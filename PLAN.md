# Kontak Network: Plan

## Ne yapıyoruz

Kontak için **her gün kendi kendine çalışan bir sosyal medya ajanı.** Ajan sabah uyanıyor, TikTok ve Instagram'da motosiklet gündemine bakıyor, neyin yükseldiğini analiz ediyor ve Kontak'a hazır içerik üretiyor: fikir, senaryo, açıklama metni, görsel, kısa video. Kimse elle araştırma yapmıyor. Ekip sadece panelden bakıp onaylıyor ve paylaşıyor.

- **Öncesi:** Kontak ekibi her gün elle TikTok ve Instagram'da geziniyor, trend arıyor, fikir buluyor, içerik hazırlıyor. Saatler gidiyor, tutarlılık yok.
- **Sonrası:** ajan her sabah 08:00'de çalışıyor, ekip güne hazır içerikle başlıyor.

## Sistem nasıl çalışıyor

```
08:00 Cloudflare Cron (ya da paneldeki "Şimdi çalıştır")
  ↓
Cloudflare Workflow: adım adım, her adım tekrar denenebilir
  1. Tara       Apify → TikTok + Instagram: marka profilindeki hashtag'ler ve hesaplar
                (son 24-48 saatin gönderileri: izlenme, beğeni, ses, format)
  2. Analiz     Ajan beyni → yükselen konular, sesler, formatlar = günlük gündem raporu
  3. Üret       Ajan beyni → 3 içerik fikri: kanca, senaryo, açıklama, hashtag
                fal.ai → her fikre görsel, en iyisine kısa video
  4. Kaydet     D1 (veri) + R2 (görsel/video)
  ↓
Panel: Bugün'ün gündemi, hazır içerikler (onayla / reddet / metni kopyala), çalıştırma geçmişi
```

**Roller:** Apify araştırır, Manus şef (takip listesi, seri ve içerik kararlarını o verir), fal.ai görsel ve videoyu üretir. Ajan hangi hashtag'leri izleyeceğine kendisi karar verir (8 aktif + 3 deneme), tek tek gönderi değil seri düşünür. Ayrıntı: SOZLESME.md sonundaki "Ek".

**Ajan beyni:** Manus API (Manus işi koordine ediyor, jüri kriteri). Manus API çalışmazsa yedek: Cloudflare Workers AI (anahtar gerektirmez). Beyin tek bir fonksiyonun arkasında, değiştirmek bir satır.

**Otomatik paylaşım yok:** Instagram ve TikTok'a otomatik paylaşım için onaylı iş hesabı API'si gerekiyor, bugün yetişmez. Ajan hazırlar, insan onaylar ve paylaşır. Bu aynı zamanda marka güvenliği için doğru tercih.

## Kim ne yapıyor

| Kişi | Rol | İş |
|---|---|---|
| **Burak** | **Backend** | Cloudflare Worker, Cron, Workflow, Apify entegrasyonu, D1 + R2, API uçları, gizli anahtarlar |
| **Kemal** | **Frontend + entegrasyon** | Panel (gündem, içerik kartları, onay, geçmiş, "Şimdi çalıştır"), fal.ai modülü, uçtan uca test, deploy |
| **Nida** | **Ajan beyni + sunum** | Manus API'yi doğrulamak, marka profili, analiz ve üretim promptları (`prompts/`), fal.ai stil testleri, sunum ve demo akışı |

Herkesin ilk promptu `baslangic/` klasöründe: Burak Claude Code/Codex'te, Kemal Claude Code'da, Nida Manus'ta çalışır. Veri şekilleri `SOZLESME.md`'de.

## API sözleşmesi (Burak ↔ Kemal)

```
GET  /api/brand                  → marka profili
PUT  /api/brand                  → profili düzenle
GET  /api/runs                   → çalıştırma geçmişi (zaman, durum, taranan gönderi sayısı)
GET  /api/runs/latest            → son çalıştırma + gündem raporu
POST /api/runs                   → "Şimdi çalıştır" (Workflow başlatır)
GET  /api/trends?run=<id>        → yükselen konular/sesler/formatlar
GET  /api/ideas?run=<id>         → içerik fikirleri (+ görsel/video linki, durum)
PATCH /api/ideas/:id             → durum: yeni / onaylandı / reddedildi / paylaşıldı
```

Kemal, Burak hazır olana kadar `data/mock/` altındaki sahte JSON ile çalışır.

## Saat saat

| Saat | Burak | Nida | Kemal |
|---|---|---|---|
| 09:30 | Cloudflare iskeleti, D1 şeması | Manus API anahtarı var mı, test | Panel iskeleti, sahte veri |
| 10:30 | Apify TikTok + Instagram aktörleri Worker'dan çalışıyor | Marka profili + analiz promptu | fal.ai görsel modülü |
| 12:00 | Workflow: tara → kaydet çalışıyor | Üretim promptu, beyin Workflow'a bağlı | Panel API'ye bağlı |
| 13:00 | Cron + "Şimdi çalıştır" | Gerçek bir çalıştırmanın sonucunu kontrol | fal.ai video, uçtan uca test |
| 13:30 | **İlk tam otomatik çalıştırma, canlıda** | | |
| 14:15 | Yeni özellik yok, sunum provası | | |
| 14:45 | Teslim (son saat 15:00) | | |

**Demo güvenliği:** Apify ve video üretimi dakikalar sürebilir. Sahnede "Şimdi çalıştır"a basıp canlı log gösteriyoruz, ama 13:30'daki gerçek çalıştırmanın sonucu da panelde hazır duruyor.

## Kurallar

- Kişisel veri yok: sadece herkese açık gönderi istatistikleri ve hesap adları.
- API anahtarları sadece Cloudflare secret olarak (`wrangler secret put`). Repoya, ekrana, sunuma girmez.
- Manus görev linklerini saklayın, sunumda kanıt olacak.

## Paneli çalıştırma

```
cd frontend
npm install
npm run dev            # http://localhost:5173, backend yoksa otomatik olarak örnek veriye düşer
VITE_MOCK=1 npm run dev  # hep örnek veri
npm run build          # frontend/dist, Worker bunu sunar
```
