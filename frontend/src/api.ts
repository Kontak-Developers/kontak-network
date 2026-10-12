import { mockRequest } from './mock'
import type {
  Brand, Decision, Idea, IdeaStatus, InstagramPublishPreview, InstagramPublishResult, KontakRota,
  Run, Series, SocialStatus, Trend, WatchItem, WatchStatus, Weekly,
} from './types'

// Panel iki yerde çalışır:
//  - yerelde (localhost): /api → wrangler dev; erişilemeyen uç örnek veriye düşer
//  - prod: panel.kontakdating.com/ag/ altında; istekler /ag/api'ye gider ve
//    Kontak panelinin moderatör jetonunu taşır. Prod'da sahte veri gösterilmez
//    (moderatör sahte içeriği onaylamasın), yalnız ?ornek=1 ile açıkça istenirse.
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname)
const FORCE_MOCK = import.meta.env.VITE_MOCK === '1' || new URLSearchParams(location.search).has('ornek')
const FALLBACK = LOCAL
const BASE = (import.meta.env.VITE_API_URL ?? location.pathname.replace(/\/[^/]*$/, '')).replace(/\/$/, '')
const JETON_ANAHTAR = 'kontak_panel_jeton'

export class ApiError extends Error {
  status: number
  kod: string
  constructor(status: number, kod: string, mesaj: string) {
    super(mesaj)
    this.status = status
    this.kod = kod
  }
}

export type MockLevel = 'yok' | 'kismi' | 'tam'
export type AuthState = 'tamam' | 'giris_yok' | 'yetkisiz'

const live = new Set<string>()
const mocked = new Set<string>()
const mockListeners = new Set<(level: MockLevel) => void>()
const authListeners = new Set<(s: AuthState) => void>()

export function mockLevel(): MockLevel {
  if (FORCE_MOCK) return 'tam'
  if (!mocked.size) return 'yok'
  return live.size ? 'kismi' : 'tam'
}

export function mockedEndpoints() {
  return [...mocked]
}

export function onMockChange(fn: (level: MockLevel) => void) {
  mockListeners.add(fn)
  return () => {
    mockListeners.delete(fn)
  }
}

export function onAuthChange(fn: (s: AuthState) => void) {
  authListeners.add(fn)
  return () => {
    authListeners.delete(fn)
  }
}

/** Kontak panelinin giriş sayfası (prod'da /ag/'nin bir üstü) */
export const PANEL_URL = LOCAL ? null : '/'

// /api/ideas/i1 ve /api/ideas aynı uç sayılsın
const endpointOf = (method: string, path: string) =>
  `${method} ${path.split('?')[0].replace(/\/api\/(ideas|watchlist)\/.+$/, '/api/$1/:id')}`

function mark(endpoint: string, ok: boolean) {
  const before = mockLevel()
  if (ok) {
    live.add(endpoint)
    mocked.delete(endpoint)
  } else {
    mocked.add(endpoint)
  }
  const after = mockLevel()
  if (after !== before) mockListeners.forEach((fn) => fn(after))
}

function token() {
  try {
    return sessionStorage.getItem(JETON_ANAHTAR)
  } catch {
    return null
  }
}

/** Uç yok / sunucu yok: yerelde örnek veriye düşülebilir. Yetki ve doğrulama hataları düşmez. */
const isMissing = (status: number) => status === 404 || status >= 500

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (FORCE_MOCK) return (await mockRequest(method, path, body)) as T
  const ep = endpointOf(method, path)
  const headers: Record<string, string> = {}
  if (body) headers['Content-Type'] = 'application/json'
  const t = token()
  if (t) headers.Authorization = `Bearer ${t}`

  let res: Response
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    if (FALLBACK) {
      mark(ep, false)
      return (await mockRequest(method, path, body)) as T
    }
    throw new ApiError(0, 'baglanti', 'Ajana ulaşılamadı. İnternet bağlantını kontrol et.')
  }

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json().catch(() => null) : null

  if (res.ok && isJson) {
    mark(ep, true)
    return data as T
  }
  if (res.status === 401 || res.status === 403) {
    authListeners.forEach((fn) => fn(res.status === 401 ? 'giris_yok' : 'yetkisiz'))
    throw new ApiError(res.status, data?.hata?.kod ?? 'yetki', data?.hata?.mesaj ?? 'Panele giriş yap.')
  }
  if (FALLBACK && (isMissing(res.status) || !isJson)) {
    mark(ep, false)
    return (await mockRequest(method, path, body)) as T
  }
  throw new ApiError(res.status, data?.hata?.kod ?? 'hata', `${data?.hata?.mesaj ?? 'Beklenmeyen yanıt.'} (${method} ${path.split('?')[0]} → ${res.status})`)
}

const q = (run?: string) => (run ? `?run=${encodeURIComponent(run)}` : '')

export const api = {
  brand: () => request<Brand>('GET', '/api/brand'),
  saveBrand: (b: Brand) => request<Brand>('PUT', '/api/brand', b),
  runs: () => request<Run[]>('GET', '/api/runs'),
  latestRun: () => request<Run | null>('GET', '/api/runs/latest'),
  startRun: () => request<{ id: string; durum: Run['durum'] }>('POST', '/api/runs'),
  trends: (run?: string) => request<Trend[]>('GET', `/api/trends${q(run)}`),
  ideas: (run?: string) => request<Idea[]>('GET', `/api/ideas${q(run)}`),
  setIdeaStatus: (id: string, durum: IdeaStatus) =>
    request<Idea>('PATCH', `/api/ideas/${encodeURIComponent(id)}`, { durum }),
  socialStatus: () => request<SocialStatus>('GET', '/api/social/status'),
  socialConnect: (platform: 'instagram' | 'tiktok') =>
    request<{ url: string }>('POST', `/api/social/${platform}/connect`, {}),
  instagramPublishPreview: (id: string) =>
    request<InstagramPublishPreview>('GET', `/api/ideas/${encodeURIComponent(id)}/publish-preview`),
  instagramPublish: (id: string, fingerprint: string) =>
    request<InstagramPublishResult>('POST', `/api/ideas/${encodeURIComponent(id)}/publish`, { fingerprint }),
  instagramPublishStatus: (id: string) =>
    request<InstagramPublishResult>('GET', `/api/ideas/${encodeURIComponent(id)}/publish-status`),
  instagramPublishComplete: (id: string) =>
    request<InstagramPublishResult>('POST', `/api/ideas/${encodeURIComponent(id)}/publish-complete`, {}),
  weekly: () => request<Weekly | null>('GET', '/api/weekly/latest'),
  watchlist: () => request<WatchItem[]>('GET', '/api/watchlist'),
  setWatch: (id: string, durum: WatchStatus) =>
    request<WatchItem>('PATCH', `/api/watchlist/${encodeURIComponent(id)}`, { durum }),
  decisions: (run?: string) => request<Decision[]>('GET', `/api/decisions${q(run)}`),
  series: () => request<Series[]>('GET', '/api/series'),
  kontakRotalar: () => request<KontakRota[]>('GET', '/api/kontak-rotalar'),
  rotaSenkron: () => request<{ sayi: number; hata?: string }>('POST', '/api/kontak-rotalar/senkron'),
}

/** Prod'da (moderatör oturumu varken) Kontak rotaları senkronlanır */
export const canSync = !LOCAL && !FORCE_MOCK

/** Göreli medya yolu (ör. "mock/ornek-1.jpg") /ag/ altında da doğru çözülsün */
export function assetUrl(u: string | null | undefined) {
  if (!u) return null
  if (/^(https?:|data:|blob:)/.test(u) || u.startsWith(BASE + '/')) return u
  return `${BASE}/${u.replace(/^\//, '')}`
}
