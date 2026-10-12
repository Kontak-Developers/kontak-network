# Backend (Burak)

Tek Cloudflare Worker: API + Cron + Workflow `AgentRun` + panel dosyaları (`../frontend/dist`).
Uçlar ve veri şekilleri `SOZLESME.md` ile birebir.

## Akış

```
Cron 05:00 UTC (08:00 İstanbul) ya da POST /api/runs
  → AgentRun Workflow
     tara    Apify (TikTok + IG, takip listesindeki aktif/deneme/sabit etiketler)
             APIFY_TOKEN yoksa sahte veri
     analiz  ivme hesabı (src/ivme.ts) + beyin(analiz) → trends, takip listesi kararları
     uret    beyin(uretim) → 3 fikir + seriler; fal.ai görsel → R2 (VIDEO_AKTIF=1 ise 1 video)
             pazartesi: beyin(haftalik) → weekly
     kaydet  run tamamlandı, 30 günden eski ham gönderiler silinir (KVKK)
```

**Beyin:** `MANUS_API_KEY` varsa Manus API v2 (asenkron görev, `structured_output_schema` ile JSON).
Görev `MANUS_SURE_DK` içinde bitmezse ya da hata verirse Workers AI (llama 3.3 70b) yedeğe geçer.
Manus görev linkleri `runs.manus_linkleri`'ne yazılır (sunumda kanıt).

**Promptlar:** `../prompts/{analiz,uretim,haftalik}.md`. Derleme öncesi `scripts/promptlari-al.mjs`
bunları koda alır; dosya yoksa `src/brain.ts` içindeki varsayılan kullanılır. Çıktı şeması
promptta ne yazarsa yazsın `SEMALAR` ile zorlanır.

## Yerelde çalıştırma

```
cd backend
npm install
cp .dev.vars.example .dev.vars          # YETKI_KAPALI=1, anahtarlar boş → sahte tarama
npm run db:yerel                        # migration + seed
cd ../frontend && npm run build && cd ../backend
npm run dev                             # http://localhost:8787
curl -X POST localhost:8787/api/runs    # çalıştırmayı başlat
curl localhost:8787/api/runs/latest     # durumu izle
```

## Prod (yalnız prod, dev ortamı yok)

```
npx wrangler d1 create kontak-network            # çıkan database_id → wrangler.toml
npx wrangler r2 bucket create kontak-network-medya
npm run db:prod                                  # migration + seed (uzak D1)
npx wrangler secret put APIFY_TOKEN
npx wrangler secret put FAL_KEY
npx wrangler secret put MANUS_API_KEY
npm run deploy                                   # panel build + worker deploy
```

Worker'ın public adresi yok (`workers_dev = false`, route yok). Erişim prod panelden:
`panel.kontakdating.com/ag/*` → service binding → bu Worker. Panel isteğe `x-dis-onek: /ag`
başlığını ekler, medya adresleri bu önekle döner. Yetki: panelin moderatör jetonu
(`Authorization: Bearer`), kontak-api'ye sorulur.

## Uçlar

| Uç | |
|---|---|
| `GET/PUT /api/brand` | marka profili |
| `GET /api/runs`, `GET /api/runs/latest`, `POST /api/runs` | çalıştırmalar (aynı anda tek çalıştırma, 409) |
| `GET /api/trends?run=`, `GET /api/ideas?run=` | `run` isteğe bağlı |
| `PATCH /api/ideas/:id` | `{ "durum": "onaylandi" }` |
| `GET /api/weekly/latest` | haftalık özet |
| `GET /api/watchlist`, `PATCH /api/watchlist/:id` | `{ "durum": "sabit" \| "yasak" }` |
| `GET /api/decisions?run=`, `GET /api/series` | ajanın kararları, seriler |
| `GET /api/medya/<anahtar>` | R2'deki görsel/video (yetkisiz) |
| `GET /api/saglik` | hangi anahtarlar girili (değerleri değil) |
