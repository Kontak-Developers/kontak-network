import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Check, Loader2, Play, Sparkles } from 'lucide-react'
import { useShownRun, useStore } from '../store'
import { STEPS, STEP_HINT, STEP_LABEL, TREND_LABEL, fmtTime, relDay, runDuration } from '../lib'
import { MediaGrid } from '../components/MediaCard'
import { PlatformGlyph, TrendIcon } from '../components/bits'
import { Avatar } from '../components/Phone'

export default function Today({ openAgent }: { openAgent: () => void }) {
  const { brand, latest, trends, ideas, weekly, startRun } = useStore()
  const shown = useShownRun()
  const [trendId, setTrendId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  if (!brand) return null

  const running = latest?.durum === 'calisiyor'
  const todayTrends = trends.filter((t) => t.run_id === shown?.id)
  const todayIdeas = ideas.filter((i) => i.run_id === shown?.id)
  const visibleIdeas = trendId ? todayIdeas.filter((i) => i.trend_id === trendId) : todayIdeas
  const pending = todayIdeas.filter((i) => i.durum === 'yeni').length
  const stepIndex = latest ? STEPS.indexOf(latest.adim) : 0

  async function run() {
    setStarting(true)
    try {
      await startRun()
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="page">
      <section className={`hero ${running ? 'hero-running' : ''}`}>
        <div className="hero-main">
          <span className="hero-avatar">
            <Avatar brand={brand} size={48} />
            <span className="pulse" />
          </span>
          <div className="hero-text">
            <span className="eyebrow">{running ? 'Ajan şu an çalışıyor' : shown ? `${relDay(shown.baslangic)} ${fmtTime(shown.baslangic)}` : 'Henüz çalışmadı'}</span>
            <h1>{running ? 'Gündem taranıyor…' : (shown?.ozet ?? 'Ajan ilk taramasını bekliyor')}</h1>
          </div>
          <button className="btn btn-primary btn-lg hero-btn" onClick={run} disabled={running || starting}>
            {running ? <Loader2 size={18} className="spin" /> : <Play size={17} fill="currentColor" />}
            {running ? 'Çalışıyor' : 'Şimdi tara'}
          </button>
        </div>

        <ol className="steps">
          {STEPS.map((s, i) => {
            const st = !running || i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'todo'
            return (
              <li key={s} className={`step step-${st}`}>
                <span className="step-icon">{st === 'done' ? <Check size={14} strokeWidth={3} /> : st === 'active' ? <Loader2 size={14} className="spin" /> : i + 1}</span>
                <span className="step-text">
                  <b>{STEP_LABEL[s]}</b>
                  <small>{STEP_HINT[s]}</small>
                </span>
              </li>
            )
          })}
        </ol>

        {running ? (
          <ul className="log" aria-live="polite">
            {(latest?.log ?? []).slice(-4).map((l) => (
              <li key={l.zaman + l.mesaj}>
                <span>{fmtTime(l.zaman)}</span>
                {l.mesaj}
              </li>
            ))}
          </ul>
        ) : (
          shown && (
            <div className="hero-stats">
              <span>
                <b>{shown.taranan_gonderi.toLocaleString('tr-TR')}</b> gönderi tarandı
              </span>
              <span>
                <b>{todayTrends.length}</b> trend
              </span>
              <span>
                <b>{todayIdeas.length}</b> içerik
              </span>
              {runDuration(shown) && (
                <span>
                  <b>{runDuration(shown)}</b> sürdü
                </span>
              )}
              <button className="link" onClick={openAgent}>
                Kararları gör
              </button>
            </div>
          )
        )}
      </section>

      <section>
        <div className="sec-head">
          <h2>Gündem</h2>
          {trendId && (
            <button className="link" onClick={() => setTrendId(null)}>
              Tümünü göster
            </button>
          )}
        </div>
        <div className="trends">
          {todayTrends.map((t) => (
            <button
              key={t.id}
              className={`trend ${trendId === t.id ? 'on' : ''} ${t.ivme < 40 ? 'trend-flat' : ''}`}
              onClick={() => setTrendId(trendId === t.id ? null : t.id)}
              title={t.aciklama}
            >
              <span className="trend-top">
                <span className="trend-tip">
                  <TrendIcon tip={t.tip} size={14} />
                  {TREND_LABEL[t.tip]}
                </span>
                <PlatformGlyph platform={t.platform} size={12} />
              </span>
              <b className="trend-title">{t.baslik}</b>
              <span className="trend-ivme">
                <span className="trend-num">{t.ivme}</span>
                {t.ivme >= 40 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                <span className="trend-bar">
                  <span style={{ width: `${t.ivme}%` }} />
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="sec-head">
          <h2>
            Hazır içerikler
            {pending > 0 && <span className="count">{pending} onay bekliyor</span>}
          </h2>
        </div>
        {visibleIdeas.length ? <MediaGrid ideas={visibleIdeas} /> : <p className="empty">Bu trendden içerik üretilmedi.</p>}
      </section>

      {weekly && (
        <section className="week">
          <div className="week-head">
            <Sparkles size={18} />
            <h2>Bu hafta</h2>
          </div>
          <p className="week-summary">{weekly.ozet}</p>
          <div className="week-chips">
            {weekly.yukselen.map((w) => (
              <span key={w.baslik} className="wchip wchip-up">
                <ArrowUpRight size={14} /> {w.baslik}
              </span>
            ))}
            {weekly.kalici.map((w) => (
              <span key={w.baslik} className="wchip">
                {w.baslik}
              </span>
            ))}
            {weekly.sonen.map((w) => (
              <span key={w.baslik} className="wchip wchip-down">
                <ArrowDownRight size={14} /> {w.baslik}
              </span>
            ))}
          </div>
          <ol className="week-focus">
            {weekly.onerilen_odak.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
