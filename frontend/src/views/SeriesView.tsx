import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { FORMAT_LABEL } from '../lib'
import { MediaCard } from '../components/MediaCard'
import { FormatIcon } from '../components/bits'

export default function SeriesView() {
  const { series, ideas } = useStore()
  const [open, setOpen] = useState<string | null>(series[0]?.id ?? null)

  return (
    <div className="page">
      <div className="series-grid">
        {series.map((s) => {
          const eps = ideas.filter((i) => i.series_id === s.id).sort((a, b) => (a.bolum_no ?? 0) - (b.bolum_no ?? 0))
          const cover = eps.find((e) => e.gorsel_url)?.gorsel_url
          const made = new Set(eps.map((e) => e.bolum_adi))
          return (
            <button key={s.id} className={`scard ${open === s.id ? 'on' : ''}`} onClick={() => setOpen(open === s.id ? null : s.id)} title={s.neden}>
              <span className="scard-cover">
                {cover ? <img src={cover} alt="" /> : <span className="scard-empty" />}
                <span className="scard-shade" />
                {s.olusturan === 'ajan' && (
                  <span className="scard-by">
                    <Sparkles size={12} /> Ajan açtı
                  </span>
                )}
                <span className="scard-format">
                  <FormatIcon format={s.format} size={12} /> {FORMAT_LABEL[s.format]}
                </span>
              </span>
              <span className="scard-body">
                <b>{s.ad}</b>
                <span className="scard-eps">
                  {s.planlanan_bolumler.map((b) => (
                    <span key={b} className={made.has(b) ? 'done' : ''} title={b} />
                  ))}
                  <small>
                    {eps.length}/{s.planlanan_bolumler.length} bölüm
                  </small>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {open &&
        (() => {
          const s = series.find((x) => x.id === open)
          if (!s) return null
          const eps = ideas.filter((i) => i.series_id === s.id)
          return (
            <section className="episodes">
              <div className="sec-head">
                <h2>{s.ad}</h2>
                <span className="muted">{s.aciklama}</span>
              </div>
              <p className="why">
                <Sparkles size={14} /> {s.neden}
              </p>
              <div className="mgrid">
                {s.planlanan_bolumler.map((b, i) => {
                  const ep = eps.find((e) => e.bolum_adi === b)
                  return ep ? (
                    <MediaCard key={b} idea={ep} series={s} />
                  ) : (
                    <div key={b} className="ghost">
                      <span>{i + 1}</span>
                      <b>{b}</b>
                      <small>Planlandı</small>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })()}
    </div>
  )
}
