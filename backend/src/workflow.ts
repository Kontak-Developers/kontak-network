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
import { avAdaylari, avBaslat, avMaliyeti, dokum, falaTasi, igAdaylari, igHesaplari, igReelBaslat, indirilenler, indirmeBaslat, patlayanlariSec, trTrendleri, type Aday, type AvIs, type IgHesap, type TrTrend } from './avci';
import { formatlariYaz, harcamaYaz, kazananFormatlar, mevcutFormatlar, patlayanlariYaz, trTrendleriniYaz, uygunTrTrendleri } from './formatlar';
import { DIKEY_4_5, DIKEY_9_16, gorselUret, r2yeYaz, sahnePromptu, videoBaslat, videoYokla, type Uretilen } from './fal';
import { gonderileriYaz, markaOku, gonderileriOku } from './db';
import { kreatifNormalize, kreatifYaz, reelSuresiniSinirla, rotaKartiYaz, sonIcerikler, type KreatifIcerik } from './kreatif';
import {
  altyaziAdresi, altyaziBaslat, bugunkuFal, kareUret, klipAdresi, klipBaslat, kuyrukYokla, maliyetTahmini,
  montajAdresi, montajBaslat, muzikBaslat, sesAdresi, seslendir, type KuyrukIsi, type CekimPlani,
  gorselKimlikEki, kartUret, denetliUret, klipDenetle, hamFotoAyarla, falaYukle, yaziAraliklari, yaziCizelgesiBaslat, yaziKaristirBaslat, sesGeriBaslat, videoAdresi, YAZI_FPS,
} from './studyo';
import { ayarlariOku, type AjanAyarlari } from './ayarlar';
import { carouselKarti, memeKarti, reelLevhasi, urunKarti } from './yazi';
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
/** Üretilen klibin gerçek süresi: Veo 4/6/8 sn, Kling 5 sn. */
/**
 * Üretilen klibin montajdaki süresi. Veo 4/6/8 sn üretir, Kling 5 sn; montaj
 * klibi planlanan süreye KIRPAR (13 Eki gece, Şevval: "reeller çok uzun").
 * Reel 2-3 çekim, toplam 7-12 sn.
 */
function klipSuresiMs(c: { sure_sn: number; hero: boolean }, heroVeo: boolean): number {
  const plan = Math.round(Math.min(8, Math.max(2, c.sure_sn)) * 1000);
  if (c.hero && heroVeo) return Math.min(plan, (c.sure_sn >= 8 ? 8 : c.sure_sn >= 6 ? 6 : 4) * 1000);
  return Math.min(plan, 5000);
}

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
    const { runId, tetik, stok, yazi, reel } = event.payload;
    const env = this.env;
    const adim = (ad: string) =>
      yap(step, `adim-${ad}`, () => env.DB.prepare('UPDATE runs SET adim = ? WHERE id = ?').bind(ad, runId).run().then(() => ad));

    /**
     * STOK MODU (13 Ekim): fal/Apify kredisi 2 gün içinde bitiyor; paylaşım
     * stoğu için kütüphanedeki kazanan formatlarla art arda kreatif turu.
     * Tarama ve sökme yok (formatlar zaten taze). Her tur farklı bir odakla
     * ve son_icerikler'e bakarak tekrar etmeden 3 içerik çıkarır.
     */
    // Panelden yazılan ayarlar (Stüdyo sekmesi); her çalıştırmanın başında bir kez.
    const ayar = await yap(step, 'ayarlar', () => ayarlariOku(env));
    hamFotoAyarla(ayar.studyo.ham_foto);

    if (reel) {
      try {
        const liste = await yap(step, 'reel-liste', async () => {
          const marka = await markaOku(env);
          const kimlik = gorselKimlikEki(marka);
          const r = await env.DB.prepare(
            `SELECT id, puan, uretim_plani FROM ideas WHERE format = 'kisa_video' AND uretim_plani IS NOT NULL
               AND COALESCE(reel_durum, '') != 'hazir' AND id IN (${reel.ids.map(() => '?').join(',') || "''"})`
          ).bind(...reel.ids).all<any>();
          return r.results.map((x) => {
            const plan = jsonAc<CekimPlani>(x.uretim_plani, { cekimler: [], stil: '', seslendirme: null, muzik: null });
            // Eski planlar (13 Eki öncesi 3-4 çekim, 17-23 sn) yeni kurallara girer: ≤3 çekim, ≤12 sn, müzik yok.
            reelSuresiniSinirla(plan.cekimler);
            plan.cekimler.forEach((c, i) => (c.sira = i + 1));
            return { id: x.id as string, format: 'kisa_video' as const, puan: Number(x.puan) || 0, plan: { ...plan, muzik: null, stil: [plan.stil, kimlik].filter(Boolean).join('. ') } };
          });
        });
        for (const r of liste) {
          try {
            await this.reelUret(step, runId, r, reel.tavan, ayar);
          } catch (e) {
            console.error('reel yeniden üretilemedi', r.id, hataMetni(e));
            await yap(step, `reel-hata-${r.id}`, () =>
              env.DB.prepare("UPDATE ideas SET reel_durum = 'hata' WHERE id = ?").bind(r.id).run().then(() => true)
            );
          }
        }
        await yap(step, 'bitir', () =>
          env.DB.prepare("UPDATE runs SET durum = 'tamamlandi', adim = 'kaydet', bitis = ? WHERE id = ?").bind(simdiIst(), runId).run().then(() => true)
        );
      } catch (e) {
        await yap(step, 'hata-kaydet', () =>
          env.DB.prepare("UPDATE runs SET durum = 'hata', hata = ?, bitis = ? WHERE id = ?").bind(hataMetni(e).slice(0, 500), simdiIst(), runId).run().then(() => true)
        );
      }
      return;
    }

    if (yazi) {
      try {
        await this.yaziGom(step, runId, yazi.ids);
        await yap(step, 'bitir', () =>
          env.DB.prepare("UPDATE runs SET durum = 'tamamlandi', adim = 'kaydet', bitis = ? WHERE id = ?").bind(simdiIst(), runId).run().then(() => true)
        );
      } catch (e) {
        await yap(step, 'hata-kaydet', () =>
          env.DB.prepare("UPDATE runs SET durum = 'hata', hata = ?, bitis = ? WHERE id = ?").bind(hataMetni(e).slice(0, 500), simdiIst(), runId).run().then(() => true)
        );
      }
      return;
    }

    if (stok) {
      try {
        await adim('uret');
        const temel = await yap(step, 'stok-girdi', async () => {
          const sonRun = await env.DB.prepare('SELECT run_id FROM tr_trendleri ORDER BY rowid DESC LIMIT 1').first<{ run_id: string }>();
          return {
            marka: await markaOku(env),
            kazanan_formatlar: await kazananFormatlar(env, 8),
            tr_trend_uygun: sonRun ? await uygunTrTrendleri(env, sonRun.run_id) : [],
            aktif_seriler: (
              await env.DB.prepare(
                "SELECT id, ad, aciklama, format, bolum_sayisi, planlanan_bolumler FROM series WHERE durum = 'aktif' ORDER BY olusturma DESC LIMIT 5"
              ).all()
            ).results,
            hesap_performansi: { note: 'Stok modu: hesap verisi alınmadı.' },
          };
        });
        const tur = Math.min(Math.max(1, Math.round(stok.tur)), 12);
        for (let t = 1; t <= tur; t++) {
          const odak = stok.odaklar?.[(t - 1) % stok.odaklar.length] ?? '';
          try {
            await this.kreatifUret(step, runId, { ...temel, stok_turu: { tur: t, toplam: tur, odak, karisim: stok.karisim || ayar.kreatif.karisim } }, { onek: `s${t}`, tavan: stok.tavan, ayar });
          } catch (e) {
            console.error(`stok turu ${t} düştü:`, hataMetni(e));
          }
        }
        await adim('kaydet');
        await yap(step, 'bitir', () =>
          env.DB.prepare("UPDATE runs SET durum = 'tamamlandi', bitis = ? WHERE id = ?").bind(simdiIst(), runId).run().then(() => true)
        );
      } catch (e) {
        await yap(step, 'hata-kaydet', () =>
          env.DB.prepare("UPDATE runs SET durum = 'hata', hata = ?, bitis = ? WHERE id = ?")
            .bind(hataMetni(e).slice(0, 500), simdiIst(), runId).run().then(() => true)
        );
      }
      return;
    }

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
          avBaslat(env, plan.etiketler.filter((x) => x.platform === 'tiktok').map((x) => x.etiket), ayar.av)
        );
        for (let i = 0; i < 40; i++) {
          await step.sleep(`apify-bekle-${i}`, '30 seconds');
          const bitti = await yap(step, `apify-durum-${i}`, TEKRAR, async () => {
            const d = await Promise.all([...isler, ...avIsler].map((x) => taramaDurumu(env, x.runId)));
            return d.every((s) => BITMIS_APIFY.has(s));
          });
          if (bitti) break;
        }
        // Instagram 2. aşama: keşfedilen + izlenen hesapların son reelleri.
        let igIs: AvIs | null = null;
        let igHesap: IgHesap[] = [];
        if (avIsler.some((x) => x.kaynak === 'ig_kesif')) {
          const ig = await yap(step, 'ig-hesap', TEKRAR, async () => {
            const h = await igHesaplari(env, avIsler, ayar.av);
            for (const is of avIsler.filter((x) => x.kaynak === 'ig_kesif'))
              await harcamaYaz(env, runId, 'apify', 'av:ig_kesif', await avMaliyeti(env, is.runId).catch(() => 0), false);
            return { hesaplar: h, is: h.length ? await igReelBaslat(env, h, ayar.av) : null };
          }).catch((e) => {
            console.error('Instagram hesap keşfi düştü:', hataMetni(e));
            return { hesaplar: [] as IgHesap[], is: null };
          });
          igHesap = ig.hesaplar;
          igIs = ig.is;
          if (igIs) {
            for (let i = 0; i < 24; i++) {
              await step.sleep(`ig-bekle-${i}`, '20 seconds');
              const bitti = await yap(step, `ig-durum-${i}`, TEKRAR, async () => BITMIS_APIFY.has(await taramaDurumu(env, igIs!.runId)));
              if (bitti) break;
            }
          }
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
            if (is.kaynak === 'ig_kesif') continue; // ig-hesap adımında
            if (is.kaynak === 'tr_trend') tr = await trTrendleri(env, is).catch(() => []);
            else adaylar = adaylar.concat(await avAdaylari(env, is).catch(() => []));
            await harcamaYaz(env, runId, 'apify', `av:${is.kaynak}`, await avMaliyeti(env, is.runId).catch(() => 0), false);
          }
          if (igIs) {
            adaylar = adaylar.concat(await igAdaylari(env, igIs, igHesap).catch(() => []));
            await harcamaYaz(env, runId, 'apify', 'av:ig_reel', await avMaliyeti(env, igIs.runId).catch(() => 0), false);
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
          const secilen = patlayanlariSec(adaylar, ayar.av);
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
      /**
       * ⚠️ MANUS KREDİSİ: sök en pahalı adım (Manus her videoyu izliyor).
       *    Son 6 saatte söküm yapıldıysa kütüphane güncel sayılıyor; elle
       *    üst üste "Şimdi tara" kredi yakmasın. Sabah cron'u her zaman söker.
       */
      const tazeSok = tetik === 'cron'
        ? false
        : await yap(step, 'sok-taze-mi', async () => {
            const r = await env.DB.prepare('SELECT MAX(son_gorulme) AS son FROM formatlar').first<{ son: string | null }>();
            return !!r?.son && Date.parse(r.son) > Date.now() - ayar.sok.taze_saat * 3600_000;
          });
      if (avSonucu && avSonucu.secilen.length && env.FAL_KEY && !tazeSok) {
        try {
          const secilen = avSonucu.secilen;
          const ttLinkler = secilen.filter((a) => a.platform === 'tiktok').map((a) => a.link);
          const indirIs = await yap(step, 'sok-indir', TEKRAR, () => indirmeBaslat(env, ttLinkler.length ? ttLinkler : secilen.slice(0, 1).map((a) => a.link)));
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
            // Instagram reel'i: Apify zaten doğrudan mp4 adresi verdi.
            for (const a of secilen) if (a.platform === 'instagram' && a.video_url) k[a.link] = a.video_url;
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
          // Manus en fazla 10 ek görüyor (13 Ekim: 11 ekten 10'u). En çok patlayan 10.
          const linkSirasi = secilen.filter((a) => dosyalar[a.link]).sort((x, y) => y.patlama - x.patlama).slice(0, ayar.sok.izlenecek_video).map((a) => a.link);
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
          const sok = await this.beyin(step, runId, 'sok', sokGirdi, ekler, ayar.sok.sure_dk);
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
        // ⚠️ 14 Eki 08:00: analiz 0 gündem döndürünce boş batch "No SQL statements detected" ile bütün çalıştırmayı düşürdü.
        if (satirlar.length) await env.DB.batch(
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
      /**
       * v2 (13 Ekim): kütüphanede kazanan format varsa KREATİF DİREKTÖR +
       * STÜDYO; yoksa (ilk gün, sök düştüyse) eski üretim yolu yedek.
       */
      const v2 = dizi((uretimGirdi as any).kazanan_formatlar).length > 0;
      if (v2) {
        const odaklar = ayar.kreatif.odaklar;
        const odak = odaklar.length ? odaklar[Math.floor(Date.now() / 86400_000) % odaklar.length] : '';
        await this.kreatifUret(step, runId, odak ? { ...uretimGirdi, stok_turu: { tur: 1, toplam: 1, odak, karisim: ayar.kreatif.karisim } } : uretimGirdi, { ayar });
      } else {
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

  /**
   * KREATİF DİREKTÖR + STÜDYO (v2 Faz 2-3). Manus 3 içerik + rota kartı
   * yazıyor; reel'ler puan sırasıyla ve bütçe bekçisinden geçerek
   * stüdyoda üretiliyor, carousel'lerin her kartına görsel, rota kartına
   * görsel.
   */
  private async kreatifUret(step: WorkflowStep, runId: string, uretimGirdi: any, o: { onek?: string; tavan?: number; ayar: AjanAyarlari }) {
    const env = this.env;
    const p = o.onek ? `${o.onek}-` : '';
    const kimlik = gorselKimlikEki(uretimGirdi.marka);
    const stilli = (stil: string) => [stil, kimlik].filter(Boolean).join('. ');
    await nefes(step, `${p}kreatif`);
    const girdi = await yap(step, `${p}kreatif-girdi`, async () => ({
      kazanan_formatlar: uretimGirdi.kazanan_formatlar,
      tr_trend_uygun: uretimGirdi.tr_trend_uygun,
      hesap_performansi: uretimGirdi.hesap_performansi,
      aktif_seriler: uretimGirdi.aktif_seriler,
      marka: uretimGirdi.marka,
      son_icerikler: await sonIcerikler(env),
      patlayanlar_platform: await platformOzeti(env),
      ...(uretimGirdi.stok_turu ? { stok_turu: uretimGirdi.stok_turu } : {}),
      ayarlar: {
        aday: o.ayar.kreatif.aday, secim: o.ayar.kreatif.secim, min_puan: o.ayar.kreatif.min_puan,
        karisim: o.ayar.kreatif.karisim, ek_talimat: o.ayar.kreatif.ek_talimat,
      },
    }));
    const k = (await this.beyin(step, runId, 'kreatif', girdi, [], o.ayar.kreatif.sure_dk, `${p}kreatif`)) as any;
    await nefes(step, `${p}kreatif-kaydet`);
    const icerikler = await yap(step, `${p}kreatif-kaydet`, () =>
      kreatifYaz(env, runId, kreatifNormalize(k), dizi<any>(uretimGirdi.kazanan_formatlar).map((f) => f.id))
    );
    const rota = await yap(step, `${p}rota-kaydet`, () => rotaKartiYaz(env, runId, kreatifNormalize(k)?.rota_karti));
    if (!env.FAL_KEY) return;

    if (rota?.prompt) {
      await nefes(step, `${p}rota-gorsel`);
      await yap(step, `${p}rota-gorsel`, TEKRAR, async () => {
        const anahtar = await r2yeYaz(env, await kartUret(env, sahnePromptu(rota.prompt, kimlik)), `${runId}/rota-${rota.id}.jpg`);
        await env.DB.prepare('UPDATE rota_kartlari SET gorsel_anahtar = ? WHERE id = ?').bind(anahtar, rota.id).run();
        await harcamaYaz(env, runId, 'fal', 'flux-ultra (rota)', 0.06);
        return anahtar;
      }).catch((e) => console.error('rota görseli', hataMetni(e)));
    }

    for (const c of icerikler.filter((x) => x.format === 'carousel')) {
      await nefes(step, `carousel-${c.id}`);
      await yap(step, `carousel-${c.id}`, TEKRAR, async () => {
        const sonuc = await Promise.allSettled(
          c.plan.cekimler.map(async (ck, i) => {
            // Ürün kartı: yapay zekâ görseli yok, yazı adımında gerçek ekranla çiziliyor.
            if (ck.uygulama_ekrani) return '';
            const den = { acik: o.ayar.studyo.kalite_denetimi, model: o.ayar.studyo.denetim_modeli };
            const x = await denetliUret(env, (ek) => kartUret(env, sahnePromptu(ek ? `${ck.kare_prompt}. ${ek}` : ck.kare_prompt, stilli(c.plan.stil))), den);
            if (x.denetim && !x.denetim.temiz) console.warn('kart kusurlu kaldı', c.id, i + 1, x.denetim.sorunlar.join('; '));
            return r2yeYaz(env, x.url, `${runId}/${c.id}-${i + 1}.jpg`);
          })
        );
        sonuc.forEach((r, i) => r.status === 'rejected' && console.error('carousel kartı', c.id, i + 1, hataMetni(r.reason)));
        if (!sonuc.some((r) => r.status === 'fulfilled')) throw new Error('carousel kartlarının hiçbiri üretilemedi');
        await sahneMedyasiYaz(env, c.id, sonuc.map((r) => (r.status === 'fulfilled' && r.value ? { gorsel_anahtar: r.value } : {})));
        await harcamaYaz(env, runId, 'fal', 'flux-ultra (carousel)', c.plan.cekimler.filter((x) => !x.uygulama_ekrani).length * 0.06);
        return true;
      }).catch((e) => console.error('carousel görselleri', hataMetni(e)));
      if (o.ayar.studyo.yazi_gom) {
        await yap(step, `carousel-yazi-${c.id}`, TEKRAR, () => carouselYazilari(env, c.id, o.ayar.studyo.imza)).catch((e) => console.error('carousel yazıları', hataMetni(e)));
      }
    }

    const reeller = icerikler.filter((x) => x.format === 'kisa_video').sort((a, b) => b.puan - a.puan);
    for (const r of reeller) {
      try {
        await this.reelUret(step, runId, { ...r, plan: { ...r.plan, stil: stilli(r.plan.stil) } }, o.tavan, o.ayar);
      } catch (e) {
        console.error('reel üretilemedi', r.id, hataMetni(e));
        await yap(step, `reel-hata-${r.id}`, () =>
          env.DB.prepare("UPDATE ideas SET reel_durum = 'hata' WHERE id = ?").bind(r.id).run().then(() => true)
        );
      }
    }
  }

  /** Bir reel: bütçe → kareler → klipler (+ses, müzik) → montaj → altyazı → R2. */
  private async reelUret(step: WorkflowStep, runId: string, r: KreatifIcerik, tavanUst: number | undefined, ayar: AjanAyarlari) {
    const env = this.env;
    const plan = r.plan;
    if (!plan.cekimler.length) return;
    await nefes(step, `reel-butce-${r.id}`);
    const karar = await yap(step, `reel-butce-${r.id}`, async () => {
      // Tavan canlı okunuyor: süren işte panelden tavanı artırmak bir sonraki reelde geçerli.
      const canli = (await ayarlariOku(env)).butce.fal_gunluk_tavan;
      const tavan = Math.max(tavanUst ?? 0, canli);
      const harcanan = await bugunkuFal(env, simdiIst().slice(0, 10));
      const k = ayar.butce.maliyet_katsayi;
      let heroVeo = ayar.studyo.hero_veo;
      let tahmin = maliyetTahmini(plan, heroVeo, k);
      if (harcanan + tahmin > tavan && heroVeo) {
        heroVeo = false;
        tahmin = maliyetTahmini(plan, false, k);
      }
      const uret = harcanan + tahmin <= tavan;
      await env.DB.prepare('UPDATE ideas SET reel_durum = ?, reel_maliyet = ? WHERE id = ?')
        .bind(uret ? 'uretiliyor' : 'atlandi', tahmin, r.id).run();
      return { uret, heroVeo, tahmin, harcanan, tavan };
    });
    if (!karar.uret) {
      console.log(`reel atlandı (bütçe): ${r.id} bugün ${karar.harcanan}$ + ${karar.tahmin}$ > ${karar.tavan}$`);
      return;
    }

    // 1) Kareler (senkron, paralel) — R2'ye de yazılıyor (panelde sahne önizlemesi).
    const kareler = await yap(step, `reel-kare-${r.id}`, { ...TEKRAR, timeout: '10 minutes' as const }, async () => {
      const den = { acik: ayar.studyo.kalite_denetimi, model: ayar.studyo.denetim_modeli };
      const sonuc = await Promise.all(plan.cekimler.map((c) => denetliUret(env, (ek) => kareUret(env, c, plan.stil, ek), den)));
      sonuc.forEach((x, i) => x.denetim && !x.denetim.temiz && console.warn('kare kusurlu kaldı', r.id, i + 1, x.denetim.sorunlar.join('; ')));
      const yeniden = sonuc.filter((x) => x.deneme > 1).length;
      if (yeniden) await harcamaYaz(env, runId, 'fal', 'kare yeniden üretim (denetim)', yeniden * 0.06);
      const urller = sonuc.map((x) => x.url);
      const anahtarlar = await Promise.all(urller.map((u, i) => r2yeYaz(env, u, `${runId}/${r.id}-k${i + 1}.jpg`)));
      await sahneMedyasiYaz(env, r.id, anahtarlar.map((a) => ({ gorsel_anahtar: a })));
      return urller;
    });

    // 2) Klipler + müzik kuyruğa; seslendirme senkron.
    const isler = await yap(step, `reel-klip-${r.id}`, TEKRAR, () =>
      Promise.all(plan.cekimler.map((c, i) => klipBaslat(env, c, kareler[i], karar.heroVeo, !!plan.seslendirme)))
    );
    const toplamMs = plan.cekimler.reduce((t, c) => t + klipSuresiMs(c, karar.heroVeo), 0);
    const muzikIs = plan.muzik && ayar.studyo.muzik
      ? await yap(step, `reel-muzik-${r.id}`, TEKRAR, () => muzikBaslat(env, plan.muzik!, toplamMs, !!plan.seslendirme))
      : null;
    const ses = plan.seslendirme ? await yap(step, `reel-ses-${r.id}`, TEKRAR, () => seslendir(env, plan.seslendirme!, ayar.studyo.ses)) : null;

    const hepsi = muzikIs ? [...isler, muzikIs] : isler;
    const bitti = await this.kuyrukBekle(step, `reel-${r.id}`, hepsi, 30);
    let klipUrller = plan.cekimler.map((_, i) => klipAdresi(bitti[i]));

    // 2b) Video denetimi: kusurlu klip (uydurma tabela/arayüz, yüz, bozuk motor) bir kez yeniden üretilir.
    if (ayar.studyo.video_denetimi) {
      const kusurlu = await yap(step, `reel-video-denetim-${r.id}`, { ...TEKRAR, timeout: '10 minutes' as const }, async () => {
        const d = await Promise.all(klipUrller.map((u) => klipDenetle(env, u, ayar.studyo.denetim_modeli)));
        d.forEach((x, i) => !x.temiz && console.warn('klip kusurlu', r.id, i + 1, x.sorunlar.join('; ')));
        return d.map((x, i) => (x.temiz ? -1 : i)).filter((i) => i >= 0);
      });
      if (kusurlu.length) {
        const yeniIsler = await yap(step, `reel-klip-tekrar-${r.id}`, TEKRAR, () =>
          Promise.all(kusurlu.map((i) => klipBaslat(env, plan.cekimler[i], kareler[i], karar.heroVeo, !!plan.seslendirme)))
        );
        const yeni = await this.kuyrukBekle(step, `reel-tekrar-${r.id}`, yeniIsler, 30);
        klipUrller = klipUrller.map((u, i) => (kusurlu.includes(i) ? klipAdresi(yeni[kusurlu.indexOf(i)]) : u));
        await yap(step, `reel-klip-tekrar-harcama-${r.id}`, () =>
          harcamaYaz(env, runId, 'fal', 'klip yeniden üretim (video denetimi)', kusurlu.length * 0.5).then(() => true)
        );
      }
    }
    const klipler = plan.cekimler.map((c, i) => ({ url: klipUrller[i], sureMs: klipSuresiMs(c, karar.heroVeo) }));
    const muzik = muzikIs ? sesAdresi(bitti[isler.length]) : null;

    // 3) Montaj (+ altyazı).
    const montajIs = await yap(step, `reel-montaj-${r.id}`, TEKRAR, () => montajBaslat(env, klipler, ses, muzik));
    let video = montajAdresi((await this.kuyrukBekle(step, `reel-montaj-${r.id}`, [montajIs], 20))[0]);
    if (ses && ayar.studyo.altyazi) {
      const altIs = await yap(step, `reel-altyazi-${r.id}`, TEKRAR, () => altyaziBaslat(env, video));
      video = altyaziAdresi((await this.kuyrukBekle(step, `reel-altyazi-${r.id}`, [altIs], 20))[0]);
    }

    // 4) R2 + defter.
    await nefes(step, `reel-kaydet-${r.id}`);
    await yap(step, `reel-kaydet-${r.id}`, { ...TEKRAR, timeout: '10 minutes' as const }, async () => {
      const anahtar = await r2yeYaz(env, video, `${runId}/${r.id}-reel.mp4`);
      await env.DB.prepare("UPDATE ideas SET video_anahtar = ?, reel_durum = 'hazir' WHERE id = ?").bind(anahtar, r.id).run();
      await harcamaYaz(env, runId, 'fal', `reel ${karar.heroVeo ? 'veo+kling' : 'kling'}`, karar.tahmin);
      return anahtar;
    });

    // 5) Ekran yazısı gömülü kopya (temiz sürüm de kalıyor: uygulamada yazı eklemek isteyen için).
    if (ayar.studyo.yazi_gom) {
      const sureler = plan.cekimler.map((c) => klipSuresiMs(c, karar.heroVeo));
      await this.yaziliReel(step, r.id, video, plan, sureler, ayar.studyo.imza).catch((e) => console.error('yazılı reel', r.id, hataMetni(e)));
    }
  }

  /** Reel'e ekran yazısı göm → R2 `-reel-yazili.mp4` → ideas.yazili_anahtar. Temiz sürüm kalır. */
  private async yaziliReel(step: WorkflowStep, fikirId: string, videoUrl: string, plan: CekimPlani, sureler: number[], imza = '') {
    const env = this.env;
    const araliklar = yaziAraliklari(plan, sureler);
    if (!araliklar.length && !imza) return;
    const toplamMs = sureler.reduce((a, b) => a + b, 0);
    const cizelgeIs = await yap(step, `yazi-cizelge-${fikirId}`, TEKRAR, async () => {
      const kare = (ms: number) => Math.max(1, Math.round((ms / 1000) * YAZI_FPS));
      const gri = await falaYukle(env, await reelLevhasi(null, 1080, 1920, imza), 'image/png', `${fikirId}-gri.png`);
      const parcalar: { url: string; frames: number }[] = [];
      let t = 0;
      for (const [i, a] of araliklar.entries()) {
        if (a.basMs > t) parcalar.push({ url: gri, frames: kare(a.basMs - t) });
        parcalar.push({ url: await falaYukle(env, await reelLevhasi(a.metin, 1080, 1920, imza), 'image/png', `${fikirId}-yazi-${i}.png`), frames: kare(a.bitMs - a.basMs) });
        t = a.bitMs;
      }
      if (toplamMs > t) parcalar.push({ url: gri, frames: kare(toplamMs - t) });
      // images-to-video: görsel başına en fazla 1000 kare
      return yaziCizelgesiBaslat(env, parcalar.flatMap((p) => (p.frames > 1000 ? [{ ...p, frames: 1000 }, { ...p, frames: p.frames - 1000 }] : [p])));
    });
    const cizelge = videoAdresi((await this.kuyrukBekle(step, `yazi-c-${fikirId}`, [cizelgeIs], 20))[0]);
    const karisimIs = await yap(step, `yazi-karistir-${fikirId}`, TEKRAR, () => yaziKaristirBaslat(env, videoUrl, cizelge));
    const karisim = videoAdresi((await this.kuyrukBekle(step, `yazi-k-${fikirId}`, [karisimIs], 20))[0]);
    const sesIs = await yap(step, `yazi-ses-${fikirId}`, TEKRAR, () => sesGeriBaslat(env, karisim, videoUrl));
    // ⚠️ 14 Eki: trend ses önerilen reel bilerek sessiz (ses TikTok'ta eklenir); ses kanalı yokken
    //    merge-audio-video "Stream map '' matches no streams" veriyor → sessiz karışımı kullan.
    const sesSonuc = (await this.kuyrukBekle(step, `yazi-s-${fikirId}`, [sesIs], 20))[0];
    const son = metin(sesSonuc?.video?.url) || karisim;
    await yap(step, `yazi-kaydet-${fikirId}`, { ...TEKRAR, timeout: '10 minutes' as const }, async () => {
      const r = await env.DB.prepare('SELECT run_id FROM ideas WHERE id = ?').bind(fikirId).first<{ run_id: string }>();
      const anahtar = await r2yeYaz(env, son, `${r?.run_id ?? 'yazili'}/${fikirId}-reel-yazili.mp4`);
      await env.DB.prepare('UPDATE ideas SET yazili_anahtar = ? WHERE id = ?').bind(anahtar, fikirId).run();
      await harcamaYaz(env, null, 'fal', 'yazı gömme (ffmpeg)', 0.02);
      return anahtar;
    });
  }

  /**
   * YAZI MODU: hazır reel ve carousel'lerin yazısız olanlarına ekran yazısı
   * göm. Panelde "Yazıları göm" ve eski stok için. Reel süreleri planla
   * aynı mantıkla (hero Veo, diğerleri 5 sn) hesaplanıyor.
   */
  private async yaziGom(step: WorkflowStep, runId: string, ids?: string[]) {
    const env = this.env;
    const imza = await yap(step, 'yazi-imza', async () => (await ayarlariOku(env)).studyo.imza);
    await yap(step, 'yazi-adim', () => env.DB.prepare("UPDATE runs SET adim = 'uret' WHERE id = ?").bind(runId).run().then(() => true));
    const liste = await yap(step, 'yazi-liste', async () => {
      const r = await env.DB.prepare(
        `SELECT id, format, video_anahtar, uretim_plani, sahneler FROM ideas
          WHERE durum != 'reddedildi' AND uretim_plani IS NOT NULL
            AND ((format = 'kisa_video' AND video_anahtar IS NOT NULL AND yazili_anahtar IS NULL) OR format = 'carousel')
          ORDER BY olusturma DESC LIMIT 60`
      ).all<any>();
      return r.results
        .filter((x) => !ids?.length || ids.includes(x.id))
        .filter((x) => x.format === 'kisa_video' || jsonAc<any[]>(x.sahneler, []).some((s) => s.gorsel_anahtar && !s.yazili_anahtar))
        .map((x) => ({ id: x.id as string, format: x.format as string, video: x.video_anahtar as string | null, plan: jsonAc<CekimPlani | null>(x.uretim_plani, null) }));
    });
    for (const x of liste) {
      try {
        if (x.format === 'carousel') {
          await yap(step, `carousel-yazi-${x.id}`, TEKRAR, () => carouselYazilari(env, x.id, imza));
          continue;
        }
        if (!x.plan || !x.video) continue;
        const plan = x.plan;
        const url = await yap(step, `yazi-kaynak-${x.id}`, { ...TEKRAR, timeout: '10 minutes' as const }, async () => {
          const o = await env.MEDYA.get(x.video!);
          if (!o) throw new Error('reel R2’de yok');
          return falaYukle(env, await o.arrayBuffer(), 'video/mp4', `${x.id}.mp4`);
        });
        await this.yaziliReel(step, x.id, url, plan, plan.cekimler.map((c) => klipSuresiMs(c, true)), imza);
      } catch (e) {
        console.error('yazı gömülemedi', x.id, hataMetni(e));
      }
    }
  }

  /** fal kuyruk işlerini 20 sn arayla yokla; hepsi bitince sonuç gövdeleri. */
  private async kuyrukBekle(step: WorkflowStep, ad: string, isler: KuyrukIsi[], maxTur: number): Promise<any[]> {
    const env = this.env;
    let sonuc: (any | null)[] = isler.map(() => null);
    for (let i = 0; i < maxTur; i++) {
      await step.sleep(`${ad}-bekle-${i}`, '20 seconds');
      sonuc = await yap(step, `${ad}-yokla-${i}`, TEKRAR, () =>
        Promise.all(isler.map((is, j) => (sonuc[j] ? Promise.resolve(sonuc[j]) : kuyrukYokla(env, is))))
      );
      if (sonuc.every((x) => x)) return sonuc;
    }
    throw new Error(`${ad}: fal işleri süresinde bitmedi`);
  }

  /** Manus'u başlatır ve bekler; düşerse ya da süre dolarsa Workers AI. */
  private async beyin(
    step: WorkflowStep,
    runId: string,
    ad: PromptAdi,
    girdi: unknown,
    ekler: BrainEki[] = [],
    sureDk?: number,
    onek: string = ad
  ): Promise<unknown> {
    const env = this.env;
    let bas: any;
    try {
      bas = await yap(step, `${onek}-baslat`, MANUS_BASLAT, async () => {
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
      return yap(step, `${onek}-yedek`, TEKRAR, () => workersAi(env, ad, girdi) as Promise<any>);
    }
    if (bas.saglayici === 'workersai') return bas.sonuc;

    const tur = Math.max(1, Math.round((sureDk ?? (sayi(env.MANUS_SURE_DK) || 20)) * 3)); // 20 sn'de bir
    for (let i = 0; i < tur; i++) {
      await step.sleep(`${onek}-bekle-${i}`, '20 seconds');
      const y = await yap(step, `${onek}-yokla-${i}`, TEKRAR, () => brainYokla(env, bas.taskId, ad) as Promise<any>);
      if (!y.bitti) continue;
      if ('sonuc' in y) return y.sonuc;
      console.error(`Manus ${ad}:`, y.hata);
      break;
    }
    return yap(step, `${onek}-yedek`, TEKRAR, () => workersAi(env, ad, girdi) as Promise<any>);
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
/** Son 10 günde platform başına en çok patlayan 5 video (kreatif direktör platforma göre yazsın). */
async function platformOzeti(env: Env) {
  const sor = (p: string) =>
    env.DB.prepare(
      "SELECT hesap, izlenme, patlama, substr(aciklama, 1, 160) AS aciklama, ses FROM patlayanlar WHERE platform = ? AND bulunma > ? ORDER BY patlama DESC LIMIT 5"
    ).bind(p, simdiIst(new Date(Date.now() - 10 * 86400_000))).all();
  const [tiktok, instagram] = await Promise.all([sor('tiktok'), sor('instagram')]);
  return { tiktok: tiktok.results, instagram: instagram.results };
}

/** Carousel kartlarına yazı: R2'deki görsel → yazılı PNG → sahneler[i].yazili_anahtar. */
export async function carouselYazilari(env: Env, fikirId: string, imza = ''): Promise<number> {
  const r = await env.DB.prepare('SELECT sahneler, uretim_plani FROM ideas WHERE id = ?').bind(fikirId).first<{ sahneler: string; uretim_plani: string }>();
  const sahneler = jsonAc<any[]>(r?.sahneler, []);
  const plan = jsonAc<CekimPlani | null>(r?.uretim_plani, null);
  // Eski içeriklerde stil yok: klasik (alt karartma). Yeni varsayılan meme.
  const stil = plan?.carousel_stil ?? 'klasik';
  const toplam = sahneler.length;
  let ekranlar: { id: string; anahtar: string }[] | null = null;
  let yazilan = 0;
  for (let i = 0; i < sahneler.length; i++) {
    const s = sahneler[i];
    if (s.yazili_anahtar) continue;
    const yazi = metin(s.ekran_yazisi);
    const urun = metin(plan?.cekimler?.[i]?.uygulama_ekrani);
    let png: Uint8Array;
    if (urun) {
      // Gerçek uygulama ekranı (kütüphane) ya da marka kartı.
      ekranlar ??= dizi<any>(((await markaOku(env)) as any).gorsel_kimlik?.uygulama_ekranlari).map((e) => ({ id: metin(e?.id), anahtar: metin(e?.anahtar) }));
      const secili = ekranlar.find((e) => e.id === urun);
      const o = secili ? await env.MEDYA.get(secili.anahtar) : null;
      png = await urunKarti(o ? { veri: await o.arrayBuffer(), mime: o.httpMetadata?.contentType ?? 'image/png' } : null, yazi, 1080, 1440, imza);
    } else {
      if (!s.gorsel_anahtar) continue;
      const o = await env.MEDYA.get(s.gorsel_anahtar);
      if (!o) continue;
      const veri = await o.arrayBuffer();
      const mime = o.httpMetadata?.contentType ?? 'image/jpeg';
      png = stil === 'meme' ? await memeKarti(veri, mime, yazi, i + 1, toplam, 1080, 1440, imza) : await carouselKarti(veri, mime, yazi, i + 1, toplam, 1080, 1440, imza);
    }
    const anahtar = s.gorsel_anahtar ? String(s.gorsel_anahtar).replace(/\.(jpe?g|png)$/i, '') + '-yazili.png' : `${fikirId}/urun-${i + 1}-yazili.png`;
    await env.MEDYA.put(anahtar, png, { httpMetadata: { contentType: 'image/png' } });
    s.yazili_anahtar = anahtar;
    if (!s.gorsel_anahtar) s.gorsel_anahtar = anahtar; // kapak/önizleme boş kalmasın
    yazilan++;
  }
  if (yazilan) await env.DB.prepare('UPDATE ideas SET sahneler = ? WHERE id = ?').bind(JSON.stringify(sahneler), fikirId).run();
  return yazilan;
}

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
