-- Büyüme Ajanı'na özel hesaplar (13 Ekim). Sosyal medya ekibi (ör. Şevval)
-- Kontak moderatör hesabı olmadan /ag'ye girer: moderatör hesabı kullanıcı
-- kişisel verilerine (telefon, şikâyet, selfie) erişiyor, ajana gerek yok.
-- Şifre PBKDF2-SHA256 (100k), düz metin saklanmaz; oturum jetonunun da
-- yalnız SHA-256 özeti tutulur.

CREATE TABLE ag_kullanicilar (
  id TEXT PRIMARY KEY,
  eposta TEXT NOT NULL UNIQUE,
  ad TEXT NOT NULL,
  sifre_ozet TEXT NOT NULL,      -- hex
  tuz TEXT NOT NULL,             -- hex
  aktif INTEGER NOT NULL DEFAULT 1,
  olusturma TEXT NOT NULL,
  son_giris TEXT
);

CREATE TABLE ag_oturumlar (
  jeton_ozet TEXT PRIMARY KEY,   -- SHA-256(jeton) hex
  kullanici_id TEXT NOT NULL,
  bitis INTEGER NOT NULL         -- unix ms
);
CREATE INDEX ag_oturumlar_kullanici ON ag_oturumlar(kullanici_id);

-- Kaba kuvvet kısıtı: e-posta başına başarısız denemeler.
CREATE TABLE ag_giris_denemeleri (
  eposta TEXT NOT NULL,
  zaman INTEGER NOT NULL
);
CREATE INDEX ag_giris_denemeleri_eposta ON ag_giris_denemeleri(eposta, zaman);
