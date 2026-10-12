import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Idea, IdeaStatus, Trend } from '../types'
import { IdeaCard, STATUS } from '../ui'

type Filter = 'hepsi' | IdeaStatus
const FILTERS: Filter[] = ['hepsi', 'yeni', 'onaylandi', 'paylasildi', 'reddedildi']

export function useIdeaActions(setIdeas: React.Dispatch<React.SetStateAction<Idea[]>>) {
  return async (id: string, durum: IdeaStatus) => {
    setIdeas((list) => list.map((i) => (i.id === id ? { ...i, durum } : i)))
    try {
      await api.setIdeaStatus(id, durum)
    } catch {
      // başarısızsa sunucudaki hali geri yükle
      setIdeas(await api.ideas())
    }
  }
}

export default function Ideas() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [trends, setTrends] = useState<Trend[]>([])
  const [filter, setFilter] = useState<Filter>('yeni')
  const [loading, setLoading] = useState(true)
  const onStatus = useIdeaActions(setIdeas)

  useEffect(() => {
    Promise.all([api.ideas(), api.trends()]).then(([i, t]) => {
      setIdeas(i)
      setTrends(t)
      if (!i.some((x) => x.durum === 'yeni')) setFilter('hepsi')
      setLoading(false)
    })
  }, [])

  const trendById = useMemo(() => new Map(trends.map((t) => [t.id, t])), [trends])
  const counts = useMemo(() => {
    const c: Record<string, number> = { hepsi: ideas.length }
    ideas.forEach((i) => (c[i.durum] = (c[i.durum] ?? 0) + 1))
    return c
  }, [ideas])
  const shown = filter === 'hepsi' ? ideas : ideas.filter((i) => i.durum === filter)

  if (loading) return <p className="empty">Yükleniyor…</p>

  return (
    <div className="stack">
      <div className="filters" role="tablist" aria-label="Duruma göre filtrele">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`filter ${filter === f ? 'filter-on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'hepsi' ? 'Tümü' : STATUS[f]} <span className="filter-count">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="idea-grid">
          {shown.map((i) => (
            <IdeaCard key={i.id} idea={i} trend={trendById.get(i.trend_id)} onStatus={onStatus} />
          ))}
        </div>
      ) : (
        <p className="empty card">Bu durumda içerik yok.</p>
      )}
    </div>
  )
}
