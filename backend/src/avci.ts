// Trend Avcısı (v2, 12 Ekim akşam).
//
// Burak: "trend olacak değil, trend OLMUŞ, şu an trend olan içerik tarzında".
//
// Eski tarama hashtag'lerin ivmesine bakıyordu: hangi ETİKET yükseliyor.
// Trend etiket değil FORMAT (kanca, kurgu, ses, ekran yazısı) ve formatın
// kanıtı algoritmanın ödüllendirdiği videolar. En güçlü sinyal:
//
//   patlama = izlenme ÷ max(takipçi, 1000)
//
// 449 takipçili hesabın 175 bin izlenmesi (175×) içeriğin kendisinin
// tuttuğunu söyler; 2 milyon takipçinin 2 milyon izlenmesi söylemez.
// (12 Ekim deneme turu: TR motor etiketlerinde 175×, 207×, 113× videolar.)
//
// Kaynaklar (deneme maliyeti toplam ~$0.71):
//   tr_motor     clockworks/tiktok-scraper — TR motor etiketleri
//   global_motor clockworks/tiktok-scraper — dünya araması (format ilhamı)
//   tr_trend     data_xplorer/tiktok-trends — TikTok Creative Center, TR, 7 gün
//                ⚠️ TR genel trendleri haber/trajedi ağırlıklı (12 Ekim: ilk
//                10'un çoğu bir cinayet davası). Marka uygunluğuna Manus
//                karar veriyor; varsayılan UYGUN DEĞİL.
//
// Seçilen patlayanların videosu indirilir (Apify, anahtarlı) ve fal
// depolamasına konur: Apify kayıt adresi anahtarsız 403, Manus ve fal
// Wizper'ın erişebileceği herkese açık adres gerekiyor. Apify anahtarı
// hiçbir dış servise gitmiyor.

import type { Env } from './tipler';
import { apify } from './apify';
import { dizi, metin, sayi } from './yardimci';
import type { AjanAyarlari } from './ayarlar';

type AvAyari = AjanAyarlari['av'];

export type AvKaynak = 'tr_motor' | 'global_motor' | 'tr_trend';
export type AvIs = { kaynak: AvKaynak; runId: string; datasetId: string };

export type Aday = {
  link: string;
  platform: 'tiktok';
  kaynak: Exclude<AvKaynak, 'tr_trend'>;
  hesap: string | null;
  takipci: number;
  izlenme: number;
  begeni: number;
  yorum: number;
  paylasim: number;
  kaydetme: number;
  patlama: number;
  sure_sn: number | null;
  aciklama: string;
  ses: string | null;
  tarih: string;
};

export type TrTrend = { hashtag: string; sira: number; yon: string | null; gonderi: number; sektor: string };

/**
 * Avın başlangıcı: kaynaklar paralel. Etiket, arama ve eşikler panelden
 * (Stüdyo → Avcı; ayarlar.ts). TR araması etiketsiz patlayanları da
 * yakalıyor: Türk motorcuların çoğu etiket koymuyor.
 */
export async function avBaslat(env: Env, trEtiketler: string[], av: AvAyari): Promise<AvIs[]> {
  const etiketler = [...new Set([...av.tr_etiketler, ...trEtiketler])].slice(0, 15);
  const adet = av.etiket_basi_video;
  const tt = (girdi: Record<string, unknown>, maxItems: number) =>
    apify(env, `/acts/clockworks~tiktok-scraper/runs?maxItems=${maxItems}`, {
      method: 'POST',
      body: JSON.stringify({
        ...girdi,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false,
      }),
    });
  const is = (kaynak: AvKaynak, r: any): AvIs => ({ kaynak, runId: r.data.id, datasetId: r.data.defaultDatasetId });
  const isler: Promise<AvIs>[] = [];
  if (etiketler.length) isler.push(tt({ hashtags: etiketler, resultsPerPage: adet }, etiketler.length * adet).then((r) => is('tr_motor', r)));
  if (av.tr_aramalar.length)
    isler.push(
      tt({ searchQueries: av.tr_aramalar, resultsPerPage: av.arama_basi_video, searchSection: '/video' }, av.tr_aramalar.length * av.arama_basi_video)
        .then((r) => is('tr_motor', r))
    );
  if (av.global_aramalar.length)
    isler.push(
      tt({ searchQueries: av.global_aramalar, resultsPerPage: av.arama_basi_video, searchSection: '/video' }, av.global_aramalar.length * av.arama_basi_video)
        .then((r) => is('global_motor', r))
    );
  if (av.creative_center)
    isler.push(
      apify(env, '/acts/data_xplorer~tiktok-trends/runs', {
        method: 'POST',
        body: JSON.stringify({ trendType: 'hashtags', countryCode: 'TR', hashtagPeriod: '7', maxItems: 50 }),
      }).then((r) => is('tr_trend', r))
    );
  return Promise.all(isler);
}

/** Apify'ın bildirdiği gerçek maliyet (harcama defteri için). */
export async function avMaliyeti(env: Env, runId: string): Promise<number> {
  const r = await apify(env, `/actor-runs/${runId}`);
  return sayi(r.data?.usageTotalUsd);
}

export async function avAdaylari(env: Env, is: AvIs): Promise<Aday[]> {
  const ham = dizi<any>(await apify(env, `/datasets/${is.datasetId}/items?clean=true&format=json&limit=1000`));
  const kaynak = is.kaynak as Aday['kaynak'];
  return ham
    .map((x): Aday | null => {
      const link = metin(x?.webVideoUrl);
      const tarih = metin(x?.createTimeISO);
      if (!link.startsWith('https://') || !tarih) return null;
      const takipci = sayi(x?.authorMeta?.fans);
      const izlenme = sayi(x?.playCount);
      return {
        link,
        platform: 'tiktok',
        kaynak,
        hesap: x?.authorMeta?.name ? metin(x.authorMeta.name) : null,
        takipci,
        izlenme,
        begeni: sayi(x?.diggCount),
        yorum: sayi(x?.commentCount),
        paylasim: sayi(x?.shareCount),
        kaydetme: sayi(x?.collectCount),
        patlama: Math.round((izlenme / Math.max(takipci, 1000)) * 10) / 10,
        sure_sn: x?.videoMeta?.duration ? sayi(x.videoMeta.duration) : null,
        aciklama: metin(x?.text).slice(0, 400),
        ses: x?.musicMeta?.musicName ? metin(x.musicMeta.musicName).slice(0, 120) : null,
        tarih,
      };
    })
    .filter((a): a is Aday => a !== null);
}

export async function trTrendleri(env: Env, is: AvIs): Promise<TrTrend[]> {
  const ham = dizi<any>(await apify(env, `/datasets/${is.datasetId}/items?clean=true&format=json&limit=100`));
  return ham
    .map((x) => ({
      hashtag: metin(x?.Hashtag).replace(/^#+/, '').slice(0, 80),
      sira: sayi(x?.Rank),
      yon: x?.['Trend Direction'] ? metin(x['Trend Direction']) : null,
      gonderi: sayi(x?.Posts),
      sektor: dizi<string>(x?.Industries).join(', ').slice(0, 120),
    }))
    .filter((t) => t.hashtag);
}

/**
 * Patlayanları seç (varsayılan: son 14 gün; TR'de en az 15 bin, dünyada 50
 * bin izlenme; patlama en az 5×; aynı hesaptan en fazla 2 video — tek
 * hesabın tarzı kütüphaneyi domine etmesin; 9 TR + 4 dünya). Hepsi panelden.
 */
export function patlayanlariSec(adaylar: Aday[], av: AvAyari, simdi = Date.now()): Aday[] {
  const sinir = simdi - av.gun * 86400_000;
  const tekil = new Map<string, Aday>();
  for (const a of adaylar) if (!tekil.has(a.link)) tekil.set(a.link, a);
  const uygun = [...tekil.values()].filter(
    (a) =>
      Date.parse(a.tarih) >= sinir &&
      a.patlama >= av.min_patlama &&
      a.izlenme >= (a.kaynak === 'tr_motor' ? av.min_izlenme_tr : av.min_izlenme_global)
  );
  const sec = (kaynak: Aday['kaynak'], n: number) => {
    const hesapSay = new Map<string, number>();
    return uygun
      .filter((a) => a.kaynak === kaynak)
      .sort((x, y) => y.patlama - x.patlama)
      .filter((a) => {
        const h = a.hesap ?? a.link;
        const s = (hesapSay.get(h) ?? 0) + 1;
        hesapSay.set(h, s);
        return s <= av.hesap_basi;
      })
      .slice(0, n);
  };
  return [...sec('tr_motor', av.tr_secim), ...sec('global_motor', av.global_secim)];
}

/** Seçilenlerin videosunu indir (ayrı Apify işi; yalnız bunlar için ücret). */
export async function indirmeBaslat(env: Env, linkler: string[]): Promise<AvIs> {
  const r = await apify(env, `/acts/clockworks~tiktok-scraper/runs?maxItems=${linkler.length}`, {
    method: 'POST',
    body: JSON.stringify({ postURLs: linkler, shouldDownloadVideos: true, shouldDownloadCovers: false }),
  });
  return { kaynak: 'tr_motor', runId: r.data.id, datasetId: r.data.defaultDatasetId };
}

/** link → Apify kayıt adresi (anahtarlı). */
export async function indirilenler(env: Env, is: AvIs): Promise<Record<string, string>> {
  const ham = dizi<any>(await apify(env, `/datasets/${is.datasetId}/items?clean=true&format=json`));
  const out: Record<string, string> = {};
  for (const x of ham) {
    const link = metin(x?.webVideoUrl ?? x?.submittedVideoUrl);
    const dosya = dizi<string>(x?.mediaUrls)[0];
    if (link && dosya) out[link] = dosya;
  }
  return out;
}

/**
 * Apify'dan (anahtarla) indirip fal depolamasına koyar; herkese açık adres
 * döner. 25 MB üstü atlanır (Manus file_url sınırı 20 MB, pay bırakıldı;
 * uzun vlog'lar zaten format örneği olarak zayıf).
 */
export async function falaTasi(env: Env, apifyAdres: string, ad: string): Promise<string | null> {
  const v = await fetch(apifyAdres, { headers: { Authorization: `Bearer ${env.APIFY_TOKEN}` } });
  if (!v.ok) return null;
  const veri = await v.arrayBuffer();
  if (veri.byteLength > 19 * 1024 * 1024) return null;
  const i = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST',
    headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: 'video/mp4', file_name: `${ad}.mp4` }),
  });
  if (!i.ok) return null;
  const j: any = await i.json();
  const p = await fetch(j.upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: veri });
  return p.ok ? metin(j.file_url) : null;
}

// Whisper müzikte / sessizlikte bunları UYDURUR (12 Ekim: konuşmasız motor
// videosunda "Thank you."). Döküm ajanı "videoda anlatım var" diye yanıltmasın.
const UYDURMA = /^(thank you|thanks for watching|altyazı|abone ol|müzik|music|you|\.+)[\s.!]*$/i;

/** Konuşma dökümü (fal Wizper). Konuşma yoksa / uydurmaysa null. */
export async function dokum(env: Env, videoUrl: string): Promise<string | null> {
  const y = await fetch('https://fal.run/fal-ai/wizper', {
    method: 'POST',
    headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: videoUrl, task: 'transcribe', chunk_level: 'segment', version: '3' }),
  });
  if (!y.ok) return null;
  const v: any = await y.json();
  const t = metin(v?.text).trim();
  if (!t || UYDURMA.test(t) || t.split(/\s+/).length < 6) return null;
  return t.slice(0, 1500);
}
