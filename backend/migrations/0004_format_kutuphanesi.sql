-- v2 (12 Ekim akşam): "trend olacak" değil "trend OLMUŞ".
-- Hashtag ivmesi yerine PATLAYAN VİDEOLAR (izlenme ÷ takipçi) ve onlardan
-- Manus'un söktüğü FORMATLAR. Eski trends/posts tabloları panel için duruyor.

-- Avcının bulduğu, algoritmanın şu an ödüllendirdiği videolar.
CREATE TABLE patlayanlar (
  link TEXT PRIMARY KEY,
  platform TEXT NOT NULL,             -- tiktok | instagram
  kaynak TEXT NOT NULL,               -- tr_motor | global_motor | tr_trend
  hesap TEXT,
  takipci INTEGER NOT NULL DEFAULT 0,
  izlenme INTEGER NOT NULL DEFAULT 0,
  begeni INTEGER NOT NULL DEFAULT 0,
  yorum INTEGER NOT NULL DEFAULT 0,
  paylasim INTEGER NOT NULL DEFAULT 0,
  kaydetme INTEGER NOT NULL DEFAULT 0,
  patlama REAL NOT NULL DEFAULT 0,    -- izlenme / max(takipçi, 1000)
  sure_sn INTEGER,
  aciklama TEXT,
  ses TEXT,
  tarih TEXT NOT NULL,                -- paylaşım anı
  dokum TEXT,                         -- konuşma dökümü (fal wizper), varsa
  format_id TEXT,                     -- Manus'un eşlediği format
  run_id TEXT NOT NULL,
  bulunma TEXT NOT NULL
);
CREATE INDEX patlayanlar_run ON patlayanlar(run_id);
CREATE INDEX patlayanlar_patlama ON patlayanlar(patlama DESC);

-- Format kütüphanesi: içerik KALIBI, tek video değil. Aynı format farklı
-- turlarda yeniden görülünce güçleniyor; görülmeyince sönüyor.
CREATE TABLE formatlar (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL,                   -- "POV: ilk grup sürüşünde ben"
  ozet TEXT NOT NULL DEFAULT '',
  kanca_kalibi TEXT NOT NULL DEFAULT '',
  yapi TEXT NOT NULL DEFAULT '',      -- sahne sahne, satır satır
  kurgu TEXT NOT NULL DEFAULT '',     -- süre, tempo, geçişler
  ses TEXT NOT NULL DEFAULT '',       -- trend ses / tür / seslendirme var mı
  ekran_yazisi TEXT NOT NULL DEFAULT '',
  neden_tuttu TEXT NOT NULL DEFAULT '',
  kontak_acisi TEXT NOT NULL DEFAULT '',
  seslendirme INTEGER NOT NULL DEFAULT 0,   -- format anlatımlı mı (1/0)
  ornekler TEXT NOT NULL DEFAULT '[]',      -- [{link, izlenme, patlama, hesap}]
  gorulme INTEGER NOT NULL DEFAULT 1,       -- kaç turda görüldü
  ilk_gorulme TEXT NOT NULL,
  son_gorulme TEXT NOT NULL,
  durum TEXT NOT NULL DEFAULT 'yukseliyor', -- yukseliyor | zirvede | sonuyor
  skor INTEGER NOT NULL DEFAULT 0,          -- 0-100, kanıt gücü
  kullanim INTEGER NOT NULL DEFAULT 0       -- Kontak bunu kaç içerikte kullandı
);
CREATE INDEX formatlar_skor ON formatlar(durum, skor DESC);

-- Türkiye Creative Center trendleri (bağlam). marka_uygun=0 olanlar
-- (haber, siyaset, trajedi, suç) asla içeriğe girmez.
CREATE TABLE tr_trendleri (
  run_id TEXT NOT NULL,
  hashtag TEXT NOT NULL,
  sira INTEGER NOT NULL,
  yon TEXT,
  gonderi INTEGER,
  sektor TEXT,
  marka_uygun INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (run_id, hashtag)
);

-- Harcama defteri: fal / apify / manus, tur başına. Bütçe bekçisi buradan okur.
CREATE TABLE harcamalar (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  servis TEXT NOT NULL,               -- apify | fal | manus
  kalem TEXT NOT NULL,                -- model / aktör adı
  tutar_usd REAL NOT NULL,
  tahmini INTEGER NOT NULL DEFAULT 1, -- 1: tahmin, 0: servisin bildirdiği
  zaman TEXT NOT NULL
);
CREATE INDEX harcamalar_zaman ON harcamalar(zaman);
