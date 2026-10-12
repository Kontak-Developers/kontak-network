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
import { brainBaslat, brainYokla, workersAi, type PromptAdi } from './brain';
import { gorselUret, videoBaslat, videoYokla } from './fal';
import { gonderileriYaz, markaOku, gonderileriOku } from './db';
import {
  dizi, hataMetni, isoHafta, jsonAc, kisaId, metin, pazartesiMi, sayi, simdiIst, sinirla,
} from './yardimci';

const TEKRAR = {
  retries: { limit: 3, delay: '10 seconds' as const, backoff: 'exponential' as const },
  timeout: '5 minutes' as const,
};

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
      if (env.APIFY_TOKEN) {
        // İlk çalıştırmada referans boş: 7 günlük geçmiş için daha çok gönderi.
        const adet = sayi(env.GONDERI_PER_ETIKET) * (plan.ilk ? 3 : 1);
        const isler = await yap(step, 'apify-baslat', TEKRAR, async () => {
          const out: ApifyIs[] = [];
          for (const p of ['tiktok', 'instagram'] as Platform[]) {
            const e = plan.etiketler.filter((x) => x.platform === p).map((x) => x.etiket);
            if (e.length) out.push(await taramaBaslat(env, p, e, adet));
          }
          return out;
        });
        for (let i = 0; i < 40; i++) {
          await step.sleep(`apify-bekle-${i}`, '30 seconds');
          const bitti = await yap(step, `apify-durum-${i}`, TEKRAR, async () => {
            const d = await Promise.all(isler.map((x) => taramaDurumu(env, x.runId)));
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
      const analizGirdi = await yap(step, 'analiz-girdi', async () => {
        const gonderiler = await gonderileriOku(env, 9);
        const ivme = ivmeHesapla(gonderiler);
        const takip = await env.DB.prepare('SELECT etiket, platform, durum, skor FROM watchlist').all();
        return {
          marka: await markaOku(env),
          takip_listesi: takip.results,
          ivme_hashtag: ivme.filter((s) => s.tur === 'hashtag').slice(0, 25),
          ivme_ses: ivme.filter((s) => s.tur === 'ses').slice(0, 15),
          gonderiler: ornekGonderiler(gonderiler, 30),
        };
      });
      const analiz = (await this.beyin(step, runId, 'analiz', analizGirdi)) as any;

      const trendler = await yap(step, 'analiz-kaydet', async () => {
        const gecerliLink = new Set(analizGirdi.gonderiler.map((g) => g.link));
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
      const uretimGirdi = await yap(step, 'uretim-girdi', async () => ({
        marka: await markaOku(env),
        gundem: trendler.map(({ run_id, ...t }) => t),
        aktif_seriler: (
          await env.DB.prepare(
            "SELECT id, ad, aciklama, format, bolum_sayisi, planlanan_bolumler FROM series WHERE durum = 'aktif' ORDER BY olusturma DESC LIMIT 5"
          ).all()
        ).results,
      }));
      const uretim = (await this.beyin(step, runId, 'uretim', uretimGirdi)) as any;

      const fikirler = await yap(step, 'uretim-kaydet', () => fikirleriYaz(env, runId, uretim, trendler.map((t) => t.id)));

      if (env.FAL_KEY) {
        for (const f of fikirler) {
          try {
            await yap(step, `gorsel-${f.id}`, { ...TEKRAR, retries: { ...TEKRAR.retries, limit: 2 } }, async () => {
              const anahtar = await gorselUret(env, f.gorsel_prompt, `${runId}/${f.id}.jpg`);
              await env.DB.prepare('UPDATE ideas SET gorsel_anahtar = ? WHERE id = ?').bind(anahtar, f.id).run();
              return anahtar;
            });
          } catch (e) {
            console.error('görsel üretilemedi', f.id, hataMetni(e)); // fikir görselsiz de işe yarar
          }
        }
        const butce = sayi((await markaOku(env)).sinirlar?.butce?.video_per_run ?? 1);
        const videoFikri = fikirler.find((f) => f.format === 'kisa_video') ?? fikirler[0];
        if (env.VIDEO_AKTIF === '1' && butce > 0 && videoFikri) {
          try {
            const is = await yap(step, 'video-baslat', TEKRAR, () => videoBaslat(env, videoFikri.video_prompt));
            for (let i = 0; i < 30; i++) {
              await step.sleep(`video-bekle-${i}`, '30 seconds');
              const anahtar = await yap(step, `video-durum-${i}`, TEKRAR, () => videoYokla(env, is, `${runId}/${videoFikri.id}.mp4`));
              if (anahtar) {
                await yap(step, 'video-kaydet', () =>
                  env.DB.prepare('UPDATE ideas SET video_anahtar = ? WHERE id = ?').bind(anahtar, videoFikri.id).run().then(() => true)
                );
                break;
              }
            }
          } catch (e) {
            console.error('video üretilemedi', hataMetni(e));
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
  private async beyin(step: WorkflowStep, runId: string, ad: PromptAdi, girdi: unknown): Promise<unknown> {
    const env = this.env;
    let bas: any;
    try {
      bas = await yap(step, `${ad}-baslat`, MANUS_BASLAT, async () => {
      const b = await brainBaslat(env, ad, girdi, `Kontak Network · ${ad} · ${runId}`);
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

    const tur = Math.max(1, Math.round((sayi(env.MANUS_SURE_DK) || 20) * 3)); // 20 sn'de bir
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

type FikirOzet = { id: string; format: string; gorsel_prompt: string; video_prompt: string };

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
    const sahneler = dizi<any>(f?.sahneler).slice(0, 8).map((s, i) => ({
      sira: sayi(s?.sira) || i + 1, sure_sn: sayi(s?.sure_sn), prompt: metin(s?.prompt), ekran_yazisi: metin(s?.ekran_yazisi),
    }));
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
    });
  }
  if (stmts.length) await env.DB.batch(stmts);
  return ozet;
}
