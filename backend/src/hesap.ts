// Büyüme Ajanı hesapları (13 Ekim) — e-posta + şifre, yalnız /ag.
//
// Burak: "sosyal medyacı kuzenime hesap açmamız lazım … authenticator'a
// gerek yok, şifreyle girse yeter". Kontak moderatör hesabı VERİLMEDİ:
// o hesap kullanıcı kişisel verilerine erişiyor ve iki adım zorunlu; ajanı
// kullanmak için bunların hiçbiri gerekmiyor (KVKK: en az yetki).
//
// Şifre: PBKDF2-SHA256, 100.000 tur (Workers WebCrypto üst sınırı), 16 bayt
// tuz. Oturum jetonu "ag_" + 32 rastgele bayt; D1'de yalnız SHA-256 özeti.
// Kaba kuvvet: e-posta başına 15 dakikada 8 başarısız deneme.

import type { Env } from './tipler';
import { simdiIst } from './yardimci';

const TUR = 100_000;
const OTURUM_GUN = 14;
const DENEME_SINIRI = 8;
const DENEME_PENCERE_MS = 15 * 60_000;

const hex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
const hexten = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

export async function sifreOzeti(sifre: string, tuzHex: string): Promise<string> {
  const anahtar = await crypto.subtle.importKey('raw', new TextEncoder().encode(sifre), 'PBKDF2', false, ['deriveBits']);
  const bit = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexten(tuzHex), iterations: TUR },
    anahtar,
    256
  );
  return hex(bit);
}

async function sha256(metin: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(metin)));
}

/** Sabit zamanlı karşılaştırma (zamanlama saldırısı yok). */
function esit(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let f = 0;
  for (let i = 0; i < a.length; i++) f |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return f === 0;
}

/** "şevval@" ile "sevval@" aynı hesap: Türkçe harfler ASCII'ye. */
export function epostaNormal(e: string): string {
  const tablo: Record<string, string> = { ş: 's', ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ü: 'u' };
  return e.trim().toLocaleLowerCase('tr').replace(/[şçğıöü]/g, (h) => tablo[h]);
}

export type GirisSonucu =
  | { ok: true; jeton: string; ad: string; eposta: string }
  | { ok: false; kod: 'gecersiz' | 'cok_deneme' };

export async function giris(env: Env, epostaHam: string, sifre: string): Promise<GirisSonucu> {
  const eposta = epostaNormal(epostaHam);
  const simdi = Date.now();
  const deneme = await env.DB.prepare('SELECT COUNT(*) AS n FROM ag_giris_denemeleri WHERE eposta = ? AND zaman > ?')
    .bind(eposta, simdi - DENEME_PENCERE_MS).first<{ n: number }>();
  if ((deneme?.n ?? 0) >= DENEME_SINIRI) return { ok: false, kod: 'cok_deneme' };

  const k = await env.DB.prepare('SELECT * FROM ag_kullanicilar WHERE eposta = ? AND aktif = 1')
    .bind(eposta).first<{ id: string; ad: string; eposta: string; sifre_ozet: string; tuz: string }>();
  // Kullanıcı yoksa da aynı işi yap: "böyle bir e-posta var mı" zamanlamadan anlaşılmasın.
  const ozet = await sifreOzeti(sifre, k?.tuz ?? '00'.repeat(16));
  if (!k || !esit(ozet, k.sifre_ozet)) {
    await env.DB.prepare('INSERT INTO ag_giris_denemeleri (eposta, zaman) VALUES (?, ?)').bind(eposta, simdi).run();
    return { ok: false, kod: 'gecersiz' };
  }

  const jeton = 'ag_' + hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.batch([
    env.DB.prepare('INSERT INTO ag_oturumlar (jeton_ozet, kullanici_id, bitis) VALUES (?, ?, ?)')
      .bind(await sha256(jeton), k.id, simdi + OTURUM_GUN * 86400_000),
    env.DB.prepare('UPDATE ag_kullanicilar SET son_giris = ? WHERE id = ?').bind(simdiIst(), k.id),
    env.DB.prepare('DELETE FROM ag_giris_denemeleri WHERE eposta = ?').bind(eposta),
    env.DB.prepare('DELETE FROM ag_oturumlar WHERE bitis < ?').bind(simdi),
  ]);
  return { ok: true, jeton, ad: k.ad, eposta: k.eposta };
}

/** Geçerli ajan oturumu mu? Kullanıcıyı döner. */
export async function oturum(env: Env, jeton: string): Promise<{ id: string; ad: string; eposta: string } | null> {
  if (!jeton.startsWith('ag_') || jeton.length > 80) return null;
  return env.DB.prepare(
    `SELECT k.id, k.ad, k.eposta FROM ag_oturumlar o JOIN ag_kullanicilar k ON k.id = o.kullanici_id
      WHERE o.jeton_ozet = ? AND o.bitis > ? AND k.aktif = 1`
  ).bind(await sha256(jeton), Date.now()).first();
}

export async function cikis(env: Env, jeton: string) {
  await env.DB.prepare('DELETE FROM ag_oturumlar WHERE jeton_ozet = ?').bind(await sha256(jeton)).run();
}

/** Şifre değiştir: eski doğru olmalı; bütün oturumlar kapanır, yenisi açılmaz. */
export async function sifreDegistir(env: Env, kullaniciId: string, eski: string, yeni: string): Promise<boolean> {
  const k = await env.DB.prepare('SELECT sifre_ozet, tuz FROM ag_kullanicilar WHERE id = ?')
    .bind(kullaniciId).first<{ sifre_ozet: string; tuz: string }>();
  if (!k || !esit(await sifreOzeti(eski, k.tuz), k.sifre_ozet)) return false;
  const tuz = hex(crypto.getRandomValues(new Uint8Array(16)));
  await env.DB.batch([
    env.DB.prepare('UPDATE ag_kullanicilar SET sifre_ozet = ?, tuz = ? WHERE id = ?').bind(await sifreOzeti(yeni, tuz), tuz, kullaniciId),
    env.DB.prepare('DELETE FROM ag_oturumlar WHERE kullanici_id = ?').bind(kullaniciId),
  ]);
  return true;
}
