// Kontak Network Worker: API + Cron + Workflow + panel dosyaları.
// Uçlar SOZLESME.md ile birebir.

import type { Env, RunParams } from './tipler';
import { fikirCikti, haftaCikti, runCikti, seriCikti, trendCikti } from './db';
import { hata, json, jsonAc, runIdUret, simdiIst } from './yardimci';
import { cikis, giris, oturum, sifreDegistir } from './hesap';
import { studyoApi } from './studyoApi';
import {
  instagramPublish, instagramPublishComplete, instagramPublishPreview, instagramPublishStatus, socialConnectUrl,
  socialOAuthCallback, socialStatus, SocialError,
} from './social';

export { AgentRun } from './workflow';

const FIKIR_DURUM = new Set(['yeni', 'onaylandi', 'reddedildi', 'paylasildi']);
const INSAN_DURUM = new Set(['sabit', 'yasak']);

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const yol = url.pathname;
    if (!yol.startsWith('/api/')) return env.VARLIKLAR.fetch(req);

    try {
      // OAuth callback'leri moderatör Bearer token'ı taşımaz; tek kullanımlık,
      // kısa ömürlü state D1'de doğrulanır. Diğer sosyal uçlar yetki arar.
      const oauthCallback = yol.match(/^\/api\/social\/(instagram|tiktok)\/callback$/);
      if (oauthCallback && req.method === 'GET') {
        const platform = oauthCallback[1] as 'instagram' | 'tiktok';
        try {
          await socialOAuthCallback(env, platform, url);
          return oauthRedirect(env, url, platform, 'baglandi');
        } catch (e) {
          const code = e instanceof SocialError ? e.code : 'oauth_hatasi';
          return oauthRedirect(env, url, platform, `hata_${code}`);
        }
      }
      // Görseller <img> ile yüklenir, başlık gönderilemez. Anahtarlar
      // tahmin edilemez (run + rastgele fikir id'si), yetki aranmaz.
      if (req.method === 'GET' && yol.startsWith('/api/medya/')) return medya(env, yol.slice('/api/medya/'.length));
      if (yol === '/api/saglik') {
        return json({ ok: true, apify: !!env.APIFY_TOKEN, manus: !!env.MANUS_API_KEY, fal: !!env.FAL_KEY });
      }

      // Ajan hesabı girişi (e-posta + şifre). Kontak moderatörleri panel jetonuyla gelir.
      if (yol === '/api/giris' && req.method === 'POST') {
        const g = await req.json<{ eposta?: string; sifre?: string }>().catch(() => ({}) as { eposta?: string; sifre?: string });
        if (!g.eposta || !g.sifre || g.eposta.length > 200 || g.sifre.length > 200) return hata('eksik', 'E-posta ve şifre gir.', 400);
        const s = await giris(env, g.eposta, g.sifre);
        if (s.ok) return json({ jeton: s.jeton, ad: s.ad, eposta: s.eposta });
        if (s.kod === 'cok_deneme') return hata('cok_deneme', 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.', 429);
        return hata('gecersiz', 'E-posta ya da şifre yanlış.', 401);
      }

      const red = await yetki(req, env, url);
      if (red) return red;
      const jeton = (req.headers.get('authorization') ?? '').slice(7);
      if (jeton.startsWith('ag_')) {
        if (yol === '/api/cikis' && req.method === 'POST') {
          await cikis(env, jeton);
          return json({ ok: true });
        }
        if (yol === '/api/ben') return json(await oturum(env, jeton));
        if (yol === '/api/sifre' && req.method === 'POST') {
          const b = await req.json<{ eski?: string; yeni?: string }>().catch(() => ({}) as { eski?: string; yeni?: string });
          if (!b.yeni || b.yeni.length < 10 || b.yeni.length > 200) return hata('zayif', 'Yeni şifre en az 10 karakter olmalı.', 400);
          const k = await oturum(env, jeton);
          if (!k || !(await sifreDegistir(env, k.id, b.eski ?? '', b.yeni))) return hata('gecersiz', 'Mevcut şifre yanlış.', 400);
          return json({ ok: true });
        }
      }
      return await api(req, env, url);
    } catch (e) {
      if (e instanceof SocialError) return hata(e.code, e.message, e.status);
      console.error(e);
      return hata('sunucu', 'Beklenmeyen bir hata oldu.', 500);
    }
  },

  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runBaslat(env, 'cron').then(() => undefined));
  },
} satisfies ExportedHandler<Env>;

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const yol = url.pathname;
  const m = req.method;
  const run = url.searchParams.get('run');
  // Panel /ag altından proxy'liyorsa medya adresi o önekle verilmeli.
  const onek = (req.headers.get('x-dis-onek') ?? '').match(/^\/[a-z0-9-]{1,20}$/)?.[0] ?? '';
  const medyaOnek = `${onek}/api/medya/`;
  const DB = env.DB;

  // Stüdyo sekmesi (ayarlar, kimlik, promptlar, stok, yazı, kararlar).
  if (yol.startsWith('/api/studyo') || /^\/api\/(formats|rota-kartlari)\/[^/]+$/.test(yol) || /^\/api\/ideas\/[^/]+\/metin$/.test(yol)) {
    const jeton = (req.headers.get('authorization') ?? '').slice(7);
    const kim = jeton.startsWith('ag_') ? (await oturum(env, jeton))?.eposta ?? 'ajan-hesabi' : 'kontak-moderator';
    const y = await studyoApi(req, env, url, kim, medyaOnek, (ek, ozet) => runBaslat(env, 'manuel', ek, ozet));
    if (y) return y;
  }

  if (yol === '/api/social/status' && m === 'GET') return json(await socialStatus(env));
  const socialConnect = yol.match(/^\/api\/social\/(instagram|tiktok)\/connect$/);
  if (socialConnect && m === 'POST') {
    const platform = socialConnect[1] as 'instagram' | 'tiktok';
    const redirectUri = `${socialApiBase(env, url, onek)}/social/${platform}/callback`;
    return json(await socialConnectUrl(env, platform, redirectUri));
  }

  const publicApi = new URL(socialApiBase(env, url, onek));
  const publicPrefix = publicApi.pathname.replace(/\/api\/?$/, '');
  const publishPreview = yol.match(/^\/api\/ideas\/([A-Za-z0-9_-]{1,40})\/publish-preview$/);
  if (publishPreview && m === 'GET') return json(await instagramPublishPreview(env, publishPreview[1], publicApi.origin, publicPrefix));
  const publishStatus = yol.match(/^\/api\/ideas\/([A-Za-z0-9_-]{1,40})\/publish-status$/);
  if (publishStatus && m === 'GET') return json(await instagramPublishStatus(env, publishStatus[1]));
  const publishComplete = yol.match(/^\/api\/ideas\/([A-Za-z0-9_-]{1,40})\/publish-complete$/);
  if (publishComplete && m === 'POST') return json(await instagramPublishComplete(env, publishComplete[1]), 202);
  const publish = yol.match(/^\/api\/ideas\/([A-Za-z0-9_-]{1,40})\/publish$/);
  if (publish && m === 'POST') {
    const body: any = await req.json().catch(() => null);
    if (typeof body?.fingerprint !== 'string') return hata('gecersiz', 'Önizleme onayı gerekli.', 400);
    return json(await instagramPublish(env, publish[1], body.fingerprint, publicApi.origin, publicPrefix), 202);
  }

  if (yol === '/api/brand') {
    if (m === 'GET') {
      const r = await DB.prepare("SELECT veri FROM brands WHERE id = 'kontak'").first<{ veri: string }>();
      return r ? new Response(r.veri, { headers: { 'content-type': 'application/json; charset=utf-8' } }) : hata('yok', 'Marka profili yok.', 404);
    }
    if (m === 'PUT') {
      const govde = await req.text();
      if (govde.length > 50_000) return hata('buyuk', 'Profil çok büyük.', 413);
      let b: any;
      try {
        b = JSON.parse(govde);
      } catch {
        return hata('gecersiz', 'Gövde JSON değil.', 400);
      }
      if (!b || typeof b !== 'object' || Array.isArray(b) || typeof b.ad !== 'string') {
        return hata('gecersiz', 'Profilde en az "ad" olmalı.', 400);
      }
      b.id = 'kontak';
      // Görsel kimlik panel formunda yok; kayıt onu silmesin.
      if (!b.gorsel_kimlik) {
        const eski = jsonAc<any>((await DB.prepare("SELECT veri FROM brands WHERE id = 'kontak'").first<{ veri: string }>())?.veri, {});
        if (eski.gorsel_kimlik) b.gorsel_kimlik = eski.gorsel_kimlik;
      }
      await DB.prepare("INSERT INTO brands (id, veri, guncelleme) VALUES ('kontak', ?, ?) ON CONFLICT(id) DO UPDATE SET veri = excluded.veri, guncelleme = excluded.guncelleme")
        .bind(JSON.stringify(b), simdiIst()).run();
      return json(b);
    }
  }

  if (yol === '/api/runs') {
    if (m === 'GET') {
      const r = await DB.prepare('SELECT * FROM runs ORDER BY baslangic DESC LIMIT 60').all();
      return json(r.results.map(runCikti));
    }
    if (m === 'POST') {
      // Aynı anda tek çalıştırma: üst üste basmak kredi yakar.
      const suren = await DB.prepare(
        "SELECT * FROM runs WHERE durum = 'calisiyor' AND id LIKE 'run_%' AND baslangic > ? ORDER BY baslangic DESC LIMIT 1"
      ).bind(simdiIst(new Date(Date.now() - 45 * 60_000))).first();
      if (suren) return json({ hata: { kod: 'zaten_calisiyor', mesaj: 'Ajan şu an çalışıyor.' }, run: runCikti(suren) }, 409);
      const id = await runBaslat(env, 'manuel');
      return json({ id, durum: 'calisiyor' }, 202);
    }
  }

  if (yol === '/api/runs/latest' && m === 'GET') {
    // Yalnız tarama çalıştırmaları (run_*): stok/yazı/reel işleri Bugün sayfasını boşaltmasın; onlar Stüdyo'da.
    const r = await DB.prepare("SELECT * FROM runs WHERE id LIKE 'run_%' ORDER BY baslangic DESC LIMIT 1").first();
    return json(r ? runCikti(r) : null);
  }

  if (yol === '/api/trends' && m === 'GET') {
    const r = run
      ? await DB.prepare('SELECT * FROM trends WHERE run_id = ? ORDER BY ivme DESC').bind(run).all()
      : await DB.prepare('SELECT * FROM trends ORDER BY ivme DESC LIMIT 200').all();
    return json(r.results.map(trendCikti));
  }

  if (yol === '/api/ideas' && m === 'GET') {
    const r = run
      ? await DB.prepare('SELECT * FROM ideas WHERE run_id = ? ORDER BY olusturma').bind(run).all()
      : await DB.prepare('SELECT * FROM ideas ORDER BY run_id DESC, olusturma LIMIT 200').all();
    return json(r.results.map((i) => fikirCikti(i, medyaOnek)));
  }

  const fikir = yol.match(/^\/api\/ideas\/([A-Za-z0-9_-]{1,40})$/);
  if (fikir && m === 'PATCH') {
    const b: any = await req.json().catch(() => null);
    if (!b || !FIKIR_DURUM.has(b.durum)) return hata('gecersiz', 'durum: yeni | onaylandi | reddedildi | paylasildi', 400);
    if (b.durum === 'paylasildi') {
      const idea = await DB.prepare('SELECT platform FROM ideas WHERE id = ?').bind(fikir[1]).first<{ platform: string }>();
      if (!idea) return hata('yok', 'Fikir bulunamadı.', 404);
      if (idea.platform === 'instagram') {
        const job = await DB.prepare("SELECT 1 FROM social_publish_jobs WHERE idea_id = ? AND platform = 'instagram' AND status = 'published'")
          .bind(fikir[1]).first();
        if (!job) return hata('yayim_onayi_gerekli', 'Instagram içeriği yalnızca onay ekranındaki yayımla işlemi başarıyla tamamlanınca paylaşıldı işaretlenebilir.', 409);
      }
    }
    const r = await DB.prepare('UPDATE ideas SET durum = ? WHERE id = ? RETURNING *').bind(b.durum, fikir[1]).first();
    return r ? json(fikirCikti(r, medyaOnek)) : hata('yok', 'Fikir bulunamadı.', 404);
  }

  if (yol === '/api/weekly/latest' && m === 'GET') {
    const r = await DB.prepare('SELECT * FROM weekly ORDER BY hafta DESC LIMIT 1').first();
    return json(r ? haftaCikti(r) : null);
  }

  if (yol === '/api/watchlist' && m === 'GET') {
    const r = await DB.prepare(
      `SELECT * FROM watchlist ORDER BY CASE durum WHEN 'sabit' THEN 0 WHEN 'aktif' THEN 1 WHEN 'deneme' THEN 2
         WHEN 'yasak' THEN 3 ELSE 4 END, skor DESC`
    ).all();
    return json(r.results);
  }

  const takip = yol.match(/^\/api\/watchlist\/([A-Za-z0-9_-]{1,40})$/);
  if (takip && m === 'PATCH') {
    const b: any = await req.json().catch(() => null);
    if (!b || !INSAN_DURUM.has(b.durum)) return hata('gecersiz', 'durum: sabit | yasak', 400);
    const r = await DB.prepare("UPDATE watchlist SET durum = ?, kaynak = 'insan' WHERE id = ? RETURNING *").bind(b.durum, takip[1]).first();
    return r ? json(r) : hata('yok', 'Etiket bulunamadı.', 404);
  }

  if (yol === '/api/decisions' && m === 'GET') {
    const r = run
      ? await DB.prepare('SELECT * FROM decisions WHERE run_id = ? ORDER BY zaman').bind(run).all()
      : await DB.prepare('SELECT * FROM decisions ORDER BY zaman DESC LIMIT 200').all();
    return json(r.results);
  }

  // Kontak uygulamasındaki onaylı rotalar. Panel açılınca moderatör jetonuyla
  // senkronlanır; sabah çalıştırması (jetonsuz) bu kopyayı kullanır.
  if (yol === '/api/kontak-rotalar' && m === 'GET') {
    await rotaTablosu(env);
    const r = await DB.prepare('SELECT veri FROM kontak_rotalar ORDER BY guncelleme DESC LIMIT 100').all<{ veri: string }>();
    return json(r.results.map((x) => JSON.parse(x.veri)));
  }
  if (yol === '/api/kontak-rotalar/senkron' && m === 'POST') {
    return json(await rotaSenkron(env, req.headers.get('authorization') ?? ''));
  }

  // ── v2: format kütüphanesi, patlayanlar, harcama ──
  if (yol === '/api/formats' && m === 'GET') {
    const r = await DB.prepare(
      `SELECT * FROM formatlar ORDER BY CASE durum WHEN 'zirvede' THEN 0 WHEN 'yukseliyor' THEN 1 ELSE 2 END, skor DESC LIMIT 60`
    ).all<any>();
    return json(r.results.map((f) => ({ ...f, seslendirme: f.seslendirme === 1, ornekler: jsonAc(f.ornekler, []) })));
  }
  if (yol === '/api/patlayanlar' && m === 'GET') {
    const r = run
      ? await DB.prepare('SELECT * FROM patlayanlar WHERE run_id = ? ORDER BY patlama DESC').bind(run).all<any>()
      : await DB.prepare('SELECT * FROM patlayanlar ORDER BY bulunma DESC, patlama DESC LIMIT 60').all<any>();
    return json(r.results.map(({ kapak_anahtar, ...p }: any) => ({ ...p, kapak_url: kapak_anahtar ? `${medyaOnek}${kapak_anahtar}` : null })));
  }
  if (yol === '/api/rota-kartlari' && m === 'GET') {
    const r = await DB.prepare('SELECT * FROM rota_kartlari ORDER BY olusturma DESC LIMIT 30').all<any>();
    return json(
      r.results.map(({ gorsel_anahtar, ...k }) => ({
        ...k,
        duraklar: jsonAc(k.duraklar, []),
        kaynaklar: jsonAc(k.kaynaklar, []),
        gorsel_url: gorsel_anahtar ? `${medyaOnek}${gorsel_anahtar}` : null,
      }))
    );
  }
  if (yol === '/api/harcamalar' && m === 'GET') {
    const toplam = await DB.prepare('SELECT servis, ROUND(SUM(tutar_usd), 3) AS usd, COUNT(*) AS kalem FROM harcamalar GROUP BY servis').all();
    const bugun = await DB.prepare('SELECT servis, ROUND(SUM(tutar_usd), 3) AS usd FROM harcamalar WHERE zaman >= ? GROUP BY servis')
      .bind(simdiIst().slice(0, 10)).all();
    return json({ toplam: toplam.results, bugun: bugun.results });
  }

  if (yol === '/api/series' && m === 'GET') {
    const r = await DB.prepare("SELECT * FROM series ORDER BY durum = 'aktif' DESC, olusturma DESC").all();
    return json(r.results.map(seriCikti));
  }

  return hata('yok', 'Böyle bir uç yok.', 404);
}

async function rotaTablosu(env: Env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS kontak_rotalar (id TEXT PRIMARY KEY, veri TEXT NOT NULL, guncelleme TEXT NOT NULL)').run();
}

async function rotaSenkron(env: Env, yetkiBasligi: string) {
  await rotaTablosu(env);
  const api = (yol: string) =>
    env.KONTAK_API.fetch(new Request(`https://api.kontakdating.com${yol}`, { headers: { Authorization: yetkiBasligi } }));
  const l = await api('/api/yonetim/rotalar?durum=onayli&limit=60');
  if (!l.ok) return { sayi: 0, hata: `Kontak rotaları alınamadı (${l.status})` };
  const liste = ((await l.json()) as any)?.rotalar ?? [];
  // Çizgi listede yok; rota ayrıntısından (Google kodlu polyline)
  const ayrinti = await Promise.all(
    liste.slice(0, 40).map(async (r: any) => {
      try {
        const y = await api(`/api/rota/${encodeURIComponent(r.id)}`);
        if (!y.ok) return null;
        const d: any = await y.json();
        return d?.rota?.cizgi ?? d?.cizgi ?? null;
      } catch {
        return null;
      }
    })
  );
  const zaman = simdiIst();
  const stmts = liste.slice(0, 40).map((r: any, i: number) =>
    env.DB.prepare('INSERT INTO kontak_rotalar (id, veri, guncelleme) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET veri = excluded.veri, guncelleme = excluded.guncelleme')
      .bind(String(r.id), JSON.stringify({
        id: r.id, ad: r.ad, aciklama: r.aciklama ?? null, sehir: r.sehir, mesafe_m: r.mesafe_m, sure_s: r.sure_s,
        zorluk: r.zorluk, en_iyi_zaman: r.en_iyi_zaman ?? null, noktalar: r.noktalar ?? [], cizgi: ayrinti[i],
      }), zaman)
  );
  if (stmts.length) await env.DB.batch(stmts);
  return { sayi: stmts.length };
}

async function runBaslat(env: Env, tetik: RunParams['tetik'], ek: Partial<RunParams> = {}, ozet = ''): Promise<string> {
  let id = runIdUret();
  if (ek.stok) id = id.replace(/^run_/, 'stok_');
  if (ek.yazi) id = id.replace(/^run_/, 'yazi_');
  if (ek.reel) id = id.replace(/^run_/, 'reel_');
  if (await env.DB.prepare('SELECT 1 FROM runs WHERE id = ?').bind(id).first()) id += `_${Date.now() % 100000}`;
  await env.DB.prepare(
    "INSERT INTO runs (id, tetik, durum, adim, baslangic, taranan_gonderi, ozet) VALUES (?, ?, 'calisiyor', ?, ?, 0, ?)"
  ).bind(id, tetik, ek.stok || ek.yazi || ek.reel ? 'uret' : 'tara', simdiIst(), ozet).run();
  try {
    const w = await env.AGENT_RUN.create({ id, params: { ...ek, runId: id, tetik } });
    await env.DB.prepare('UPDATE runs SET workflow_id = ? WHERE id = ?').bind(w.id, id).run();
  } catch (e) {
    await env.DB.prepare("UPDATE runs SET durum = 'hata', hata = ?, bitis = ? WHERE id = ?")
      .bind('Workflow başlatılamadı', simdiIst(), id).run();
    throw e;
  }
  return id;
}

async function medya(env: Env, anahtar: string): Promise<Response> {
  if (!/^[A-Za-z0-9_./-]{1,120}$/.test(anahtar) || anahtar.includes('..')) return hata('yok', 'Dosya yok.', 404);
  const o = await env.MEDYA.get(anahtar);
  if (!o) return hata('yok', 'Dosya yok.', 404);
  const h = new Headers();
  o.writeHttpMetadata(h);
  h.set('etag', o.httpEtag);
  h.set('cache-control', 'private, max-age=86400');
  return new Response(o.body, { headers: h });
}

function oauthRedirect(env: Env, url: URL, platform: string, result: string) {
  const publicApi = new URL(socialApiBase(env, url, ''));
  const panel = new URL(publicApi);
  panel.pathname = panel.pathname.replace(/\/api\/?$/, '/') || '/';
  panel.search = '';
  panel.searchParams.set('sosyal', platform);
  panel.searchParams.set('sonuc', result);
  panel.hash = 'ajan';
  return Response.redirect(panel.toString(), 302);
}

function socialApiBase(env: Env, url: URL, prefix: string) {
  const fallback = `${url.origin}${prefix}/api`;
  const base = (env.SOCIAL_REDIRECT_BASE_URL || fallback).replace(/\/+$/, '');
  const parsed = new URL(base);
  if (parsed.pathname !== '/api' && !parsed.pathname.endsWith('/ag/api')) {
    throw new SocialError(500, 'callback_base_gecersiz', 'Sosyal OAuth callback kökü /api ile bitmeli.');
  }
  return parsed.toString().replace(/\/$/, '');
}

// ─────────────────────────────────────────────
// Yetki: prod panelin moderatör jetonu.
//
// Jeton kontak-api'ye (service binding, internete çıkmaz) moderatör
// korumalı bir uçla sorulur: 200 → moderatör + iki adımlı doğrulama
// tamam. Böylece JWT sırrı bu Worker'a kopyalanmaz, panel girişi aynen
// geçerli olur. Sonuç 2 dk önbellekte, her istekte API'ye gidilmez.
// ─────────────────────────────────────────────
const onay = new Map<string, number>();

async function yetki(req: Request, env: Env, url: URL): Promise<Response | null> {
  // Yalnız yerelde kapatılabilir; prod'a yanlışlıkla girse de işlemez.
  if (env.YETKI_KAPALI === '1' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return null;

  const baslik = req.headers.get('authorization') ?? '';
  if (!baslik.startsWith('Bearer ') || baslik.length > 4096) return hata('oturum_yok', 'Panele giriş yap.', 401);
  // Ajan hesabı oturumu: Kontak API'ye hiç gitmez, D1'den doğrulanır.
  if (baslik.startsWith('Bearer ag_')) {
    return (await oturum(env, baslik.slice(7))) ? null : hata('oturum_dustu', 'Oturum süresi doldu, tekrar giriş yap.', 401);
  }

  const ozet = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(baslik))))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const bitis = onay.get(ozet);
  if (bitis && bitis > Date.now()) return null;

  const y = await env.KONTAK_API.fetch(
    new Request(`https://api.kontakdating.com${env.YETKI_KONTROL_YOLU}`, { headers: { Authorization: baslik } })
  );
  await y.body?.cancel();
  if (y.status === 200) {
    if (onay.size > 500) onay.clear();
    onay.set(ozet, Date.now() + 120_000);
    return null;
  }
  if (y.status === 401) return hata('oturum_dustu', 'Oturum süresi doldu, panele tekrar giriş yap.', 401);
  if (y.status === 403) return hata('yetkisiz', 'Bu bölüm yalnız moderatörlere açık.', 403);
  return hata('yetki_kontrolu', 'Yetki kontrol edilemedi.', 502);
}
