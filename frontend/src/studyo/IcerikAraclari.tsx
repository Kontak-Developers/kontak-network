import { useEffect, useState } from 'react'
import { Copy, Download, Pencil, RefreshCw, Sparkles, Type } from 'lucide-react'
import { assetUrl } from '../api'
import { caption, copyText, isTuru, scenesOf, zamanEtiketi } from '../lib'
import { useStore } from '../store'
import type { Idea } from '../types'
import { studyoApi } from './api'
import './studyo.css'

const REEL_DURUM: Record<string, string> = {
  bekliyor: 'Reel sırada bekliyor',
  uretiliyor: 'Reel şu an üretiliyor (~4 dk)',
  atlandi: 'Reel bütçe tavanı yüzünden üretilmedi',
  hata: 'Reel üretiminde hata oldu (çoğu zaman fal bakiyesi)',
}

const TIP: Record<string, string> = {
  itiraf: 'İtiraf',
  pov: 'POV',
  karsitlik: 'Karşıtlık',
  soru: 'Soru',
  liste: 'Liste',
  acik_dongu: 'Açık döngü',
  sayi_saat: 'Sayı/saat',
  gizli_bilgi: 'Gizli bilgi',
}

/**
 * İçerik önizlemesinin altındaki Stüdyo araçları: hazır dosyalar (yazılı ve
 * temiz), kanca varyantları, metin düzenleme. Onaydan bağımsız: stoklarken
 * dosyayı hemen indirebilmek için.
 */
export default function IcerikAraclari({ idea }: { idea: Idea }) {
  const { toast, refreshIdeas } = useStore()
  const sahneler = scenesOf(idea)
  const [duzenle, setDuzenle] = useState(false)
  const [kanca, setKanca] = useState(idea.kanca)
  const [aciklama, setAciklama] = useState(idea.aciklama_metni)
  const [etiketler, setEtiketler] = useState(idea.hashtagler.join(' '))
  const [yazilar, setYazilar] = useState(sahneler.map((s) => s.ekran_yazisi ?? ''))
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [yenilenen, setYenilenen] = useState<number | null>(null)
  const [gomuluyor, setGomuluyor] = useState(false)
  const yaziGom = async () => {
    setGomuluyor(true)
    try {
      await studyoApi.yaziGom([idea.id])
      toast('Yazılı sürüm hazırlanıyor (~2 dk); bitince Dosyalar\'da görünür')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Başlatılamadı')
    } finally {
      setGomuluyor(false)
    }
  }
  const plan = (idea as Idea & { uretim_plani?: { cekimler?: { uygulama_ekrani?: string }[] } | null }).uretim_plani
  const kartYenile = async (i: number) => {
    setYenilenen(i)
    try {
      const r = await studyoApi.kartYenidenUret(idea.id, i)
      await refreshIdeas()
      toast(r.temiz ? `${i + 1}. kart yenilendi` : `${i + 1}. kart yenilendi ama küçük kusur kalmış olabilir: ${r.sorunlar.join(', ')}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kart yenilenemedi')
    } finally {
      setYenilenen(null)
    }
  }

  useEffect(() => {
    setDuzenle(false)
    setKanca(idea.kanca)
    setAciklama(idea.aciklama_metni)
    setEtiketler(idea.hashtagler.join(' '))
    setYazilar(scenesOf(idea).map((s) => s.ekran_yazisi ?? ''))
  }, [idea])

  const v2 = idea.puan != null || (idea.kanca_varyantlari?.length ?? 0) > 0
  const yaziliSlaytlar = sahneler.map((s) => s.yazili_url).filter((u): u is string => !!u)
  const temizSlaytlar = sahneler.map((s) => s.gorsel_url).filter((u): u is string => !!u)
  const dosyaAdi = (ek: string) => `kontak-${idea.baslik.toLocaleLowerCase('tr').replace(/[^a-z0-9ğüşıöç]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}${ek}`

  const kaydet = async (b: Parameters<typeof studyoApi.metinKaydet>[1], mesaj: string) => {
    setKaydediliyor(true)
    try {
      const r = await studyoApi.metinKaydet(idea.id, b)
      if (r.yazi_yeniden_gomulmeli) {
        await studyoApi.yaziGom([idea.id])
        toast(`${mesaj}; yazılı dosya yeniden hazırlanıyor (~2 dk)`)
      } else toast(mesaj)
      await refreshIdeas()
      setDuzenle(false)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kaydedilemedi')
    } finally {
      setKaydediliyor(false)
    }
  }

  const yenidenUret = async (hazirOlan = false) => {
    if (hazirOlan && !window.confirm('Bu reel yeni kurallarla baştan üretilsin mi? (en fazla 12 sn, müziksiz, yazısız; ~2–3$)\nMevcut video yenisi gelene kadar kalır.')) return
    setKaydediliyor(true)
    try {
      await studyoApi.reelUret([idea.id], hazirOlan)
      toast('Reel yeni kurallarla yeniden üretiliyor (~5 dk)')
      await refreshIdeas()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Başlatılamadı')
    } finally {
      setKaydediliyor(false)
    }
  }

  const varyantKullan = (metin: string) => {
    const yeni = [...yazilar]
    if (yeni.length) yeni[0] = metin
    kaydet({ kanca: metin, ekran_yazilari: yeni }, 'Kanca değişti')
  }

  return (
    <div className="st-icerik">
      {idea.olusturma && (
        <p className="st-uretildi">
          Üretildi: <b>{zamanEtiketi(idea.olusturma)}</b> · {isTuru(idea.run_id)}
        </p>
      )}
      {idea.format === 'kisa_video' && idea.reel_durum && idea.reel_durum !== 'hazir' && (
        <div className="st-icerik-not">
          <span>{REEL_DURUM[idea.reel_durum]}</span>
          {(idea.reel_durum === 'atlandi' || idea.reel_durum === 'hata') && (
            <button className="btn btn-sm" onClick={() => yenidenUret()} disabled={kaydediliyor}>
              <RefreshCw size={14} /> Yeniden üret (~3$)
            </button>
          )}
        </div>
      )}

      {(idea.aciklama_metni || idea.hashtagler.length > 0) && (
        <div className="st-icerik-blok">
          <span className="st-icerik-baslik st-aciklama-bas">
            Açıklama
            <button className="btn btn-sm" onClick={async () => (await copyText(caption(idea))) && toast('Açıklama ve etiketler kopyalandı')}>
              <Copy size={13} /> Kopyala
            </button>
          </span>
          <div className="st-aciklama-kutu">
            {idea.aciklama_metni && <p>{idea.aciklama_metni}</p>}
            {idea.hashtagler.length > 0 && <p className="st-etiketler">{idea.hashtagler.join(' ')}</p>}
          </div>
        </div>
      )}

      {(idea.video_url || temizSlaytlar.length > 0) && (
        <div className="st-icerik-blok">
          <span className="st-icerik-baslik">Dosyalar</span>
          <div className="st-dosyalar">
            {idea.format === 'kisa_video' && idea.yazili_video_url && (
              <a className="btn btn-sm btn-primary" href={assetUrl(idea.yazili_video_url) ?? undefined} download={dosyaAdi('-yazili.mp4')}>
                <Download size={14} /> Yazılı MP4
              </a>
            )}
            {idea.format === 'kisa_video' && idea.reel_durum === 'hazir' && (
              <button className="btn btn-sm" onClick={() => yenidenUret(true)} disabled={kaydediliyor} title="En fazla 12 sn, müziksiz, yazısız; eski plan yeni kurallara sokulur">
                <RefreshCw size={14} /> Yeni kurallarla yeniden üret
              </button>
            )}
            {idea.format === 'kisa_video' && idea.video_url && (
              <a className={`btn btn-sm${idea.yazili_video_url ? '' : ' btn-primary'}`} href={assetUrl(idea.video_url) ?? undefined} download={dosyaAdi('.mp4')}>
                <Download size={14} /> Yazısız MP4
              </a>
            )}
            {idea.format !== 'kisa_video' &&
              yaziliSlaytlar.map((u, i) => (
                <a key={u} className="btn btn-sm btn-primary" href={assetUrl(u) ?? undefined} download={dosyaAdi(`-${i + 1}.png`)}>
                  <Download size={14} /> {i + 1}
                </a>
              ))}
            {idea.format !== 'kisa_video' &&
              temizSlaytlar.map((u, i) => (
                <a key={u} className={`btn btn-sm${yaziliSlaytlar.length ? '' : ' btn-primary'}`} href={assetUrl(u) ?? undefined} download={dosyaAdi(`-${i + 1}-temiz.jpg`)} title="Yazısız">
                  <Download size={14} /> {i + 1}{yaziliSlaytlar.length ? ' yazısız' : ''}
                </a>
              ))}
          </div>
        </div>
      )}

      {sahneler.some((s) => s.ekran_yazisi?.trim()) && (
        <div className="st-icerik-blok">
          <span className="st-icerik-baslik st-aciklama-bas">
            <span>
              <Type size={13} /> Ekran yazıları
            </span>
            {!(idea.yazili_video_url || yaziliSlaytlar.length) && (
              <button className="btn btn-sm" onClick={yaziGom} disabled={gomuluyor} title="Bu yazıları Kontak yazı tipiyle dosyaya göm (~0,02$)">
                <Type size={13} /> {gomuluyor ? 'Başlatılıyor…' : 'Yazıyı dosyaya uygula'}
              </button>
            )}
          </span>
          <p className="st-sessiz">Dosyalar yazısız; yazıyı Instagram/TikTok'ta ekle ya da tek tuşla uygula. Değiştirmek için "Metni düzenle".</p>
          <ul className="st-yazilar">
            {sahneler.map((s, i) =>
              s.ekran_yazisi?.trim() ? (
                <li key={i}>
                  <span className="st-varyant-tip">{idea.format === 'carousel' ? `${i + 1}. kart` : i === 0 ? 'Açılış' : i === sahneler.length - 1 ? 'Kapanış' : `${i + 1}. sahne`}</span>
                  <span className="st-varyant-metin">{s.ekran_yazisi}</span>
                  <button className="btn btn-sm" aria-label={`${i + 1}. yazıyı kopyala`} onClick={async () => (await copyText(s.ekran_yazisi!)) && toast('Yazı kopyalandı')}>
                    <Copy size={13} />
                  </button>
                </li>
              ) : null
            )}
          </ul>
        </div>
      )}

      {idea.format === 'carousel' && sahneler.length > 0 && (
        <div className="st-icerik-blok">
          <span className="st-icerik-baslik">Kartlar</span>
          <div className="st-kartlar-serit">
            {sahneler.map((s, i) => {
              const gorsel = s.yazili_url ?? s.gorsel_url
              const urun = !!plan?.cekimler?.[i]?.uygulama_ekrani
              return (
                <div key={i} className="st-kart-kucuk">
                  {gorsel ? <img src={assetUrl(gorsel) ?? undefined} alt={`${i + 1}. kart`} loading="lazy" /> : <span className="st-kart-bos" />}
                  {!urun && (
                    <button
                      className="st-kart-yenile"
                      onClick={() => kartYenile(i)}
                      disabled={yenilenen !== null}
                      title="Bu kartın görselini yeni kurallarla yeniden üret (~0,06–0,18$)"
                    >
                      <RefreshCw size={12} className={yenilenen === i ? 'st-don' : ''} /> {yenilenen === i ? 'Üretiliyor…' : 'Yeniden üret'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {v2 && (
        <div className="st-icerik-blok">
          <span className="st-icerik-baslik">
            Kreatif direktörün notu {idea.puan != null && <b className="st-puan">{idea.puan}/50</b>}
          </span>
          {idea.puan_gerekce && <p className="st-sessiz">{idea.puan_gerekce}</p>}
          {idea.neden_simdi && <p className="st-icerik-metin">{idea.neden_simdi}</p>}
        </div>
      )}

      {(idea.kanca_varyantlari?.length ?? 0) > 0 && (
        <div className="st-icerik-blok">
          <span className="st-icerik-baslik">
            <Sparkles size={13} /> Kanca varyantları
          </span>
          <ul className="st-varyantlar">
            {[...idea.kanca_varyantlari!].sort((a, b) => b.puan - a.puan).map((v) => {
              const secili = v.metin.trim() === idea.kanca.trim()
              return (
                <li key={v.metin} className={secili ? 'on' : ''}>
                  <span className="st-varyant-tip">{TIP[v.tip] ?? v.tip}</span>
                  <span className="st-varyant-metin">{v.metin}</span>
                  <b>{v.puan}</b>
                  {!secili && (
                    <button className="btn btn-sm" onClick={() => varyantKullan(v.metin)} disabled={kaydediliyor}>
                      Kullan
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="st-icerik-blok">
        {!duzenle ? (
          <button className="btn btn-sm" onClick={() => setDuzenle(true)}>
            <Pencil size={14} /> Metni düzenle
          </button>
        ) : (
          <form
            className="st-duzenle"
            onSubmit={(e) => {
              e.preventDefault()
              kaydet(
                { kanca, aciklama_metni: aciklama, hashtagler: etiketler.split(/[\s,]+/).filter(Boolean), ekran_yazilari: yazilar },
                'Metin kaydedildi'
              )
            }}
          >
            <label className="st-alan">
              <span className="st-etiket">Kanca</span>
              <input value={kanca} onChange={(e) => setKanca(e.target.value)} />
            </label>
            <label className="st-alan">
              <span className="st-etiket">Açıklama</span>
              <textarea rows={4} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
            </label>
            <label className="st-alan">
              <span className="st-etiket">Etiketler</span>
              <input value={etiketler} onChange={(e) => setEtiketler(e.target.value)} placeholder="#motorcu #motosiklet" />
            </label>
            {yazilar.length > 0 && (
              <div className="st-alan">
                <span className="st-etiket">
                  <Type size={13} /> Ekran yazıları
                </span>
                <p className="st-aciklama">Yazılı sürümü varsa o da yeni yazıyla yeniden hazırlanır.</p>
                {yazilar.map((y, i) => (
                  <input
                    key={i}
                    value={y}
                    aria-label={`${i + 1}. ${idea.format === 'carousel' ? 'kart' : 'sahne'} yazısı`}
                    placeholder={`${i + 1}. ${idea.format === 'carousel' ? 'kart' : 'sahne'} (boş olabilir)`}
                    onChange={(e) => setYazilar(yazilar.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                ))}
              </div>
            )}
            <div className="st-duzenle-dugmeler">
              <button type="button" className="btn btn-sm" onClick={() => setDuzenle(false)} disabled={kaydediliyor}>
                Vazgeç
              </button>
              <button type="submit" className="btn btn-sm btn-primary" disabled={kaydediliyor}>
                {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
