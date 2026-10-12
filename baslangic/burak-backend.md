# Burak: ilk prompt (Claude Code ya da Codex)

Repoyu klonla, kök klasörde Claude Code'u ya da Codex'i aç, aşağıdakini yapıştır.

```
git clone https://github.com/Kontak-Developers/kontak-network.git
cd kontak-network
```

---

Bu repoda Kontak için her gün otomatik çalışan bir sosyal medya ajanının backend'ini kuracaksın. Önce PLAN.md ve SOZLESME.md'yi oku, veri şekilleri ve API uçları oradakiyle birebir olsun.

`backend/` klasöründe tek bir Cloudflare Worker kur (TypeScript, wrangler):

1. **Statik dosyalar:** Worker `../frontend/dist` klasörünü static assets olarak sunsun, `/api/*` dışındaki her istek panele gitsin. Tek deploy, tek domain.
2. **D1:** `brands`, `runs`, `trends`, `ideas` tabloları. Migration dosyası yaz. Kontak marka profilini seed et, `izlenecek` alanında birkaç Türkçe motosiklet hashtag'i olsun.
3. **R2:** üretilen görsel ve videoları saklamak için bir bucket bağla.
4. **API:** SOZLESME.md'deki tüm uçlar: `GET/PUT /api/brand`, `GET /api/runs`, `GET /api/runs/latest`, `POST /api/runs`, `GET /api/trends`, `GET /api/ideas`, `PATCH /api/ideas/:id`.
5. **Cloudflare Workflow `AgentRun`:** 4 adım, her biri ayrı `step.do` ve tekrar denemeli. Her adımda `runs.adim` güncellensin.
   - `tara`: Apify API ile marka profilindeki hashtag'leri tara. TikTok için `clockworks/tiktok-scraper`, Instagram için `apify/instagram-hashtag-scraper`, son 48 saat, hashtag başına ~30 gönderi. Uzun sürebilir: run'ı başlat, `step.sleep` ile bekleyip durumunu yokla, bitince dataset'i çek. Sadece istatistik ve herkese açık alanları tut: link, hesap adı, açıklama, izlenme, beğeni, yorum, paylaşım, ses adı, tarih.
   - `analiz`: `brain(promptAdi, girdi)` fonksiyonunu `analiz` promptuyla çağır, çıkan gündemi `trends`'e yaz.
   - `uret`: `brain` fonksiyonunu `uretim` promptuyla çağır, 3 fikri `ideas`'a yaz. Sonra her fikir için fal.ai ile görsel üret (`fal-ai/flux/schnell`, 1080x1350), R2'ye kaydet, `gorsel_url`'i güncelle.
   - `kaydet`: `runs`'ı `tamamlandi` yap, `taranan_gonderi` ve `ozet`'i yaz.
6. **`brain` fonksiyonu** (`backend/src/brain.ts`): tek arayüz, iki sağlayıcı. `MANUS_API_KEY` varsa Manus API'yi kullansın (Nida dokümantasyonu getirecek, şimdilik iskelet yeterli). Yoksa Cloudflare Workers AI kullansın (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`). Promptlar `prompts/analiz.md` ve `prompts/uretim.md`'den build sırasında import edilsin. Çıktı JSON parse edilip doğrulansın.
7. **Cron:** her gün 08:00 İstanbul saati (05:00 UTC), `AgentRun`'ı başlatsın. `POST /api/runs` de aynısını yapsın.
8. **Gizli anahtarlar:** `APIFY_TOKEN`, `FAL_KEY`, `MANUS_API_KEY` sadece `wrangler secret put` ile girilecek. Kodda ya da repoda anahtar olmasın, `.dev.vars.example` dosyası oluştur.

Önce Apify olmadan sahte tarama verisiyle tüm akışın uçtan uca çalıştığını göster, sonra gerçek Apify'ı bağla. Bitince backend/README.md'ye çalıştırma komutlarını yaz.

---

## Ek (ikinci mesaj olarak ver)

SOZLESME.md'ye "Trend tespiti" ve "Haftalık özet" bölümleri eklendi, oku ve uygula:
- `posts` tablosu: her taramanın ham gönderilerini sakla (link benzersiz, tekrar ekleme).
- İvme hesabı: son 48 saatin günlük ortalaması ÷ önceki 7 günün günlük ortalaması, hashtag ve ses bazında, 0-100'e ölçekle. Bu sayıları `analiz` promptuna girdi olarak ver.
- Hiç geçmiş yoksa (ilk çalıştırma) son 7 günü tara.
- Pazartesi çalıştırması ayrıca `haftalik` promptuyla haftalık özet üretsin, `weekly` tablosuna yazsın. `GET /api/weekly/latest` ucunu ekle.
