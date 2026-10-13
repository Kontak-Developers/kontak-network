import { useEffect, useState } from 'react'
import { Ban, ExternalLink, Pin, Undo2 } from 'lucide-react'
import { useStore } from '../store'
import { assetUrl } from '../api'
import { relDay } from '../lib'
import { studyoApi } from './api'
import type { Format, Patlayan } from './tipler'
import { Bolum } from './parcalar'

const DURUM: Record<Format['durum'], string> = { zirvede: 'Zirvede', yukseliyor: 'Yükseliyor', sonuyor: 'Sönüyor' }

export default function Formatlar() {
  const { toast } = useStore()
  const [liste, setListe] = useState<Format[] | null>(null)
  const [kapak, setKapak] = useState<Map<string, Patlayan>>(new Map())
  const [hata, setHata] = useState<string | null>(null)
  const [acik, setAcik] = useState<string | null>(null)
  useEffect(() => {
    studyoApi.formatlar().then(setListe, (e) => setHata(e instanceof Error ? e.message : 'Yüklenemedi'))
    studyoApi.patlayanlar().then((p) => setKapak(new Map(p.map((x) => [x.link, x]))), () => undefined)
  }, [])

  const karar = async (f: Format, k: Format['panel_karari']) => {
    try {
      await studyoApi.formatKarari(f.id, k)
      setListe((l) => l?.map((x) => (x.id === f.id ? { ...x, panel_karari: k } : x)) ?? l)
      toast(k === 'sabit' ? `"${f.ad}" her turda kullanılacak` : k === 'kapali' ? `"${f.ad}" kapatıldı` : `"${f.ad}" ajana bırakıldı`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kaydedilemedi')
    }
  }

  return (
    <Bolum baslik="Format kütüphanesi" aciklama="Patlayan videolardan sökülen kalıplar. Sabitle: her turda. Kapat: hiç.">
      {hata && <p className="st-sessiz">{hata}</p>}
      {!liste && !hata && <div className="st-yukleniyor kucuk" aria-busy="true" />}
      {liste?.length === 0 && <p className="st-sessiz">Henüz format yok; ilk sabah taramasından sonra dolar.</p>}
      <div className="fo-liste">
        {liste?.map((f) => {
          const ornekler = f.ornekler.map((o) => (typeof o === 'string' ? o : o.link))
          const gorseller = ornekler.map((l) => kapak.get(l)).filter((p): p is Patlayan => !!p?.kapak_url).slice(0, 3)
          const enIyi = Math.max(0, ...ornekler.map((l) => kapak.get(l)?.patlama ?? 0))
          const detay = acik === f.id
          return (
            <article key={f.id} className={`fo-kart ${f.panel_karari ? `fo-${f.panel_karari}` : ''}`}>
              <div className="fo-ornekler">
                {gorseller.length ? (
                  gorseller.map((p) => (
                    <a key={p.link} href={p.link} target="_blank" rel="noreferrer" aria-label={`@${p.hesap} videosu`}>
                      <img src={assetUrl(p.kapak_url) ?? undefined} alt="" loading="lazy" />
                    </a>
                  ))
                ) : (
                  <span className="fo-ornek-bos">
                    {ornekler.slice(0, 3).map((l, i) => (
                      <a key={l} href={l} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} /> Örnek {i + 1}
                      </a>
                    ))}
                  </span>
                )}
                <span className="fo-halka" style={{ ['--g' as string]: `${f.skor}` }} title="Kanıt gücü">
                  <b>{f.skor}</b>
                </span>
              </div>
              <div className="fo-govde">
                <div className="fo-rozetler">
                  <span className={`st-durum st-durum-${f.durum}`}>{DURUM[f.durum]}</span>
                  {f.panel_karari === 'sabit' && <span className="st-durum st-durum-sabit">Sabit</span>}
                  {f.panel_karari === 'kapali' && <span className="st-durum">Kapalı</span>}
                  {enIyi > 0 && <span className="st-durum fo-patlama">{Math.round(enIyi)}×</span>}
                </div>
                <h3>{f.ad}</h3>
                <p className="fo-ozet">{f.ozet}</p>
                <blockquote>{f.kanca_kalibi}</blockquote>
                {detay && (
                  <dl className="fo-detay">
                    <dt>Yapı</dt>
                    <dd>{f.yapi}</dd>
                    <dt>Kurgu</dt>
                    <dd>{f.kurgu}</dd>
                    <dt>Ses</dt>
                    <dd>{f.ses}</dd>
                    <dt>Neden tuttu</dt>
                    <dd>{f.neden_tuttu}</dd>
                    <dt>Kontak açısı</dt>
                    <dd className="st-cok-satir">{f.kontak_acisi}</dd>
                  </dl>
                )}
                <footer>
                  <button className="fo-daha" onClick={() => setAcik(detay ? null : f.id)} aria-expanded={detay}>
                    {detay ? 'Kısalt' : 'Yapı ve Kontak açısı'}
                  </button>
                  <span className="st-sessiz">
                    {f.gorulme} tur · {f.kullanim} içerik · {relDay(f.son_gorulme)}
                  </span>
                </footer>
                <div className="fo-dugmeler">
                  {f.panel_karari !== 'sabit' && (
                    <button className="btn btn-sm" onClick={() => karar(f, 'sabit')}>
                      <Pin size={13} /> Sabitle
                    </button>
                  )}
                  {f.panel_karari !== 'kapali' && (
                    <button className="btn btn-sm" onClick={() => karar(f, 'kapali')}>
                      <Ban size={13} /> Kapat
                    </button>
                  )}
                  {f.panel_karari && (
                    <button className="btn btn-sm" onClick={() => karar(f, null)}>
                      <Undo2 size={13} /> Ajana bırak
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </Bolum>
  )
}
