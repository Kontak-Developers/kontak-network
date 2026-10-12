import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { STATUS_LABEL } from '../lib'
import type { IdeaStatus } from '../types'
import { MediaGrid } from '../components/MediaCard'
import { InstagramGlyph, TikTokGlyph } from '../components/bits'

type Filter = 'hepsi' | IdeaStatus
const FILTERS: Filter[] = ['yeni', 'onaylandi', 'paylasildi', 'reddedildi', 'hepsi']
type PFilter = 'hepsi' | 'instagram' | 'tiktok'

export default function Content() {
  const { ideas } = useStore()
  const [filter, setFilter] = useState<Filter>(() => (ideas.some((i) => i.durum === 'yeni') ? 'yeni' : 'hepsi'))
  const [pf, setPf] = useState<PFilter>('hepsi')

  const counts = useMemo(() => {
    const c: Record<string, number> = { hepsi: ideas.length }
    ideas.forEach((i) => (c[i.durum] = (c[i.durum] ?? 0) + 1))
    return c
  }, [ideas])

  const shown = ideas.filter((i) => (filter === 'hepsi' || i.durum === filter) && (pf === 'hepsi' || i.platform === pf))

  return (
    <div className="page">
      <div className="toolbar">
        <div className="tabs-pill" role="tablist">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'hepsi' ? 'Tümü' : f === 'yeni' ? 'Bekleyen' : STATUS_LABEL[f]}
              <span>{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="seg seg-sm" role="tablist" aria-label="Platform">
          <button className={pf === 'hepsi' ? 'on' : ''} onClick={() => setPf('hepsi')}>
            Tümü
          </button>
          <button className={pf === 'instagram' ? 'on' : ''} onClick={() => setPf('instagram')} aria-label="Instagram">
            <InstagramGlyph size={15} />
          </button>
          <button className={pf === 'tiktok' ? 'on' : ''} onClick={() => setPf('tiktok')} aria-label="TikTok">
            <TikTokGlyph size={15} />
          </button>
        </div>
      </div>
      {shown.length ? <MediaGrid ideas={shown} /> : <p className="empty">Bu filtrede içerik yok.</p>}
    </div>
  )
}
