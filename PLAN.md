# Kontak Network: Plan

## Ne yapıyoruz

Kontak'ın haftalık büyüme işini yapan bir otomasyon. Panel, otomasyonun ürettiğini gösterdiğimiz ve ekibin onayladığı ekran.

- **Öncesi:** Kontak ekibi her hafta elle motorcu grubu arıyor, gönderi yazıyor, görsel hazırlıyor, tek tek mesaj atıyor.
- **Sonrası:** otomasyon haftada bir çalışıyor, ekip panelden sadece onaylayıp gönderiyor.

## Sistem nasıl çalışıyor

```
Tetik (haftalık zamanlayıcı ya da paneldeki "Şimdi çalıştır")
  → 1. Keşif:   Manus + Apify   → topluluklar ve buluşma noktaları
  → 2. Üretim:  Manus + fal.ai  → 7 günlük takvim, görseller, iş birliği mesajları
  → 3. Kayıt:   sonuç POST /api/ingest ile Cloudflare D1'e yazılır
  → 4. Onay:    panelde ekip bakar, düzenler, gönderir, kanban'da takip eder
```

Motordan bağımsız tasarım: sonucu kim üretirse üretsin (Manus'ta elle çalıştırılan görev, Manus'un zamanlanmış görevi, Manus API ya da yedek bir script), `POST /api/ingest`'e aynı JSON'u gönderiyor. Panel sadece D1'i okuyor.

## Kim ne yapıyor

| Kişi | İş | Manus promptu |
|---|---|---|
| Burak | 1. Keşif: Apify ile topluluk ve buluşma noktası taraması | `prompts/1-burak-kesif.md` |
| Nida | 2. Üretim: takvim, metinler, fal.ai görselleri, mesajlar + sunum | `prompts/2-nida-uretim.md` |
| Kemal | Cloudflare (D1, API, zamanlayıcı), panel, uçtan uca bağlantı. 13:00'te iki promptu tek bir "haftalık çalıştırma" görevinde birleştirir. | `prompts/3-kemal-haftalik-gorev.md` |

## Saat saat

| Saat | Burak | Nida | Kemal |
|---|---|---|---|
| 09:30 | Repo, Apify hesabı, prompt 1'i Manus'a at | Prompt 2'nin A bölümünü at (marka profili + takvim) | Cloudflare hesabı, iskelet (Claude Code) |
| 11:00 | İlk `community.json`'ı repoya yükle | Burak'ın listesiyle prompt 2'nin B bölümünü at (mesajlar) | Panel sahte veriyle çalışıyor |
| 12:00 | Veriyi temizle, haritaya konum ekle | Görseller hazır, repoya yükle | Gerçek veri D1'de |
| 13:00 | Kemal'e yardım: test | Sunum metni | Haftalık görev promptu, `/api/ingest` uçtan uca |
| 13:30 | Panel canlıda | | |
| 14:15 | Yeni özellik yok, prova | | |
| 14:45 | Teslim (son saat 15:00) | | |

## Dosyalar nereye

- `data/community.json`, `data/places.json`: Burak
- `data/brand.json`, `data/calendar.json`, `data/outreach.json`: Nida
- `public/images/`: Nida'nın görselleri (`gun-1.png` … `gun-7.png`)

Kod bilmeyen için yükleme yolu: GitHub'da klasöre gir, **Add file → Upload files**.

## Kurallar

- Kişisel veri yok. Sadece herkese açık hesaplar (kulüp, grup, kafe, işletme, içerik üreticisi sayfası). Bireylerin özel profilleri yok.
- API anahtarı repoya, ekrana, sunuma girmez.
- Manus'ta kullandığınız promptları ve görev linklerini saklayın, sunumda "Manus ne yaptı" sorusuna kanıt olacak.
