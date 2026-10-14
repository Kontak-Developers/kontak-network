// Ortam ve ortak tipler. Veri şekilleri SOZLESME.md ile birebir.

export interface Env {
  DB: D1Database;
  MEDYA: R2Bucket;
  AI: Ai;
  AGENT_RUN: Workflow<RunParams>;
  KONTAK_API: Fetcher;
  /** "1" değilse zamanlayıcı tetiklense bile tarama başlamaz (elle çalışma) */
  OTOMATIK_TARAMA?: string;
  /** Rota kartı → uygulama (şimdilik kontak-api-dev) */
  KONTAK_API_ROTA: Fetcher;
  /** kontak-api AJAN_SERVIS_ANAHTARI ile aynı */
  KONTAK_AJAN_ANAHTARI?: string;
  VARLIKLAR: Fetcher;

  // Gizli anahtarlar (wrangler secret put). Boşsa ilgili adım yedeğe düşer.
  APIFY_TOKEN?: string;
  FAL_KEY?: string;
  MANUS_API_KEY?: string;
  IG_APP_ID?: string;
  IG_APP_SECRET?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  SOCIAL_TOKEN_ENCRYPTION_KEY?: string;
  SOCIAL_REDIRECT_BASE_URL?: string;
  YETKI_KAPALI?: string;

  GONDERI_PER_ETIKET: string;
  MANUS_PROFIL: string;
  MANUS_SURE_DK: string;
  FAL_GORSEL_MODEL: string;
  FAL_VIDEO_MODEL: string;
  VIDEO_AKTIF: string;
  YETKI_KONTROL_YOLU: string;
  /** Stüdyo: ElevenLabs ses adı ve günlük fal tavanı (USD). */
  FAL_SES?: string;
  FAL_GUNLUK_TAVAN?: string;
}

export type RunParams = {
  runId: string;
  tetik: 'cron' | 'manuel';
  /** Stok modu: tarama/sökme yok, kütüphanedeki formatlarla art arda kreatif turları. */
  stok?: { tur: number; tavan: number; odaklar?: string[]; karisim?: string };
  /** Yazı gömme modu: hazır reel/carousel'lere ekran yazısını göm (ids yoksa eksik olanların hepsi). */
  yazi?: { ids?: string[] };
  /** Yeniden üretim: bütçeden atlanan / hata veren reelleri mevcut planla üret. */
  reel?: { ids: string[]; tavan: number };
};

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
