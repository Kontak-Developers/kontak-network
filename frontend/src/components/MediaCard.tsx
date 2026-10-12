import type { Idea, Series } from '../types'
import { useStore } from '../store'
import { assetUrl } from '../api'
import { FORMAT_LABEL, STATUS_LABEL } from '../lib'
import { FormatIcon, PlatformGlyph, SeriesIcon } from './bits'

export function MediaCard({ idea, series }: { idea: Idea; series?: Series }) {
  const { selectedId, select } = useStore()
  const on = selectedId === idea.id
  return (
    <button
      className={`mcard mcard-${idea.durum} ${on ? 'mcard-on' : ''}`}
      onClick={() => select(on ? null : idea.id)}
      aria-pressed={on}
      aria-label={`${idea.baslik}, ${STATUS_LABEL[idea.durum]}`}
    >
      {idea.gorsel_url ? <img src={assetUrl(idea.gorsel_url)!} alt="" loading="lazy" /> : <span className="mcard-empty" />}
      <span className="mcard-shade" />
      <span className="mcard-top">
        <span className="mcard-chip">
          <PlatformGlyph platform={idea.platform} size={12} />
          <FormatIcon format={idea.format} size={12} />
          {FORMAT_LABEL[idea.format]}
        </span>
        <span className={`dot dot-${idea.durum}`} title={STATUS_LABEL[idea.durum]} />
      </span>
      <span className="mcard-bottom">
        {series && (
          <span className="mcard-series">
            <SeriesIcon size={11} />
            {series.ad} · {idea.bolum_no}
          </span>
        )}
        <span className="mcard-title">{idea.baslik}</span>
      </span>
    </button>
  )
}

export function MediaGrid({ ideas }: { ideas: Idea[] }) {
  const { series } = useStore()
  const byId = new Map(series.map((s) => [s.id, s]))
  return (
    <div className="mgrid">
      {ideas.map((i) => (
        <MediaCard key={i.id} idea={i} series={i.series_id ? byId.get(i.series_id) : undefined} />
      ))}
    </div>
  )
}
