// Kreatif direktör çıktısını kaydetme (v2 Faz 2, 13 Ekim).
//
// prompts/kreatif.md → { adaylar_ozeti, icerikler[3], rota_karti }.
// İçerikler `ideas` tablosuna (panel aynı ekranda gösteriyor), çekim planı
// `uretim_plani`'na (stüdyo bunu üretiyor), rota kartı `rota_kartlari`'na.

import type { Env } from './tipler';
import type { CekimPlani } from './studyo';
import { dizi, kisaId, metin, sayi, simdiIst, sinirla } from './yardimci';

export type KreatifIcerik = { id: string; format: 'kisa_video' | 'carousel'; puan: number; plan: CekimPlani };

/** Tekrar etmesin diye son içeriklerin başlık ve kancaları. */
export async function sonIcerikler(env: Env) {
  const r = await env.DB.prepare(
    'SELECT baslik, kanca, format_id, olusturma FROM ideas ORDER BY olusturma DESC LIMIT 15'
  ).all();
  const rotalar = await env.DB.prepare('SELECT ad, il FROM rota_kartlari ORDER BY olusturma DESC LIMIT 10').all();
  return { icerikler: r.results, rotalar: rotalar.results };
}

function planCikar(x: any): CekimPlani {
  const cekimler = dizi<any>(x?.cekimler)
    .slice(0, 5)
    .map((c, i) => ({
      sira: sayi(c?.sira) || i + 1,
      sure_sn: Math.round(sinirla(sayi(c?.sure_sn) || 5, 4, 8)),
      kare_prompt: metin(c?.kare_prompt).slice(0, 900),
      hareket_prompt: metin(c?.hareket_prompt).slice(0, 600),
      hero: !!c?.hero,
      ekran_yazisi: metin(c?.ekran_yazisi).slice(0, 120),
    }))
    .filter((c) => c.kare_prompt);
  // Tam 1 hero: model hiç seçmediyse en uzun çekim; birden çoksa ilki.
  let heroVar = false;
  for (const c of cekimler) {
    if (c.hero && !heroVar) heroVar = true;
    else c.hero = false;
  }
  if (!heroVar && cekimler.length) {
    const enUzun = cekimler.reduce((a, b) => (b.sure_sn > a.sure_sn ? b : a));
    enUzun.hero = true;
  }
  return {
    cekimler,
    stil: metin(x?.stil).slice(0, 600),
    seslendirme: metin(x?.seslendirme).trim() ? metin(x.seslendirme).trim().slice(0, 600) : null,
    muzik: metin(x?.muzik).trim() ? metin(x.muzik).trim().slice(0, 300) : null,
  };
}

export async function kreatifYaz(env: Env, runId: string, k: any, gecerliFormatlar: string[]): Promise<KreatifIcerik[]> {
  const zaman = simdiIst();
  const stmts: D1PreparedStatement[] = [];
  const out: KreatifIcerik[] = [];
  const karar = (tur: string, hedef: string, neden: string) =>
    stmts.push(
      env.DB.prepare('INSERT INTO decisions (id, run_id, tur, hedef, neden, zaman) VALUES (?,?,?,?,?,?)')
        .bind(kisaId('d'), runId, tur, hedef.slice(0, 120), neden.slice(0, 400), zaman)
    );

  for (const x of dizi<any>(k?.icerikler).slice(0, 3)) {
    const baslik = metin(x?.baslik).slice(0, 140);
    if (!baslik) continue;
    const id = kisaId('i');
    const format: KreatifIcerik['format'] = x?.format === 'carousel' ? 'carousel' : 'kisa_video';
    const plan = planCikar(x);
    const formatId = gecerliFormatlar.includes(metin(x?.format_id)) ? metin(x.format_id) : null;
    const puan = Math.round(sinirla(sayi(x?.puan), 0, 50));
    // Panelin sahne kartları: çekimler → sahneler (görsel/klip sonra işlenir).
    const sahneler = plan.cekimler.map((c) => ({
      sira: c.sira, sure_sn: c.sure_sn, tur: format === 'kisa_video' ? 'video' : 'foto',
      prompt: c.kare_prompt, ekran_yazisi: c.ekran_yazisi, tasarim: null,
    }));
    stmts.push(
      env.DB.prepare(
        `INSERT INTO ideas (id, run_id, trend_id, platform, format, baslik, kanca, senaryo, aciklama_metni, hashtagler,
           gorsel_prompt, durum, sahneler, onerilen_ses, olusturma, format_id, puan, puan_gerekce, neden_simdi,
           uretim_plani, reel_durum)
         VALUES (?,?,NULL,?,?,?,?,?,?,?,?,'yeni',?,?,?,?,?,?,?,?,?)`
      ).bind(
        id, runId, x?.platform === 'instagram' ? 'instagram' : 'tiktok', format, baslik,
        metin(x?.kanca).slice(0, 300),
        JSON.stringify(dizi<string>(x?.senaryo).map((s) => metin(s)).slice(0, 12)),
        metin(x?.aciklama_metni).slice(0, 2200),
        JSON.stringify(dizi<string>(x?.hashtagler).map((h) => metin(h)).slice(0, 10)),
        plan.stil,
        JSON.stringify(sahneler),
        metin(x?.onerilen_ses).trim() ? metin(x.onerilen_ses).slice(0, 120) : null,
        zaman, formatId, puan, metin(x?.puan_gerekce).slice(0, 600), metin(x?.neden_simdi).slice(0, 600),
        JSON.stringify(plan), format === 'kisa_video' ? 'bekliyor' : null
      )
    );
    if (formatId) stmts.push(env.DB.prepare('UPDATE formatlar SET kullanim = kullanim + 1 WHERE id = ?').bind(formatId));
    karar('icerik_uret', baslik, `${format === 'kisa_video' ? 'Reel' : 'Carousel'} · ${puan}/50 · ${metin(x?.neden_simdi)}`);
    out.push({ id, format, puan, plan });
  }
  if (metin(k?.adaylar_ozeti)) karar('adaylar', 'Bugünün 6 adayı', metin(k.adaylar_ozeti));
  if (stmts.length) await env.DB.batch(stmts);
  return out;
}

/** Rota kartını kaydet; görsel sonra (stüdyo kare üretimi). */
export async function rotaKartiYaz(env: Env, runId: string, r: any): Promise<{ id: string; prompt: string } | null> {
  const ad = metin(r?.ad).slice(0, 120);
  if (!ad) return null;
  const id = kisaId('r');
  const satirlar = (v: unknown) => metin(v).split('\n').map((x) => x.trim()).filter(Boolean);
  await env.DB.prepare(
    `INSERT INTO rota_kartlari (id, run_id, ad, il, baslangic, bitis, duraklar, km, sure_dk, en_iyi_zaman, zorluk,
       yol_tipi, neden_git, gorsel_prompt, kaynaklar, olusturma)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, runId, ad, metin(r?.il).slice(0, 60), metin(r?.baslangic).slice(0, 120), metin(r?.bitis).slice(0, 120),
    JSON.stringify(satirlar(r?.duraklar).slice(0, 10)), sayi(r?.km) || null, Math.round(sayi(r?.sure_dk)) || null,
    metin(r?.en_iyi_zaman).slice(0, 200), ['kolay', 'orta', 'zor'].includes(r?.zorluk) ? r.zorluk : 'orta',
    metin(r?.yol_tipi).slice(0, 120), metin(r?.neden_git).slice(0, 800), metin(r?.kare_prompt).slice(0, 900),
    JSON.stringify(satirlar(r?.kaynaklar).filter((l) => /^https?:\/\//.test(l)).slice(0, 8)), simdiIst()
  ).run();
  return { id, prompt: metin(r?.kare_prompt) };
}
