import { mockRequest } from './mock'
import type { Brand, Decision, Idea, IdeaStatus, Run, Series, Trend, WatchItem, WatchStatus, Weekly } from './types'

// VITE_MOCK=1 ise hep sahte veri. Değilse her uç önce gerçek API'yi dener,
// o uç erişilemezse yalnızca o uç sahte veriye düşer (backend parça parça gelebilir).
// VITE_API_URL verilirse API başka bir adreste (ör. https://ajan-api.kontakdating.com).
const FORCE_MOCK = import.meta.env.VITE_MOCK === '1'
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export type MockLevel = 'yok' | 'kismi' | 'tam'

const live = new Set<string>()
const mocked = new Set<string>()
const listeners = new Set<(level: MockLevel) => void>()

export function mockLevel(): MockLevel {
  if (FORCE_MOCK) return 'tam'
  if (!mocked.size) return 'yok'
  return live.size ? 'kismi' : 'tam'
}

export function mockedEndpoints() {
  return [...mocked]
}

export function onMockChange(fn: (level: MockLevel) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

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
  if (after !== before) listeners.forEach((fn) => fn(after))
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (FORCE_MOCK) return (await mockRequest(method, path, body)) as T
  const ep = endpointOf(method, path)
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const isJson = res.headers.get('content-type')?.includes('application/json')
    if (!res.ok || !isJson) throw new Error(`${res.status}`)
    mark(ep, true)
    return (await res.json()) as T
  } catch {
    mark(ep, false)
    return (await mockRequest(method, path, body)) as T
  }
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
  weekly: () => request<Weekly | null>('GET', '/api/weekly/latest'),
  watchlist: () => request<WatchItem[]>('GET', '/api/watchlist'),
  setWatch: (id: string, durum: WatchStatus) =>
    request<WatchItem>('PATCH', `/api/watchlist/${encodeURIComponent(id)}`, { durum }),
  decisions: (run?: string) => request<Decision[]>('GET', `/api/decisions${q(run)}`),
  series: () => request<Series[]>('GET', '/api/series'),
}
