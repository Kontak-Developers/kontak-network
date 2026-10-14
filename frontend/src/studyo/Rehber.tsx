import { useEffect, useState } from 'react'
import { BookOpen, ChevronDown, Pencil } from 'lucide-react'
import { useStore } from '../store'
import { studyoApi } from './api'
import type { MarkaRehberi } from './tipler'
import { Bolum } from './parcalar'

/** "## 4. Marka Dili…" → "Marka Dili…" başlıkları. */
const basliklar = (metin: string) =>
  metin
    .split('\n')
    .filter((s) => s.startsWith('## '))
    .map((s) => s.slice(3).replace(/^\d+\.\s*/, '').trim())

/** Rehberin yalın markdown'ı: başlık, madde, alıntı ve kalın yazı yeter. */
function Metin({ metin }: { metin: string }) {
  const kalin = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
      p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith('`') ? <code key={i}>{p.slice(1, -1)}</code> : p
    )
  return (
    <div className="st-rehber-metin">
      {metin.split('\n').map((s, i) => {
        if (!s.trim() || s.startsWith('# ')) return null
        if (s.startsWith('## ')) return <h3 key={i}>{s.slice(3)}</h3>
        if (s.startsWith('### ')) return <h4 key={i}>{s.slice(4)}</h4>
        if (s.startsWith('> ')) return <p key={i} className="st-rehber-not">{kalin(s.slice(2))}</p>
        if (/^(-|\d+\.)\s/.test(s)) return <p key={i} className="st-rehber-madde">{kalin(s)}</p>
        return <p key={i}>{kalin(s)}</p>
      })}
    </div>
  )
}

/**
 * Marka rehberi (Şevval, 14 Eki): üreticilerin kullandığı yazılı kurallar.
 * Ajan her kreatif turda `marka.rehber` olarak okur; çelişirse prompttan önce gelir.
 */
export default function Rehber({ rehber, kaydedildi }: { rehber: MarkaRehberi | null; kaydedildi: (r: MarkaRehberi) => void }) {
  const { toast } = useStore()
  const [duzenle, setDuzenle] = useState(false)
  const [taslak, setTaslak] = useState(rehber?.metin ?? '')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  useEffect(() => setTaslak(rehber?.metin ?? ''), [rehber])

  const kaydet = async () => {
    setKaydediliyor(true)
    try {
      const r = await studyoApi.rehberKaydet(taslak)
      kaydedildi(r)
      setDuzenle(false)
      toast('Marka rehberi kaydedildi; bir sonraki üretimden itibaren geçerli')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kaydedilemedi')
    } finally {
      setKaydediliyor(false)
    }
  }

  const bolumler = basliklar(rehber?.metin ?? '')
  return (
    <Bolum
      baslik="Marka rehberi"
      aciklama={
        rehber
          ? `Ajan her üretimde buna uyar ve içerikleri 14 maddelik yayın öncesi kontrolden geçirir. Son güncelleme ${rehber.surum} · ${rehber.guncelleyen}.`
          : 'Henüz rehber yok. Yapıştırdığında ajan her üretimde buna uyar.'
      }
      sag={
        !duzenle && (
          <button className="btn btn-sm" onClick={() => setDuzenle(true)}>
            <Pencil size={14} /> {rehber ? 'Düzenle' : 'Rehber ekle'}
          </button>
        )
      }
    >
      {duzenle ? (
        <div className="st-duzenle">
          <label className="st-alan">
            <span className="st-etiket">Rehber metni (markdown: ## başlık, - madde)</span>
            <textarea id="rehber-metin" rows={18} value={taslak} onChange={(e) => setTaslak(e.target.value)} />
          </label>
          <div className="st-duzenle-dugmeler">
            <button className="btn btn-sm" onClick={() => { setDuzenle(false); setTaslak(rehber?.metin ?? '') }} disabled={kaydediliyor}>
              Vazgeç
            </button>
            <button className="btn btn-sm btn-primary" onClick={kaydet} disabled={kaydediliyor}>
              {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      ) : (
        rehber && (
          <>
            <ol className="st-rehber-bolumler">
              {bolumler.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ol>
            <details className="st-yardim">
              <summary>
                <ChevronDown size={16} /> <BookOpen size={15} /> Tamamını oku
              </summary>
              <Metin metin={rehber.metin} />
            </details>
          </>
        )
      )}
    </Bolum>
  )
}
