import { mockRequest } from './mock'
import type { Brand, Idea, IdeaStatus, Run, Trend, Weekly } from './types'

// VITE_MOCK=1 ise hep sahte veri. Değilse gerçek API, erişilemezse sahte veriye düşer.
const FORCE_MOCK = import.meta.env.VITE_MOCK === '1'
let usingMock = FORCE_MOCK
const listeners = new Set<(mock: boolean) => void>()

export function isUsingMock() {
  return usingMock
}

export function onMockChange(fn: (mock: boolean) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function setMock(v: boolean) {
  if (usingMock === v) return
  usingMock = v
  listeners.forEach((fn) => fn(v))
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (usingMock) return (await mockRequest(method, path, body)) as T
  try {
    const res = await fetch(path, {
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

export const api = {
  brand: () => request<Brand>('GET', '/api/brand'),
  saveBrand: (b: Brand) => request<Brand>('PUT', '/api/brand', b),
  runs: () => request<Run[]>('GET', '/api/runs'),
  latestRun: () => request<Run | null>('GET', '/api/runs/latest'),
  startRun: () => request<{ id: string; durum: Run['durum'] }>('POST', '/api/runs'),
  trends: (run?: string) => request<Trend[]>('GET', `/api/trends${run ? `?run=${encodeURIComponent(run)}` : ''}`),
  ideas: (run?: string) => request<Idea[]>('GET', `/api/ideas${run ? `?run=${encodeURIComponent(run)}` : ''}`),
  setIdeaStatus: (id: string, durum: IdeaStatus) =>
    request<Idea>('PATCH', `/api/ideas/${encodeURIComponent(id)}`, { durum }),
  weekly: () => request<Weekly | null>('GET', '/api/weekly/latest'),
}
