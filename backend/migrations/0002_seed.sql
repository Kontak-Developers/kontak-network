-- Kontak marka profili + başlangıç takip listesi.
-- Profil Nida'nın Manus çıktısıyla PUT /api/brand üzerinden güncellenebilir.

INSERT INTO brands (id, veri, guncelleme) VALUES ('kontak', '{
  "id": "kontak",
  "ad": "Kontak",
  "tanim": "Türkiye''de motosiklet kültürü üzerine kurulu tanışma ve topluluk uygulaması",
  "hedef_kitle": "20-40 yaş arası, hafta sonu sürüşe çıkan, yeni sürüş arkadaşı ve topluluk arayan motorcular",
  "ton_kurallari": [
    "Samimi ama abartısız: motorcu gibi konuş, reklamcı gibi değil",
    "Güvenliği her zaman ön planda tut: kasksız, ekipmansız sürüş gösterme",
    "Kimseyi küçümseme: scooter da motordur",
    "Emojiyi ölçülü kullan, en fazla 2"
  ],
  "vurgu_rengi": "#0000A8",
  "sutunlar": [
    { "ad": "Topluluk", "oran": 30 },
    { "ad": "Rota", "oran": 25 },
    { "ad": "Tanışma", "oran": 25 },
    { "ad": "Güvenlik", "oran": 20 }
  ],
  "izlenecek": {
    "tiktok_hashtagler": ["motosiklet", "motorcu", "motovlog", "motorcuyuz", "istanbulmotor"],
    "instagram_hashtagler": ["motosiklet", "motorcu", "motosikletkulübü", "motorcukafe", "sürüş"],
    "hesaplar": []
  },
  "sinirlar": {
    "konu_alani": "Türkiye motosiklet kültürü: sürüş, rota, topluluk, ekipman, güvenlik",
    "yasak_konular": ["siyaset", "kaza görüntüsü", "yarış / sokak yarışı"],
    "gorsel_kurallar": [
      "Yüzü görünen gerçekçi insan yok. Kasklı ya da arkadan çekilmiş sürücü olabilir.",
      "Güvensiz sürüş yok: kasksız sürüş, tek teker, aşırı hız",
      "Başka markanın logosu ve okunabilir plaka yok",
      "Üretilen görselin/videonun içine yazı yazdırılmaz; ekran yazısı ayrı alanda",
      "Rotalar gerçek yerler; var olmayan yol veya mekân uydurulmaz",
      "Müzik videoya gömülmez; önerilen ses paylaşırken eklenir"
    ],
    "butce": { "aktif_hashtag": 8, "deneme_hashtag": 3, "video_per_run": 1 }
  }
}', '2026-10-12T09:30:00+03:00');

INSERT INTO watchlist (id, etiket, platform, durum, kaynak, skor, eklenme, neden) VALUES
  ('w_tt_motosiklet',   'motosiklet',       'tiktok',    'aktif', 'profil', 50, '2026-10-12T09:30:00+03:00', 'Marka profilinden'),
  ('w_tt_motorcu',      'motorcu',          'tiktok',    'aktif', 'profil', 50, '2026-10-12T09:30:00+03:00', 'Marka profilinden'),
  ('w_tt_motovlog',     'motovlog',         'tiktok',    'aktif', 'profil', 50, '2026-10-12T09:30:00+03:00', 'Marka profilinden'),
  ('w_tt_motorcuyuz',   'motorcuyuz',       'tiktok',    'aktif', 'profil', 50, '2026-10-12T09:30:00+03:00', 'Marka profilinden'),
  ('w_ig_motosiklet',   'motosiklet',       'instagram', 'aktif', 'profil', 50, '2026-10-12T09:30:00+03:00', 'Marka profilinden'),
  ('w_ig_motorcu',      'motorcu',          'instagram', 'aktif', 'profil', 50, '2026-10-12T09:30:00+03:00', 'Marka profilinden'),
  ('w_ig_motosikletkulubu', 'motosikletkulübü', 'instagram', 'aktif', 'profil', 50, '2026-10-12T09:30:00+03:00', 'Marka profilinden'),
  ('w_ig_motorcukafe',  'motorcukafe',      'instagram', 'aktif', 'profil', 50, '2026-10-12T09:30:00+03:00', 'Marka profilinden');
