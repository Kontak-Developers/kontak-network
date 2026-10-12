// Backend hazır değilken ya da erişilemezken kullanılan sahte API.
// data/mock/ altındaki dosyalarla başlar, değişiklikleri bu tarayıcıda saklar.
import brandSeed from '../../data/mock/brand.json'
import runsSeed from '../../data/mock/runs.json'
import trendsSeed from '../../data/mock/trends.json'
import ideasSeed from '../../data/mock/ideas.json'
import weeklySeed from '../../data/mock/weekly.json'
import watchSeed from '../../data/mock/watchlist.json'
import decisionsSeed from '../../data/mock/decisions.json'
import seriesSeed from '../../data/mock/series.json'
import type { Brand, Decision, Idea, Run, RunStep, Series, Trend, WatchItem, Weekly } from './types'

const STORE_KEY = 'kontak-network-mock-v2'
const STEP_MS = 3200

type State = {
  brand: Brand
  runs: Run[]
  trends: Trend[]
  ideas: Idea[]
  weekly: Weekly
  watchlist: WatchItem[]
  decisions: Decision[]
  series: Series[]
}

function seed(): State {
  return {
    brand: brandSeed as Brand,
    runs: runsSeed as Run[],
    trends: trendsSeed as Trend[],
    ideas: ideasSeed as Idea[],
    weekly: weeklySeed as Weekly,
    watchlist: watchSeed as WatchItem[],
    decisions: decisionsSeed as Decision[],
    series: seriesSeed as Series[],
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
    const { weekly: _w, ...rest } = state
    localStorage.setItem(STORE_KEY, JSON.stringify(rest))
  } catch {
    // önemli değil, sadece bu oturumda kalır
  }
}

// Ajanın canlı günlüğü: her adımda birkaç satır
const LOG: Record<RunStep, string[]> = {
  tara: [
    'Takip listesi yüklendi: 8 aktif, 3 deneme etiket',
    'TikTok taranıyor: #motovlog #pov #virajsever',
    'Instagram taranıyor: #motosiklet #sonbaharrotası #ilksürüşüm',
    '428 gönderi toplandı, 7 günlük referansla karşılaştırılıyor',
  ],
  analiz: [
    'Manus gündemi analiz ediyor',
    'Yükselen: Kask kamerası POV (ivme 88)',
    'Yeni etiket bulundu: #kaskkamerası, denemeye alındı',
    '#scootermodifiye 5 gündür durağan, listeden çıkarıldı',
  ],
  uret: [
    'Seri seçildi: Ruh haline göre rota, sıradaki bölüm planlanıyor',
    '4 içerik fikri yazıldı',
    'fal.ai görselleri üretiyor (3/3)',
    'fal.ai videosu üretiliyor: POV, 14 sn',
  ],
  kaydet: ['İçerikler panele kaydedildi', 'Ajan tamamlandı'],
}

function startRun(): Run {
  const now = new Date()
  const t0 = now.getTime()
  const id = `run_manuel_${t0}`
  const run: Run = {
    id,
    tetik: 'manuel',
    durum: 'calisiyor',
    adim: 'tara',
    baslangic: now.toISOString(),
    bitis: null,
    taranan_gonderi: 0,
    ozet: 'Ajan çalışıyor…',
    log: [],
  }
  state.runs.unshift(run)
  save()

  const steps: RunStep[] = ['tara', 'analiz', 'uret', 'kaydet']
  steps.forEach((step, i) => {
    const lines = LOG[step]
    lines.forEach((mesaj, j) => {
      setTimeout(() => {
        run.adim = step
        run.taranan_gonderi = step === 'tara' ? Math.round((428 * (j + 1)) / lines.length) : 428
        run.log = [...(run.log ?? []), { zaman: new Date().toISOString(), mesaj }]
        save()
      }, STEP_MS * i + (STEP_MS / lines.length) * j)
    })
  })

  setTimeout(() => {
    const source = state.runs.find((r) => r.id !== id && r.durum === 'tamamlandi')
    if (source) {
      const idMap = new Map<string, string>()
      const trends = state.trends
        .filter((t) => t.run_id === source.id)
        .map((t) => {
          const nid = `${t.id}_${t0}`
          idMap.set(t.id, nid)
          return { ...t, id: nid, run_id: id }
        })
      const ideas = state.ideas
        .filter((x) => x.run_id === source.id)
        .map((x) => ({
          ...x,
          id: `${x.id}_${t0}`,
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
    run.bitis = new Date().toISOString()
    save()
  }, STEP_MS * steps.length)

  return run
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

export async function mockRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 120))
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
    const idea = state.ideas.find((x) => x.id === decodeURIComponent(ideaMatch[1]))
    if (!idea) throw new Error('İçerik bulunamadı')
    Object.assign(idea, body)
    save()
    return clone(idea)
  }
  if (method === 'GET' && p === '/api/weekly/latest') return clone(state.weekly)
  if (method === 'GET' && p === '/api/watchlist') return clone(state.watchlist)
  const watchMatch = p.match(/^\/api\/watchlist\/(.+)$/)
  if (method === 'PATCH' && watchMatch) {
    const w = state.watchlist.find((x) => x.id === decodeURIComponent(watchMatch[1]))
    if (!w) throw new Error('Etiket bulunamadı')
    Object.assign(w, body, { kaynak: 'insan' })
    save()
    return clone(w)
  }
  if (method === 'GET' && p === '/api/decisions')
    return clone(state.decisions.filter((d) => !run || d.run_id === run).sort((a, b) => b.zaman.localeCompare(a.zaman)))
  if (method === 'GET' && p === '/api/series') return clone(state.series)

  throw new Error(`Sahte API'de yok: ${method} ${p}`)
}
