# Veri sözleşmesi

Backend, frontend ve ajan beyni bu şekilleri kullanır. Değiştirmek gerekirse önce burayı güncelleyin, ekibe haber verin.

## Klasör yapısı

```
backend/    Cloudflare Worker: API, Cron, Workflow, D1, R2 (Burak)
            frontend/dist'i statik dosya olarak da sunar, tek deploy
frontend/   Vite + React panel (Kemal)
prompts/    Ajan beyni promptları: analiz.md, uretim.md (Nida)
data/mock/  Sahte veri, aşağıdaki şekillerle birebir
```

## Marka: `GET /api/brand`

```json
{
  "id": "kontak",
  "ad": "Kontak",
  "tanim": "Türkiye'de motosiklet kültürü üzerine kurulu tanışma ve topluluk uygulaması",
  "hedef_kitle": "…",
  "ton_kurallari": ["…"],
  "vurgu_rengi": "#0000A8",
  "sutunlar": [{ "ad": "Rota", "oran": 25 }],
  "izlenecek": {
    "tiktok_hashtagler": ["motosiklet", "motorcu"],
    "instagram_hashtagler": ["motosiklet", "motorcu"],
    "hesaplar": ["herkese_acik_hesap_adi"]
  }
}
```

## Çalıştırma: `GET /api/runs`, `GET /api/runs/latest`

```json
{
  "id": "run_2026-10-12_0800",
  "tetik": "cron",
  "durum": "tamamlandi",
  "adim": "kaydet",
  "baslangic": "2026-10-12T08:00:00+03:00",
  "bitis": "2026-10-12T08:06:12+03:00",
  "taranan_gonderi": 412,
  "ozet": "Bugün kask kamerası POV videoları ve sonbahar rotaları yükseliyor."
}
```
`tetik`: cron | manuel. `durum`: calisiyor | tamamlandi | hata. `adim`: tara | analiz | uret | kaydet.

## Gündem: `GET /api/trends?run=<id>`

```json
[
  {
    "id": "t1",
    "run_id": "run_2026-10-12_0800",
    "tip": "format",
    "baslik": "Kask kamerası POV",
    "aciklama": "Sürüş anını sürücünün gözünden gösteren kısa videolar…",
    "platform": "tiktok",
    "ivme": 82,
    "ornek_linkler": ["https://www.tiktok.com/@hesap/video/…"]
  }
]
```
`tip`: konu | ses | format | hashtag. `platform`: tiktok | instagram | ikisi. `ivme`: 0-100.

## İçerik fikri: `GET /api/ideas?run=<id>`, `PATCH /api/ideas/:id`

```json
{
  "id": "i1",
  "run_id": "run_2026-10-12_0800",
  "trend_id": "t1",
  "platform": "tiktok",
  "format": "kisa_video",
  "baslik": "İlk Kontak sürüşü: POV",
  "kanca": "İlk 2 saniyede söylenecek/yazılacak cümle",
  "senaryo": ["Sahne 1: …", "Sahne 2: …", "Sahne 3: …"],
  "aciklama_metni": "Paylaşım açıklaması",
  "hashtagler": ["#motosiklet"],
  "gorsel_prompt": "fal.ai için İngilizce prompt",
  "gorsel_url": "https://…",
  "video_url": null,
  "durum": "yeni"
}
```
`format`: kisa_video | carousel | gonderi. `durum`: yeni | onaylandi | reddedildi | paylasildi.
`PATCH` gövdesi: `{ "durum": "onaylandi" }`.

## Başlatma: `POST /api/runs`

Gövde yok. `{ "id": "run_…", "durum": "calisiyor" }` döner. Panel `GET /api/runs/latest` ile 5 saniyede bir durumu izler.
