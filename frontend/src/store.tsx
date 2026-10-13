import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError, api, canSync, onAuthChange } from './api'
import type { AuthState } from './api'
import type { Brand, Decision, Idea, IdeaStatus, KontakRota, Run, Series, Trend, WatchItem, WatchStatus, Weekly } from './types'

type Toast = { id: number; text: string }

type Store = {
  ready: boolean
  error: string | null
  auth: AuthState
  brand: Brand | null
  runs: Run[]
  latest: Run | null
  trends: Trend[]
  ideas: Idea[]
  series: Series[]
  watchlist: WatchItem[]
  decisions: Decision[]
  weekly: Weekly | null
  kontakRotalar: KontakRota[]
  selectedId: string | null
  select: (id: string | null) => void
  setIdeaStatus: (id: string, durum: IdeaStatus) => Promise<void>
  setWatch: (id: string, durum: WatchStatus) => Promise<void>
  startRun: () => Promise<void>
  saveBrand: (b: Brand) => Promise<void>
  /** İçerik listesini tazele (Stüdyo: metin düzenleme, yazı gömme sonrası) */
  refreshIdeas: () => Promise<void>
  toast: (text: string) => void
  toasts: Toast[]
}

const Ctx = createContext<Store | null>(null)

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider yok')
  return s
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [auth, setAuth] = useState<AuthState>('tamam')
  const [brand, setBrand] = useState<Brand | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [trends, setTrends] = useState<Trend[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const ideasRef = useRef<Idea[]>([])
  ideasRef.current = ideas
  const [series, setSeries] = useState<Series[]>([])
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [weekly, setWeekly] = useState<Weekly | null>(null)
  const [kontakRotalar, setKontakRotalar] = useState<KontakRota[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(location.search).get('icerik'))
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  const toast = useCallback((text: string) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200)
  }, [])

  const loadAll = useCallback(async () => {
    try {
    // Marka ve çalıştırmalar şart; diğerleri düşerse boş değerle devam
    const soft = <T,>(p: Promise<T>, fallback: T) =>
      p.catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) throw e
        console.warn(e)
        return fallback
      })
    const [b, r, t, i, s, w, d, wk] = await Promise.all([
      api.brand(),
      api.runs(),
      soft(api.trends(), []),
      soft(api.ideas(), []),
      soft(api.series(), []),
      soft(api.watchlist(), []),
      soft(api.decisions(), []),
      soft(api.weekly(), null),
    ])
    soft(api.kontakRotalar(), []).then(setKontakRotalar)
    setBrand(normalizeBrand(b))
    setRuns(r)
    setTrends(t)
    setIdeas(i)
    setSeries(s)
    setWatchlist(w)
    setDecisions(d)
    setWeekly(wk)
    setError(null)
    setReady(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veriler yüklenemedi.')
    }
  }, [])

  useEffect(() => {
    const off = onAuthChange(setAuth)
    loadAll()
    // Kontak uygulamasındaki rotaları ajana kopyala (sabah çalıştırması jetonsuz)
    if (canSync)
      api
        .rotaSenkron()
        .then(() => api.kontakRotalar())
        .then(setKontakRotalar)
        .catch((e) => console.warn('rota senkronu', e))
    return off
  }, [loadAll])

  // Yalnız tarama çalıştırmaları (run_*). Stok/yazı/reel işleri Stüdyo'da izleniyor; burada
  // sayılırsa Bugün sayfası boşalıyor ve "tamamlandı" bildirimi döngüye giriyordu (13 Eki).
  const latest = runs.find((r) => r.id.startsWith('run_')) ?? null

  // Ajan çalışırken durumu izle, bitince her şeyi yenile
  useEffect(() => {
    if (latest?.durum !== 'calisiyor') return
    const timer = setInterval(async () => {
      const r = await api.latestRun().catch(() => null)
      if (!r) return
      if (r.durum === 'calisiyor') setRuns((list) => [r, ...list.filter((x) => x.id !== r.id)])
      else {
        await loadAll()
        toast(r.durum === 'tamamlandi' ? 'Ajan tamamlandı, yeni içerikler hazır' : 'Ajan hata verdi')
      }
    }, 800)
    return () => clearInterval(timer)
  }, [latest?.durum, loadAll, toast])

  useEffect(() => {
    if (brand) document.documentElement.style.setProperty('--marka', brand.vurgu_rengi)
  }, [brand])

  const setIdeaStatus = useCallback(
    async (id: string, durum: IdeaStatus) => {
      setIdeas((list) => list.map((i) => (i.id === id ? { ...i, durum } : i)))
      try {
        await api.setIdeaStatus(id, durum)
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Kaydedilemedi')
        setIdeas(await api.ideas().catch(() => []))
      }
    },
    [toast],
  )

  const setWatch = useCallback(async (id: string, durum: WatchStatus) => {
    setWatchlist((list) => list.map((w) => (w.id === id ? { ...w, durum, kaynak: 'insan' } : w)))
    try {
      await api.setWatch(id, durum)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kaydedilemedi')
      setWatchlist(await api.watchlist().catch(() => []))
    }
  }, [toast])

  const startRun = useCallback(async () => {
    try {
      await api.startRun()
    } catch (e) {
      toast(e instanceof ApiError && e.kod === 'zaten_calisiyor' ? 'Ajan zaten çalışıyor' : e instanceof Error ? e.message : 'Başlatılamadı')
    }
    setRuns(await api.runs().catch(() => []))
  }, [toast])

  const saveBrand = useCallback(async (b: Brand) => {
    setBrand(normalizeBrand(await api.saveBrand(b)))
  }, [])

  const refreshIdeas = useCallback(async () => {
    setIdeas(await api.ideas().catch(() => ideasRef.current))
  }, [])

  const value = useMemo<Store>(
    () => ({
      ready,
      error,
      auth,
      brand,
      runs,
      latest,
      trends,
      ideas,
      series,
      watchlist,
      decisions,
      weekly,
      kontakRotalar,
      selectedId,
      select: setSelectedId,
      setIdeaStatus,
      setWatch,
      startRun,
      saveBrand,
      refreshIdeas,
      toast,
      toasts,
    }),
    [ready, error, auth, brand, runs, latest, trends, ideas, series, watchlist, decisions, weekly, kontakRotalar, selectedId, setIdeaStatus, setWatch, startRun, saveBrand, refreshIdeas, toast, toasts],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Backend'den eksik gelebilecek alanları tamamla */
function normalizeBrand(b: Brand): Brand {
  return {
    ...b,
    kullanici_adi: b.kullanici_adi || (b.id === 'kontak' ? 'kontak.social' : b.id),
    logo_url: b.logo_url ?? null,
    ton_kurallari: b.ton_kurallari ?? [],
    sutunlar: b.sutunlar ?? [],
    izlenecek: { ...{ tiktok_hashtagler: [], instagram_hashtagler: [], hesaplar: [] }, ...b.izlenecek },
  }
}

/** Ekranda gösterilecek "bugünkü" çalıştırma: çalışan varsa son tamamlanan */
export function useShownRun() {
  const { runs } = useStore()
  return runs.find((r) => r.durum === 'tamamlandi' && r.id.startsWith('run_')) ?? null
}
