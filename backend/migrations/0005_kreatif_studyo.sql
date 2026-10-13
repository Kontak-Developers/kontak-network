-- v2 Faz 2-3 (13 Ekim): kreatif direktör çıktısı + stüdyo durumu + rota kartları.

ALTER TABLE ideas ADD COLUMN format_id TEXT;          -- dayandığı kazanan format
ALTER TABLE ideas ADD COLUMN puan INTEGER;            -- kreatif direktörün 50 üzerinden puanı
ALTER TABLE ideas ADD COLUMN puan_gerekce TEXT;
ALTER TABLE ideas ADD COLUMN neden_simdi TEXT;
ALTER TABLE ideas ADD COLUMN uretim_plani TEXT;       -- CekimPlani JSON (studyo.ts)
ALTER TABLE ideas ADD COLUMN reel_durum TEXT;         -- bekliyor | uretiliyor | hazir | atlandi | hata
ALTER TABLE ideas ADD COLUMN reel_maliyet REAL;       -- tahmini fal USD

-- Ajanın önerdiği gerçek rotalar. Uygulamanın Rotalar bölümüne moderatör
-- onayıyla girer (Kontak API rota önerisi, dev'de taslak).
CREATE TABLE rota_kartlari (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  ad TEXT NOT NULL,
  il TEXT NOT NULL DEFAULT '',
  baslangic TEXT NOT NULL DEFAULT '',
  bitis TEXT NOT NULL DEFAULT '',
  duraklar TEXT NOT NULL DEFAULT '[]',
  km REAL,
  sure_dk INTEGER,
  en_iyi_zaman TEXT NOT NULL DEFAULT '',
  zorluk TEXT NOT NULL DEFAULT 'orta',
  yol_tipi TEXT NOT NULL DEFAULT '',
  neden_git TEXT NOT NULL DEFAULT '',
  gorsel_prompt TEXT NOT NULL DEFAULT '',
  gorsel_anahtar TEXT,
  kaynaklar TEXT NOT NULL DEFAULT '[]',
  durum TEXT NOT NULL DEFAULT 'taslak',   -- taslak | uygulamaya_gonderildi | reddedildi
  kontak_rota_id TEXT,                    -- Kontak API'deki öneri kimliği (gönderilince)
  olusturma TEXT NOT NULL
);
CREATE INDEX rota_kartlari_run ON rota_kartlari(run_id);
