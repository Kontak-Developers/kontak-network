import { mockRequest } from './mock'
import type { Brand, Decision, Idea, IdeaStatus, Run, Series, Trend, WatchItem, WatchStatus, Weekly } from './types'

// VITE_MOCK=1 ise hep sahte veri. Değilse gerçek API, erişilemezse sahte veriye düşer.
// VITE_API_URL verilirse API başka bir adreste (ör. https://ajan-api.kontakdating.com).
const FORCE_MOCK = import.meta.env.VITE_MOCK === '1'
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
let usingMock = FORCE_MOCK
const listeners = new Set<(mock: boolean) => void>()

export function isUsingMock() {
  return usingMock
}

export function onMockChange(fn: (mock: boolean) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function setMock(v: boolean) {
  if (usingMock === v) return
  usingMock = v
  listeners.forEach((fn) => fn(v))
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (usingMock) return (await mockRequest(method, path, body)) as T
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const isJson = res.headers.get('content-type')?.includes('application/json')
    if (!res.ok || !isJson) throw new Error(`${res.status}`)
    return (await res.json()) as T
  } catch {
    setMock(true)
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
