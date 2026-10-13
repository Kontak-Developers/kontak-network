-- Stüdyo sekmesi (13 Ekim akşam): ajanın her ayarı panelden.
--  ayarlar      : tek satır 'ajan' — avcı, sökücü, kreatif, stüdyo, bütçe
--                 (varsayılanlar src/ayarlar.ts'te; burada yalnız değişenler)
--  prompt_ozel  : prompts/*.md yerine panelden yazılmış prompt (boşsa dosya)
--  ideas        : kanca varyantları (A/B) ve ekran yazısı gömülü reel

CREATE TABLE ayarlar (
  anahtar TEXT PRIMARY KEY,
  veri TEXT NOT NULL,
  guncelleme TEXT NOT NULL,
  guncelleyen TEXT
);

CREATE TABLE prompt_ozel (
  ad TEXT PRIMARY KEY,
  metin TEXT NOT NULL,
  guncelleme TEXT NOT NULL,
  guncelleyen TEXT
);

ALTER TABLE ideas ADD COLUMN kanca_varyantlari TEXT;
ALTER TABLE ideas ADD COLUMN yazili_anahtar TEXT;
