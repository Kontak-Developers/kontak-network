import type { Idea, Series } from '../types'
import { useStore } from '../store'
import { assetUrl } from '../api'
import { FORMAT_LABEL, STATUS_LABEL, hasVideo, scenesOf } from '../lib'
import { Images, Play } from 'lucide-react'
import { FormatIcon, PlatformGlyph, SeriesIcon } from './bits'
import DesignCard from './DesignCard'

export function MediaCard({ idea, series }: { idea: Idea; series?: Series }) {
  const { selectedId, select, brand } = useStore()
  const cover = scenesOf(idea)[0]
  const on = selectedId === idea.id
  return (
    <button
      className={`mcard mcard-${idea.durum} ${on ? 'mcard-on' : ''}`}
      onClick={() => select(on ? null : idea.id)}
      aria-pressed={on}
      aria-label={`${idea.baslik}, ${STATUS_LABEL[idea.durum]}`}
    >
      {cover?.tur === 'tasarim' && cover.tasarim && brand ? (
        <span className="mcard-design">
          <DesignCard spec={cover.tasarim} brand={brand} />
        </span>
      ) : idea.gorsel_url ? (
        <img src={assetUrl(idea.gorsel_url)!} alt="" loading="lazy" />
      ) : (
        <span className="mcard-empty" />
      )}
      <span className="mcard-shade" />
      <span className="mcard-top">
        <span className="mcard-chips">
          <span className={`mcard-plat mcard-plat-${idea.platform}`}>
            <PlatformGlyph platform={idea.platform} size={12} />
            {idea.platform === 'instagram' ? 'Instagram' : 'TikTok'}
          </span>
          <span className="mcard-chip">
            <FormatIcon format={idea.format} size={12} />
            {FORMAT_LABEL[idea.format]}
          </span>
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
      {idea.format === 'kisa_video' && idea.reel_durum && idea.reel_durum !== 'hazir' && (
        <span className={`mcard-reel mcard-reel-${idea.reel_durum}`}>
          {idea.reel_durum === 'uretiliyor' ? 'Üretiliyor' : idea.reel_durum === 'bekliyor' ? 'Sırada' : idea.reel_durum === 'atlandi' ? 'Bütçeden atlandı' : 'Üretilemedi'}
        </span>
      )}
      {hasVideo(idea) ? (
        <span className="mcard-media">
          <Play size={10} fill="currentColor" /> {scenesOf(idea).filter((s) => s.video_url).length} klip
        </span>
      ) : (
        idea.format === 'carousel' && (
          <span className="mcard-media">
            <Images size={11} /> {scenesOf(idea).length}
          </span>
        )
      )}
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
