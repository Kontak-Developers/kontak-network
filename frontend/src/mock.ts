// Backend hazır değilken ya da erişilemezken kullanılan sahte API.
// data/mock/ altındaki dosyalarla başlar, değişiklikleri bu tarayıcıda saklar.
import brandSeed from '../../data/mock/brand.json'
import runsSeed from '../../data/mock/runs.json'
import trendsSeed from '../../data/mock/trends.json'
import ideasSeed from '../../data/mock/ideas.json'
import weeklySeed from '../../data/mock/weekly.json'
import type { Brand, Idea, Run, RunStep, Trend, Weekly } from './types'

const STORE_KEY = 'kontak-panel-mock-v1'
const STEPS: RunStep[] = ['tara', 'analiz', 'uret', 'kaydet']
const STEP_MS = 3000

type State = { brand: Brand; runs: Run[]; trends: Trend[]; ideas: Idea[]; weekly: Weekly }

function seed(): State {
  return {
    brand: brandSeed as Brand,
    runs: runsSeed as Run[],
    trends: trendsSeed as Trend[],
    ideas: ideasSeed as Idea[],
    weekly: weeklySeed as Weekly,
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return { ...seed(), ...JSON.parse(raw) }
  } catch {
    // tarayıcı depolaması kapalıysa seed ile devam
  }
  return seed()
}

const state = load()

function save() {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ brand: state.brand, runs: state.runs, trends: state.trends, ideas: state.ideas }),
    )
  } catch {
    // önemli değil, sadece bu oturumda kalır
  }
}

// "Şimdi çalıştır": adımları sırayla ilerletir, bitince son günün gündemini yeni çalıştırmaya kopyalar
function startRun(): Run {
  const now = new Date()
  const id = `run_manuel_${now.getTime()}`
  const run: Run = {
    id,
    tetik: 'manuel',
    durum: 'calisiyor',
    adim: 'tara',
    baslangic: now.toISOString(),
    bitis: null,
    taranan_gonderi: 0,
    ozet: 'Ajan çalışıyor…',
  }
  state.runs.unshift(run)
  save()

  STEPS.forEach((step, i) => {
    setTimeout(() => {
      run.adim = step
      run.taranan_gonderi = Math.min(430, 140 * (i + 1))
      save()
    }, STEP_MS * i)
  })

  setTimeout(() => {
    const source = state.runs.find((r) => r.id !== id && r.durum === 'tamamlandi')
    if (source) {
      const idMap = new Map<string, string>()
      const trends = state.trends
        .filter((t) => t.run_id === source.id)
        .map((t) => {
          const nid = `${t.id}_${now.getTime()}`
          idMap.set(t.id, nid)
          return { ...t, id: nid, run_id: id }
        })
      const ideas = state.ideas
        .filter((x) => x.run_id === source.id)
        .map((x) => ({
          ...x,
          id: `${x.id}_${now.getTime()}`,
          run_id: id,
          trend_id: idMap.get(x.trend_id) ?? x.trend_id,
          durum: 'yeni' as const,
        }))
      state.trends.push(...trends)
      state.ideas.push(...ideas)
      run.ozet = source.ozet
    }
    run.durum = 'tamamlandi'
    run.adim = 'kaydet'
    run.taranan_gonderi = 428
    run.bitis = new Date().toISOString()
    save()
  }, STEP_MS * STEPS.length)

  return run
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

export async function mockRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 150))
  const url = new URL(path, 'http://mock')
  const p = url.pathname
  const run = url.searchParams.get('run')

  if (method === 'GET' && p === '/api/brand') return clone(state.brand)
  if (method === 'PUT' && p === '/api/brand') {
    state.brand = body as Brand
    save()
    return clone(state.brand)
  }
  if (method === 'GET' && p === '/api/runs') return clone(state.runs)
  if (method === 'GET' && p === '/api/runs/latest') return clone(state.runs[0] ?? null)
  if (method === 'POST' && p === '/api/runs') {
    const r = startRun()
    return { id: r.id, durum: r.durum }
  }
  if (method === 'GET' && p === '/api/trends')
    return clone(state.trends.filter((t) => !run || t.run_id === run).sort((a, b) => b.ivme - a.ivme))
  if (method === 'GET' && p === '/api/ideas') {
    const order = new Map(state.runs.map((r, i) => [r.id, i]))
    return clone(
      state.ideas
        .filter((x) => !run || x.run_id === run)
        .sort((a, b) => (order.get(a.run_id) ?? 99) - (order.get(b.run_id) ?? 99)),
    )
  }
  const ideaMatch = p.match(/^\/api\/ideas\/(.+)$/)
  if (method === 'PATCH' && ideaMatch) {
    const idea = state.ideas.find((x) => x.id === ideaMatch[1])
    if (!idea) throw new Error('İçerik bulunamadı')
    Object.assign(idea, body)
    save()
    return clone(idea)
  }
  if (method === 'GET' && p === '/api/weekly/latest') return clone(state.weekly)

  throw new Error(`Sahte API'de yok: ${method} ${p}`)
}

export function resetMock() {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    // yoksay
  }
}
