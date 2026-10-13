import { useEffect, useState, type ReactNode } from 'react'
import { AtSign, ChevronDown, Flame, Globe, Hash, Search, Settings2, TrendingUp } from 'lucide-react'
import { assetUrl } from '../api'
import { InstagramGlyph, TikTokGlyph } from '../components/bits'
import { studyoApi } from './api'
import type { AjanAyarlari, Patlayan } from './tipler'
import type { AyarDegistir } from './Studyo'
import { Anahtar, Bolum, ListeAlani, SayiAlani, binlik } from './parcalar'

type Av = AjanAyarlari['av']
type ListeAlaniAdi = 'tr_etiketler' | 'tt_hesaplar' | 'tr_aramalar' | 'ig_hesaplar' | 'ig_aramalar' | 'global_aramalar'

const KAYNAKLAR: {
  id: ListeAlaniAdi | 'creative_center'
  platform: 'tiktok' | 'instagram' | 'dunya'
  ad: string
  ikon: ReactNode
  onEk?: string
  yer?: string
  oneri?: string[]
}[] = [
  { id: 'tt_hesaplar', platform: 'tiktok', ad: 'Hesaplar', ikon: <AtSign size={14} />, onEk: '@', yer: 'kullanıcı adı' },
  { id: 'tr_etiketler', platform: 'tiktok', ad: 'Etiketler', ikon: <Hash size={14} />, onEk: '#', yer: 'etiket' },
  { id: 'tr_aramalar', platform: 'tiktok', ad: 'Aramalar', ikon: <Search size={14} />, yer: 'arama', oneri: ['motorcu kız', 'motor kursu', 'scooter', 'motorcu mizah'] },
  { id: 'ig_hesaplar', platform: 'instagram', ad: 'Hesaplar', ikon: <AtSign size={14} />, onEk: '@', yer: 'kullanıcı adı' },
  { id: 'ig_aramalar', platform: 'instagram', ad: 'Hesap keşfi', ikon: <Search size={14} />, yer: 'arama (en fazla 3)' },
  { id: 'global_aramalar', platform: 'dunya', ad: 'Dünyadan ilham', ikon: <Globe size={14} />, yer: 'arama', oneri: ['motorcycle date', 'moto girl', 'motorcycle humor'] },
  { id: 'creative_center', platform: 'tiktok', ad: 'TR trendleri', ikon: <TrendingUp size={14} /> },
]

function PlatformBas({ p }: { p: 'tiktok' | 'instagram' | 'dunya' }) {
  if (p === 'tiktok')
    return (
      <span className="av-plat av-plat-tiktok">
        <TikTokGlyph size={13} /> TikTok
      </span>
    )
  if (p === 'instagram')
    return (
      <span className="av-plat av-plat-instagram">
        <InstagramGlyph size={13} /> Instagram
      </span>
    )
  return (
    <span className="av-plat av-plat-dunya">
      <Globe size={13} /> Dünya
    </span>
  )
}

export default function Avci({ ayar, varsayilan, degistir }: { ayar: AjanAyarlari; varsayilan: AjanAyarlari; degistir: AyarDegistir }) {
  const av = ayar.av
  const a = <K extends keyof Av>(k: K, v: Av[K]) => degistir((x) => ({ ...x, av: { ...x.av, [k]: v } }))
  const s = <K extends keyof AjanAyarlari['sok']>(k: K, v: AjanAyarlari['sok'][K]) => degistir((x) => ({ ...x, sok: { ...x.sok, [k]: v } }))
  const [acik, setAcik] = useState<ListeAlaniAdi | null>(null)
  const [gelismis, setGelismis] = useState(false)
  const secili = KAYNAKLAR.find((k) => k.id === acik)

  return (
    <>
      <Bolum baslik="Nereye bakıyor" aciklama="Her taramada bakılan yerler. Bir kaynağa tıkla, düzenle.">
        <div className="av-kaynaklar">
          {KAYNAKLAR.map((k) => {
            const anahtarli = k.id === 'creative_center'
            const sayi = anahtarli ? null : av[k.id as ListeAlaniAdi].length
            const kapali = (k.platform === 'instagram' && !av.ig_aktif) || (anahtarli && !av.creative_center)
            return (
              <div key={k.id} className={`av-kaynak ${acik === k.id ? 'on' : ''} ${kapali ? 'kapali' : ''}`}>
                <PlatformBas p={k.platform} />
                {anahtarli ? (
                  <div className="av-kaynak-govde">
                    <span className="av-kaynak-ad">
                      {k.ikon} {k.ad}
                    </span>
                    <button
                      className={`st-switch ${av.creative_center ? 'on' : ''}`}
                      role="switch"
                      aria-checked={av.creative_center}
                      aria-label="Creative Center trendleri"
                      onClick={() => a('creative_center', !av.creative_center)}
                    >
                      <span />
                    </button>
                  </div>
                ) : (
                  <button className="av-kaynak-govde" onClick={() => setAcik(acik === k.id ? null : (k.id as ListeAlaniAdi))} aria-expanded={acik === k.id}>
                    <span className="av-kaynak-ad">
                      {k.ikon} {k.ad}
                    </span>
                    <b>{sayi}</b>
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {secili && secili.id !== 'creative_center' && (
          <div className="av-duzenle">
            <ListeAlani
              etiket={`${secili.platform === 'tiktok' ? 'TikTok' : secili.platform === 'instagram' ? 'Instagram' : 'Dünya'} · ${secili.ad}`}
              onEk={secili.onEk}
              degerler={av[secili.id as ListeAlaniAdi]}
              degistir={(v) => a(secili.id as ListeAlaniAdi, v)}
              yerTutucu={secili.yer ?? ''}
              oneriler={secili.oneri ?? (varsayilan.av[secili.id as ListeAlaniAdi] as string[])}
            />
            {secili.platform === 'instagram' && (
              <Anahtar etiket="Instagram avı açık" acik={av.ig_aktif} degistir={(v) => a('ig_aktif', v)} />
            )}
          </div>
        )}
      </Bolum>

      <Bolum
        baslik="Patlama eşiği"
        aciklama="Patlama = izlenme ÷ takipçi"
        sag={
          <button className="btn btn-sm" onClick={() => setGelismis((v) => !v)} aria-expanded={gelismis}>
            <Settings2 size={14} /> Gelişmiş <ChevronDown size={14} className={gelismis ? 'av-don' : ''} />
          </button>
        }
      >
        <div className="av-esikler">
          <Esik etiket="En az patlama" deger={av.min_patlama} birim="×" degistir={(n) => a('min_patlama', n)} adim={1} min={1} max={1000} />
          <Esik etiket="Son" deger={av.gun} birim="gün" degistir={(n) => a('gun', n)} adim={1} min={2} max={60} />
          <Esik etiket="TikTok TR en az" deger={av.min_izlenme_tr} birim="izlenme" degistir={(n) => a('min_izlenme_tr', n)} adim={5000} min={0} max={10_000_000} />
          <Esik etiket="Instagram en az" deger={av.min_izlenme_ig} birim="izlenme" degistir={(n) => a('min_izlenme_ig', n)} adim={5000} min={0} max={10_000_000} />
        </div>
        {gelismis && (
          <div className="st-izgara st-izgara-4">
            <SayiAlani etiket="TikTok TR seçim" deger={av.tr_secim} degistir={(n) => a('tr_secim', n)} min={0} max={15} />
            <SayiAlani etiket="Instagram seçim" deger={av.ig_secim} degistir={(n) => a('ig_secim', n)} min={0} max={8} />
            <SayiAlani etiket="Dünya seçim" deger={av.global_secim} degistir={(n) => a('global_secim', n)} min={0} max={10} />
            <SayiAlani etiket="Hesap başına en fazla" deger={av.hesap_basi} degistir={(n) => a('hesap_basi', n)} min={1} max={5} />
            <SayiAlani etiket="Dünya en az izlenme" deger={av.min_izlenme_global} degistir={(n) => a('min_izlenme_global', n)} min={0} max={50_000_000} adim={1000} />
            <SayiAlani etiket="Etiket başına video" deger={av.etiket_basi_video} degistir={(n) => a('etiket_basi_video', n)} min={5} max={100} />
            <SayiAlani etiket="Arama başına video" deger={av.arama_basi_video} degistir={(n) => a('arama_basi_video', n)} min={5} max={100} />
            <SayiAlani etiket="Instagram hesap sayısı" deger={av.ig_hesap_sayisi} degistir={(n) => a('ig_hesap_sayisi', n)} min={5} max={40} />
            <SayiAlani etiket="Manus'un izlediği video" deger={ayar.sok.izlenecek_video} degistir={(n) => s('izlenecek_video', n)} min={1} max={10} />
            <SayiAlani etiket="Söküm süresi" deger={ayar.sok.sure_dk} degistir={(n) => s('sure_dk', n)} min={10} max={60} birim="dk" />
            <SayiAlani etiket="Söküm tazeliği" deger={ayar.sok.taze_saat} degistir={(n) => s('taze_saat', n)} min={0} max={72} birim="saat" />
          </div>
        )}
      </Bolum>

      <Patlayanlar />
    </>
  )
}

function Esik({
  etiket,
  deger,
  birim,
  degistir,
  adim,
  min,
  max,
}: {
  etiket: string
  deger: number
  birim: string
  degistir: (n: number) => void
  adim: number
  min: number
  max: number
}) {
  const id = `esik-${etiket}`
  return (
    <label className="av-esik" htmlFor={id}>
      <span>{etiket}</span>
      <span className="av-esik-deger">
        <input id={id} type="number" value={deger} min={min} max={max} step={adim} onChange={(e) => Number.isFinite(Number(e.target.value)) && degistir(Number(e.target.value))} />
        <small>{birim}</small>
      </span>
    </label>
  )
}

function Patlayanlar() {
  const [liste, setListe] = useState<Patlayan[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<'hepsi' | 'tiktok' | 'instagram'>('hepsi')
  const [tumu, setTumu] = useState(false)
  useEffect(() => {
    studyoApi.patlayanlar().then(setListe, (e) => setHata(e instanceof Error ? e.message : 'Yüklenemedi'))
  }, [])
  // Haber/gündem hesapları artık avda eleniyor; eski kayıtlarda da gösterme.
  const HABER = /(haber|gundem|gündem|news|medya|ajans)/i
  const uygun = (liste ?? []).filter((p) => !HABER.test(p.hesap ?? '') && (filtre === 'hepsi' || p.platform === filtre))
  const sirali = uygun.sort((x, y) => Number(!!y.kapak_url) - Number(!!x.kapak_url) || y.patlama - x.patlama)
  const gorunen = tumu ? sirali : sirali.slice(0, 18)
  const say = (p: string) => (liste ?? []).filter((x) => x.platform === p).length

  return (
    <Bolum
      baslik="Son patlayanlar"
      sag={
        <div className="st-segment" role="tablist" aria-label="Platform">
          <button className={filtre === 'hepsi' ? 'on' : ''} onClick={() => setFiltre('hepsi')}>
            Tümü
          </button>
          <button className={filtre === 'tiktok' ? 'on' : ''} onClick={() => setFiltre('tiktok')}>
            TikTok {say('tiktok')}
          </button>
          <button className={filtre === 'instagram' ? 'on' : ''} onClick={() => setFiltre('instagram')}>
            Instagram {say('instagram')}
          </button>
        </div>
      }
    >
      {hata && <p className="st-sessiz">{hata}</p>}
      {!liste && !hata && <div className="st-yukleniyor kucuk" aria-busy="true" />}
      {liste && gorunen.length === 0 && <p className="st-sessiz">Bu platformda henüz patlayan yok; bir sonraki taramada dolar.</p>}
      <div className="av-videolar">
        {gorunen.map((p) => (
          <a key={p.link} className="av-video" href={p.link} target="_blank" rel="noreferrer" title={p.aciklama ?? ''}>
            {p.kapak_url ? <img src={assetUrl(p.kapak_url) ?? undefined} alt="" loading="lazy" /> : <span className="av-video-bos" />}
            <span className="av-video-ust">
              <span className={`av-mini av-mini-${p.platform}`}>{p.platform === 'instagram' ? <InstagramGlyph size={11} /> : <TikTokGlyph size={11} />}</span>
              <span className={`av-patlama ${p.patlama >= 50 ? 'cok' : ''}`}>
                <Flame size={12} /> {Math.round(p.patlama)}×
              </span>
            </span>
            <span className="av-video-alt">
              <b>@{p.hesap ?? '—'}</b>
              <span>
                {binlik(p.izlenme)} izlenme · {binlik(p.takipci)} takipçi
              </span>
            </span>
          </a>
        ))}
      </div>
      {sirali.length > 18 && (
        <button className="btn btn-sm tl-more" onClick={() => setTumu((v) => !v)}>
          {tumu ? 'Daha az göster' : `Tümünü göster (${sirali.length})`}
        </button>
      )}
    </Bolum>
  )
}
