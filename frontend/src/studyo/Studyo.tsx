import { useCallback, useEffect, useState } from 'react'
import { Clapperboard, Palette, Radar, Rocket, Route, ScrollText, Shapes } from 'lucide-react'
import { useStore } from '../store'
import { studyoApi } from './api'
import type { AjanAyarlari, StudyoOzet } from './tipler'
import { KaydetCubugu } from './parcalar'
import Uretim from './Uretim'
import Kimlik from './Kimlik'
import Rehber from './Rehber'
import Avci from './Avci'
import Formatlar from './Formatlar'
import Kreatif from './Kreatif'
import Promptlar from './Promptlar'
import Rotalar from './Rotalar'
import './studyo.css'

export type AyarDegistir = (f: (a: AjanAyarlari) => AjanAyarlari) => void

const BOLUMLER = [
  { id: 'uretim', label: 'Üretim', icon: Rocket },
  { id: 'kimlik', label: 'Marka & kimlik', icon: Palette },
  { id: 'avci', label: 'Avcı', icon: Radar },
  { id: 'formatlar', label: 'Formatlar', icon: Shapes },
  { id: 'kreatif', label: 'Kreatif & stüdyo', icon: Clapperboard },
  { id: 'promptlar', label: 'Promptlar', icon: ScrollText },
  { id: 'rotalar', label: 'Rotalar', icon: Route },
] as const
type BolumId = (typeof BOLUMLER)[number]['id']

const SAKLA = 'kontak_studyo_bolum'
function ilkBolum(): BolumId {
  try {
    const b = localStorage.getItem(SAKLA)
    if (BOLUMLER.some((x) => x.id === b)) return b as BolumId
  } catch {
    /* gizli sekme */
  }
  return 'uretim'
}

export default function Studyo() {
  const { toast } = useStore()
  const [bolum, setBolum] = useState<BolumId>(ilkBolum)
  const [ozet, setOzet] = useState<StudyoOzet | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [taslak, setTaslak] = useState<AjanAyarlari | null>(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const yukle = useCallback(async () => {
    try {
      const o = await studyoApi.ozet()
      setOzet(o)
      setHata(null)
      return o
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Stüdyo yüklenemedi.')
      return null
    }
  }, [])

  useEffect(() => {
    yukle().then((o) => o && setTaslak(o.ayarlar))
  }, [yukle])

  // Süren üretim varken 20 sn'de bir tazele (ilerleme ve harcama).
  useEffect(() => {
    if (!ozet?.suren.length) return
    const t = setInterval(yukle, 20_000)
    return () => clearInterval(t)
  }, [ozet?.suren.length, yukle])

  const sec = (b: BolumId) => {
    setBolum(b)
    try {
      localStorage.setItem(SAKLA, b)
    } catch {
      /* yok say */
    }
  }

  const ayarDegistir: AyarDegistir = (f) => setTaslak((a) => (a ? f(a) : a))
  const kirli = !!ozet && !!taslak && JSON.stringify(taslak) !== JSON.stringify(ozet.ayarlar)

  const kaydet = async () => {
    if (!taslak) return
    setKaydediliyor(true)
    try {
      const a = await studyoApi.ayarlariKaydet(taslak)
      setOzet((o) => (o ? { ...o, ayarlar: a } : o))
      setTaslak(a)
      toast('Ayarlar kaydedildi; bir sonraki çalıştırmada geçerli')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ayarlar kaydedilemedi')
    } finally {
      setKaydediliyor(false)
    }
  }

  if (hata && !ozet)
    return (
      <div className="panel st-bos">
        <b>Stüdyo yüklenemedi</b>
        <p>{hata}</p>
        <button className="btn" onClick={() => yukle().then((o) => o && setTaslak(o.ayarlar))}>
          Tekrar dene
        </button>
      </div>
    )
  if (!ozet || !taslak) return <div className="st-yukleniyor" aria-busy="true" />

  const ayarBolumu = bolum === 'avci' || bolum === 'kreatif'

  return (
    <div className="page st">
      <nav className="st-sekmeler" aria-label="Stüdyo bölümleri">
        {BOLUMLER.map(({ id, label, icon: Icon }) => (
          <button key={id} className={bolum === id ? 'on' : ''} onClick={() => sec(id)} aria-current={bolum === id ? 'page' : undefined}>
            <Icon size={16} />
            {label}
            {id === 'uretim' && ozet.suren.length > 0 && <span className="st-nabiz" aria-label="Üretim sürüyor" />}
          </button>
        ))}
      </nav>

      {bolum === 'uretim' && <Uretim ozet={ozet} yenile={yukle} />}
      {bolum === 'kimlik' && <Rehber rehber={ozet.rehber} kaydedildi={(r) => setOzet({ ...ozet, rehber: r })} />}
      {bolum === 'kimlik' && <Kimlik kimlik={ozet.kimlik} kaydedildi={(k) => setOzet({ ...ozet, kimlik: k })} />}
      {bolum === 'avci' && <Avci ayar={taslak} varsayilan={ozet.varsayilan} degistir={ayarDegistir} />}
      {bolum === 'formatlar' && <Formatlar />}
      {bolum === 'kreatif' && <Kreatif ayar={taslak} varsayilan={ozet.varsayilan} degistir={ayarDegistir} />}
      {bolum === 'promptlar' && <Promptlar ozetler={ozet.promptlar} yenile={yukle} />}
      {bolum === 'rotalar' && <Rotalar />}

      {ayarBolumu && (
        <KaydetCubugu
          kirli={kirli}
          kaydediliyor={kaydediliyor}
          kaydet={kaydet}
          vazgec={() => setTaslak(ozet.ayarlar)}
          not="Süren üretim eski ayarla biter; yenisi bir sonraki turda."
        />
      )}
    </div>
  )
}
