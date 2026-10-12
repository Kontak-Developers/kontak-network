// D1 okuma/yazma ve satır → sözleşme şekli dönüşümleri.

import type { Brand, Env, Gonderi } from './tipler';
import { jsonAc, simdiIst } from './yardimci';

export async function markaOku(env: Env): Promise<Brand> {
  const r = await env.DB.prepare("SELECT veri FROM brands WHERE id = 'kontak'").first<{ veri: string }>();
  return jsonAc<Brand>(r?.veri, { id: 'kontak', ad: 'Kontak' });
}

export async function gonderileriYaz(env: Env, gonderiler: Gonderi[], runId: string) {
  const taranma = simdiIst();
  // Aynı link tekrar gelirse yalnız istatistikler tazelenir.
  const sql = `INSERT INTO posts (link, platform, hesap, aciklama, hashtagler, ses, format, izlenme, begeni, yorum, paylasim, tarih, taranma, run_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(link) DO UPDATE SET izlenme = excluded.izlenme, begeni = excluded.begeni,
      yorum = excluded.yorum, paylasim = excluded.paylasim, taranma = excluded.taranma`;
  for (let i = 0; i < gonderiler.length; i += 50) {
    await env.DB.batch(
      gonderiler.slice(i, i + 50).map((g) =>
        env.DB.prepare(sql).bind(
          g.link, g.platform, g.hesap, g.aciklama, JSON.stringify(g.hashtagler), g.ses, g.format,
          g.izlenme, g.begeni, g.yorum, g.paylasim, new Date(g.tarih).toISOString(), taranma, runId
        )
      )
    );
  }
}

export async function gonderileriOku(env: Env, gun: number): Promise<Gonderi[]> {
  const sinir = new Date(Date.now() - gun * 86400_000).toISOString();
  const r = await env.DB.prepare('SELECT * FROM posts WHERE tarih >= ?').bind(sinir).all<any>();
  return r.results.map((p) => ({ ...p, hashtagler: jsonAc<string[]>(p.hashtagler, []) }));
}

// ─────────────── Satır → API ───────────────

export function runCikti(r: any) {
  return {
    id: r.id,
    tetik: r.tetik,
    durum: r.durum,
    adim: r.adim,
    baslangic: r.baslangic,
    bitis: r.bitis ?? null,
    taranan_gonderi: r.taranan_gonderi,
    ozet: r.ozet,
    hata: r.hata ?? null,
    manus_linkleri: jsonAc<string[]>(r.manus_linkleri, []),
  };
}

export function trendCikti(t: any) {
  return { ...t, ornek_linkler: jsonAc<string[]>(t.ornek_linkler, []) };
}

/** medyaOnek: R2 anahtarını panelin erişebileceği adrese çevirir. */
export function fikirCikti(i: any, medyaOnek: string) {
  const { gorsel_anahtar, video_anahtar, olusturma, ...geri } = i;
  return {
    ...geri,
    senaryo: jsonAc<string[]>(i.senaryo, []),
    hashtagler: jsonAc<string[]>(i.hashtagler, []),
    sahneler: jsonAc<unknown[]>(i.sahneler, []),
    rota: jsonAc<unknown>(i.rota, null),
    gorsel_url: gorsel_anahtar ? `${medyaOnek}${gorsel_anahtar}` : null,
    video_url: video_anahtar ? `${medyaOnek}${video_anahtar}` : null,
  };
}

export function seriCikti(s: any) {
  const { olusturma, ...geri } = s;
  return { ...geri, planlanan_bolumler: jsonAc<string[]>(s.planlanan_bolumler, []) };
}

export function haftaCikti(w: any) {
  return {
    ...w,
    kalici: jsonAc(w.kalici, []),
    yukselen: jsonAc(w.yukselen, []),
    sonen: jsonAc(w.sonen, []),
    onerilen_odak: jsonAc(w.onerilen_odak, []),
  };
}
