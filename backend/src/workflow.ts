// AgentRun: tara → analiz → üret → kaydet.
//
// Her step.do sonucu Cloudflare'de saklanır (checkpoint). Bir adım düşüp
// Workflow tekrar denediğinde önceki adımlar YENİDEN ÇALIŞMAZ — fal.ai
// patlarsa Apify taraması ikinci kez ücretlendirilmez.
//
// Uzun beklemeler (Apify, Manus, fal video) step.sleep ile: Worker CPU'su
// harcanmaz, Workflow uyur.

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep, type WorkflowStepConfig } from 'cloudflare:workers';
import type { Brand, Env, Etiket, Gonderi, Platform, RunParams } from './tipler';
import { taramaBaslat, taramaDurumu, taramaSonuclari, sahteTarama, type ApifyIs } from './apify';
import { ivmeHesapla, ornekGonderiler } from './ivme';
import { brainBaslat, brainYokla, workersAi, type BrainEki, type PromptAdi } from './brain';
import { avAdaylari, avBaslat, avMaliyeti, dokum, falaTasi, indirilenler, indirmeBaslat, patlayanlariSec, trTrendleri, type Aday, type AvIs, type TrTrend } from './avci';
import { formatlariYaz, harcamaYaz, kazananFormatlar, mevcutFormatlar, patlayanlariYaz, trTrendleriniYaz, uygunTrTrendleri } from './formatlar';
import { DIKEY_4_5, DIKEY_9_16, gorselUret, sahnePromptu, videoBaslat, videoYokla, type Uretilen } from './fal';
import { gonderileriYaz, markaOku, gonderileriOku } from './db';
import { syncSocialPerformance } from './social';
import {
  dizi, hataMetni, isoHafta, jsonAc, kisaId, metin, pazartesiMi, sayi, simdiIst, sinirla,
} from './yardimci';

const TEKRAR = {
  retries: { limit: 3, delay: '10 seconds' as const, backoff: 'exponential' as const },
  timeout: '5 minutes' as const,
};

/**
 * ⚠️ NEFES (13 Ekim gece): bir Worker çağrısında en fazla 50 dış istek
 *    (ücretsiz plan). Workflow `step.sleep` görmedikçe adımları AYNI
 *    çağrıda koşturuyor; sök zincirinde video taşıma (≈41) + döküm (≈27)
 *    art arda 50'yi aştı ve sonraki HER adım ("Too many subrequests") düştü.
 *    Uyku çağrıyı bitiriyor, sonraki adım taze kotayla başlıyor. Ağır
 *    adımların önüne konur; bedeli ~1 sn.
 */
function nefes(step: WorkflowStep, ad: string): Promise<void> {
  return step.sleep(`nefes-${ad}`, '1 second');
}

/** step.do'nun Serializable tipleri D1 satırları ve iç içe JSON'da çok katı; tek yerde gevşetildi. */
function yap<T>(step: WorkflowStep, ad: string, fn: () => Promise<T>): Promise<T>;
function yap<T>(step: WorkflowStep, ad: string, cfg: WorkflowStepConfig, fn: () => Promise<T>): Promise<T>;
function yap(step: WorkflowStep, ad: string, a: any, b?: any): Promise<any> {
  return (b ? step.do(ad, a, b) : step.do(ad, a)) as Promise<any>;
}
// Manus görev açılışı: art arda görevde geçici 400 dönüyor, bekleyip dene.
const MANUS_BASLAT = {
  retries: { limit: 4, delay: '20 seconds' as const, backoff: 'linear' as const },
  timeout: '2 minutes' as const,
};
const BITMIS_APIFY = new Set(['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED']);

export class AgentRun extends WorkflowEntrypoint<Env, RunParams> {
  async run(event: WorkflowEvent<RunParams>, step: WorkflowStep) {
    const { runId, tetik } = event.payload;
    const env = this.env;
    const adim = (ad: string) =>
      yap(step, `adim-${ad}`, () => env.DB.prepare('UPDATE runs SET adim = ? WHERE id = ?').bind(ad, runId).run().then(() => ad));

    try {
      // ───────────── 1. TARA ─────────────
      await adim('tara');
      const plan = await yap(step, 'tara-plan', async () => {
        const w = await env.DB.prepare(
          "SELECT etiket, platform FROM watchlist WHERE durum IN ('aktif','deneme','sabit')"
        ).all<Etiket>();
        const ilk = !(await env.DB.prepare('SELECT 1 FROM posts LIMIT 1').first());
        return { etiketler: w.results, ilk };
      });

      let taranan = 0;
      let avSonucu: { toplam: number; secilen: Aday[]; tr: TrTrend[] } | null = null;
      if (env.APIFY_TOKEN) {
        // İlk çalıştırmada referans boş: 7 günlük geçmiş için daha çok gönderi.
        const adet = sayi(env.GONDERI_PER_ETIKET) * (plan.ilk ? 3 : 1);
        /**
         * v2 (12 Ekim akşam): TikTok artık AVCI'dan (avci.ts) — patlama
         * oranı için takipçi sayısı gerekiyor, eski tarama bunu almıyordu.
         * Instagram eski taramayla sürüyor (ivme ve panel gündemi için).
         */
        const isler = await yap(step, 'apify-baslat', TEKRAR, async () => {
          const out: ApifyIs[] = [];
          const ig = plan.etiketler.filter((x) => x.platform === 'instagram').map((x) => x.etiket);
          if (ig.length) out.push(await taramaBaslat(env, 'instagram', ig, adet));
          return out;
        });
        const avIsler = await yap(step, 'av-baslat', TEKRAR, () =>
          avBaslat(env, plan.etiketler.filter((x) => x.platform === 'tiktok').map((x) => x.etiket), sayi(env.GONDERI_PER_ETIKET) || 30)
        );
        for (let i = 0; i < 40; i++) {
          await step.sleep(`apify-bekle-${i}`, '30 seconds');
          const bitti = await yap(step, `apify-durum-${i}`, TEKRAR, async () => {
            const d = await Promise.all([...isler, ...avIsler].map((x) => taramaDurumu(env, x.runId)));
            return d.every((s) => BITMIS_APIFY.has(s));
          });
          if (bitti) break;
        }
        // Yarım kalan run'ın dataset'i de o ana kadarkini verir.
        for (const is of isler) {
          taranan += await yap(step, `apify-kaydet-${is.platform}`, TEKRAR, async () => {
            const g = await taramaSonuclari(env, is);
            await gonderileriYaz(env, g, runId);
            return g.length;
          });
        }
        const av = await yap(step, 'av-topla', TEKRAR, async () => {
          let adaylar: Aday[] = [];
          let tr: TrTrend[] = [];
          for (const is of avIsler) {
            if (is.kaynak === 'tr_trend') tr = await trTrendleri(env, is).catch(() => []);
            else adaylar = adaylar.concat(await avAdaylari(env, is).catch(() => []));
            await harcamaYaz(env, runId, 'apify', `av:${is.kaynak}`, await avMaliyeti(env, is.runId).catch(() => 0), false);
          }
          // TR motor videoları eski ivme hesabını da beslesin (panel gündemi).
          await gonderileriYaz(
            env,
            adaylar.filter((a) => a.kaynak === 'tr_motor').map((a) => ({
              link: a.link, platform: 'tiktok' as const, hesap: a.hesap, aciklama: a.aciklama,
              hashtagler: (a.aciklama.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.slice(1).toLocaleLowerCase('tr')),
              ses: a.ses, format: 'video' as const, izlenme: a.izlenme, begeni: a.begeni, yorum: a.yorum,
              paylasim: a.paylasim, tarih: a.tarih,
            })),
            runId
          );
          const secilen = patlayanlariSec(adaylar);
          await patlayanlariYaz(env, runId, secilen);
          await trTrendleriniYaz(env, runId, tr);
          return { toplam: adaylar.length, secilen, tr };
        });
        taranan += av.toplam;
        avSonucu = av;
      } else {
        taranan = await yap(step, 'sahte-tara', async () => {
          const g = sahteTarama(plan.ilk ? 9 : 2);
          await gonderileriYaz(env, g, runId);
          return g.length;
        });
      }
      await yap(step, 'tara-sayi', () =>
        env.DB.prepare('UPDATE runs SET taranan_gonderi = ? WHERE id = ?').bind(taranan, runId).run().then(() => taranan)
      );

      // ───────────── 2. ANALİZ ─────────────
      await adim('analiz');

      /**
       * SÖK (v2): patlayanların videoları → fal depolama → döküm → Manus
       * videoları izleyip formatları söküyor → kütüphane. Bir halkası
       * düşerse analiz/üretim eski yoldan sürüyor (format yoksa da içerik
       * çıkıyor, yalnız daha zayıf).
       */
      if (avSonucu && avSonucu.secilen.length && env.FAL_KEY) {
        try {
          const secilen = avSonucu.secilen;
          const indirIs = await yap(step, 'sok-indir', TEKRAR, () => indirmeBaslat(env, secilen.map((a) => a.link)));
          for (let i = 0; i < 20; i++) {
            await step.sleep(`sok-indir-bekle-${i}`, '15 seconds');
            const bitti = await yap(step, `sok-indir-durum-${i}`, TEKRAR, async () =>
              BITMIS_APIFY.has(await taramaDurumu(env, indirIs.runId))
            );
            if (bitti) break;
          }
          await nefes(step, 'sok-kaynak');
          const kaynak = await yap(step, 'sok-kaynak', TEKRAR, async () => {
            const k = await indirilenler(env, indirIs);
            await harcamaYaz(env, runId, 'apify', 'indir:tiktok-video', await avMaliyeti(env, indirIs.runId).catch(() => 0), false);
            return k;
          });
          // Video başına 3 istek (Apify indir, fal başlat, fal yükle): 5'erli
          // parça ≈ 15 istek; her parça kendi çağrısında (nefes).
          const tasinacak = secilen.filter((a) => kaynak[a.link]);
          const dosyalar: Record<string, string> = {};
          for (let p = 0; p * 5 < tasinacak.length; p++) {
            await nefes(step, `sok-fal-${p}`);
            const parca = await yap(step, `sok-fal-${p}`, { ...TEKRAR, timeout: '10 minutes' as const }, async () => {
              const out: Record<string, string> = {};
              const liste = tasinacak.slice(p * 5, p * 5 + 5);
              // 2'şerli: video ≤ 19 MB, Worker belleği 128 MB.
              for (let i = 0; i < liste.length; i += 2) {
                await Promise.all(
                  liste.slice(i, i + 2).map(async (a, j) => {
                    const url = await falaTasi(env, kaynak[a.link], `patlayan-${p * 5 + i + j + 1}`).catch(() => null);
                    if (url) out[a.link] = url;
                  })
                );
              }
              return out;
            });
            Object.assign(dosyalar, parca);
          }
          await nefes(step, 'sok-dokum');
          const dokumler = await yap(step, 'sok-dokum', { ...TEKRAR, timeout: '10 minutes' as const }, async () => {
            const out: Record<string, string> = {};
            await Promise.all(
              Object.entries(dosyalar).map(async ([link, url]) => {
                const d = await dokum(env, url).catch(() => null);
                if (d) {
                  out[link] = d;
                  await env.DB.prepare('UPDATE patlayanlar SET dokum = ? WHERE link = ?').bind(d, link).run();
                }
              })
            );
            // Wizper ~ saniye başı tahmini (tahmini=1).
            await harcamaYaz(env, runId, 'fal', 'fal-ai/wizper', Object.keys(dosyalar).length * 0.01);
            return out;
          });
          const linkSirasi = Object.keys(dosyalar);
          const ekler: BrainEki[] = linkSirasi.map((l, i) => ({ url: dosyalar[l], ad: `video-${i + 1}.mp4`, mime: 'video/mp4' }));
          await nefes(step, 'sok-girdi');
          const sokGirdi = await yap(step, 'sok-girdi', async () => ({
            patlayanlar: secilen.map((a) => ({
              link: a.link, kaynak: a.kaynak, hesap: a.hesap, takipci: a.takipci, izlenme: a.izlenme, patlama: a.patlama,
              begeni: a.begeni, yorum: a.yorum, paylasim: a.paylasim, kaydetme: a.kaydetme, sure_sn: a.sure_sn,
              aciklama: a.aciklama, ses: a.ses, tarih: a.tarih, dokum: dokumler[a.link] ?? null,
              dosya: linkSirasi.includes(a.link) ? `video-${linkSirasi.indexOf(a.link) + 1}.mp4` : null,
            })),
            mevcut_formatlar: await mevcutFormatlar(env),
            tr_trendleri: avSonucu!.tr.slice(0, 40),
          }));
          const sok = await this.beyin(step, runId, 'sok', sokGirdi, ekler, 35);
          await nefes(step, 'sok-kaydet');
          await yap(step, 'sok-kaydet', () => formatlariYaz(env, runId, sok, secilen));
        } catch (e) {
          console.error('sök zinciri düştü, eski yoldan devam:', hataMetni(e));
        }
      }

      await nefes(step, 'analiz');
      const analizGirdi = await yap(step, 'analiz-girdi', async () => {
        const gonderiler = await gonderileriOku(env, 9);
        const ivme = ivmeHesapla(gonderiler);
        const takip = await env.DB.prepare('SELECT etiket, platform, durum, skor FROM watchlist').all();
        // Alan adları prompts/analiz.md "Girdi" bölümüyle aynı (Nida).
        return {
          calisma_zamani: simdiIst(),
          gonderiler: ornekGonderiler(gonderiler, 30).map((g) => ({
            platform: g.platform, link: g.link, hesap: g.hesap, aciklama: g.aciklama, hashtagler: g.hashtagler,
            izlenme: g.izlenme, begeniler: g.begeni, yorumlar: g.yorum, paylasimlar: g.paylasim,
            ses_adi: g.ses, tarih: g.tarih, icerik_formati: g.format,
          })),
          // analiz.md ivmeyi bu adlarla bekliyor; yoksa "önceki dönem kıyası yok" sayar.
          ivme_hashtag: ivme.filter((s) => s.tur === 'hashtag').slice(0, 25),
          ivme_ses: ivme.filter((s) => s.tur === 'ses').slice(0, 15),
          marka: await markaOku(env),
          takip_listesi: takip.results,
        };
      });
      const analizHam = (await this.beyin(step, runId, 'analiz', analizGirdi)) as any;
      // Şema dışı (Workers AI yedeği / prompt kendi şekliyle) yanıtları da kabul et.
      const analiz = Array.isArray(analizHam)
        ? { trendler: analizHam }
        : { ...analizHam, trendler: analizHam?.trendler ?? analizHam?.gundem ?? [] };

      const trendler = await yap(step, 'analiz-kaydet', async () => {
        const gecerliLink = new Set(analizGirdi.gonderiler.map((g: { link: string }) => g.link));
        const satirlar = dizi<any>(analiz?.trendler).slice(0, 10).map((t) => ({
          id: kisaId('t'),
          run_id: runId,
          tip: ['konu', 'ses', 'format', 'hashtag'].includes(t?.tip) ? t.tip : 'konu',
          baslik: metin(t?.baslik).slice(0, 120),
          aciklama: metin(t?.aciklama).slice(0, 600),
          platform: ['tiktok', 'instagram', 'ikisi'].includes(t?.platform) ? t.platform : 'ikisi',
          ivme: Math.round(sinirla(sayi(t?.ivme), 0, 100)),
          // Model link uydurmasın: yalnız taranan gönderilerden.
          ornek_linkler: dizi<string>(t?.ornek_linkler).filter((l) => gecerliLink.has(l)).slice(0, 4),
        })).filter((t) => t.baslik);
        await env.DB.batch(
          satirlar.map((t) =>
            env.DB.prepare(
              'INSERT INTO trends (id, run_id, tip, baslik, aciklama, platform, ivme, ornek_linkler) VALUES (?,?,?,?,?,?,?,?)'
            ).bind(t.id, t.run_id, t.tip, t.baslik, t.aciklama, t.platform, t.ivme, JSON.stringify(t.ornek_linkler))
          )
        );
        await env.DB.prepare('UPDATE runs SET ozet = ? WHERE id = ?').bind(metin(analiz?.ozet).slice(0, 300), runId).run();
        await takipKararlari(env, runId, dizi<any>(analiz?.takip), analizGirdi.ivme_hashtag);
        return satirlar;
      });

      // ───────────── 3. ÜRET ─────────────
      await adim('uret');
      // Şekil prompts/uretim.md "Girdi" bölümüyle aynı: gundem.{ozet, gundem[]}.
      await nefes(step, 'uretim');
      const uretimGirdi = await yap(step, 'uretim-girdi', async () => {
        let hesapPerformansi: any;
        try {
          hesapPerformansi = await syncSocialPerformance(env);
        } catch {
          // Social API failure must not stop public trend analysis/content ideation.
          hesapPerformansi = {
            note: 'Kontak hesap verileri alınamadı; genel trend analizi sürdürülüyor.',
            instagram: { connected: false, posts: [] }, tiktok: { connected: false, posts: [] },
            warnings: ['Hesap metrikleri bu çalıştırmada yok.'],
          };
        }
        return {
          marka: await markaOku(env),
          gundem: { ozet: metin(analiz?.ozet), gundem: trendler.map(({ run_id, ...t }) => t) },
          uygulama_rotalari: await uygulamaRotalari(env),
          aktif_seriler: (
            await env.DB.prepare(
              "SELECT id, ad, aciklama, format, bolum_sayisi, planlanan_bolumler FROM series WHERE durum = 'aktif' ORDER BY olusturma DESC LIMIT 5"
            ).all()
          ).results,
          hesap_performansi: hesapPerformansi,
          // v2: "trend OLMUŞ" kalıplar (formatlar.ts) ve marka için güvenli TR trendleri.
          kazanan_formatlar: await kazananFormatlar(env, 8),
          tr_trend_uygun: await uygunTrTrendleri(env, runId),
        };
      });
      const uretimHam = (await this.beyin(step, runId, 'uretim', uretimGirdi)) as any;
      // uretim.md kökte 3 elemanlı dizi istiyor; şema {seriler, fikirler}. İkisi de olur.
      const uretim = Array.isArray(uretimHam) ? { fikirler: uretimHam, seriler: [] } : uretimHam;

      const fikirler = await yap(step, 'uretim-kaydet', () => fikirleriYaz(env, runId, uretim, trendler.map((t) => t.id)));

      if (env.FAL_KEY) {
        // Her sahneye ayrı görsel: carousel'de her kart, videoda her sahne farklı kare.
        // Bir fikrin sahneleri tek adımda paralel üretilir; biri düşerse diğerleri kalır.
        const uretilen: Record<string, (Uretilen | null)[]> = {};
        for (const f of fikirler) {
          try {
            await nefes(step, `gorsel-${f.id}`);
            uretilen[f.id] = await yap(step, `gorsel-${f.id}`, { ...TEKRAR, retries: { ...TEKRAR.retries, limit: 2 } }, async () => {
              const kareler = kareListesi(f);
              const boyut = f.format === 'kisa_video' ? DIKEY_9_16 : DIKEY_4_5;
              if (!kareler.some(Boolean)) return kareler.map(() => null); // hepsi tasarım kartı
              const sonuc = await Promise.allSettled(
                kareler.map((k, i) =>
                  k ? gorselUret(env, sahnePromptu(k, f.gorsel_prompt), `${runId}/${f.id}-${i + 1}.jpg`, boyut) : Promise.resolve(null)
                )
              );
              const out = sonuc.map((r) => (r.status === 'fulfilled' ? r.value : null));
              sonuc.forEach((r, i) => r.status === 'rejected' && console.error('görsel üretilemedi', f.id, i + 1, hataMetni(r.reason)));
              if (!out.some(Boolean)) throw new Error('hiçbir sahne görseli üretilemedi');
              await sahneMedyasiYaz(env, f.id, out.map((o) => (o ? { gorsel_anahtar: o.anahtar } : {})));
              return out;
            });
          } catch (e) {
            console.error('görsel üretilemedi', f.id, hataMetni(e)); // fikir görselsiz de işe yarar
          }
        }

        // Video: bütçe kadar kısa video fikri; her sahne görselinden 5 sn'lik gerçek klip.
        const butce = sayi((await markaOku(env)).sinirlar?.butce?.video_per_run ?? 1);
        // Ajan hangi sahnenin video olacağına kendisi karar verir (tur: video); bütçe yalnız üst sınır.
        const videoFikirleri = fikirler.filter((f) => f.sahneler.some((s) => s.tur === 'video')).slice(0, Math.max(0, butce));
        if (env.VIDEO_AKTIF === '1') {
          for (const vf of videoFikirleri) {
            try {
              const gorseller = uretilen[vf.id] ?? [];
              // Yalnız tur=video sahneler, görseli olanlar; en fazla VIDEO_SAHNE_SINIRI klip
              let kalan = VIDEO_SAHNE_SINIRI;
              const kareler = vf.sahneler.map((s, i) =>
                s.tur === 'video' && gorseller[i] && kalan-- > 0 ? s.prompt || vf.gorsel_prompt : null
              );
              const isler = await yap(step, `video-baslat-${vf.id}`, TEKRAR, async () => {
                const r = await Promise.allSettled(
                  kareler.map((k, i) => (k ? videoBaslat(env, k, gorseller[i]?.falUrl) : Promise.resolve(null)))
                );
                r.forEach((x, i) => x.status === 'rejected' && console.error('video başlatılamadı', vf.id, i + 1, hataMetni(x.reason)));
                return r.map((x) => (x.status === 'fulfilled' ? x.value : null));
              });
              // null: sürüyor · '': başarısız (bir daha yoklanmaz) · anahtar: hazır
              const bitti: (string | null)[] = isler.map((is) => (is ? null : ''));
              for (let tur = 0; tur < 24 && bitti.some((b) => b === null); tur++) {
                await step.sleep(`video-bekle-${vf.id}-${tur}`, '30 seconds');
                const durum = await yap(step, `video-durum-${vf.id}-${tur}`, TEKRAR, async () =>
                  Promise.all(
                    isler.map(async (is, i) => {
                      if (!is || bitti[i] !== null) return bitti[i];
                      try {
                        return await videoYokla(env, is, `${runId}/${vf.id}-${i + 1}.mp4`);
                      } catch (e) {
                        console.error('video klibi başarısız', vf.id, i + 1, hataMetni(e));
                        return '';
                      }
                    })
                  )
                );
                durum.forEach((d, i) => d !== null && (bitti[i] = d));
              }
              await yap(step, `video-kaydet-${vf.id}`, async () => {
                await sahneMedyasiYaz(env, vf.id, bitti.map((b) => (b ? { video_anahtar: b } : {})));
                const ilk = bitti.find(Boolean);
                if (ilk) await env.DB.prepare('UPDATE ideas SET video_anahtar = ? WHERE id = ?').bind(ilk, vf.id).run();
                return bitti.filter(Boolean).length;
              });
            } catch (e) {
              console.error('video üretilemedi', vf.id, hataMetni(e));
            }
          }
        }
      }

      // Pazartesi: haftalık özet (hafta başına bir kez).
      if (pazartesiMi()) {
        const hafta = isoHafta();
        const varMi = await yap(step, 'haftalik-var-mi', async () =>
          !!(await env.DB.prepare('SELECT 1 FROM weekly WHERE hafta = ?').bind(hafta).first())
        );
        if (!varMi) {
          const girdi = await yap(step, 'haftalik-girdi', async () => {
            const r = await env.DB.prepare(
              `SELECT r.id AS run_id, r.baslangic, t.tip, t.baslik, t.platform, t.ivme
               FROM trends t JOIN runs r ON r.id = t.run_id
               WHERE r.baslangic >= ? ORDER BY r.baslangic`
            ).bind(simdiIst(new Date(Date.now() - 7 * 86400_000))).all();
            return { gundemler: r.results };
          });
          const h = (await this.beyin(step, runId, 'haftalik', girdi)) as any;
          await yap(step, 'haftalik-kaydet', async () => {
            const liste = (v: unknown) =>
              JSON.stringify(dizi<any>(v).map((x) => ({ baslik: metin(x?.baslik), ivme: Math.round(sinirla(sayi(x?.ivme), 0, 100)) })));
            await env.DB.prepare(
              'INSERT OR REPLACE INTO weekly (id, hafta, olusturma, ozet, kalici, yukselen, sonen, onerilen_odak) VALUES (?,?,?,?,?,?,?,?)'
            ).bind(
              `week_${hafta}`, hafta, simdiIst(), metin(h?.ozet), liste(h?.kalici), liste(h?.yukselen), liste(h?.sonen),
              JSON.stringify(dizi<string>(h?.onerilen_odak).map((x) => metin(x)).slice(0, 4))
            ).run();
            return true;
          });
        }
      }

      // ───────────── 4. KAYDET ─────────────
      await adim('kaydet');
      await yap(step, 'bitir', async () => {
        // KVKK: ham gönderiler 30 günden fazla tutulmaz.
        await env.DB.prepare('DELETE FROM posts WHERE taranma < ?').bind(simdiIst(new Date(Date.now() - 30 * 86400_000))).run();
        await env.DB.prepare("UPDATE runs SET durum = 'tamamlandi', bitis = ? WHERE id = ?").bind(simdiIst(), runId).run();
        return true;
      });
    } catch (e) {
      await yap(step, 'hata-kaydet', () =>
        env.DB.prepare("UPDATE runs SET durum = 'hata', hata = ?, bitis = ? WHERE id = ?")
          .bind(hataMetni(e).slice(0, 500), simdiIst(), runId).run().then(() => true)
      );
      throw e;
    }
  }

  /** Manus'u başlatır ve bekler; düşerse ya da süre dolarsa Workers AI. */
  private async beyin(
    step: WorkflowStep,
    runId: string,
    ad: PromptAdi,
    girdi: unknown,
    ekler: BrainEki[] = [],
    sureDk?: number
  ): Promise<unknown> {
    const env = this.env;
    let bas: any;
    try {
      bas = await yap(step, `${ad}-baslat`, MANUS_BASLAT, async () => {
      const b = await brainBaslat(env, ad, girdi, `Kontak Network · ${ad} · ${runId}`, ekler);
      if (b.saglayici === 'manus') {
        // Sunumda kanıt: görev linkleri çalıştırmaya yazılır.
        const r = await env.DB.prepare('SELECT manus_linkleri FROM runs WHERE id = ?').bind(runId).first<{ manus_linkleri: string }>();
        const linkler = jsonAc<string[]>(r?.manus_linkleri, []);
        linkler.push(b.taskUrl);
        await env.DB.prepare('UPDATE runs SET manus_linkleri = ? WHERE id = ?').bind(JSON.stringify(linkler), runId).run();
      }
      return b as any;
      });
    } catch (e) {
      console.error(`Manus ${ad} başlatılamadı, Workers AI yedeği:`, hataMetni(e));
      return yap(step, `${ad}-yedek`, TEKRAR, () => workersAi(env, ad, girdi) as Promise<any>);
    }
    if (bas.saglayici === 'workersai') return bas.sonuc;

    const tur = Math.max(1, Math.round((sureDk ?? (sayi(env.MANUS_SURE_DK) || 20)) * 3)); // 20 sn'de bir
    for (let i = 0; i < tur; i++) {
      await step.sleep(`${ad}-bekle-${i}`, '20 seconds');
      const y = await yap(step, `${ad}-yokla-${i}`, TEKRAR, () => brainYokla(env, bas.taskId) as Promise<any>);
      if (!y.bitti) continue;
      if ('sonuc' in y) return y.sonuc;
      console.error(`Manus ${ad}:`, y.hata);
      break;
    }
    return yap(step, `${ad}-yedek`, TEKRAR, () => workersAi(env, ad, girdi) as Promise<any>);
  }
}

/** Ajanın takip listesi kararları. Bütçe ve insan kararları (sabit/yasak) burada zorlanır. */
async function takipKararlari(
  env: Env,
  runId: string,
  kararlar: any[],
  ivme: { ad: string; ivme: number }[]
) {
  const marka = await markaOku(env);
  const maxAktif = sayi(marka.sinirlar?.butce?.aktif_hashtag ?? 8) || 8;
  const maxDeneme = sayi(marka.sinirlar?.butce?.deneme_hashtag ?? 3) || 3;
  const zaman = simdiIst();
  const skor = new Map(ivme.map((s) => [s.ad, s.ivme]));

  // Skorları tazele.
  const tum = (await env.DB.prepare('SELECT id, etiket, platform, durum FROM watchlist').all<any>()).results;
  const stmts = tum
    .filter((w) => skor.has(w.etiket))
    .map((w) => env.DB.prepare('UPDATE watchlist SET skor = ? WHERE id = ?').bind(skor.get(w.etiket), w.id));
  if (stmts.length) await env.DB.batch(stmts);

  const say = async (durum: string) =>
    ((await env.DB.prepare('SELECT COUNT(*) AS n FROM watchlist WHERE durum = ?').bind(durum).first<{ n: number }>())?.n ?? 0);
  const karar = (tur: string, hedef: string, neden: string) =>
    env.DB.prepare('INSERT INTO decisions (id, run_id, tur, hedef, neden, zaman) VALUES (?,?,?,?,?,?)')
      .bind(kisaId('d'), runId, tur, hedef, neden.slice(0, 300), zaman).run();

  for (const k of kararlar.slice(0, 10)) {
    const etiket = metin(k?.etiket).replace(/^#/, '').trim().toLocaleLowerCase('tr');
    const platform = k?.platform === 'instagram' ? 'instagram' : 'tiktok';
    const neden = metin(k?.neden);
    if (!etiket || etiket.length > 60) continue;
    const mevcut = await env.DB.prepare('SELECT id, durum FROM watchlist WHERE etiket = ? AND platform = ?')
      .bind(etiket, platform).first<{ id: string; durum: string }>();
    if (mevcut && (mevcut.durum === 'sabit' || mevcut.durum === 'yasak')) continue; // insanın kararı

    if (k?.karar === 'ekle') {
      if (mevcut && mevcut.durum !== 'elendi') continue;
      if ((await say('deneme')) >= maxDeneme) continue;
      if (mevcut) {
        await env.DB.prepare("UPDATE watchlist SET durum = 'deneme', neden = ?, eklenme = ? WHERE id = ?").bind(neden, zaman, mevcut.id).run();
      } else {
        await env.DB.prepare(
          "INSERT INTO watchlist (id, etiket, platform, durum, kaynak, skor, eklenme, neden) VALUES (?,?,?,'deneme','kesif',?,?,?)"
        ).bind(kisaId('w'), etiket, platform, skor.get(etiket) ?? 0, zaman, neden).run();
      }
      await karar('hashtag_ekle', `#${etiket}`, neden);
    } else if (k?.karar === 'kalici') {
      if (mevcut?.durum !== 'deneme' || (await say('aktif')) >= maxAktif) continue;
      await env.DB.prepare("UPDATE watchlist SET durum = 'aktif', neden = ? WHERE id = ?").bind(neden, mevcut.id).run();
      await karar('hashtag_kalici', `#${etiket}`, neden);
    } else if (k?.karar === 'cikar') {
      if (!mevcut || (mevcut.durum !== 'aktif' && mevcut.durum !== 'deneme')) continue;
      await env.DB.prepare("UPDATE watchlist SET durum = 'elendi', neden = ? WHERE id = ?").bind(neden, mevcut.id).run();
      await karar('hashtag_cikar', `#${etiket}`, neden);
    }
  }
}

type SahneOzet = { prompt: string; tur: 'foto' | 'video' | 'tasarim' };
type FikirOzet = { id: string; format: string; gorsel_prompt: string; video_prompt: string; sahneler: SahneOzet[] };

/** Kontak uygulamasındaki onaylı rotalar (panelden senkronlanır). Tablo yoksa boş. */
async function uygulamaRotalari(env: Env) {
  try {
    const r = await env.DB.prepare('SELECT veri FROM kontak_rotalar ORDER BY guncelleme DESC LIMIT 40').all<{ veri: string }>();
    return r.results.map((x) => {
      const v = jsonAc<any>(x.veri, {});
      return {
        id: v.id, ad: v.ad, sehir: v.sehir, km: Math.round((v.mesafe_m ?? 0) / 1000), sure_dk: Math.round((v.sure_s ?? 0) / 60),
        zorluk: v.zorluk, en_iyi_zaman: v.en_iyi_zaman ?? null, duraklar: (v.noktalar ?? []).map((n: any) => n.ad),
      };
    });
  } catch {
    return [];
  }
}

/** Kısa videoda en fazla bu kadar sahne klibe dönüşür (kredi). */
const VIDEO_SAHNE_SINIRI = 4;

/**
 * Görseli üretilecek sahneler (sahne sırasıyla, tasarım kartları null).
 * Tasarım kartı panelde uygulamanın tasarım diliyle çizilir, fal.ai'a gitmez.
 * Hiç sahne yoksa ortak stilden tek kare.
 */
function kareListesi(f: FikirOzet): (string | null)[] {
  const enFazla = f.format === 'gonderi' ? 2 : f.format === 'carousel' ? 7 : 5;
  const s = f.sahneler.slice(0, enFazla);
  if (!s.length) return [f.gorsel_prompt];
  return s.map((x) => (x.tur === 'tasarim' ? null : x.prompt.trim() || f.gorsel_prompt));
}

/** Sahnelerin R2 anahtarlarını sahneler JSON'una işler; kapak = ilk görsel. */
async function sahneMedyasiYaz(env: Env, fikirId: string, ekler: { gorsel_anahtar?: string; video_anahtar?: string }[]) {
  const r = await env.DB.prepare('SELECT sahneler, gorsel_anahtar FROM ideas WHERE id = ?').bind(fikirId).first<any>();
  if (!r) return;
  let sahneler = jsonAc<any[]>(r.sahneler, []);
  if (!sahneler.length) sahneler = ekler.map((_, i) => ({ sira: i + 1, sure_sn: 0, prompt: '', ekran_yazisi: '' }));
  sahneler = sahneler.map((s, i) => ({ ...s, ...(ekler[i] ?? {}) }));
  const kapak = r.gorsel_anahtar ?? sahneler.find((s) => s.gorsel_anahtar)?.gorsel_anahtar ?? null;
  await env.DB.prepare('UPDATE ideas SET sahneler = ?, gorsel_anahtar = ? WHERE id = ?').bind(JSON.stringify(sahneler), kapak, fikirId).run();
}

async function fikirleriYaz(env: Env, runId: string, uretim: any, trendIdleri: string[]): Promise<FikirOzet[]> {
  const zaman = simdiIst();
  const stmts: D1PreparedStatement[] = [];
  const karar = (tur: string, hedef: string, neden: string) =>
    stmts.push(
      env.DB.prepare('INSERT INTO decisions (id, run_id, tur, hedef, neden, zaman) VALUES (?,?,?,?,?,?)')
        .bind(kisaId('d'), runId, tur, hedef.slice(0, 120), neden.slice(0, 300), zaman)
    );

  // Seriler: var olanlar id ile, yeni açılanlar ad ile eşleşir.
  const mevcut = (await env.DB.prepare('SELECT id, ad, bolum_sayisi FROM series').all<any>()).results;
  const seriAd = new Map<string, { id: string; bolum: number }>();
  for (const s of mevcut) seriAd.set(s.id, { id: s.id, bolum: s.bolum_sayisi }), seriAd.set(s.ad.toLocaleLowerCase('tr'), { id: s.id, bolum: s.bolum_sayisi });

  for (const s of dizi<any>(uretim?.seriler).slice(0, 2)) {
    const ad = metin(s?.ad).slice(0, 80);
    if (!ad || seriAd.has(ad.toLocaleLowerCase('tr'))) continue;
    const id = kisaId('s');
    stmts.push(
      env.DB.prepare(
        "INSERT INTO series (id, ad, aciklama, format, durum, olusturan, bolum_sayisi, planlanan_bolumler, neden, olusturma) VALUES (?,?,?,?,'aktif','ajan',0,?,?,?)"
      ).bind(
        id, ad, metin(s?.aciklama).slice(0, 400),
        ['kisa_video', 'carousel', 'gonderi'].includes(s?.format) ? s.format : 'kisa_video',
        JSON.stringify(dizi<string>(s?.planlanan_bolumler).map((b) => metin(b)).slice(0, 10)), metin(s?.neden).slice(0, 300), zaman
      )
    );
    seriAd.set(ad.toLocaleLowerCase('tr'), { id, bolum: 0 });
    karar('seri_ac', ad, metin(s?.neden));
  }

  const ozet: FikirOzet[] = [];
  for (const f of dizi<any>(uretim?.fikirler).slice(0, 3)) {
    const id = kisaId('i');
    const baslik = metin(f?.baslik).slice(0, 140);
    if (!baslik) continue;
    const seriAnahtar = f?.seri ? metin(f.seri).toLocaleLowerCase('tr') : '';
    const seri = seriAnahtar ? seriAd.get(seriAnahtar) ?? seriAd.get(metin(f.seri)) : undefined;
    let bolumNo: number | null = null;
    if (seri) {
      seri.bolum += 1;
      bolumNo = f?.bolum_no ? sayi(f.bolum_no) : seri.bolum;
      stmts.push(env.DB.prepare('UPDATE series SET bolum_sayisi = bolum_sayisi + 1 WHERE id = ?').bind(seri.id));
      karar('bolum_planla', `${baslik}`, `Seri bölümü ${bolumNo}${f?.bolum_adi ? ': ' + metin(f.bolum_adi) : ''}`);
    }
    const fmt = ['kisa_video', 'carousel', 'gonderi'].includes(f?.format) ? f.format : 'gonderi';
    const sahneler = dizi<any>(f?.sahneler).slice(0, 8).map((s, i) => {
      // Eski şekil (tur yok): videoda video, diğerlerinde foto
      const tur = ['foto', 'video', 'tasarim'].includes(s?.tur) ? s.tur : fmt === 'kisa_video' ? 'video' : 'foto';
      // Şema düz alan veriyor (tasarim_*); eski/yedek çıktı iç içe tasarim verebilir.
      const ham = s?.tasarim && typeof s.tasarim === 'object'
        ? s.tasarim
        : {
            sablon: s?.tasarim_sablon, baslik: s?.tasarim_baslik, alt_baslik: s?.tasarim_alt_baslik, rota_id: s?.tasarim_rota_id,
            maddeler: Array.isArray(s?.tasarim_maddeler)
              ? s.tasarim_maddeler
              : metin(s?.tasarim_maddeler).split('\n').map((x) => x.trim()).filter(Boolean),
          };
      const t = ham.sablon && ham.sablon !== 'yok' ? ham : null;
      return {
        sira: sayi(s?.sira) || i + 1, sure_sn: sayi(s?.sure_sn), tur: tur === 'tasarim' && !t ? 'foto' : tur,
        prompt: metin(s?.prompt).slice(0, 1200), ekran_yazisi: metin(s?.ekran_yazisi).slice(0, 160),
        tasarim: t
          ? {
              sablon: metin(t.sablon).slice(0, 20), baslik: metin(t.baslik).slice(0, 120), alt_baslik: metin(t.alt_baslik).slice(0, 200),
              maddeler: dizi<string>(t.maddeler).map((m) => metin(m).slice(0, 140)).slice(0, 8), rota_id: metin(t.rota_id).slice(0, 60),
            }
          : null,
      };
    });
    const rota = f?.rota && typeof f.rota === 'object' && metin(f.rota.ad).trim()
      ? { ad: metin(f.rota.ad), km: sayi(f.rota.km), duraklar: dizi<string>(f.rota.duraklar).map((d) => metin(d)) }
      : null;
    const format = ['kisa_video', 'carousel', 'gonderi'].includes(f?.format) ? f.format : 'gonderi';
    const gorselPrompt = metin(f?.gorsel_prompt).slice(0, 1200);
    stmts.push(
      env.DB.prepare(
        `INSERT INTO ideas (id, run_id, trend_id, platform, format, baslik, kanca, senaryo, aciklama_metni, hashtagler,
          gorsel_prompt, durum, series_id, bolum_no, bolum_adi, sahneler, rota, onerilen_ses, olusturma)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'yeni',?,?,?,?,?,?,?)`
      ).bind(
        id, runId, trendIdleri.includes(f?.trend_id) ? f.trend_id : trendIdleri[0] ?? null,
        f?.platform === 'instagram' ? 'instagram' : 'tiktok', format, baslik, metin(f?.kanca).slice(0, 300),
        JSON.stringify(dizi<string>(f?.senaryo).map((x) => metin(x)).slice(0, 10)), metin(f?.aciklama_metni).slice(0, 2200),
        JSON.stringify(dizi<string>(f?.hashtagler).map((x) => metin(x)).slice(0, 15)), gorselPrompt,
        seri?.id ?? null, bolumNo, f?.bolum_adi ? metin(f.bolum_adi).slice(0, 80) : null,
        JSON.stringify(sahneler), rota ? JSON.stringify(rota) : null, f?.onerilen_ses ? metin(f.onerilen_ses).slice(0, 120) : null, zaman
      )
    );
    karar('icerik_uret', baslik, `${format}, ${f?.platform === 'instagram' ? 'Instagram' : 'TikTok'}`);
    ozet.push({
      id, format, gorsel_prompt: gorselPrompt,
      video_prompt: sahneler.map((s) => s.prompt).filter(Boolean).join(' Then: ') || gorselPrompt,
      sahneler: sahneler.map((s) => ({ prompt: s.prompt, tur: s.tur as SahneOzet['tur'] })),
    });
  }
  if (stmts.length) await env.DB.batch(stmts);
  return ozet;
}
