import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { Idea, Run, Trend, Weekly } from '../types'
import { RunMeta, RunStatus, StepTrack, TrendList } from '../ui'

export default function Today({ onOpenIdeas }: { onOpenIdeas: () => void }) {
  const [run, setRun] = useState<Run | null>(null)
  const [trends, setTrends] = useState<Trend[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [weekly, setWeekly] = useState<Weekly | null>(null)
  const [starting, setStarting] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const latest = await api.latestRun()
    setRun(latest)
    // çalışan bir çalıştırma varsa son tamamlananın gündemini göster
    const runs = latest?.durum === 'tamamlandi' ? [latest] : (await api.runs()).filter((r) => r.durum === 'tamamlandi')
    const shown = runs[0]
    if (shown) {
      const [t, i] = await Promise.all([api.trends(shown.id), api.ideas(shown.id)])
      setTrends(t)
      setIdeas(i)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    api.weekly().then(setWeekly)
  }, [load])

  useEffect(() => {
    if (run?.durum !== 'calisiyor') return
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [run?.durum, load])

  async function start() {
    setStarting(true)
    try {
      await api.startRun()
      await load()
    } finally {
      setStarting(false)
    }
  }

  if (loading) return <p className="empty">Yükleniyor…</p>

  const pending = ideas.filter((i) => i.durum === 'yeni').length

  return (
    <div className="stack">
      <section className="card run-card">
        <div className="run-card-head">
          <div>
            <p className="eyebrow">Ajanın son çalıştırması</p>
            {run ? (
              <h2>
                {run.durum === 'calisiyor' ? 'Ajan şu an çalışıyor' : run.ozet} <RunStatus run={run} />
              </h2>
            ) : (
              <h2>Ajan henüz çalışmadı</h2>
            )}
          </div>
          <button className="btn btn-primary btn-lg" onClick={start} disabled={starting || run?.durum === 'calisiyor'}>
            {run?.durum === 'calisiyor' ? 'Çalışıyor…' : 'Şimdi çalıştır'}
          </button>
        </div>
        {run && (
          <>
            <StepTrack run={run} />
            <RunMeta run={run} />
          </>
        )}
        <p className="hint">Ajan her sabah 08:00'de TikTok ve Instagram'ı kendiliğinden tarar.</p>
      </section>

      <div className="stats">
        <div className="card stat">
          <span className="stat-value">{run?.taranan_gonderi.toLocaleString('tr-TR') ?? 0}</span>
          <span className="stat-label">taranan gönderi</span>
        </div>
        <div className="card stat">
          <span className="stat-value">{trends.length}</span>
          <span className="stat-label">gündem maddesi</span>
        </div>
        <div className="card stat">
          <span className="stat-value">{ideas.length}</span>
          <span className="stat-label">hazır içerik</span>
        </div>
        <button className="card stat stat-action" onClick={onOpenIdeas}>
          <span className="stat-value">{pending}</span>
          <span className="stat-label">onay bekliyor →</span>
        </button>
      </div>

      <div className="two-col">
        <section className="card">
          <div className="section-head">
            <h2>Bugünün gündemi</h2>
            <span className="muted">İvmeye göre sıralı</span>
          </div>
          <TrendList trends={trends} />
        </section>

        {weekly && (
          <section className="card weekly">
            <div className="section-head">
              <h2>Haftalık özet</h2>
              <span className="muted">{weekly.hafta.replace('-W', ' · Hafta ')}</span>
            </div>
            <p className="weekly-summary">{weekly.ozet}</p>
            <WeeklyGroup title="Yükselen" items={weekly.yukselen} tone="up" />
            <WeeklyGroup title="Kalıcı" items={weekly.kalici} tone="steady" />
            <WeeklyGroup title="Sönen" items={weekly.sonen} tone="down" />
            <h3 className="weekly-title">Bu hafta odak</h3>
            <ul className="focus-list">
              {weekly.onerilen_odak.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function WeeklyGroup({ title, items, tone }: { title: string; items: Weekly['kalici']; tone: string }) {
  if (!items.length) return null
  return (
    <div className="weekly-group">
      <h3 className="weekly-title">{title}</h3>
      <ul>
        {items.map((i) => (
          <li key={i.baslik} className={`weekly-item weekly-${tone}`}>
            <span>{i.baslik}</span>
            <span className="weekly-ivme">{i.ivme}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
