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

  const durumda = ideas.filter((i) => filter === 'hepsi' || i.durum === filter)
  const pSay = { hepsi: durumda.length, instagram: durumda.filter((i) => i.platform === 'instagram').length, tiktok: durumda.filter((i) => i.platform === 'tiktok').length }
  const shown = durumda.filter((i) => pf === 'hepsi' || i.platform === pf)
  const gruplar: { p: 'instagram' | 'tiktok'; ad: string; liste: typeof shown }[] = [
    { p: 'instagram', ad: 'Instagram', liste: shown.filter((i) => i.platform === 'instagram') },
    { p: 'tiktok', ad: 'TikTok', liste: shown.filter((i) => i.platform === 'tiktok') },
  ]

  return (
    <div className="page">
      {/* Platform birincil ayrım (13 Eki, Nida: "yalnız kartın üstünde minnacık yazıyor") */}
      <div className="plat-sekmeler" role="tablist" aria-label="Platform">
        <button role="tab" aria-selected={pf === 'hepsi'} className={pf === 'hepsi' ? 'on' : ''} onClick={() => setPf('hepsi')}>
          Tümü <span>{pSay.hepsi}</span>
        </button>
        <button role="tab" aria-selected={pf === 'instagram'} className={`plat-ig ${pf === 'instagram' ? 'on' : ''}`} onClick={() => setPf('instagram')}>
          <InstagramGlyph size={17} /> Instagram <span>{pSay.instagram}</span>
        </button>
        <button role="tab" aria-selected={pf === 'tiktok'} className={`plat-tt ${pf === 'tiktok' ? 'on' : ''}`} onClick={() => setPf('tiktok')}>
          <TikTokGlyph size={17} /> TikTok <span>{pSay.tiktok}</span>
        </button>
      </div>
      <div className="toolbar">
        <div className="tabs-pill" role="tablist">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'hepsi' ? 'Tümü' : f === 'yeni' ? 'Bekleyen' : STATUS_LABEL[f]}
              <span>{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      {!shown.length ? (
        <p className="empty">Bu filtrede içerik yok.</p>
      ) : pf !== 'hepsi' ? (
        <MediaGrid ideas={shown} />
      ) : (
        gruplar
          .filter((g) => g.liste.length)
          .map((g) => (
            <section key={g.p} className="plat-grup">
              <h2 className={`plat-baslik plat-baslik-${g.p}`}>
                {g.p === 'instagram' ? <InstagramGlyph size={18} /> : <TikTokGlyph size={18} />}
                {g.ad}
                <span>{g.liste.length}</span>
              </h2>
              <MediaGrid ideas={g.liste} />
            </section>
          ))
      )}
    </div>
  )
}
