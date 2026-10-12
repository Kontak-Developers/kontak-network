# Prompt 1: Keşif (Burak)

Aşağıdakini olduğu gibi Manus'a yapıştır. Apify bağlıysa Manus kendisi çalıştırır. Bağlı değilse Apify sitesinde aynı aktörleri çalıştırıp JSON'u Manus'a yükle ve "bunu aşağıdaki formata çevir" de.

---

Kontak için topluluk keşfi yapacaksın. Kontak, Türkiye'de motosiklet kültürü üzerine kurulu bir tanışma ve topluluk uygulaması. Amacımız Kontak'ın iş birliği yapabileceği motosiklet topluluklarını ve motorcuların buluştuğu yerleri bulmak.

Apify ile şunları tara:
1. Instagram hashtag'leri: #motosiklet #motorcu #motorcuyuz #istanbulmotor #ankaramotor #izmirmotor #motosikletkulübü #scooter #motorsiklet. Paylaşım yapan hesaplardan topluluk niteliğinde olanları çıkar.
2. Google Maps: İstanbul, Ankara, İzmir, Bursa, Antalya'da "motorcu kafe", "motosiklet kulübü", "motorcu buluşma noktası".

Kurallar:
- Sadece herkese açık topluluk hesapları: kulüpler, gruplar, kafeler, işletmeler, motosiklet içerik üreticilerinin herkese açık sayfaları. Bireylerin kişisel profillerini alma.
- Telefon numarası, e-posta, kişi adı gibi kişisel veri yazma.
- Her topluluğa Kontak'la iş birliği uygunluğu için 1-10 arası puan ver ve tek cümlelik gerekçe yaz.
- En az 30 topluluk ve 15 buluşma noktası hedefle.

Çıktıyı iki JSON dosyası olarak ver:

`community.json`:
```json
[
  {
    "id": "c1",
    "ad": "Örnek Motor Kulübü",
    "tur": "kulüp",
    "platform": "instagram",
    "sehir": "İstanbul",
    "takipci": 12400,
    "link": "https://instagram.com/ornekhesap",
    "lat": 41.0369,
    "lng": 28.9850,
    "puan": 8,
    "neden": "Haftalık sürüş etkinlikleri düzenliyor, genç ve aktif kitle."
  }
]
```
`tur` şunlardan biri: kulüp, grup, kafe, işletme, içerik üreticisi, etkinlik.
`lat`/`lng`: hesabın şehri ya da mekânın konumu. Tam konum yoksa şehir merkezini kullan.

`places.json`:
```json
[
  {
    "id": "p1",
    "ad": "Örnek Motorcu Kafe",
    "tur": "kafe",
    "sehir": "İstanbul",
    "lat": 41.0,
    "lng": 29.0,
    "maps_link": "https://maps.google.com/?q=..."
  }
]
```

Sonunda kısa bir özet yaz: kaç hesap tarandı, kaç topluluk elendi, kaç tanesi kaldı, en yüksek puanlı 10 topluluk.
