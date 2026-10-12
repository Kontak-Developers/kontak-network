// Ortam ve ortak tipler. Veri şekilleri SOZLESME.md ile birebir.

export interface Env {
  DB: D1Database;
  MEDYA: R2Bucket;
  AI: Ai;
  AGENT_RUN: Workflow<RunParams>;
  KONTAK_API: Fetcher;
  VARLIKLAR: Fetcher;

  // Gizli anahtarlar (wrangler secret put). Boşsa ilgili adım yedeğe düşer.
  APIFY_TOKEN?: string;
  FAL_KEY?: string;
  MANUS_API_KEY?: string;
  YETKI_KAPALI?: string;

  GONDERI_PER_ETIKET: string;
  MANUS_PROFIL: string;
  MANUS_SURE_DK: string;
  FAL_GORSEL_MODEL: string;
  FAL_VIDEO_MODEL: string;
  VIDEO_AKTIF: string;
  YETKI_KONTROL_YOLU: string;
}

export type RunParams = { runId: string; tetik: 'cron' | 'manuel' };

export type Platform = 'tiktok' | 'instagram';

/** Taranmış gönderi: yalnız herkese açık alanlar. */
export type Gonderi = {
  link: string;
  platform: Platform;
  hesap: string | null;
  aciklama: string;
  hashtagler: string[];
  ses: string | null;
  format: 'video' | 'gorsel' | 'carousel';
  izlenme: number;
  begeni: number;
  yorum: number;
  paylasim: number;
  tarih: string;
};

export type Etiket = { etiket: string; platform: Platform };

export type Brand = Record<string, unknown> & {
  id: string;
  ad: string;
  izlenecek?: { tiktok_hashtagler?: string[]; instagram_hashtagler?: string[]; hesaplar?: string[] };
  sinirlar?: { butce?: { aktif_hashtag?: number; deneme_hashtag?: number; video_per_run?: number } };
};
