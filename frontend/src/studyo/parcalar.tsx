import { useId, useState, type ReactNode } from 'react'
import { Plus, RotateCcw, Save, X } from 'lucide-react'

/** Etiket, arama, odak, mekân gibi metin listeleri: yonga + ekleme kutusu. */
export function ListeAlani({
  etiket,
  aciklama,
  degerler,
  degistir,
  yerTutucu,
  onEk = '',
  oneriler = [],
}: {
  etiket: string
  aciklama?: string
  degerler: string[]
  degistir: (v: string[]) => void
  yerTutucu: string
  onEk?: string
  oneriler?: string[]
}) {
  const id = useId()
  const [yeni, setYeni] = useState('')
  const ekle = (v: string) => {
    const t = v.trim().replace(onEk ? new RegExp(`^\\${onEk}+`) : /^$/, '')
    if (!t || degerler.includes(t)) return
    degistir([...degerler, t])
    setYeni('')
  }
  const kalanOneri = oneriler.filter((o) => !degerler.includes(o))
  return (
    <div className="st-alan">
      <label htmlFor={id} className="st-etiket">
        {etiket}
      </label>
      {aciklama && <p className="st-aciklama">{aciklama}</p>}
      <div className="st-yongalar">
        {degerler.map((d) => (
          <span key={d} className="st-yonga">
            {onEk}
            {d}
            <button type="button" aria-label={`${d} kaldır`} onClick={() => degistir(degerler.filter((x) => x !== d))}>
              <X size={13} />
            </button>
          </span>
        ))}
        <form
          className="st-yonga-ekle"
          onSubmit={(e) => {
            e.preventDefault()
            ekle(yeni)
          }}
        >
          <input id={id} value={yeni} onChange={(e) => setYeni(e.target.value)} placeholder={yerTutucu} />
          <button type="submit" className="icon-btn" aria-label="Ekle" disabled={!yeni.trim()}>
            <Plus size={15} />
          </button>
        </form>
      </div>
      {kalanOneri.length > 0 && (
        <div className="st-oneriler">
          <span>Öneri:</span>
          {kalanOneri.map((o) => (
            <button key={o} type="button" onClick={() => ekle(o)}>
              + {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function SayiAlani({
  etiket,
  aciklama,
  deger,
  degistir,
  min,
  max,
  adim = 1,
  birim,
}: {
  etiket: string
  aciklama?: string
  deger: number
  degistir: (n: number) => void
  min: number
  max: number
  adim?: number
  birim?: string
}) {
  const id = useId()
  return (
    <div className="st-alan st-sayi">
      <label htmlFor={id} className="st-etiket">
        {etiket}
      </label>
      <span className="st-sayi-kutu">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={adim}
          value={Number.isFinite(deger) ? deger : ''}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) degistir(n)
          }}
        />
        {birim && <span className="st-birim">{birim}</span>}
      </span>
      {aciklama && <p className="st-aciklama">{aciklama}</p>}
    </div>
  )
}

export function Anahtar({
  etiket,
  aciklama,
  acik,
  degistir,
}: {
  etiket: string
  aciklama?: string
  acik: boolean
  degistir: (v: boolean) => void
}) {
  const id = useId()
  return (
    <div className="st-anahtar">
      <span>
        <label htmlFor={id} className="st-etiket">
          {etiket}
        </label>
        {aciklama && <p className="st-aciklama">{aciklama}</p>}
      </span>
      <button id={id} type="button" role="switch" aria-checked={acik} className={`st-switch ${acik ? 'on' : ''}`} onClick={() => degistir(!acik)}>
        <span />
      </button>
    </div>
  )
}

export function MetinAlani({
  etiket,
  aciklama,
  deger,
  degistir,
  satir = 3,
  yerTutucu,
  ingilizce,
}: {
  etiket: string
  aciklama?: string
  deger: string
  degistir: (v: string) => void
  satir?: number
  yerTutucu?: string
  ingilizce?: boolean
}) {
  const id = useId()
  return (
    <div className="st-alan">
      <label htmlFor={id} className="st-etiket">
        {etiket}
        {ingilizce && <span className="st-dil">EN</span>}
      </label>
      {aciklama && <p className="st-aciklama">{aciklama}</p>}
      {satir === 1 ? (
        <input id={id} value={deger} onChange={(e) => degistir(e.target.value)} placeholder={yerTutucu} />
      ) : (
        <textarea id={id} rows={satir} value={deger} onChange={(e) => degistir(e.target.value)} placeholder={yerTutucu} />
      )}
    </div>
  )
}

/** Kaydedilmemiş değişiklik varken sayfanın altında duran çubuk. */
export function KaydetCubugu({
  kirli,
  kaydediliyor,
  kaydet,
  vazgec,
  not,
}: {
  kirli: boolean
  kaydediliyor: boolean
  kaydet: () => void
  vazgec: () => void
  not?: string
}) {
  if (!kirli) return null
  return (
    <div className="st-kaydet" role="region" aria-label="Kaydedilmemiş değişiklikler">
      <span>
        <b>Kaydedilmemiş değişiklik var</b>
        {not && <small>{not}</small>}
      </span>
      <button className="btn" onClick={vazgec} disabled={kaydediliyor}>
        <RotateCcw size={15} /> Vazgeç
      </button>
      <button className="btn btn-primary" onClick={kaydet} disabled={kaydediliyor}>
        <Save size={15} /> {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </div>
  )
}

export function Bolum({ baslik, aciklama, sag, children }: { baslik: string; aciklama?: string; sag?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel st-bolum">
      <div className="st-bolum-bas">
        <span>
          <h2>{baslik}</h2>
          {aciklama && <p>{aciklama}</p>}
        </span>
        {sag}
      </div>
      {children}
    </section>
  )
}

export const usd = (n: number) => `$${n.toFixed(n < 10 ? 2 : 1)}`
export const binlik = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.0', '')} Mn` : n >= 1000 ? `${Math.round(n / 1000)} B` : String(n)
