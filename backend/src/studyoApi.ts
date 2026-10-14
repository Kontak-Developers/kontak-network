// Stüdyo sekmesinin uçları (13 Ekim akşam). Sözleşme: SOZLESME.md "Stüdyo".
//
// Ajanın her ayarı, görsel kimlik, promptlar, stok üretimi, yazı gömme,
// format ve rota kararları, metin düzenleme. Yetki index.ts'te (moderatör
// jetonu ya da ajan hesabı); burada yalnız iş.

import type { Env, RunParams } from './tipler';
import { ayarlariOku, ayarlariYaz, VARSAYILAN_AYARLAR } from './ayarlar';
import { promptAl, promptMetni, type PromptAdi } from './brain';
import { markaOku } from './db';
import { denetliUret, gorselKimlikEki, hamFotoAyarla, kareDenetle, kartUret, type CekimPlani } from './studyo';
import { carouselYazilari } from './workflow';
import { sahnePromptu, r2yeYaz } from './fal';
import { harcamaYaz } from './formatlar';
import { dizi, hata, json, jsonAc, kisaId, metin, sayi, simdiIst } from './yardimci';

const PROMPTLAR: PromptAdi[] = ['sok', 'kreatif', 'analiz', 'uretim', 'haftalik'];
const ROTA_DURUM = new Set(['taslak', 'onaylandi', 'reddedildi']);
const FORMAT_KARAR = new Set(['sabit', 'kapali']);

export type RunBaslatici = (ek: Partial<RunParams>, ozet: string) => Promise<string>;

export async function studyoApi(
  req: Request,
  env: Env,
  url: URL,
  kim: string,
  medyaOnek: string,
  runBaslat: RunBaslatici
): Promise<Response | null> {
  const yol = url.pathname;
  const m = req.method;
  const DB = env.DB;
  const govde = async () => (await req.json().catch(() => null)) as any;

  // ── Genel bakış: ayarlar, kimlik, promptlar, bütçe, süren işler ──
  if (yol === '/api/studyo' && m === 'GET') {
    const [ayarlar, marka, ozel, bugun, toplam, suren] = await Promise.all([
      ayarlariOku(env),
      markaOku(env),
      DB.prepare('SELECT ad, guncelleme, guncelleyen FROM prompt_ozel').all<any>(),
      DB.prepare('SELECT servis, ROUND(SUM(tutar_usd), 2) AS usd FROM harcamalar WHERE zaman >= ? GROUP BY servis').bind(simdiIst().slice(0, 10)).all<any>(),
      DB.prepare('SELECT servis, ROUND(SUM(tutar_usd), 2) AS usd FROM harcamalar GROUP BY servis').all<any>(),
      DB.prepare(
        `SELECT r.id, r.ozet, r.adim, r.baslangic,
                (SELECT COUNT(*) FROM ideas i WHERE i.run_id = r.id) AS icerik,
                (SELECT COUNT(*) FROM ideas i WHERE i.run_id = r.id AND (i.reel_durum = 'hazir' OR (i.format = 'carousel' AND i.gorsel_anahtar IS NOT NULL))) AS hazir
           FROM runs r WHERE r.durum = 'calisiyor' AND r.baslangic > ? ORDER BY r.baslangic DESC`
      ).bind(simdiIst(new Date(Date.now() - 6 * 3600_000))).all<any>(),
    ]);
    const ozelMap = new Map(ozel.results.map((p) => [p.ad, p]));
    return json({
      ayarlar,
      varsayilan: VARSAYILAN_AYARLAR,
      kimlik: (marka as any).gorsel_kimlik ?? null,
      rehber: (marka as any).rehber ?? null,
      promptlar: PROMPTLAR.map((ad) => ({
        ad,
        ozel: ozelMap.has(ad),
        guncelleme: ozelMap.get(ad)?.guncelleme ?? null,
        guncelleyen: ozelMap.get(ad)?.guncelleyen ?? null,
      })),
      harcama: { bugun: bugun.results, toplam: toplam.results, tavan: ayarlar.butce.fal_gunluk_tavan },
      suren: suren.results,
    });
  }

  if (yol === '/api/studyo/ayarlar' && m === 'PUT') {
    const b = await govde();
    if (!b || typeof b !== 'object') return hata('gecersiz', 'Ayarlar JSON nesnesi olmalı.', 400);
    return json(await ayarlariYaz(env, b, kim));
  }

  // ── Görsel kimlik: brands.veri.gorsel_kimlik ──
  if (yol === '/api/studyo/kimlik' && m === 'PUT') {
    const b = await govde();
    if (!b || typeof b !== 'object' || Array.isArray(b)) return hata('gecersiz', 'Kimlik nesne olmalı.', 400);
    if (!metin(b.stil_eki).trim()) return hata('gecersiz', 'Stil eki boş olamaz: her karenin ortak dili o.', 400);
    if (JSON.stringify(b).length > 40_000) return hata('buyuk', 'Kimlik çok uzun.', 413);
    const r = await DB.prepare("SELECT veri FROM brands WHERE id = 'kontak'").first<{ veri: string }>();
    const marka = jsonAc<any>(r?.veri, { id: 'kontak', ad: 'Kontak' });
    marka.gorsel_kimlik = { ...b, surum: simdiIst().slice(0, 10), guncelleyen: kim };
    await DB.prepare("UPDATE brands SET veri = ?, guncelleme = ? WHERE id = 'kontak'").bind(JSON.stringify(marka), simdiIst()).run();
    return json(marka.gorsel_kimlik);
  }

  // Marka rehberi (Şevval): üreticilerin ve ajanın uyduğu yazılı kurallar. Kreatif girdisine `marka.rehber` olarak gider.
  if (yol === '/api/studyo/rehber' && m === 'PUT') {
    const b = await govde();
    const yeni = metin(b?.metin).trim();
    if (yeni.length < 200) return hata('gecersiz', 'Rehber çok kısa görünüyor; tamamını yapıştır.', 400);
    if (yeni.length > 30_000) return hata('buyuk', 'Rehber çok uzun (en fazla 30.000 karakter).', 413);
    const r = await DB.prepare("SELECT veri FROM brands WHERE id = 'kontak'").first<{ veri: string }>();
    const marka = jsonAc<any>(r?.veri, { id: 'kontak', ad: 'Kontak' });
    marka.rehber = { metin: yeni, surum: simdiIst().slice(0, 10), guncelleyen: kim };
    await DB.prepare("UPDATE brands SET veri = ?, guncelleme = ? WHERE id = 'kontak'").bind(JSON.stringify(marka), simdiIst()).run();
    return json(marka.rehber);
  }

  // Kimliği tek karede dene (Flux Ultra, ~0,06$): kimlik düzenlerken sonucu görmek için.
  if (yol === '/api/studyo/kimlik/dene' && m === 'POST') {
    const b = await govde();
    const prompt = metin(b?.prompt).trim();
    if (prompt.length < 20) return hata('gecersiz', 'Denemek için en az bir cümlelik sahne yaz.', 400);
    const marka = await markaOku(env);
    const kimlik = gorselKimlikEki(b?.kimlik ? { gorsel_kimlik: b.kimlik } : marka);
    const karakter = metin(b?.karakter);
    const id = kisaId('o');
    const anahtar = await r2yeYaz(env, await kartUret(env, sahnePromptu(prompt, [karakter, kimlik].filter(Boolean).join('. '))), `onizleme/${id}.jpg`);
    await harcamaYaz(env, null, 'fal', 'flux-ultra (kimlik denemesi)', 0.06);
    return json({ url: `${medyaOnek}${anahtar}` });
  }

  // Tek görsel denetimi (panel ve hata ayıklama): yazı, yüz, logo, bozuk motor.
  if (yol === '/api/studyo/denetle' && m === 'POST') {
    const b = await govde();
    const u = metin(b?.url);
    if (!/^https:\/\//.test(u)) return hata('gecersiz', 'url https olmalı.', 400);
    const ayar = await ayarlariOku(env);
    return json(await kareDenetle(env, u, ayar.studyo.denetim_modeli));
  }

  // ── Uygulama ekranları (ürün yerleştirme): gerçek ekran görüntüleri ──
  // Gövde ham görsel; ad ve açıklama sorgu dizgesinde. Liste markanın görsel
  // kimliğinde (kreatif direktör okuyup carousel'de "uygulama_ekrani" seçiyor).
  if (yol === '/api/studyo/ekran' && m === 'POST') {
    const tur = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!/^image\/(png|jpeg|webp)$/.test(tur)) return hata('gecersiz', 'PNG, JPG ya da WEBP yükle.', 400);
    const veri = await req.arrayBuffer();
    if (!veri.byteLength || veri.byteLength > 8 * 1024 * 1024) return hata('buyuk', 'Görsel en fazla 8 MB.', 413);
    const ad = (url.searchParams.get('ad') ?? '').trim().slice(0, 60) || 'Ekran';
    const aciklama = (url.searchParams.get('aciklama') ?? '').trim().slice(0, 200);
    const id = kisaId('e');
    const anahtar = `uygulama/${id}.${tur === 'image/png' ? 'png' : tur === 'image/webp' ? 'webp' : 'jpg'}`;
    await env.MEDYA.put(anahtar, veri, { httpMetadata: { contentType: tur } });
    const r = await DB.prepare("SELECT veri FROM brands WHERE id = 'kontak'").first<{ veri: string }>();
    const marka = jsonAc<any>(r?.veri, { id: 'kontak', ad: 'Kontak' });
    marka.gorsel_kimlik ??= {};
    const liste = dizi<any>(marka.gorsel_kimlik.uygulama_ekranlari);
    liste.push({ id, ad, aciklama, anahtar });
    marka.gorsel_kimlik.uygulama_ekranlari = liste.slice(-20);
    await DB.prepare("UPDATE brands SET veri = ?, guncelleme = ? WHERE id = 'kontak'").bind(JSON.stringify(marka), simdiIst()).run();
    return json({ id, ad, aciklama, anahtar, url: `${medyaOnek}${anahtar}` }, 201);
  }
  const ekranSil = yol.match(/^\/api\/studyo\/ekran\/([A-Za-z0-9_-]{1,40})$/);
  if (ekranSil && m === 'DELETE') {
    const r = await DB.prepare("SELECT veri FROM brands WHERE id = 'kontak'").first<{ veri: string }>();
    const marka = jsonAc<any>(r?.veri, {});
    const liste = dizi<any>(marka.gorsel_kimlik?.uygulama_ekranlari);
    const silinen = liste.find((e) => e?.id === ekranSil[1]);
    if (!silinen) return hata('yok', 'Ekran bulunamadı.', 404);
    marka.gorsel_kimlik.uygulama_ekranlari = liste.filter((e) => e?.id !== ekranSil[1]);
    await DB.prepare("UPDATE brands SET veri = ?, guncelleme = ? WHERE id = 'kontak'").bind(JSON.stringify(marka), simdiIst()).run();
    await env.MEDYA.delete(metin(silinen.anahtar)).catch(() => undefined);
    return json({ ok: true });
  }

  // ── Promptlar ──
  const prompt = yol.match(/^\/api\/studyo\/promptlar\/([a-z]{3,12})$/);
  if (prompt) {
    const ad = prompt[1] as PromptAdi;
    if (!PROMPTLAR.includes(ad)) return hata('yok', 'Böyle bir prompt yok.', 404);
    if (m === 'GET') {
      const ozel = await DB.prepare('SELECT metin, guncelleme, guncelleyen FROM prompt_ozel WHERE ad = ?').bind(ad).first<any>();
      return json({ ad, dosya: promptMetni(ad), ozel: ozel ?? null, gecerli: await promptAl(env, ad) });
    }
    if (m === 'PUT') {
      const b = await govde();
      const t = metin(b?.metin);
      if (t.trim().length < 200) return hata('gecersiz', 'Prompt en az 200 karakter olmalı (yanlışlıkla boşaltılmasın).', 400);
      if (t.length > 60_000) return hata('buyuk', 'Prompt çok uzun.', 413);
      await DB.prepare(
        'INSERT INTO prompt_ozel (ad, metin, guncelleme, guncelleyen) VALUES (?, ?, ?, ?) ON CONFLICT(ad) DO UPDATE SET metin = excluded.metin, guncelleme = excluded.guncelleme, guncelleyen = excluded.guncelleyen'
      ).bind(ad, t, simdiIst(), kim).run();
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      await DB.prepare('DELETE FROM prompt_ozel WHERE ad = ?').bind(ad).run();
      return json({ ok: true });
    }
  }

  // ── Stok üretimi ──
  if (yol === '/api/studyo/stok' && m === 'POST') {
    const b = await govde();
    const ayar = await ayarlariOku(env);
    const tur = Math.round(sayi(b?.tur));
    if (tur < 1 || tur > 8) return hata('gecersiz', 'Tur sayısı 1-8 arası olmalı.', 400);
    const tavan = sayi(b?.tavan) || ayar.butce.fal_gunluk_tavan;
    if (tavan > 200) return hata('gecersiz', 'Günlük tavan en fazla 200$.', 400);
    // Aynı anda en fazla 2 stok: ikisi aynı son_icerikler'i okuyup tekrar üretmesin, kredi kontrolden çıkmasın.
    const suren = await DB.prepare("SELECT COUNT(*) AS n FROM runs WHERE durum = 'calisiyor' AND id LIKE 'stok_%' AND baslangic > ?")
      .bind(simdiIst(new Date(Date.now() - 4 * 3600_000))).first<{ n: number }>();
    if ((suren?.n ?? 0) >= 2) return hata('zaten_calisiyor', 'Şu an 2 stok üretimi sürüyor; biri bitince yenisini başlat.', 409);
    const odaklar = dizi<string>(b?.odaklar).map((x) => metin(x).trim()).filter(Boolean).slice(0, 8);
    const karisim = metin(b?.karisim).trim().slice(0, 60) || ayar.kreatif.karisim;
    const id = await runBaslat(
      { stok: { tur, tavan, karisim, odaklar: odaklar.length ? odaklar : ayar.kreatif.odaklar } },
      `Stok: ${tur} tur · ${karisim}${odaklar.length ? ` · ${odaklar.join(' / ').slice(0, 160)}` : ''}`
    );
    return json({ id }, 202);
  }

  if (yol === '/api/studyo/yazi' && m === 'POST') {
    const b = await govde();
    const ids = dizi<string>(b?.ids).map((x) => metin(x)).filter((x) => /^[A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, 60);
    const id = await runBaslat({ yazi: { ids } }, ids.length ? `Yazı gömme: ${ids.length} içerik` : 'Yazı gömme: eksik olanların hepsi');
    return json({ id }, 202);
  }

  // Bütçeden atlanan / hata veren reelleri mevcut planla yeniden üret.
  if (yol === '/api/studyo/reel' && m === 'POST') {
    const b = await govde();
    const ids = dizi<string>(b?.ids).map((x) => metin(x)).filter((x) => /^[A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, 12);
    if (!ids.length) return hata('gecersiz', 'En az bir reel seç.', 400);
    const ayar = await ayarlariOku(env);
    const tavan = Math.min(200, sayi(b?.tavan) || Math.max(ayar.butce.fal_gunluk_tavan, 60));
    // yeniden: true → hazır reel de yeni kurallarla baştan üretilir; eski yazılı sürüm düşer (yazı artık panelde katman).
    const yeniden = b?.yeniden === true;
    await DB.prepare(
      `UPDATE ideas SET reel_durum = 'bekliyor'${yeniden ? ', yazili_anahtar = NULL' : ''} WHERE id IN (${ids.map(() => '?').join(',')})${yeniden ? '' : " AND COALESCE(reel_durum, '') != 'hazir'"}`
    ).bind(...ids).run();
    const id = await runBaslat({ reel: { ids, tavan } }, `Reel yeniden üretim: ${ids.length} reel`);
    return json({ id }, 202);
  }

  // ── Tek carousel kartını yeniden üret (14 Eki: tabela kaçan kart) ──
  // Yeni kimlik ve kurallarla (denetimli, 3 denemeye kadar), sonra yazı yeniden gömülür.
  const kart = yol.match(/^\/api\/studyo\/kart\/([A-Za-z0-9_-]{1,40})\/(\d{1,2})$/);
  if (kart && m === 'POST') {
    const [, fikirId, sira] = kart;
    const i = Number(sira);
    const r = await DB.prepare("SELECT run_id, format, sahneler, uretim_plani FROM ideas WHERE id = ?").bind(fikirId).first<any>();
    if (!r || r.format !== 'carousel') return hata('yok', 'Carousel bulunamadı.', 404);
    const plan = jsonAc<CekimPlani | null>(r.uretim_plani, null);
    const sahneler = jsonAc<any[]>(r.sahneler, []);
    const ck = plan?.cekimler?.[i];
    if (!ck || !sahneler[i]) return hata('yok', 'Kart bulunamadı.', 404);
    if (ck.uygulama_ekrani) return hata('gecersiz', 'Bu kart gerçek uygulama ekranı; yeniden üretilmez.', 400);
    if (!ck.kare_prompt) return hata('gecersiz', 'Kartın görsel tarifi yok.', 400);
    const ayar = await ayarlariOku(env);
    hamFotoAyarla(ayar.studyo.ham_foto);
    const kimlik = gorselKimlikEki(await markaOku(env));
    const stil = [plan!.stil, kimlik].filter(Boolean).join('. ');
    const x = await denetliUret(
      env,
      (ek) => kartUret(env, sahnePromptu(ek ? `${ck.kare_prompt}. ${ek}` : ck.kare_prompt, stil)),
      { acik: ayar.studyo.kalite_denetimi, model: ayar.studyo.denetim_modeli }
    );
    const anahtar = await r2yeYaz(env, x.url, `${r.run_id}/${fikirId}-${i + 1}-v${Date.now().toString(36)}.jpg`);
    const { yazili_anahtar, ...geri } = sahneler[i];
    sahneler[i] = { ...geri, gorsel_anahtar: anahtar };
    await DB.prepare('UPDATE ideas SET sahneler = ?, gorsel_anahtar = CASE WHEN ? = 0 THEN ? ELSE gorsel_anahtar END WHERE id = ?')
      .bind(JSON.stringify(sahneler), i, anahtar, fikirId).run();
    await harcamaYaz(env, r.run_id, 'fal', 'kart yeniden üretim (panel)', x.deneme * 0.06);
    // Kart önceden yazılıysa seri tutarlı kalsın diye yeniden gömülür; yazısız içerik yazısız kalır.
    if (ayar.studyo.yazi_gom || yazili_anahtar) await carouselYazilari(env, fikirId, ayar.studyo.imza);
    return json({ ok: true, deneme: x.deneme, temiz: x.denetim?.temiz ?? true, sorunlar: x.denetim?.sorunlar ?? [] });
  }

  // ── Format kararı ──
  const format = yol.match(/^\/api\/formats\/([A-Za-z0-9_-]{1,40})$/);
  if (format && m === 'PATCH') {
    const b = await govde();
    const karar = b?.panel_karari === null ? null : metin(b?.panel_karari);
    if (karar !== null && !FORMAT_KARAR.has(karar)) return hata('gecersiz', 'panel_karari: sabit | kapali | null', 400);
    const r = await DB.prepare('UPDATE formatlar SET panel_karari = ? WHERE id = ? RETURNING id, panel_karari').bind(karar, format[1]).first();
    return r ? json(r) : hata('yok', 'Format bulunamadı.', 404);
  }

  // ── Rota kartı kararı ──
  const rota = yol.match(/^\/api\/rota-kartlari\/([A-Za-z0-9_-]{1,40})$/);
  if (rota && m === 'PATCH') {
    const b = await govde();
    if (!ROTA_DURUM.has(b?.durum)) return hata('gecersiz', 'durum: taslak | onaylandi | reddedildi', 400);
    const kart = await DB.prepare('SELECT * FROM rota_kartlari WHERE id = ?').bind(rota[1]).first<any>();
    if (!kart) return hata('yok', 'Rota kartı bulunamadı.', 404);
    if (b.durum !== 'onaylandi') {
      await DB.prepare('UPDATE rota_kartlari SET durum = ? WHERE id = ?').bind(b.durum, kart.id).run();
      return json({ id: kart.id, durum: b.durum });
    }
    if (kart.kontak_rota_id) return json({ id: kart.id, durum: 'uygulamaya_gonderildi', kontak_rota_id: kart.kontak_rota_id });
    // Onay = uygulamaya gönder (dev). Kontak tarafı yer adlarını koordinata çevirip çizgiyi çiziyor,
    // rotayı moderatör onay kuyruğuna koyuyor.
    if (!env.KONTAK_AJAN_ANAHTARI) return hata('yapilandirma', 'Uygulama bağlantı anahtarı tanımlı değil.', 503);
    const duraklar = [kart.baslangic, ...jsonAc<string[]>(kart.duraklar, []), kart.bitis].map((x) => metin(x).trim()).filter(Boolean);
    const y = await env.KONTAK_API_ROTA.fetch(
      new Request('https://kontak-api-dev/api/ajan/rota-oneri', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ajan-anahtari': env.KONTAK_AJAN_ANAHTARI },
        body: JSON.stringify({
          ad: kart.ad, sehir: kart.il, aciklama: kart.neden_git, enIyiZaman: kart.en_iyi_zaman,
          zorluk: kart.zorluk, duraklar,
        }),
      })
    );
    const sonuc: any = await y.json().catch(() => null);
    if (!y.ok || !sonuc?.id) {
      return hata('gonderilemedi', sonuc?.hata?.mesaj ?? `Uygulamaya gönderilemedi (${y.status}).`, 502);
    }
    // Kapak ayrı istekte ham görsel (Kontak API: JSON 256 KB, görsel 2 MB sınırı).
    if (kart.gorsel_anahtar) {
      const o = await env.MEDYA.get(kart.gorsel_anahtar);
      if (o && o.size < 2 * 1024 * 1024) {
        await env.KONTAK_API_ROTA.fetch(
          new Request(`https://kontak-api-dev/api/ajan/rota-oneri/${encodeURIComponent(sonuc.id)}/kapak`, {
            method: 'PUT',
            headers: { 'content-type': o.httpMetadata?.contentType ?? 'image/jpeg', 'x-ajan-anahtari': env.KONTAK_AJAN_ANAHTARI },
            body: await o.arrayBuffer(),
          })
        ).catch(() => null); // kapaksız da olur
      }
    }
    await DB.prepare("UPDATE rota_kartlari SET durum = 'uygulamaya_gonderildi', kontak_rota_id = ? WHERE id = ?").bind(sonuc.id, kart.id).run();
    return json({ id: kart.id, durum: 'uygulamaya_gonderildi', kontak_rota_id: sonuc.id, km: Math.round(sonuc.mesafeM / 1000) });
  }

  // ── İçerik metni düzenleme (kanca, açıklama, etiketler, ekran yazıları) ──
  const metinUcu = yol.match(/^\/api\/ideas\/([A-Za-z0-9_-]{1,40})\/metin$/);
  if (metinUcu && m === 'PATCH') {
    const b = await govde();
    const r = await DB.prepare('SELECT * FROM ideas WHERE id = ?').bind(metinUcu[1]).first<any>();
    if (!r) return hata('yok', 'İçerik bulunamadı.', 404);
    const kanca = typeof b?.kanca === 'string' ? b.kanca.slice(0, 300) : r.kanca;
    const aciklama = typeof b?.aciklama_metni === 'string' ? b.aciklama_metni.slice(0, 2200) : r.aciklama_metni;
    const etiketler = Array.isArray(b?.hashtagler)
      ? JSON.stringify(dizi<string>(b.hashtagler).map((h) => metin(h).trim()).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`)).slice(0, 15))
      : r.hashtagler;
    let sahneler = jsonAc<any[]>(r.sahneler, []);
    let plan = jsonAc<any>(r.uretim_plani, null);
    let yaziDegisti = false;
    if (Array.isArray(b?.ekran_yazilari)) {
      const yeni = dizi<string>(b.ekran_yazilari).map((x) => metin(x).slice(0, 220));
      sahneler = sahneler.map((s, i) => {
        if (i >= yeni.length || yeni[i] === (s.ekran_yazisi ?? '')) return s;
        yaziDegisti = true;
        const { yazili_anahtar, ...geri } = s;
        return { ...geri, ekran_yazisi: yeni[i] };
      });
      if (plan?.cekimler) plan = { ...plan, cekimler: plan.cekimler.map((c: any, i: number) => (i < yeni.length ? { ...c, ekran_yazisi: yeni[i] } : c)) };
    }
    const g = await DB.prepare(
      `UPDATE ideas SET kanca = ?, aciklama_metni = ?, hashtagler = ?, sahneler = ?, uretim_plani = ?,
         yazili_anahtar = CASE WHEN ? THEN NULL ELSE yazili_anahtar END WHERE id = ? RETURNING id`
    ).bind(kanca, aciklama, etiketler, JSON.stringify(sahneler), plan ? JSON.stringify(plan) : null, yaziDegisti ? 1 : 0, r.id).first();
    // Yalnız önceden yazılı sürümü olan içerik yeniden gömülür; yazısız akışta (rehber) metin sadece katman olarak değişir.
    const yaziliVardi = !!r.yazili_anahtar || jsonAc<any[]>(r.sahneler, []).some((s) => s.yazili_anahtar);
    return json({ ok: !!g, yazi_yeniden_gomulmeli: yaziDegisti && yaziliVardi });
  }

  return null;
}
