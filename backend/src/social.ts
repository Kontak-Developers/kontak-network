import type { Env } from './tipler';

export type SocialPlatform = 'instagram' | 'tiktok';
type TokenSet = { access_token: string; refresh_token?: string; access_expires_at: number; refresh_expires_at?: number; token_type?: string };
type ConnectionRow = {
  platform: SocialPlatform; account_id: string; username: string; scopes: string; status: string;
  tokens_enc: string; tokens_iv: string; access_expires_at: number; refresh_expires_at: number | null; updated_at: string;
};
type SocialPost = {
  platform: SocialPlatform; post_id: string; permalink: string | null; caption: string; media_type: string;
  published_at: string; views: number | null; likes: number | null; comments: number | null;
  shares: number | null; reach: number | null; saves: number | null;
};

const IG_GRAPH = 'https://graph.instagram.com/v26.0';
const TT_API = 'https://open.tiktokapis.com';
const encoder = new TextEncoder();

export class SocialError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function socialConfigured(env: Env, platform: SocialPlatform) {
  const encryption = !!env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  return platform === 'instagram'
    ? encryption && !!env.IG_APP_ID && !!env.IG_APP_SECRET
    : encryption && !!env.TIKTOK_CLIENT_KEY && !!env.TIKTOK_CLIENT_SECRET;
}

export async function socialStatus(env: Env) {
  const rows = await env.DB.prepare(
    'SELECT platform, account_id, username, scopes, status, last_sync, updated_at FROM social_connections'
  ).all<any>();
  const byPlatform = new Map<string, any>(rows.results.map((r: any) => [r.platform, r]));
  const counts = await env.DB.prepare(
    `SELECT platform, COUNT(*) AS posts, MAX(fetched_at) AS last_sync
     FROM social_posts GROUP BY platform`
  ).all<any>();
  const countByPlatform = new Map<string, any>(counts.results.map((r: any) => [r.platform, r]));
  const shape = (platform: SocialPlatform) => {
    const r = byPlatform.get(platform);
    const c = countByPlatform.get(platform);
    return {
      configured: socialConfigured(env, platform),
      connected: !!r && r.status === 'connected',
      username: r?.username ?? null,
      scopes: r?.scopes ? String(r.scopes).split(',').filter(Boolean) : [],
      last_sync: r?.last_sync ?? c?.last_sync ?? null,
      needs_reconnect: !!r && r.status !== 'connected',
      posts_read: Number(c?.posts ?? 0),
    };
  };
  return {
    instagram: shape('instagram'),
    tiktok: shape('tiktok'),
    tiktok_publishing: 'manual_only',
  };
}

export async function socialConnectUrl(env: Env, platform: SocialPlatform, redirectUri: string) {
  if (!socialConfigured(env, platform)) {
    throw new SocialError(503, 'sosyal_kurulum', platform === 'instagram'
      ? 'Instagram Developer uygulama bilgileri Worker Secret olarak eklenmemiş.'
      : 'TikTok Developer uygulama bilgileri Worker Secret olarak eklenmemiş.');
  }
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== 'https:' && redirect.hostname !== 'localhost' && redirect.hostname !== '127.0.0.1') {
    throw new SocialError(400, 'redirect_gecersiz', 'Bağlantı adresi güvenli HTTPS olmalı.');
  }
  const state = randomState();
  const expires = new Date(Date.now() + 10 * 60_000).toISOString();
  await env.DB.prepare('DELETE FROM social_oauth_states WHERE expires_at <= ?').bind(new Date().toISOString()).run();
  await env.DB.prepare(
    'INSERT INTO social_oauth_states (state_hash, platform, redirect_uri, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(await sha256(state), platform, redirect.href, expires).run();

  const auth = platform === 'instagram'
    ? new URL('https://api.instagram.com/oauth/authorize')
    : new URL('https://www.tiktok.com/v2/auth/authorize/');
  if (platform === 'instagram') {
    auth.searchParams.set('client_id', env.IG_APP_ID!);
    auth.searchParams.set('redirect_uri', redirect.href);
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish');
    auth.searchParams.set('state', state);
  } else {
    auth.searchParams.set('client_key', env.TIKTOK_CLIENT_KEY!);
    auth.searchParams.set('scope', 'user.info.basic,video.list');
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('redirect_uri', redirect.href);
    auth.searchParams.set('state', state);
    auth.searchParams.set('disable_auto_auth', '1');
  }
  return { url: auth.toString() };
}

export async function socialOAuthCallback(env: Env, platform: SocialPlatform, url: URL) {
  const state = url.searchParams.get('state') ?? '';
  if (state.length < 20) throw new SocialError(400, 'oauth_state', 'Bağlantı isteği geçersiz veya süresi dolmuş.');
  const row = await env.DB.prepare(
    'DELETE FROM social_oauth_states WHERE state_hash = ? AND platform = ? AND expires_at > ? RETURNING redirect_uri'
  ).bind(await sha256(state), platform, new Date().toISOString()).first<{ redirect_uri: string }>();
  if (!row) throw new SocialError(400, 'oauth_state', 'Bağlantı isteği geçersiz veya süresi dolmuş.');
  if (url.searchParams.has('error') || url.searchParams.has('error_description') || url.searchParams.has('error_code')) {
    throw new SocialError(400, 'oauth_reddedildi', 'Hesap erişimi verilmedi. İstersen bağlantıyı yeniden deneyebilirsin.');
  }
  const code = (url.searchParams.get('code') ?? '').replace(/#_$/, '');
  if (!code) throw new SocialError(400, 'oauth_code', 'Platform yetkilendirme kodu vermedi.');
  if (platform === 'instagram') await completeInstagramOAuth(env, code, row.redirect_uri);
  else await completeTikTokOAuth(env, code, row.redirect_uri);
}

async function completeInstagramOAuth(env: Env, code: string, redirectUri: string) {
  requireConfigured(env, 'instagram');
  const form = new URLSearchParams({
    client_id: env.IG_APP_ID!, client_secret: env.IG_APP_SECRET!,
    grant_type: 'authorization_code', redirect_uri: redirectUri, code,
  });
  const short = await fetchJson('https://api.instagram.com/oauth/access_token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form,
  });
  if (typeof short.access_token !== 'string') throw new SocialError(502, 'instagram_oauth', 'Instagram token alınamadı.');
  const exchangeUrl = new URL(`${IG_GRAPH}/access_token`);
  exchangeUrl.searchParams.set('grant_type', 'ig_exchange_token');
  exchangeUrl.searchParams.set('client_secret', env.IG_APP_SECRET!);
  exchangeUrl.searchParams.set('access_token', short.access_token);
  const long = await fetchJson(exchangeUrl.toString());
  const accessToken = String(long.access_token ?? '');
  if (!accessToken) throw new SocialError(502, 'instagram_oauth', 'Instagram uzun ömürlü token vermedi.');
  const profileUrl = new URL(`${IG_GRAPH}/me`);
  profileUrl.searchParams.set('fields', 'user_id,username');
  const profile = await fetchJson(profileUrl.toString(), { headers: { authorization: `Bearer ${accessToken}` } });
  const accountId = String(profile.user_id ?? profile.id ?? short.user_id ?? '');
  if (!accountId) throw new SocialError(502, 'instagram_oauth', 'Instagram hesap kimliği alınamadı.');
  const now = Math.floor(Date.now() / 1000);
  await saveConnection(env, 'instagram', accountId, String(profile.username ?? 'Instagram'),
    'instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish', {
      access_token: accessToken, access_expires_at: now + Number(long.expires_in ?? 60 * 86400), token_type: 'Bearer',
    });
}

async function completeTikTokOAuth(env: Env, code: string, redirectUri: string) {
  requireConfigured(env, 'tiktok');
  const form = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY!, client_secret: env.TIKTOK_CLIENT_SECRET!,
    code, grant_type: 'authorization_code', redirect_uri: redirectUri,
  });
  const tokenBody = await fetchJson(`${TT_API}/v2/oauth/token/`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'cache-control': 'no-cache' }, body: form,
  });
  const token = tokenBody.data ?? tokenBody;
  if (typeof token.access_token !== 'string' || typeof token.open_id !== 'string') {
    throw new SocialError(502, 'tiktok_oauth', 'TikTok token alınamadı.');
  }
  const profileUrl = new URL(`${TT_API}/v2/user/info/`);
  profileUrl.searchParams.set('fields', 'open_id,display_name,avatar_url');
  const profileBody = await fetchJson(profileUrl.toString(), { headers: { authorization: `Bearer ${token.access_token}` } });
  const profile = profileBody.data?.user ?? {};
  const now = Math.floor(Date.now() / 1000);
  await saveConnection(env, 'tiktok', String(token.open_id), String(profile.display_name ?? 'TikTok hesabı'),
    String(token.scope ?? 'user.info.basic,video.list'), {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      access_expires_at: now + Number(token.expires_in ?? 86400),
      refresh_expires_at: now + Number(token.refresh_expires_in ?? 365 * 86400),
      token_type: token.token_type ?? 'Bearer',
    });
}

export async function syncSocialPerformance(env: Env) {
  const output: any = {
    note: 'Bu, Kontak hesabının kendi içerik verisidir; genel TikTok/Instagram trend kanıtı değildir.',
    instagram: { connected: false, posts: [] as any[] },
    tiktok: { connected: false, posts: [] as any[] },
    warnings: [] as string[],
  };
  for (const platform of ['instagram', 'tiktok'] as const) {
    const row = await getConnection(env, platform);
    if (!row || row.status !== 'connected') continue;
    output[platform].connected = true;
    output[platform].username = row.username;
    try {
      const tokens = await usableTokens(env, row);
      const posts = platform === 'instagram'
        ? await readInstagramPosts(env, row, tokens)
        : await readTikTokPosts(env, row, tokens);
      for (const post of posts) await saveOwnedPost(env, row, post);
      await env.DB.prepare("UPDATE social_connections SET last_sync = ?, status = 'connected', last_error = NULL WHERE platform = ?")
        .bind(new Date().toISOString(), platform).run();
      await env.DB.prepare('DELETE FROM social_posts WHERE published_at < ?')
        .bind(new Date(Date.now() - 90 * 86400_000).toISOString()).run();
      output[platform].posts = posts.slice(0, 10).map(promptPost);
    } catch (error) {
      output.warnings.push(`${platform}: hesap verisi bu çalıştırmada alınamadı; genel trend analizi sürdürülüyor.`);
      const reconnect = error instanceof SocialError && (error.status === 401 || error.code === 'yeniden_baglan');
      await env.DB.prepare("UPDATE social_connections SET status = ?, last_error = ? WHERE platform = ?")
        .bind(reconnect ? 'needs_reconnect' : 'connected', reconnect ? 'reauthorization_required' : 'sync_failed', platform)
        .run().catch(() => undefined);
    }
  }
  return output;
}

async function readInstagramPosts(env: Env, row: ConnectionRow, tokens: TokenSet): Promise<SocialPost[]> {
  const listUrl = new URL(`${IG_GRAPH}/${encodeURIComponent(row.account_id)}/media`);
  listUrl.searchParams.set('fields', 'id,caption,media_type,permalink,timestamp,like_count,comments_count');
  listUrl.searchParams.set('limit', '10');
  const list = await fetchJson(listUrl.toString(), { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const items: any[] = Array.isArray(list.data) ? list.data : [];
  const posts: SocialPost[] = [];
  for (const item of items) {
    const postId = String(item.id ?? '');
    const publishedAt = safeIso(item.timestamp);
    if (!postId || !publishedAt) continue;
    let insights: Record<string, number | null> = {};
    try {
      const insightUrl = new URL(`${IG_GRAPH}/${encodeURIComponent(postId)}/insights`);
      insightUrl.searchParams.set('metric', 'reach,saved,shares,views,total_interactions');
      const got = await fetchJson(insightUrl.toString(), { headers: { authorization: `Bearer ${tokens.access_token}` } });
      insights = metricsMap(got.data);
    } catch { /* Some metrics/media types may not be available; preserve null instead of inventing zero. */ }
    posts.push({
      platform: 'instagram', post_id: postId, permalink: item.permalink ?? null,
      caption: String(item.caption ?? '').slice(0, 2200), media_type: String(item.media_type ?? 'UNKNOWN'),
      published_at: publishedAt, views: insights.views ?? null,
      likes: nullableNumber(item.like_count), comments: nullableNumber(item.comments_count),
      shares: insights.shares ?? null, reach: insights.reach ?? null, saves: insights.saved ?? null,
    });
  }
  return posts;
}

async function readTikTokPosts(_env: Env, row: ConnectionRow, tokens: TokenSet): Promise<SocialPost[]> {
  const listUrl = new URL(`${TT_API}/v2/video/list/`);
  listUrl.searchParams.set('fields', 'id,title,video_description,create_time,view_count,like_count,comment_count,share_count,share_url');
  const got = await fetchJson(listUrl.toString(), {
    method: 'POST', headers: { authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ max_count: 20 }),
  });
  const items: any[] = Array.isArray(got.data?.videos) ? got.data.videos : [];
  const posts: SocialPost[] = [];
  for (const item of items) {
    const postId = String(item.id ?? '');
    const created = Number(item.create_time);
    const publishedAt = Number.isFinite(created) && created > 0 ? safeIso(new Date(created * 1000)) : null;
    if (!postId || !publishedAt) continue;
    posts.push({
      platform: 'tiktok', post_id: postId, permalink: item.share_url ?? null,
      caption: String(item.video_description ?? item.title ?? '').slice(0, 2200), media_type: 'VIDEO',
      published_at: publishedAt,
      views: nullableNumber(item.view_count), likes: nullableNumber(item.like_count),
      comments: nullableNumber(item.comment_count), shares: nullableNumber(item.share_count), reach: null, saves: null,
    });
  }
  return posts;
}

function metricsMap(data: any): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (!Array.isArray(data)) return out;
  for (const entry of data) {
    const v = entry?.total_value?.value ?? entry?.values?.[0]?.value;
    out[String(entry?.name)] = nullableNumber(v);
  }
  return out;
}

async function saveOwnedPost(env: Env, row: ConnectionRow, post: SocialPost) {
  await env.DB.prepare(
    `INSERT INTO social_posts (platform, platform_post_id, account_id, permalink, caption, media_type, published_at,
      views, likes, comments, shares, reach, saves, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(platform, platform_post_id) DO UPDATE SET
      permalink=excluded.permalink, caption=excluded.caption, media_type=excluded.media_type,
      views=excluded.views, likes=excluded.likes, comments=excluded.comments, shares=excluded.shares,
      reach=excluded.reach, saves=excluded.saves, fetched_at=excluded.fetched_at`
  ).bind(post.platform, post.post_id, row.account_id, post.permalink, post.caption, post.media_type, post.published_at,
    post.views, post.likes, post.comments, post.shares, post.reach, post.saves, new Date().toISOString()).run();
}

function promptPost(p: SocialPost) {
  return {
    platform: p.platform, media_type: p.media_type, published_at: p.published_at,
    views: p.views, likes: p.likes, comments: p.comments, shares: p.shares, reach: p.reach, saves: p.saves,
    permalink: p.permalink,
  };
}

export async function instagramPublishPreview(env: Env, ideaId: string, origin: string, prefix: string) {
  const idea = await env.DB.prepare('SELECT * FROM ideas WHERE id = ?').bind(ideaId).first<any>();
  if (!idea) throw new SocialError(404, 'fikir_yok', 'İçerik bulunamadı.');
  const conn = await getConnection(env, 'instagram');
  const hashtagler = parseArray(idea.hashtagler);
  const caption = [String(idea.aciklama_metni ?? '').trim(), hashtagler.join(' ')].filter(Boolean).join('\n\n');
  let mediaKeys: string[] = [];
  let mediaType: 'IMAGE' | 'REELS' | 'CAROUSEL' = 'IMAGE';
  let reason = '';
  if (idea.platform !== 'instagram') reason = 'Bu fikir Instagram için üretilmemiş.';
  else if (idea.durum === 'paylasildi') reason = 'Bu fikir daha önce paylaşıldı.';
  else if (idea.format === 'gonderi') mediaKeys = idea.gorsel_anahtar ? [String(idea.gorsel_anahtar)] : [];
  else if (idea.format === 'carousel') {
    mediaType = 'CAROUSEL';
    const scenes = parseObjectArray(idea.sahneler);
    const sceneKeys = scenes.map((scene) => typeof scene.gorsel_anahtar === 'string' ? scene.gorsel_anahtar : '');
    if (scenes.length < 2) reason = 'Instagram carousel için en az iki sahne gerekir.';
    else if (scenes.length > 10) reason = 'Instagram carousel en fazla 10 slayt içerebilir.';
    else if (sceneKeys.some((key) => !key)) reason = 'Her carousel slaytının ayrı bir görsel dosyası hazır olmalı; tasarım kartı veya eksik görseli yayımlamıyorum.';
    else mediaKeys = sceneKeys;
  }
  else if (idea.format === 'kisa_video') { mediaKeys = idea.video_anahtar ? [String(idea.video_anahtar)] : []; mediaType = 'REELS'; }
  else reason = 'Bu içerik formatı desteklenmiyor.';
  if (!reason && !mediaKeys.length) reason = idea.format === 'kisa_video' ? 'Yayımlanabilir video dosyası henüz hazır değil.' : 'Yayımlanabilir görsel dosyası henüz hazır değil.';
  if (!reason && caption.length > 2200) reason = 'Açıklama Instagram sınırını aşıyor.';
  if (!reason && (!conn || conn.status !== 'connected')) reason = 'Instagram hesabı Worker’a henüz bağlanmamış.';
  if (!reason && !socialConfigured(env, 'instagram')) reason = 'Meta Developer uygulaması Worker’da yapılandırılmamış.';
  const mediaUrls = mediaKeys.map((key) => publicMediaUrl(origin, prefix, key));
  const payload = { idea_id: ideaId, platform: 'instagram', format: String(idea.format), caption, media_url: mediaUrls[0] ?? null, media_urls: mediaUrls, media_type: mediaType, account: conn?.username ?? null };
  return { ...payload, can_publish: !reason, block_reason: reason || null, fingerprint: await sha256(JSON.stringify(payload)) };
}

export async function instagramPublish(env: Env, ideaId: string, fingerprint: string, origin: string, prefix: string) {
  const preview = await instagramPublishPreview(env, ideaId, origin, prefix);
  if (!preview.can_publish) throw new SocialError(409, 'yayin_hazir_degil', preview.block_reason ?? 'İçerik yayımlanmaya hazır değil.');
  if (!fingerprint || fingerprint !== preview.fingerprint) throw new SocialError(409, 'icerik_degisti', 'Onay ekranından sonra içerik değişti; yeniden inceleyip onayla.');
  const existing = await env.DB.prepare('SELECT * FROM social_publish_jobs WHERE idea_id = ?').bind(ideaId).first<any>();
  if (existing?.status === 'published') return { status: 'published', media_id: existing.media_id ?? null };
  if (existing?.status === 'uncertain') throw new SocialError(409, 'yayin_dogrulama_gerekli', 'Yayın yanıtı doğrulanamadı. Instagram hesabını kontrol et; güvenlik için aynı içeriği tekrar göndermiyorum.');
  if (existing && existing.payload_hash !== fingerprint) throw new SocialError(409, 'icerik_degisti', 'Bu içerik farklı bir onayla değişmiş. Önizlemeyi yenile.');
  const conn = await getConnection(env, 'instagram');
  if (!conn) throw new SocialError(409, 'instagram_baglantisi_yok', 'Instagram hesabını önce bağla.');
  const tokens = await usableTokens(env, conn);
  let job = existing;
  if (!job) {
    const insert = await env.DB.prepare(
      `INSERT OR IGNORE INTO social_publish_jobs (idea_id, platform, payload_hash, status, created_at, updated_at)
       VALUES (?, 'instagram', ?, 'creating', ?, ?)`
    ).bind(ideaId, fingerprint, new Date().toISOString(), new Date().toISOString()).run();
    job = await env.DB.prepare('SELECT * FROM social_publish_jobs WHERE idea_id = ?').bind(ideaId).first<any>();
    if (!job || (insert.meta?.changes ?? 0) === 0) throw new SocialError(409, 'yayin_bekliyor', 'Bu içerik için zaten bir yayın isteği işleniyor.');
    try {
      let body: URLSearchParams;
      if (preview.media_type === 'CAROUSEL') {
        const children: string[] = [];
        for (const mediaUrl of preview.media_urls) {
          const childBody = new URLSearchParams({ image_url: mediaUrl, is_carousel_item: 'true' });
          const child = await fetchJson(`${IG_GRAPH}/${encodeURIComponent(conn.account_id)}/media`, {
            method: 'POST', headers: { authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/x-www-form-urlencoded' }, body: childBody,
          });
          if (typeof child.id !== 'string') throw new SocialError(502, 'instagram_carousel', 'Carousel slaytı Instagram için hazırlanamadı.');
          children.push(child.id);
        }
        body = new URLSearchParams({ media_type: 'CAROUSEL', children: JSON.stringify(children), caption: preview.caption, is_ai_generated: 'true' });
      } else {
        body = new URLSearchParams({ caption: preview.caption, is_ai_generated: 'true' });
      }
      if (preview.media_type === 'REELS') {
        body.set('media_type', 'REELS');
        body.set('video_url', preview.media_url!);
      } else if (preview.media_type === 'IMAGE') {
        body.set('image_url', preview.media_url!);
      }
      const created = await fetchJson(`${IG_GRAPH}/${encodeURIComponent(conn.account_id)}/media`, {
        method: 'POST', headers: { authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/x-www-form-urlencoded' }, body,
      });
      if (typeof created.id !== 'string') throw new SocialError(502, 'instagram_container', 'Instagram medya hazırlama yanıtı geçersiz.');
      await env.DB.prepare("UPDATE social_publish_jobs SET container_id = ?, status = 'processing', updated_at = ? WHERE idea_id = ? AND status = 'creating'")
        .bind(created.id, new Date().toISOString(), ideaId).run();
      job = await env.DB.prepare('SELECT * FROM social_publish_jobs WHERE idea_id = ?').bind(ideaId).first<any>();
    } catch (e) {
      await env.DB.prepare("UPDATE social_publish_jobs SET status = 'failed', last_error = 'container_failed', updated_at = ? WHERE idea_id = ? AND status = 'creating'")
        .bind(new Date().toISOString(), ideaId).run();
      if (e instanceof SocialError) throw e;
      throw new SocialError(502, 'instagram_container', 'Instagram içeriği hazırlanamadı; paylaşım yapılmadı.');
    }
  }
  if (job.status === 'processing' && job.container_id) return inspectInstagramContainer(tokens, String(job.container_id));
  if (job.status === 'creating' || job.status === 'publishing') {
    throw new SocialError(409, 'yayin_bekliyor', 'Yayın isteği sürüyor; yeni bir istek başlatmadım.');
  }
  if (job.status === 'failed') throw new SocialError(409, 'yayin_hatasi', 'Instagram içeriği hazırlanamadı. Önizlemeyi yenileyip yeniden dene.');
  return { status: String(job.status ?? 'unknown'), media_id: job.media_id ?? null };
}

export async function instagramPublishStatus(env: Env, ideaId: string) {
  const job = await env.DB.prepare('SELECT * FROM social_publish_jobs WHERE idea_id = ?').bind(ideaId).first<any>();
  if (!job) return { status: 'not_started' };
  if (job.status === 'publishing') return { status: 'publishing', last_error: 'Instagram yanıtı bekleniyor; otomatik tekrar yapılmıyor.' };
  if (job.status !== 'processing') return { status: job.status, media_id: job.media_id ?? null, last_error: job.status === 'failed' ? 'Yayın başarısız oldu.' : null };
  const conn = await getConnection(env, 'instagram');
  if (!conn || !job.container_id) return { status: 'needs_reconnect' };
  const tokens = await usableTokens(env, conn);
  return inspectInstagramContainer(tokens, String(job.container_id));
}

export async function instagramPublishComplete(env: Env, ideaId: string) {
  let job = await env.DB.prepare('SELECT * FROM social_publish_jobs WHERE idea_id = ?').bind(ideaId).first<any>();
  if (!job) throw new SocialError(409, 'medya_hazirlanmadi', 'Önce son önizlemede medyayı hazırla.');
  if (job.status === 'published') return { status: 'published', media_id: job.media_id ?? null };
  if (job.status === 'uncertain') throw new SocialError(409, 'yayin_dogrulama_gerekli', 'Yayın sonucu belirsiz. Instagram hesabını kontrol et; tekrar göndermiyorum.');
  if (job.status === 'publishing') return { status: 'publishing', last_error: 'Instagram yanıtı bekleniyor; otomatik tekrar yapılmıyor.' };
  if (job.status !== 'processing' || !job.container_id) throw new SocialError(409, 'medya_hazir_degil', 'Instagram medyası henüz hazırlanmamış.');
  const conn = await getConnection(env, 'instagram');
  if (!conn || conn.status !== 'connected') throw new SocialError(409, 'instagram_baglantisi_yok', 'Instagram hesabını yeniden bağla.');
  const tokens = await usableTokens(env, conn);
  const inspection = await inspectInstagramContainer(tokens, String(job.container_id));
  if (inspection.status === 'processing') return inspection;
  if (inspection.status === 'failed') {
    await env.DB.prepare("UPDATE social_publish_jobs SET status = 'failed', last_error = 'container_failed', updated_at = ? WHERE idea_id = ? AND status = 'processing'")
      .bind(new Date().toISOString(), ideaId).run();
    return { status: 'failed', last_error: 'Instagram içeriği hazırlayamadı; paylaşım yapılmadı.' };
  }
  if (inspection.status === 'uncertain') {
    await env.DB.prepare("UPDATE social_publish_jobs SET status = 'uncertain', last_error = 'already_published_without_id', updated_at = ? WHERE idea_id = ? AND status = 'processing'")
      .bind(new Date().toISOString(), ideaId).run();
    return { status: 'uncertain', last_error: 'Instagram medyayı yayınlanmış gösteriyor; tekrar göndermiyorum.' };
  }
  if (inspection.status !== 'ready') return inspection;
  const claim = await env.DB.prepare("UPDATE social_publish_jobs SET status = 'publishing', updated_at = ? WHERE idea_id = ? AND status = 'processing'")
    .bind(new Date().toISOString(), ideaId).run();
  if ((claim.meta?.changes ?? 0) !== 1) {
    job = await env.DB.prepare('SELECT status, media_id FROM social_publish_jobs WHERE idea_id = ?').bind(ideaId).first<any>();
    return { status: job?.status ?? 'publishing', media_id: job?.media_id ?? null };
  }
  try {
    const body = new URLSearchParams({ creation_id: String(job.container_id) });
    const result = await fetchJson(`${IG_GRAPH}/${encodeURIComponent(conn.account_id)}/media_publish`, {
      method: 'POST', headers: { authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/x-www-form-urlencoded' }, body,
    });
    const mediaId = String(result.id ?? '');
    if (!mediaId) throw new Error('publish response lacked id');
    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE social_publish_jobs SET status = 'published', media_id = ?, updated_at = ?, last_error = NULL WHERE idea_id = ?")
      .bind(mediaId, now, ideaId).run();
    await env.DB.prepare("UPDATE ideas SET durum = 'paylasildi', published_at = ? WHERE id = ?").bind(now, ideaId).run();
    return { status: 'published', media_id: mediaId };
  } catch {
    await env.DB.prepare("UPDATE social_publish_jobs SET status = 'uncertain', last_error = 'publish_response_unknown', updated_at = ? WHERE idea_id = ? AND status = 'publishing'")
      .bind(new Date().toISOString(), ideaId).run();
    return { status: 'uncertain', last_error: 'Instagram yanıtı belirsiz; çift paylaşımı önlemek için otomatik tekrar kapatıldı. Hesabı kontrol et.' };
  }
}

async function inspectInstagramContainer(tokens: TokenSet, containerId: string) {
  let status: string;
  try {
    const u = new URL(`${IG_GRAPH}/${encodeURIComponent(containerId)}`);
    u.searchParams.set('fields', 'status_code');
    const result = await fetchJson(u.toString(), { headers: { authorization: `Bearer ${tokens.access_token}` } });
    status = String(result.status_code ?? 'IN_PROGRESS');
  } catch {
    return { status: 'processing' };
  }
  if (status === 'IN_PROGRESS') return { status: 'processing' };
  if (status === 'ERROR' || status === 'EXPIRED') return { status: 'failed', last_error: 'Instagram medyayı hazırlayamadı.' };
  if (status === 'PUBLISHED') return { status: 'uncertain', last_error: 'Instagram medyayı yayınlanmış gösteriyor; tekrar göndermiyorum.' };
  if (status === 'FINISHED') return { status: 'ready' };
  return { status: 'processing' };
}

async function usableTokens(env: Env, row: ConnectionRow): Promise<TokenSet> {
  let tokens = await decryptTokens(env, row.tokens_enc, row.tokens_iv);
  const now = Math.floor(Date.now() / 1000);
  if (row.platform === 'instagram' && tokens.access_expires_at < now + 7 * 86400 && Date.parse(row.updated_at) < Date.now() - 86400_000) {
    const u = new URL(`${IG_GRAPH}/refresh_access_token`);
    u.searchParams.set('grant_type', 'ig_refresh_token');
    u.searchParams.set('access_token', tokens.access_token);
    const refreshed = await fetchJson(u.toString());
    tokens = { ...tokens, access_token: String(refreshed.access_token), access_expires_at: now + Number(refreshed.expires_in ?? 60 * 86400) };
    await saveConnection(env, row.platform, row.account_id, row.username, row.scopes, tokens);
  } else if (row.platform === 'tiktok' && tokens.access_expires_at < now + 3 * 3600) {
    if (!tokens.refresh_token || (tokens.refresh_expires_at ?? 0) <= now) throw new SocialError(401, 'yeniden_baglan', 'TikTok erişim izninin süresi dolmuş. Yeniden bağla.');
    requireConfigured(env, 'tiktok');
    const form = new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY!, client_secret: env.TIKTOK_CLIENT_SECRET!, grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
    const body = await fetchJson(`${TT_API}/v2/oauth/token/`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
    const t = body.data ?? body;
    tokens = {
      ...tokens, access_token: String(t.access_token), refresh_token: String(t.refresh_token ?? tokens.refresh_token),
      access_expires_at: now + Number(t.expires_in ?? 86400),
      refresh_expires_at: now + Number(t.refresh_expires_in ?? 365 * 86400),
    };
    await saveConnection(env, row.platform, row.account_id, row.username, String(t.scope ?? row.scopes), tokens);
  }
  return tokens;
}

async function getConnection(env: Env, platform: SocialPlatform) {
  return env.DB.prepare('SELECT * FROM social_connections WHERE platform = ?').bind(platform).first<ConnectionRow>();
}

async function saveConnection(env: Env, platform: SocialPlatform, accountId: string, username: string, scopes: string, tokens: TokenSet) {
  const encrypted = await encryptTokens(env, tokens);
  await env.DB.prepare(
    `INSERT INTO social_connections (platform, account_id, username, scopes, status, tokens_enc, tokens_iv,
      access_expires_at, refresh_expires_at, updated_at, last_error)
     VALUES (?, ?, ?, ?, 'connected', ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(platform) DO UPDATE SET account_id=excluded.account_id, username=excluded.username,
      scopes=excluded.scopes, status='connected', tokens_enc=excluded.tokens_enc, tokens_iv=excluded.tokens_iv,
      access_expires_at=excluded.access_expires_at, refresh_expires_at=excluded.refresh_expires_at,
      updated_at=excluded.updated_at, last_error=NULL`
  ).bind(platform, accountId, username, scopes, encrypted.cipher, encrypted.iv,
    tokens.access_expires_at, tokens.refresh_expires_at ?? null, new Date().toISOString()).run();
}

async function encryptTokens(env: Env, tokens: TokenSet) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await cryptoKey(env);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(tokens))));
  return { iv: toBase64(iv), cipher: toBase64(cipher) };
}

async function decryptTokens(env: Env, cipher: string, iv: string): Promise<TokenSet> {
  try {
    const key = await cryptoKey(env);
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(cipher));
    const tokens = JSON.parse(new TextDecoder().decode(clear));
    if (typeof tokens?.access_token !== 'string') throw new Error('missing token');
    return tokens as TokenSet;
  } catch {
    throw new SocialError(500, 'token_cozulemedi', 'Hesap tokenı güvenli biçimde açılamadı; bağlantıyı yeniden kur.');
  }
}

async function cryptoKey(env: Env) {
  const value = env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new SocialError(503, 'sifreleme_anahtari_yok', 'Sosyal token şifreleme anahtarı yapılandırılmamış.');
  let raw: Uint8Array;
  try { raw = fromBase64(value); } catch { throw new SocialError(503, 'sifreleme_anahtari_gecersiz', 'Sosyal token şifreleme anahtarı biçimi geçersiz.'); }
  if (raw.length !== 32) throw new SocialError(503, 'sifreleme_anahtari_gecersiz', 'Sosyal token şifreleme anahtarı 32 byte olmalı.');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  let response: Response;
  try { response = await fetch(url, init); } catch { throw new SocialError(502, 'platform_baglantisi', 'Sosyal platforma erişilemedi.'); }
  const body = await response.json().catch(() => null) as any;
  const providerError = body?.error;
  const providerCode = typeof providerError === 'object' ? providerError?.code : providerError;
  if (!response.ok || (providerCode && providerCode !== 'ok') || body?.error?.error_code) {
    throw new SocialError(502, 'platform_api', 'Sosyal platform isteği reddetti; hesap izinlerini ve uygulama ayarlarını kontrol et.');
  }
  return body ?? {};
}

function requireConfigured(env: Env, platform: SocialPlatform) {
  if (!socialConfigured(env, platform)) throw new SocialError(503, 'sosyal_kurulum', 'Sosyal platform uygulama bilgileri Worker Secret olarak ayarlanmamış.');
}
function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
async function sha256(s: string) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)));
  return [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function toBase64(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromBase64(s: string) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
function nullableNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function safeIso(v: unknown) {
  const date = new Date(String(v ?? ''));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function parseArray(v: unknown): string[] {
  try { const x = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(x) ? x.filter((s) => typeof s === 'string') : []; }
  catch { return []; }
}
function parseObjectArray(v: unknown): Record<string, any>[] {
  try {
    const x = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(x) ? x.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : [];
  } catch { return []; }
}
function publicMediaUrl(origin: string, prefix: string, key: string) {
  const base = prefix.match(/^\/[a-z0-9-]{1,20}$/)?.[0] ?? '';
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${origin}${base}/api/medya/${encodedKey}`;
}
