# Prompt 2: Üretim (Nida)

İki bölüm var. A'yı hemen at. B için Burak'ın `community.json`'ını bekle (yaklaşık 11:00), dosyayı Manus'a yükleyip B'yi at.

---

## A) Marka profili + 7 günlük takvim + görseller

Kontak için bir haftalık içerik üreteceksin. Kontak, Türkiye'de motosiklet kültürü üzerine kurulu bir tanışma ve topluluk uygulaması: motorcular uygulamada tanışıyor, birlikte sürüşe çıkıyor, buluşma noktalarında bir araya geliyor.

1. Önce marka profilini çıkar ve `brand.json` olarak ver:
```json
{
  "id": "kontak",
  "ad": "Kontak",
  "tanim": "…",
  "hedef_kitle": "…",
  "ton_kurallari": ["…", "…"],
  "vurgu_rengi": "#0000A8",
  "sutunlar": [
    { "ad": "Topluluk", "oran": 30 },
    { "ad": "Rota", "oran": 25 },
    { "ad": "Tanışma", "oran": 25 },
    { "ad": "Güvenlik", "oran": 20 }
  ],
  "kaynaklar": {
    "hashtagler": ["#motosiklet", "#motorcu"],
    "maps_terimleri": ["motorcu kafe"],
    "hesaplar": []
  }
}
```
Sütunları ve oranları sen öner, toplamı 100 olsun.

2. 7 günlük Instagram takvimi hazırla, `calendar.json`:
```json
[
  {
    "gun": 1,
    "tarih": "2026-10-13",
    "sutun": "Rota",
    "baslik": "…",
    "metin": "Gönderinin tam metni, Türkçe, emojiler ölçülü",
    "hashtagler": ["#motosiklet"],
    "gorsel": "gun-1.png",
    "gorsel_prompt": "fal.ai'a verdiğin İngilizce prompt"
  }
]
```
En az 1-2 gün "Rota" sütunu olsun: Türkiye'den gerçek bir motosiklet rotası (ör. İstanbul–Şile sahil yolu), mesafe ve kısa tarif.

3. fal.ai ile her gün için bir görsel üret (1080x1350, Instagram dikey). Stil tutarlı olsun, vurgu rengi lacivert #0000A8. Rota günleri için harita/rota kartı hissi veren görsel. Görselde gerçek kişi yüzü veya başka markanın logosu olmasın. Dosya adları `gun-1.png` … `gun-7.png`.

---

## B) İş birliği mesajları (Burak'ın listesiyle)

Ekteki `community.json` Kontak için bulunan topluluk listesi. Puanı en yüksek 10 topluluk için kişiye özel iş birliği mesajı yaz (Instagram DM).

Kurallar:
- Her mesaj o topluluğa özel olsun: ne yaptıklarına, şehirlerine değin.
- Kısa: en fazla 5 cümle. Samimi ama profesyonel, "siz" dili.
- Somut bir teklif: ortak sürüş etkinliği, uygulamada topluluk sayfası, buluşma noktasında Kontak buluşması gibi.
- Satış dili ve abartı yok.

Çıktı `outreach.json`:
```json
[
  {
    "id": "o1",
    "community_id": "c1",
    "alici_ad": "Örnek Motor Kulübü",
    "alici_link": "https://instagram.com/ornekhesap",
    "kanal": "instagram_dm",
    "mesaj": "Mesajın tamamı",
    "durum": "taslak"
  }
]
```
