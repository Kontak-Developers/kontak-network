-- Kontak Network: ilk şema. Şekiller SOZLESME.md ile birebir.
-- Diziler ve iç içe nesneler JSON metni olarak saklanır, API'de açılır.

-- Marka profili tek satır, tamamı JSON. Sözleşmeye alan eklendikçe
-- şema değişmesin diye sütunlara bölünmedi.
CREATE TABLE brands (
  id TEXT PRIMARY KEY,
  veri TEXT NOT NULL,
  guncelleme TEXT NOT NULL
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  tetik TEXT NOT NULL,              -- cron | manuel
  durum TEXT NOT NULL,              -- calisiyor | tamamlandi | hata
  adim TEXT NOT NULL,               -- tara | analiz | uret | kaydet
  baslangic TEXT NOT NULL,
  bitis TEXT,
  taranan_gonderi INTEGER NOT NULL DEFAULT 0,
  ozet TEXT NOT NULL DEFAULT '',
  hata TEXT,
  workflow_id TEXT,
  manus_linkleri TEXT NOT NULL DEFAULT '[]'  -- sunumda kanıt: Manus görev linkleri
);
CREATE INDEX runs_baslangic ON runs(baslangic DESC);

-- Ham gönderiler. Yalnız herkese açık alanlar; ad soyad, profil
-- fotoğrafı, konum gibi alanlar Apify'dan gelse de YAZILMAZ (apify.ts).
CREATE TABLE posts (
  link TEXT PRIMARY KEY,
  platform TEXT NOT NULL,           -- tiktok | instagram
  hesap TEXT,
  aciklama TEXT,
  hashtagler TEXT NOT NULL DEFAULT '[]',
  ses TEXT,
  format TEXT,                      -- video | gorsel | carousel
  izlenme INTEGER NOT NULL DEFAULT 0,
  begeni INTEGER NOT NULL DEFAULT 0,
  yorum INTEGER NOT NULL DEFAULT 0,
  paylasim INTEGER NOT NULL DEFAULT 0,
  tarih TEXT NOT NULL,              -- gönderinin paylaşıldığı an
  taranma TEXT NOT NULL,
  run_id TEXT
);
CREATE INDEX posts_tarih ON posts(tarih);

CREATE TABLE trends (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  tip TEXT NOT NULL,
  baslik TEXT NOT NULL,
  aciklama TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL,
  ivme INTEGER NOT NULL DEFAULT 0,
  ornek_linkler TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX trends_run ON trends(run_id);

CREATE TABLE series (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  aciklama TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'kisa_video',
  durum TEXT NOT NULL DEFAULT 'aktif',
  olusturan TEXT NOT NULL DEFAULT 'ajan',
  bolum_sayisi INTEGER NOT NULL DEFAULT 0,
  planlanan_bolumler TEXT NOT NULL DEFAULT '[]',
  neden TEXT NOT NULL DEFAULT '',
  olusturma TEXT NOT NULL
);

CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  trend_id TEXT,
  platform TEXT NOT NULL,
  format TEXT NOT NULL,
  baslik TEXT NOT NULL,
  kanca TEXT NOT NULL DEFAULT '',
  senaryo TEXT NOT NULL DEFAULT '[]',
  aciklama_metni TEXT NOT NULL DEFAULT '',
  hashtagler TEXT NOT NULL DEFAULT '[]',
  gorsel_prompt TEXT NOT NULL DEFAULT '',
  gorsel_anahtar TEXT,              -- R2 anahtarı; URL istek anında üretilir
  video_anahtar TEXT,
  durum TEXT NOT NULL DEFAULT 'yeni',
  series_id TEXT,
  bolum_no INTEGER,
  bolum_adi TEXT,
  sahneler TEXT NOT NULL DEFAULT '[]',
  rota TEXT,
  onerilen_ses TEXT,
  olusturma TEXT NOT NULL
);
CREATE INDEX ideas_run ON ideas(run_id);

CREATE TABLE watchlist (
  id TEXT PRIMARY KEY,
  etiket TEXT NOT NULL,
  platform TEXT NOT NULL,           -- tiktok | instagram
  durum TEXT NOT NULL,              -- aktif | deneme | elendi | sabit | yasak
  kaynak TEXT NOT NULL,             -- profil | kesif | insan
  skor INTEGER NOT NULL DEFAULT 0,
  eklenme TEXT NOT NULL,
  neden TEXT NOT NULL DEFAULT '',
  UNIQUE (etiket, platform)
);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  tur TEXT NOT NULL,
  hedef TEXT NOT NULL,
  neden TEXT NOT NULL DEFAULT '',
  zaman TEXT NOT NULL
);
CREATE INDEX decisions_run ON decisions(run_id);

CREATE TABLE weekly (
  id TEXT PRIMARY KEY,
  hafta TEXT NOT NULL UNIQUE,
  olusturma TEXT NOT NULL,
  ozet TEXT NOT NULL DEFAULT '',
  kalici TEXT NOT NULL DEFAULT '[]',
  yukselen TEXT NOT NULL DEFAULT '[]',
  sonen TEXT NOT NULL DEFAULT '[]',
  onerilen_odak TEXT NOT NULL DEFAULT '[]'
);
