// Ajanın "tasarim" sahneleri: Kontak uygulamasının tasarım dilinde kartlar.
// Görsel modeli kullanılmaz; metin ve rota verisi koddan çizilir, Türkçe yazı bozulmaz.
// Kart kapsayıcısına göre ölçeklenir (container query birimleri).

import { useLayoutEffect, useRef, useState } from 'react'
import { Clock, Gauge, MapPin, Route } from 'lucide-react'
import type { Brand, DesignSpec, KontakRota } from '../types'
import { useStore } from '../store'
import { Avatar } from './Phone'

/** Kartlar 360 px genişlikte tasarlanır, kapsayıcıya ölçeklenir; yükseklik kapsayıcının oranına uyar. */
const TABAN = 360

export default function DesignCard({ spec, brand }: { spec: DesignSpec; brand: Brand }) {
  const { kontakRotalar } = useStore()
  const rota = spec.rota_id ? kontakRotalar.find((r) => r.id === spec.rota_id) : undefined
  const host = useRef<HTMLDivElement>(null)
  const [olcu, setOlcu] = useState({ s: 1, h: TABAN * 1.25 })

  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (!width) return
      const s = width / TABAN
      setOlcu({ s, h: height / s })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="dc-host" ref={host}>
    <div className={`dc dc-${spec.sablon}`} style={{ height: olcu.h, transform: `scale(${olcu.s})` }}>
      {spec.sablon === 'rota' && <RotaKart spec={spec} rota={rota} brand={brand} />}
      {spec.sablon === 'liste' && <ListeKart spec={spec} brand={brand} />}
      {spec.sablon === 'metin' && <MetinKart spec={spec} brand={brand} />}
      {spec.sablon === 'karsilastirma' && <KarsilastirmaKart spec={spec} brand={brand} />}
      {spec.sablon === 'soru' && <SoruKart spec={spec} brand={brand} />}
    </div>
    </div>
  )
}

function Imza({ brand, light }: { brand: Brand; light?: boolean }) {
  return (
    <span className={`dc-imza ${light ? 'dc-imza-light' : ''}`}>
      <Avatar brand={brand} size={18} />@{brand.kullanici_adi}
    </span>
  )
}

/* ───────── Rota ───────── */

const ZORLUK: Record<string, string> = { kolay: 'Kolay', orta: 'Orta', zor: 'Zor' }

function RotaKart({ spec, rota, brand }: { spec: DesignSpec; rota?: KontakRota; brand: Brand }) {
  const pts = rota ? rotaNoktalari(rota) : []
  const km = rota ? Math.round(rota.mesafe_m / 1000) : null
  const sure = rota ? sureYazi(rota.sure_s) : null
  const bas = rota?.noktalar[0]?.ad
  const son = rota?.noktalar[rota.noktalar.length - 1]?.ad
  return (
    <>
      <div className="dc-rota-ust">
        <span className="dc-etiket">
          <Route size={11} /> Kontak rotaları
        </span>
        {rota?.sehir && <span className="dc-sehir">{rota.sehir}</span>}
      </div>
      <div className="dc-harita">
        <RotaCizimi pts={pts} />
      </div>
      <div className="dc-rota-alt">
        <b className="dc-baslik">{spec.baslik || rota?.ad}</b>
        {rota && (
          <span className="dc-guzergah">
            <MapPin size={10} /> {bas}
            {son && son !== bas ? ` → ${son}` : ''}
          </span>
        )}
        <span className="dc-istatistik">
          {km !== null && (
            <span>
              <Route size={11} /> {km} km
            </span>
          )}
          {sure && (
            <span>
              <Clock size={11} /> {sure}
            </span>
          )}
          {rota?.zorluk && (
            <span>
              <Gauge size={11} /> {ZORLUK[rota.zorluk] ?? rota.zorluk}
            </span>
          )}
        </span>
        {spec.alt_baslik && <p className="dc-alt">{spec.alt_baslik}</p>}
        <Imza brand={brand} />
      </div>
    </>
  )
}

function RotaCizimi({ pts }: { pts: [number, number][] }) {
  if (pts.length < 2)
    return (
      <svg viewBox="0 0 100 100" className="dc-svg" aria-hidden>
        <path d="M14 78 C 30 40, 52 70, 62 42 S 82 22, 88 18" className="dc-yol-golge" />
        <path d="M14 78 C 30 40, 52 70, 62 42 S 82 22, 88 18" className="dc-yol" />
        <circle cx="14" cy="78" r="3.2" className="dc-bas" />
        <circle cx="88" cy="18" r="3.6" className="dc-son" />
      </svg>
    )
  // Eşdikdörtgen izdüşüm, enlem düzeltmeli; en-boy oranı korunur
  const lat0 = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2
  const k = Math.cos((lat0 * Math.PI) / 180)
  const xy = pts.map(([la, lo]) => [lo * k, -la])
  const minX = Math.min(...xy.map((p) => p[0]))
  const maxX = Math.max(...xy.map((p) => p[0]))
  const minY = Math.min(...xy.map((p) => p[1]))
  const maxY = Math.max(...xy.map((p) => p[1]))
  const w = maxX - minX || 1e-6
  const h = maxY - minY || 1e-6
  const s = 76 / Math.max(w, h)
  const ox = (100 - w * s) / 2
  const oy = (100 - h * s) / 2
  const P = xy.map(([x, y]) => [ox + (x - minX) * s, oy + (y - minY) * s])
  const d = P.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')
  const a = P[0]
  const b = P[P.length - 1]
  return (
    <svg viewBox="0 0 100 100" className="dc-svg" aria-hidden>
      <path d={d} className="dc-yol-golge" />
      <path d={d} className="dc-yol" />
      <circle cx={a[0]} cy={a[1]} r="3.2" className="dc-bas" />
      <circle cx={b[0]} cy={b[1]} r="3.6" className="dc-son" />
    </svg>
  )
}

function rotaNoktalari(r: KontakRota): [number, number][] {
  const c = r.cizgi ? polylineCoz(r.cizgi) : []
  const pts = c.length >= 2 ? c : r.noktalar.map((n) => [n.lat, n.lon] as [number, number])
  if (pts.length <= 400) return pts
  const adim = (pts.length - 1) / 399
  return Array.from({ length: 400 }, (_, i) => pts[Math.round(i * adim)])
}

/** Google kodlu çoklu çizgi (1e5) */
function polylineCoz(str: string): [number, number][] {
  const out: [number, number][] = []
  let i = 0
  let lat = 0
  let lng = 0
  try {
    while (i < str.length) {
      for (const which of [0, 1]) {
        let shift = 0
        let result = 0
        let b: number
        do {
          if (i >= str.length) return out
          b = str.charCodeAt(i++) - 63
          result |= (b & 0x1f) << shift
          shift += 5
        } while (b >= 0x20)
        const delta = result & 1 ? ~(result >> 1) : result >> 1
        if (which === 0) lat += delta
        else lng += delta
      }
      out.push([lat / 1e5, lng / 1e5])
    }
  } catch {
    return []
  }
  return out
}

function sureYazi(sn: number) {
  const dk = Math.round(sn / 60)
  if (dk < 60) return `${dk} dk`
  const s = Math.floor(dk / 60)
  const m = dk % 60
  return m ? `${s} sa ${m} dk` : `${s} sa`
}

/* ───────── Liste / metin / karşılaştırma / soru ───────── */

function ListeKart({ spec, brand }: { spec: DesignSpec; brand: Brand }) {
  return (
    <>
      <b className="dc-baslik">{spec.baslik}</b>
      {spec.alt_baslik && <p className="dc-alt">{spec.alt_baslik}</p>}
      <ol className="dc-liste">
        {spec.maddeler.map((m, i) => (
          <li key={i}>
            <span>{i + 1}</span>
            {m}
          </li>
        ))}
      </ol>
      <Imza brand={brand} light />
    </>
  )
}

function MetinKart({ spec, brand }: { spec: DesignSpec; brand: Brand }) {
  return (
    <>
      <span className="dc-tirnak" aria-hidden>
        “
      </span>
      <b className="dc-buyuk">{spec.baslik}</b>
      {spec.alt_baslik && <p className="dc-alt">{spec.alt_baslik}</p>}
      <Imza brand={brand} light />
    </>
  )
}

function KarsilastirmaKart({ spec, brand }: { spec: DesignSpec; brand: Brand }) {
  const ayir = spec.maddeler.indexOf('|')
  const sol = ayir >= 0 ? spec.maddeler.slice(0, ayir) : spec.maddeler.slice(0, Math.ceil(spec.maddeler.length / 2))
  const sag = ayir >= 0 ? spec.maddeler.slice(ayir + 1) : spec.maddeler.slice(Math.ceil(spec.maddeler.length / 2))
  return (
    <>
      {spec.baslik && <b className="dc-baslik">{spec.baslik}</b>}
      <div className="dc-kolonlar">
        {[sol, sag].map((k, j) => (
          <div key={j} className={`dc-kolon ${j ? 'dc-kolon-vurgu' : ''}`}>
            <b>{k[0]}</b>
            <ul>
              {k.slice(1).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Imza brand={brand} light />
    </>
  )
}

function SoruKart({ spec, brand }: { spec: DesignSpec; brand: Brand }) {
  return (
    <>
      <span className="dc-etiket">Sen hangisisin?</span>
      <b className="dc-baslik">{spec.baslik}</b>
      <div className="dc-secenekler">
        {spec.maddeler.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
      {spec.alt_baslik && <p className="dc-alt">{spec.alt_baslik}</p>}
      <Imza brand={brand} />
    </>
  )
}
