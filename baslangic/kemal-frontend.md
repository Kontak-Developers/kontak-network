# Kemal: ilk prompt (Claude Code)

---

Bu repoda Kontak'ın sosyal medya ajanı için paneli kuracaksın. Önce PLAN.md ve SOZLESME.md'yi oku, veri şekilleri oradakiyle birebir olsun.

`frontend/` klasöründe Vite + React + TypeScript ile kur:

1. **Veri katmanı:** `/api/*` uçlarından okusun. Backend hazır değilken `data/mock/` altındaki sahte JSON'la çalışsın (`VITE_MOCK=1`). `data/mock/` dosyalarını SOZLESME.md şekilleriyle sen oluştur: 1 marka, 5 çalıştırma, 6 gündem maddesi, 3 içerik fikri. Vite dev sunucusu `/api`'yi `localhost:8787`'ye (wrangler dev) proxy'lesin.
2. **Ekranlar (üstte sekmeler):**
   - **Bugün:** ajanın son çalıştırma kartı (ne zaman, kaç gönderi taradı, tek cümlelik özet, durum), "Şimdi çalıştır" düğmesi ve çalışırken canlı adım göstergesi (tara → analiz → üret → kaydet). Altında gündem maddeleri: tip etiketi, platform, ivme çubuğu, örnek linkler.
   - **İçerikler:** fikir kartları: görsel/video, başlık, kanca, senaryo sahneleri, açıklama metni, hashtag'ler. Düğmeler: Onayla, Reddet, Metni kopyala, Paylaşıldı olarak işaretle. Duruma göre filtre.
   - **Geçmiş:** çalıştırma listesi, birine tıklayınca o günün gündemi ve içerikleri.
   - **Marka profili:** profili gösteren ve düzenleyen form (ton kuralları, sütunlar ve oranları, izlenecek hashtag'ler ve hesaplar).
3. **Tasarım:** sade, profesyonel. Zemin açık gri, kartlar beyaz, metin siyah, vurgu rengi marka profilinden (`vurgu_rengi`, Kontak için #0000A8). Yazı tipi Sora (Google Fonts). Tüm metinler Türkçe. Masaüstünde ve telefonda düzgün görünsün.
4. `npm run build` çıktısı `frontend/dist`'e gitsin, Burak'ın Worker'ı bunu sunacak.

Sayfada hiçbir API anahtarı ya da gizli bilgi olmasın.
