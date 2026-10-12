# Nida: ilk prompt (Manus)

Önce Manus'un ayarlarında **API anahtarı** bölümü var mı bak. Varsa anahtarı kimseye yazılı atma, Burak'a yanında `wrangler secret put MANUS_API_KEY` ile girdir. Manus'un API dokümantasyon linkini de Burak'a ilet.

Sonra aşağıdakini Manus'a yapıştır. Görev linkini sakla, sunumda "Manus ne yaptı" kanıtı olacak.

---

Kontak için her gün otomatik çalışacak bir sosyal medya ajanının beynini tasarlıyoruz. Kontak, Türkiye'de motosiklet kültürü üzerine kurulu bir tanışma ve topluluk uygulaması: motorcular uygulamada tanışıyor, birlikte sürüşe çıkıyor, buluşma noktalarında bir araya geliyor. Ajan her sabah TikTok ve Instagram'da motosiklet gündemini tarayacak, yükselen konuları bulacak ve Kontak'a hazır içerik fikri üretecek.

Senden 4 şey istiyorum:

**1. Marka profili.** Aşağıdaki şekilde bir JSON ver. Ton kurallarını, içerik sütunlarını ve oranlarını sen öner (toplam 100):
```json
{
  "id": "kontak", "ad": "Kontak", "tanim": "…", "hedef_kitle": "…",
  "ton_kurallari": ["…"], "vurgu_rengi": "#0000A8",
  "sutunlar": [{ "ad": "…", "oran": 25 }],
  "izlenecek": { "tiktok_hashtagler": [], "instagram_hashtagler": [], "hesaplar": [] }
}
```

**2. İzlenecek kaynaklar.** TikTok ve Instagram'da Türkiye motosiklet sahnesini araştır. Gündemi en iyi yansıtan 10-15 hashtag'i (# işareti olmadan) ve 10-15 herkese açık hesabı (kulüp, topluluk, içerik üreticisi sayfası; bireysel kişisel profil değil) bul. Bunları marka profilinin `izlenecek` alanına koy, her biri için neden seçtiğini tek cümleyle yaz.

**3. Ajanın iki promptu.** Bunlar her gün otomatik çalışacak, insan müdahalesi olmayacak. Bu yüzden kesin, JSON çıktı veren promptlar olsun.
- `analiz.md`: girdi olarak son 48 saatin gönderileri gelir (link, hesap, açıklama, izlenme, beğeni, yorum, paylaşım, ses adı, tarih). Çıktı: yükselen konu, ses, format ve hashtag'lerin listesi. Her madde: `tip` (konu|ses|format|hashtag), `baslik`, `aciklama`, `platform` (tiktok|instagram|ikisi), `ivme` (0-100), `ornek_linkler`. Ayrıca tek cümlelik günlük özet.
- `uretim.md`: girdi olarak gündem listesi ve marka profili gelir. Çıktı: Kontak'a uygun 3 içerik fikri. Her fikir: `trend_id`, `platform`, `format` (kisa_video|carousel|gonderi), `baslik`, `kanca`, `senaryo` (sahne listesi), `aciklama_metni`, `hashtagler`, `gorsel_prompt` (fal.ai için İngilizce, 1080x1350, vurgu rengi lacivert #0000A8, gerçek kişi yüzü veya başka marka logosu yok). Fikirler ton kurallarına ve sütun oranlarına uysun.

**4. Test.** Gerçekçi 20 örnek gönderi uydur (Türkçe motosiklet içerikleri), iki promptu bunlarla çalıştır ve çıktıları göster. Zayıf noktaları düzeltip promptların son halini ver.

Çıktıları ayrı dosyalar olarak ver: `brand.json`, `analiz.md`, `uretim.md`, `test-ciktisi.json`.
