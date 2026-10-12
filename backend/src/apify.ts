// Apify: TikTok + Instagram hashtag taraması.
//
// Akış uzun sürebilir (dakikalar). Workflow içinde: baslat → step.sleep →
// durum → (bitince) sonuclar. Tek istekte bekleyen "run-sync" uçları
// kullanılmadı; 5 dk sınırına takılır ve Worker'ı boşuna bekletir.
//
// ⚠️ KİŞİSEL VERİ: Apify ad soyad, profil fotoğrafı, konum, takipçi
// listesi gibi alanlar da döndürüyor. Aşağıdaki dönüştürücüler YALNIZ
// beyaz listedeki alanları alır; geri kalan hiçbir şey D1'e yazılmaz.

import type { Env, Gonderi, Platform } from './tipler';
import { dizi, metin, sayi } from './yardimci';

const API = 'https://api.apify.com/v2';

const AKTOR: Record<Platform, string> = {
  tiktok: 'clockworks~tiktok-scraper',
  instagram: 'apify~instagram-hashtag-scraper',
};

// Yalnız bu alanlar istenir; Apify veri setinden geri kalanı hiç gelmez.
const ALANLAR: Record<Platform, string> = {
  tiktok:
    'webVideoUrl,authorMeta,text,playCount,diggCount,commentCount,shareCount,musicMeta,createTimeISO,hashtags,isSlideshow',
  instagram:
    'url,ownerUsername,caption,hashtags,likesCount,commentsCount,videoViewCount,videoPlayCount,timestamp,type,musicInfo',
};

export async function apify(env: Env, yol: string, init?: RequestInit): Promise<any> {
  const y = await fetch(API + yol, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.APIFY_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!y.ok) throw new Error(`Apify ${y.status}: ${(await y.text()).slice(0, 200)}`);
  return y.json();
}

export type ApifyIs = { platform: Platform; runId: string; datasetId: string };

export async function taramaBaslat(
  env: Env,
  platform: Platform,
  etiketler: string[],
  adet: number
): Promise<ApifyIs> {
  const girdi =
    platform === 'tiktok'
      ? {
          hashtags: etiketler,
          resultsPerPage: adet,
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
          shouldDownloadSubtitles: false,
          shouldDownloadSlideshowImages: false,
        }
      : { hashtags: etiketler, resultsLimit: adet };
  // maxItems: sonuç başına ücretli aktörlerde faturayı da sınırlar.
  const maxItems = etiketler.length * adet;
  const r = await apify(env, `/acts/${AKTOR[platform]}/runs?maxItems=${maxItems}`, {
    method: 'POST',
    body: JSON.stringify(girdi),
  });
  return { platform, runId: r.data.id, datasetId: r.data.defaultDatasetId };
}

/** READY | RUNNING | SUCCEEDED | FAILED | TIMED-OUT | ABORTED */
export async function taramaDurumu(env: Env, runId: string): Promise<string> {
  const r = await apify(env, `/actor-runs/${runId}`);
  return r.data.status as string;
}

export async function taramaSonuclari(env: Env, is: ApifyIs): Promise<Gonderi[]> {
  const y = await apify(
    env,
    `/datasets/${is.datasetId}/items?clean=true&format=json&limit=2000&fields=${ALANLAR[is.platform]}`
  );
  const ham = dizi<any>(y);
  const donustur = is.platform === 'tiktok' ? tiktokGonderi : instagramGonderi;
  // TikTok hashtag sayfası "en popüler"i veriyor, yıllar öncesi dahil
  // (12 Ekim ilk gerçek tur: 2023 tarihli gönderiler). İvme penceresi
  // 9 gün; daha eskisi hem işe yaramaz hem gereksiz veri.
  const sinir = Date.now() - 10 * 86400_000;
  return ham
    .map(donustur)
    .filter((g): g is Gonderi => g !== null && Date.parse(g.tarih) >= sinir);
}

function etiketleriAyikla(v: unknown): string[] {
  return dizi<any>(v)
    .map((h) => (typeof h === 'string' ? h : h?.name))
    .filter((h): h is string => typeof h === 'string' && h.length > 0)
    .map((h) => h.replace(/^#/, '').toLocaleLowerCase('tr'));
}

function tiktokGonderi(o: any): Gonderi | null {
  const link = metin(o?.webVideoUrl);
  const tarih = metin(o?.createTimeISO);
  if (!link.startsWith('https://') || !tarih) return null;
  const ses = o?.musicMeta?.musicName
    ? `${o.musicMeta.musicName}${o.musicMeta.musicAuthor ? ' – ' + o.musicMeta.musicAuthor : ''}`
    : null;
  return {
    link,
    platform: 'tiktok',
    hesap: o?.authorMeta?.name ? metin(o.authorMeta.name) : null,
    aciklama: metin(o?.text).slice(0, 600),
    hashtagler: etiketleriAyikla(o?.hashtags),
    ses,
    format: o?.isSlideshow ? 'carousel' : 'video',
    izlenme: sayi(o?.playCount),
    begeni: sayi(o?.diggCount),
    yorum: sayi(o?.commentCount),
    paylasim: sayi(o?.shareCount),
    tarih,
  };
}

function instagramGonderi(o: any): Gonderi | null {
  const link = metin(o?.url);
  const tarih = metin(o?.timestamp);
  if (!link.startsWith('https://') || !tarih) return null;
  const tip = metin(o?.type).toLowerCase();
  return {
    link,
    platform: 'instagram',
    hesap: o?.ownerUsername ? metin(o.ownerUsername) : null,
    aciklama: metin(o?.caption).slice(0, 600),
    hashtagler: etiketleriAyikla(o?.hashtags),
    ses: o?.musicInfo?.song_name ? metin(o.musicInfo.song_name) : null,
    format: tip === 'video' ? 'video' : tip === 'sidecar' ? 'carousel' : 'gorsel',
    izlenme: sayi(o?.videoViewCount ?? o?.videoPlayCount),
    begeni: sayi(o?.likesCount),
    yorum: sayi(o?.commentsCount),
    paylasim: 0,
    tarih,
  };
}

// ─────────────────────────────────────────────
// Sahte tarama: APIFY_TOKEN yoksa akış uçtan uca bununla çalışır.
// Son 9 güne yayılmış, son 48 saatte bazı etiketleri "yükselen" yapar.
// ─────────────────────────────────────────────
const SAHTE_KONULAR = [
  { a: 'Kask kamerası POV, sabah Şile yolu', h: ['motovlog', 'pov', 'şile'], ses: 'Lo-fi sürüş', yeni: true },
  { a: 'Sonbahar rotası: Ağva sahil yolu, yapraklar dökülmüş', h: ['motosiklet', 'sonbaharrotası', 'ağva'], ses: 'Akustik yol', yeni: true },
  { a: 'Pazar grup sürüşü buluşma noktası Riva', h: ['motorcuyuz', 'grupsürüşü'], ses: 'Egzoz sesi remix', yeni: false },
  { a: 'İlk motorumu aldım, acemi ipuçları', h: ['motorcu', 'yenimotorcu'], ses: null, yeni: false },
  { a: 'Kafe molası, motorcu kafeleri İstanbul', h: ['motorcukafe', 'motosiklet'], ses: 'Lo-fi sürüş', yeni: true },
  { a: 'Yağmurda sürüş ekipman önerileri', h: ['motosiklet', 'ekipman', 'güvenlisürüş'], ses: null, yeni: false },
  { a: 'Viraj tekniği, Polonezköy virajları', h: ['virajsever', 'motovlog'], ses: 'Egzoz sesi remix', yeni: true },
];

export function sahteTarama(gunGeri: number): Gonderi[] {
  const simdi = Date.now();
  const sonuc: Gonderi[] = [];
  let n = 0;
  for (let gun = 0; gun < gunGeri; gun++) {
    for (const k of SAHTE_KONULAR) {
      const adet = k.yeni && gun < 2 ? 4 : 1;
      for (let i = 0; i < adet; i++) {
        n++;
        const platform: Platform = n % 2 ? 'tiktok' : 'instagram';
        const guc = (k.yeni && gun < 2 ? 3 : 1) * (1000 + ((n * 7919) % 5000));
        sonuc.push({
          link:
            platform === 'tiktok'
              ? `https://www.tiktok.com/@ornek_kulup/video/7${String(n).padStart(17, '0')}`
              : `https://www.instagram.com/p/ORNEK${n}/`,
          platform,
          hesap: 'ornek_kulup',
          aciklama: k.a,
          hashtagler: k.h,
          ses: k.ses,
          format: platform === 'tiktok' ? 'video' : n % 3 ? 'gorsel' : 'carousel',
          izlenme: guc * 10,
          begeni: guc,
          yorum: Math.round(guc / 20),
          paylasim: Math.round(guc / 40),
          tarih: new Date(simdi - gun * 86400_000 - ((n * 3_600_000) % 80_000_000)).toISOString(),
        });
      }
    }
  }
  return sonuc;
}
