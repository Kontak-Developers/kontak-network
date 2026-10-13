import { useEffect, useState } from 'react'
import { Ban, ExternalLink, Pin, Undo2 } from 'lucide-react'
import { useStore } from '../store'
import { relDay } from '../lib'
import { studyoApi } from './api'
import type { Format } from './tipler'
import { Bolum } from './parcalar'

const DURUM: Record<Format['durum'], string> = { zirvede: 'Zirvede', yukseliyor: 'Yükseliyor', sonuyor: 'Sönüyor' }

export default function Formatlar() {
  const { toast } = useStore()
  const [liste, setListe] = useState<Format[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  useEffect(() => {
    studyoApi.formatlar().then(setListe, (e) => setHata(e instanceof Error ? e.message : 'Yüklenemedi'))
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
    <Bolum
      baslik="Format kütüphanesi"
      aciklama="Patlayan videolardan sökülmüş, tekrar üretilebilir kalıplar. Kreatif direktöre en güçlü 8'i gider. Sabitlediğin her turda gider, kapattığın hiç gitmez."
    >
      {hata && <p className="st-sessiz">{hata}</p>}
      {!liste && !hata && <div className="st-yukleniyor kucuk" aria-busy="true" />}
      {liste?.length === 0 && <p className="st-sessiz">Henüz format yok; ilk sabah taramasından sonra dolar.</p>}
      <div className="st-formatlar">
        {liste?.map((f) => (
          <article key={f.id} className={`st-format ${f.panel_karari ? `st-format-${f.panel_karari}` : ''}`}>
            <header>
              <span className={`st-durum st-durum-${f.durum}`}>{DURUM[f.durum]}</span>
              {f.panel_karari === 'sabit' && <span className="st-durum st-durum-sabit">Sabit</span>}
              {f.panel_karari === 'kapali' && <span className="st-durum st-durum-kapali">Kapalı</span>}
              <span className="st-guc" title="Kanıt gücü">
                <span style={{ width: `${f.skor}%` }} />
              </span>
              <b className="st-guc-sayi">{f.skor}</b>
            </header>
            <h3>{f.ad}</h3>
            <p>{f.ozet}</p>
            <dl>
              <dt>Kanca</dt>
              <dd>{f.kanca_kalibi}</dd>
            </dl>
            <details>
              <summary>Yapı, kurgu, ses, Kontak açısı</summary>
              <dl>
                <dt>Yapı</dt>
                <dd>{f.yapi}</dd>
                <dt>Kurgu</dt>
                <dd>{f.kurgu}</dd>
                <dt>Ses</dt>
                <dd>{f.ses}</dd>
                <dt>Ekran yazısı</dt>
                <dd>{f.ekran_yazisi}</dd>
                <dt>Neden tuttu</dt>
                <dd>{f.neden_tuttu}</dd>
                <dt>Kontak açısı</dt>
                <dd className="st-cok-satir">{f.kontak_acisi}</dd>
              </dl>
            </details>
            <footer>
              <span className="st-sessiz">
                {f.gorulme} turda görüldü · {f.kullanim} içerikte kullanıldı · son {relDay(f.son_gorulme)}
              </span>
              <span className="st-ornekler">
                {f.ornekler.slice(0, 4).map((o, i) => {
                  const link = typeof o === 'string' ? o : o.link
                  return (
                    <a key={link} href={link} target="_blank" rel="noreferrer" aria-label={`Örnek ${i + 1}`}>
                      <ExternalLink size={13} /> {i + 1}
                    </a>
                  )
                })}
              </span>
              <span className="st-format-dugmeler">
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
              </span>
            </footer>
          </article>
        ))}
      </div>
    </Bolum>
  )
}
