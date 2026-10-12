import { useState } from 'react'
import type { Idea, IdeaStatus, Run, RunStep, Trend } from './types'

export const STEP_LABELS: Record<RunStep, string> = {
  tara: 'Tarama',
  analiz: 'Analiz',
  uret: 'Üretim',
  kaydet: 'Kayıt',
}
const STEPS: RunStep[] = ['tara', 'analiz', 'uret', 'kaydet']

const TREND_TIP: Record<Trend['tip'], string> = { konu: 'Konu', ses: 'Ses', format: 'Format', hashtag: 'Hashtag' }
const PLATFORM: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', ikisi: 'TikTok + Instagram' }
const FORMAT: Record<Idea['format'], string> = { kisa_video: 'Kısa video', carousel: 'Carousel', gonderi: 'Gönderi' }
export const STATUS: Record<IdeaStatus, string> = {
  yeni: 'Yeni',
  onaylandi: 'Onaylandı',
  reddedildi: 'Reddedildi',
  paylasildi: 'Paylaşıldı',
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
export const formatDate = (iso: string) => dateFmt.format(new Date(iso))

function duration(run: Run) {
  if (!run.bitis) return null
  const sec = Math.round((new Date(run.bitis).getTime() - new Date(run.baslangic).getTime()) / 1000)
  return sec < 60 ? `${sec} sn` : `${Math.floor(sec / 60)} dk ${sec % 60} sn`
}

export function RunStatus({ run }: { run: Run }) {
  const label = { calisiyor: 'Çalışıyor', tamamlandi: 'Tamamlandı', hata: 'Hata' }[run.durum]
  return <span className={`status status-${run.durum}`}>{label}</span>
}

export function StepTrack({ run }: { run: Run }) {
  const current = STEPS.indexOf(run.adim)
  return (
    <ol className="steps" aria-label="Ajan adımları">
      {STEPS.map((s, i) => {
        const state =
          run.durum === 'tamamlandi' || i < current
            ? 'done'
            : i === current
              ? run.durum === 'hata'
                ? 'failed'
                : 'active'
              : 'todo'
        return (
          <li key={s} className={`step step-${state}`}>
            <span className="step-dot" />
            {STEP_LABELS[s]}
          </li>
        )
      })}
    </ol>
  )
}

export function RunMeta({ run }: { run: Run }) {
  const d = duration(run)
  return (
    <div className="run-meta">
      <span>{formatDate(run.baslangic)}</span>
      <span>{run.tetik === 'cron' ? 'Otomatik' : 'Elle başlatıldı'}</span>
      <span>{run.taranan_gonderi.toLocaleString('tr-TR')} gönderi tarandı</span>
      {d && <span>{d}</span>}
    </div>
  )
}

export function TrendList({ trends }: { trends: Trend[] }) {
  if (!trends.length) return <p className="empty">Bu çalıştırmada gündem maddesi yok.</p>
  return (
    <ul className="trend-list">
      {trends.map((t) => (
        <li key={t.id} className="trend">
          <div className="trend-head">
            <span className="chip">{TREND_TIP[t.tip]}</span>
            <span className="chip chip-quiet">{PLATFORM[t.platform]}</span>
          </div>
          <h3>{t.baslik}</h3>
          <p>{t.aciklama}</p>
          <div className="ivme" title="Son 48 saatin önceki 7 güne göre büyümesi">
            <span className="ivme-label">İvme</span>
            <span className="ivme-bar">
              <span style={{ width: `${t.ivme}%` }} />
            </span>
            <span className="ivme-value">{t.ivme}</span>
          </div>
          {t.ornek_linkler.length > 0 && (
            <div className="trend-links">
              {t.ornek_linkler.map((l, i) => (
                <a key={l} href={l} target="_blank" rel="noreferrer">
                  Örnek {i + 1} ↗
                </a>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function IdeaCard({
  idea,
  trend,
  onStatus,
}: {
  idea: Idea
  trend?: Trend
  onStatus: (id: string, durum: IdeaStatus) => void
}) {
  const [copied, setCopied] = useState(false)
  const caption = `${idea.aciklama_metni}\n\n${idea.hashtagler.join(' ')}`

  return (
    <article className={`idea idea-${idea.durum}`}>
      <div className="idea-media">
        {idea.video_url ? (
          <video src={idea.video_url} controls playsInline muted />
        ) : idea.gorsel_url ? (
          <img src={idea.gorsel_url} alt={idea.baslik} loading="lazy" />
        ) : (
          <div className="idea-placeholder">
            <span>{FORMAT[idea.format]}</span>
            <small>Görsel üretim sırasında</small>
          </div>
        )}
        <span className={`badge badge-${idea.durum}`}>{STATUS[idea.durum]}</span>
      </div>
      <div className="idea-body">
        <div className="trend-head">
          <span className="chip">{PLATFORM[idea.platform]}</span>
          <span className="chip chip-quiet">{FORMAT[idea.format]}</span>
        </div>
        {trend && <p className="idea-trend">Gündem: {trend.baslik}</p>}
        <h3>{idea.baslik}</h3>
        <p className="idea-hook">“{idea.kanca}”</p>
        <details>
          <summary>Senaryo ({idea.senaryo.length} sahne)</summary>
          <ol className="scenes">
            {idea.senaryo.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </details>
        <div className="caption">
          <p>{idea.aciklama_metni}</p>
          <p className="tags">{idea.hashtagler.join(' ')}</p>
        </div>
        <div className="idea-actions">
          <button
            className="btn"
            onClick={async () => {
              if (await copyText(caption)) {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }
            }}
          >
            {copied ? 'Kopyalandı' : 'Metni kopyala'}
          </button>
          {idea.durum === 'yeni' && (
            <>
              <button className="btn btn-primary" onClick={() => onStatus(idea.id, 'onaylandi')}>
                Onayla
              </button>
              <button className="btn btn-ghost" onClick={() => onStatus(idea.id, 'reddedildi')}>
                Reddet
              </button>
            </>
          )}
          {idea.durum === 'onaylandi' && (
            <button className="btn btn-primary" onClick={() => onStatus(idea.id, 'paylasildi')}>
              Paylaşıldı olarak işaretle
            </button>
          )}
          {(idea.durum === 'reddedildi' || idea.durum === 'paylasildi') && (
            <button className="btn btn-ghost" onClick={() => onStatus(idea.id, 'yeni')}>
              Geri al
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
