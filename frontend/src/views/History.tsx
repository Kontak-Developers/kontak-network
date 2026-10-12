import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Idea, Run, Trend } from '../types'
import { IdeaCard, RunMeta, RunStatus, StepTrack, TrendList, formatDate } from '../ui'
import { useIdeaActions } from './Ideas'

export default function History() {
  const [runs, setRuns] = useState<Run[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [trends, setTrends] = useState<Trend[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const onStatus = useIdeaActions(setIdeas)

  useEffect(() => {
    api.runs().then((r) => {
      setRuns(r)
      setSelected(r[0]?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (!selected) return
    Promise.all([api.trends(selected), api.ideas(selected)]).then(([t, i]) => {
      setTrends(t)
      setIdeas(i)
    })
  }, [selected])

  const run = runs.find((r) => r.id === selected)

  return (
    <div className="history">
      <aside className="card run-list">
        <h2>Çalıştırmalar</h2>
        <ul>
          {runs.map((r) => (
            <li key={r.id}>
              <button className={`run-item ${r.id === selected ? 'run-item-on' : ''}`} onClick={() => setSelected(r.id)}>
                <span className="run-item-top">
                  <span>{formatDate(r.baslangic)}</span>
                  <RunStatus run={r} />
                </span>
                <span className="run-item-sub">
                  {r.tetik === 'cron' ? 'Otomatik' : 'Elle'} · {r.taranan_gonderi.toLocaleString('tr-TR')} gönderi
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {run && (
        <div className="stack">
          <section className="card">
            <p className="eyebrow">Çalıştırma</p>
            <h2>{run.ozet}</h2>
            <StepTrack run={run} />
            <RunMeta run={run} />
          </section>
          <section className="card">
            <h2 className="section-title">Gündem</h2>
            <TrendList trends={trends} />
          </section>
          {ideas.length > 0 && (
            <section>
              <h2 className="section-title">İçerikler</h2>
              <div className="idea-grid">
                {ideas.map((i) => (
                  <IdeaCard key={i.id} idea={i} trend={trends.find((t) => t.id === i.trend_id)} onStatus={onStatus} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
