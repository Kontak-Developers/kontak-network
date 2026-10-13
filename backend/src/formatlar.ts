// Format kütüphanesi (v2, 12 Ekim akşam) — patlayan videolardan sökülen
// tekrar kullanılabilir içerik kalıpları ve ömürleri.
//
// ⚠️ "TREND OLMUŞ" TANIMI: bir format birden çok turda (farklı günlerde)
//    yeniden patlayan videolarda görülüyorsa zirvede; yalnız bu tur
//    görüldüyse yükseliyor; 10 gündür görülmediyse sönüyor. Üretim
//    sönenleri kullanmıyor.

import type { Env } from './tipler';
import type { Aday, TrTrend } from './avci';
import { dizi, jsonAc, kisaId, metin, sayi, simdiIst, sinirla } from './yardimci';

type Ornek = { link: string; izlenme: number; patlama: number; hesap: string | null };

const SONME_GUN = 10;

/** Güç: sayı (0-100 ya da 0-1) ya da sözel ("yüksek/orta/düşük"). */
function gucPuani(v: unknown): number {
  if (typeof v === 'string') {
    const t = v.toLocaleLowerCase('tr');
    if (/çok yüksek/.test(t)) return 90;
    if (/yüksek|güçlü/.test(t)) return 75;
    if (/orta/.test(t)) return 55;
    if (/düşük|zayıf/.test(t)) return 30;
  }
  const n = sayi(v);
  return Math.round(sinirla(n > 0 && n <= 1 ? n * 100 : n, 0, 100));
}
const ORNEK_SINIRI = 8;

function durumHesapla(gorulme: number, ilk: string, son: string, simdi = Date.now()): string {
  if (Date.parse(son) < simdi - SONME_GUN * 86400_000) return 'sonuyor';
  // Farklı günlerde en az 3 kez → artık "trend olmuş".
  if (gorulme >= 3) return 'zirvede';
  return Date.parse(ilk) > simdi - 7 * 86400_000 ? 'yukseliyor' : 'zirvede';
}

/** Patlayanları kaydet (tur başına). */
export async function patlayanlariYaz(env: Env, runId: string, secilen: Aday[]) {
  const zaman = simdiIst();
  if (!secilen.length) return;
  await env.DB.batch(
    secilen.map((a) =>
      env.DB.prepare(
        `INSERT INTO patlayanlar (link, platform, kaynak, hesap, takipci, izlenme, begeni, yorum, paylasim, kaydetme,
           patlama, sure_sn, aciklama, ses, tarih, run_id, bulunma)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(link) DO UPDATE SET izlenme = excluded.izlenme, begeni = excluded.begeni,
           yorum = excluded.yorum, paylasim = excluded.paylasim, kaydetme = excluded.kaydetme,
           patlama = excluded.patlama, run_id = excluded.run_id`
      ).bind(
        a.link, a.platform, a.kaynak, a.hesap, a.takipci, a.izlenme, a.begeni, a.yorum, a.paylasim, a.kaydetme,
        a.patlama, a.sure_sn, a.aciklama, a.ses, a.tarih, runId, zaman
      )
    )
  );
}

export async function trTrendleriniYaz(env: Env, runId: string, liste: TrTrend[]) {
  if (!liste.length) return;
  await env.DB.batch(
    liste.map((t) =>
      env.DB.prepare(
        'INSERT OR REPLACE INTO tr_trendleri (run_id, hashtag, sira, yon, gonderi, sektor, marka_uygun) VALUES (?,?,?,?,?,?,0)'
      ).bind(runId, t.hashtag, t.sira, t.yon, t.gonderi, t.sektor)
    )
  );
}

/** Manus'a "bunlar zaten kütüphanede" diye giden özet. */
export async function mevcutFormatlar(env: Env) {
  const r = await env.DB.prepare(
    "SELECT id, ad, ozet, gorulme, durum FROM formatlar WHERE durum != 'sonuyor' ORDER BY skor DESC LIMIT 30"
  ).all();
  return r.results;
}

/** Sök çıktısını kütüphaneye işle. Döner: bu turda dokunulan format sayısı. */
export async function formatlariYaz(env: Env, runId: string, sok: any, secilen: Aday[]): Promise<number> {
  const zaman = simdiIst();
  const linkler = new Map(secilen.map((a) => [a.link, a]));
  const mevcut = new Map(
    (await env.DB.prepare('SELECT * FROM formatlar').all<any>()).results.map((f) => [f.id, f])
  );
  const stmts: D1PreparedStatement[] = [];
  let sayac = 0;

  for (const f of dizi<any>(sok?.formatlar).slice(0, 8)) {
    const ad = metin(f?.ad).slice(0, 120);
    if (!ad) continue;
    // Yalnız girdideki linkler — Manus link uydurmasın.
    const yeniOrnek: Ornek[] = dizi<string>(f?.ornek_linkler)
      .map((l) => linkler.get(l))
      .filter((a): a is Aday => !!a)
      .map((a) => ({ link: a.link, izlenme: a.izlenme, patlama: a.patlama, hesap: a.hesap }));
    const guc = gucPuani(f?.guc);
    // Manus'un ham çıktısında alan adları değişebiliyor (kanca, kontak_fikirleri[],
    // kurgu_ses_ekran_yazisi …) — ikisini de kabul et.
    const birlesik = metin(f?.kurgu_ses_ekran_yazisi);
    const fikirler = Array.isArray(f?.kontak_fikirleri)
      ? f.kontak_fikirleri.map((x: unknown, i: number) => `${i + 1}. ${metin(x)}`).join('\n')
      : '';
    const alan = {
      ozet: metin(f?.ozet).slice(0, 800),
      kanca_kalibi: metin(f?.kanca_kalibi ?? f?.kanca).slice(0, 600),
      yapi: metin(f?.yapi).slice(0, 2000),
      kurgu: metin(f?.kurgu ?? birlesik).slice(0, 900),
      ses: metin(f?.ses ?? (birlesik ? '' : '')).slice(0, 400),
      ekran_yazisi: metin(f?.ekran_yazisi).slice(0, 500),
      neden_tuttu: [metin(f?.neden_tuttu), metin(f?.guc_gerekcesi)].filter(Boolean).join(' — ').slice(0, 900),
      kontak_acisi: (metin(f?.kontak_acisi) || fikirler).slice(0, 1500),
      seslendirme: f?.seslendirme === true || f?.seslendirme === 1 || f?.seslendirme === 'evet' ? 1 : 0,
    };
    const eski = mevcut.get(metin(f?.mevcut_id));
    let id: string;
    if (eski) {
      id = eski.id;
      const ornekler = [...yeniOrnek, ...jsonAc<Ornek[]>(eski.ornekler, [])]
        .filter((o, i, d) => d.findIndex((x) => x.link === o.link) === i)
        .slice(0, ORNEK_SINIRI);
      // Aynı gün ikinci tur sayılmaz (Şimdi tara'ya üst üste basmak formatı şişirmesin).
      const yeniGun = eski.son_gorulme.slice(0, 10) !== zaman.slice(0, 10);
      const gorulme = eski.gorulme + (yeniGun ? 1 : 0);
      stmts.push(
        env.DB.prepare(
          `UPDATE formatlar SET ozet = ?, kanca_kalibi = ?, yapi = ?, kurgu = ?, ses = ?, ekran_yazisi = ?,
             neden_tuttu = ?, kontak_acisi = ?, seslendirme = ?, ornekler = ?, gorulme = ?, son_gorulme = ?,
             durum = ?, skor = ? WHERE id = ?`
        ).bind(
          alan.ozet, alan.kanca_kalibi, alan.yapi, alan.kurgu, alan.ses, alan.ekran_yazisi, alan.neden_tuttu,
          alan.kontak_acisi, alan.seslendirme, JSON.stringify(ornekler), gorulme, zaman,
          durumHesapla(gorulme, eski.ilk_gorulme, zaman), Math.max(guc, Math.round((eski.skor + guc) / 2)), id
        )
      );
    } else {
      id = kisaId('f');
      stmts.push(
        env.DB.prepare(
          `INSERT INTO formatlar (id, ad, ozet, kanca_kalibi, yapi, kurgu, ses, ekran_yazisi, neden_tuttu, kontak_acisi,
             seslendirme, ornekler, gorulme, ilk_gorulme, son_gorulme, durum, skor)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,'yukseliyor',?)`
        ).bind(
          id, ad, alan.ozet, alan.kanca_kalibi, alan.yapi, alan.kurgu, alan.ses, alan.ekran_yazisi,
          alan.neden_tuttu, alan.kontak_acisi, alan.seslendirme, JSON.stringify(yeniOrnek), zaman, zaman, guc
        )
      );
    }
    for (const o of yeniOrnek) {
      stmts.push(env.DB.prepare('UPDATE patlayanlar SET format_id = ? WHERE link = ?').bind(id, o.link));
    }
    sayac++;
  }

  // Marka için güvenli TR trendleri (Manus seçti; varsayılan uygun DEĞİL).
  for (const h of dizi<string>(sok?.tr_trend_uygun).slice(0, 15)) {
    stmts.push(
      env.DB.prepare('UPDATE tr_trendleri SET marka_uygun = 1 WHERE run_id = ? AND hashtag = ?')
        .bind(runId, metin(h).replace(/^#+/, ''))
    );
  }
  // Görülmeyenler söner.
  stmts.push(
    env.DB.prepare("UPDATE formatlar SET durum = 'sonuyor' WHERE son_gorulme < ? AND durum != 'sonuyor'")
      .bind(simdiIst(new Date(Date.now() - SONME_GUN * 86400_000)))
  );
  if (stmts.length) await env.DB.batch(stmts);
  return sayac;
}

/** Üretime giden kazanan formatlar (sönenler hariç). */
export async function kazananFormatlar(env: Env, adet = 8) {
  const r = await env.DB.prepare(
    `SELECT id, ad, ozet, kanca_kalibi, yapi, kurgu, ses, ekran_yazisi, neden_tuttu, kontak_acisi, seslendirme,
            gorulme, durum, skor, kullanim, ornekler
       FROM formatlar WHERE durum != 'sonuyor'
      ORDER BY (durum = 'zirvede') DESC, skor DESC, son_gorulme DESC LIMIT ?`
  ).bind(adet).all<any>();
  return r.results.map((f) => ({ ...f, seslendirme: f.seslendirme === 1, ornekler: jsonAc(f.ornekler, []) }));
}

export async function uygunTrTrendleri(env: Env, runId: string): Promise<string[]> {
  const r = await env.DB.prepare('SELECT hashtag FROM tr_trendleri WHERE run_id = ? AND marka_uygun = 1 ORDER BY sira')
    .bind(runId).all<{ hashtag: string }>();
  return r.results.map((x) => x.hashtag);
}

/** Harcama defteri. */
export async function harcamaYaz(env: Env, runId: string | null, servis: string, kalem: string, tutar: number, tahmini = true) {
  if (!(tutar > 0)) return;
  await env.DB.prepare('INSERT INTO harcamalar (id, run_id, servis, kalem, tutar_usd, tahmini, zaman) VALUES (?,?,?,?,?,?,?)')
    .bind(kisaId('h'), runId, servis, kalem.slice(0, 120), Math.round(tutar * 10000) / 10000, tahmini ? 1 : 0, simdiIst())
    .run();
}
