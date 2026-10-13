import { useEffect, useState } from 'react'
import { Check, Clock, ExternalLink, MapPin, Undo2, X } from 'lucide-react'
import { useStore } from '../store'
import { assetUrl } from '../api'
import { studyoApi } from './api'
import type { RotaKarti } from './tipler'
import { Bolum } from './parcalar'

const FILTRE = [
  { id: 'taslak', label: 'Onay bekleyen' },
  { id: 'onaylandi', label: 'Onaylanan' },
  { id: 'reddedildi', label: 'Reddedilen' },
] as const

export default function Rotalar() {
  const { toast } = useStore()
  const [liste, setListe] = useState<RotaKarti[] | null>(null)
  const [filtre, setFiltre] = useState<(typeof FILTRE)[number]['id']>('taslak')
  useEffect(() => {
    studyoApi.rotalar().then(setListe, (e) => toast(e instanceof Error ? e.message : 'Rotalar yüklenemedi'))
  }, [toast])

  const [gonderilen, setGonderilen] = useState<string | null>(null)
  const karar = async (r: RotaKarti, durum: 'taslak' | 'onaylandi' | 'reddedildi') => {
    if (durum === 'onaylandi') setGonderilen(r.id)
    try {
      const y = await studyoApi.rotaKarari(r.id, durum)
      setListe((l) => l?.map((x) => (x.id === r.id ? { ...x, durum: y.durum } : x)) ?? l)
      toast(
        y.durum === 'uygulamaya_gonderildi'
          ? `${r.ad} uygulamaya gönderildi${y.km ? ` (${y.km} km)` : ''}; moderatör onaylayınca görünür`
          : durum === 'reddedildi'
            ? `${r.ad} reddedildi`
            : `${r.ad} onaya geri alındı`
      )
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kaydedilemedi')
    } finally {
      setGonderilen(null)
    }
  }

  const gorunen = liste?.filter((r) => (filtre === 'onaylandi' ? r.durum === 'onaylandi' || r.durum === 'uygulamaya_gonderildi' : r.durum === filtre))

  return (
    <Bolum
      baslik="Rota kartları"
      aciklama="Onaylanan rota uygulamanın onay kuyruğuna gider; yönetim panelinde moderatör onaylayınca Rotalar'da görünür."
      sag={
        <div className="st-secenekler" role="tablist" aria-label="Rota durumu">
          {FILTRE.map((f) => (
            <button key={f.id} role="tab" aria-selected={filtre === f.id} className={filtre === f.id ? 'on' : ''} onClick={() => setFiltre(f.id)}>
              {f.label} {liste && <small>{liste.filter((r) => (f.id === 'onaylandi' ? r.durum === 'onaylandi' || r.durum === 'uygulamaya_gonderildi' : r.durum === f.id)).length}</small>}
            </button>
          ))}
        </div>
      }
    >
      {!liste && <div className="st-yukleniyor kucuk" aria-busy="true" />}
      {gorunen?.length === 0 && <p className="st-sessiz">Bu durumda rota kartı yok.</p>}
      <div className="st-rotalar">
        {gorunen?.map((r) => (
          <article key={r.id} className="st-rota">
            {r.gorsel_url ? <img src={assetUrl(r.gorsel_url) ?? undefined} alt="" loading="lazy" /> : <span className="st-rota-bos" />}
            <div className="st-rota-govde">
              <span className="st-rota-il">
                <MapPin size={13} /> {r.il}
                {r.zorluk && <span className={`st-zorluk st-zorluk-${r.zorluk}`}>{r.zorluk}</span>}
              </span>
              <h3>{r.ad}</h3>
              <p className="st-rota-ozet">
                {r.km != null && <b>{Math.round(r.km)} km</b>}
                {r.sure_dk != null && (
                  <span>
                    <Clock size={13} /> {Math.floor(r.sure_dk / 60)} sa {r.sure_dk % 60 ? `${r.sure_dk % 60} dk` : ''}
                  </span>
                )}
                {r.yol_tipi && <span>{r.yol_tipi}</span>}
              </p>
              <p>{r.neden_git}</p>
              {r.duraklar.length > 0 && (
                <ol className="st-duraklar">
                  <li>{r.baslangic}</li>
                  {r.duraklar.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                  <li>{r.bitis}</li>
                </ol>
              )}
              {r.en_iyi_zaman && (
                <p className="st-sessiz">
                  <b>En iyi zaman:</b> {r.en_iyi_zaman}
                </p>
              )}
              {r.kaynaklar.length > 0 && (
                <p className="st-kaynaklar">
                  {r.kaynaklar.map((k, i) => (
                    <a key={k} href={k} target="_blank" rel="noreferrer">
                      <ExternalLink size={12} /> Kaynak {i + 1}
                    </a>
                  ))}
                </p>
              )}
              <div className="st-rota-dugmeler">
                {r.durum === 'taslak' ? (
                  <>
                    <button className="btn btn-sm" onClick={() => karar(r, 'reddedildi')}>
                      <X size={14} /> Reddet
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => karar(r, 'onaylandi')} disabled={gonderilen === r.id}>
                      <Check size={14} /> {gonderilen === r.id ? 'Gönderiliyor…' : 'Onayla, uygulamaya gönder'}
                    </button>
                  </>
                ) : r.durum === 'uygulamaya_gonderildi' ? (
                  <span className="ro-gonderildi">
                    <Check size={14} /> Uygulamada · moderatör onayı bekliyor
                  </span>
                ) : (
                  <button className="btn btn-sm" onClick={() => karar(r, 'taslak')}>
                    <Undo2 size={14} /> Onaya geri al
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </Bolum>
  )
}
