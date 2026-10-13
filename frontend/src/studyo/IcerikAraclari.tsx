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

  const yenidenUret = async () => {
    setKaydediliyor(true)
    try {
      await studyoApi.reelUret([idea.id])
      toast('Reel yeniden üretiliyor (~5 dk)')
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
            <button className="btn btn-sm" onClick={yenidenUret} disabled={kaydediliyor}>
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
            {idea.format === 'kisa_video' && idea.video_url && (
              <a className="btn btn-sm" href={assetUrl(idea.video_url) ?? undefined} download={dosyaAdi('.mp4')}>
                <Download size={14} /> Temiz MP4
              </a>
            )}
            {idea.format !== 'kisa_video' &&
              yaziliSlaytlar.map((u, i) => (
                <a key={u} className="btn btn-sm btn-primary" href={assetUrl(u) ?? undefined} download={dosyaAdi(`-${i + 1}.png`)}>
                  <Download size={14} /> {i + 1}
                </a>
              ))}
            {idea.format !== 'kisa_video' && yaziliSlaytlar.length === 0 && temizSlaytlar.length > 0 && (
              <span className="st-sessiz">Yazılı slaytlar yok; Stüdyo → Üretim → "Eksik yazıları göm".</span>
            )}
            {idea.format !== 'kisa_video' &&
              temizSlaytlar.map((u, i) => (
                <a key={u} className="btn btn-sm" href={assetUrl(u) ?? undefined} download={dosyaAdi(`-${i + 1}-temiz.jpg`)} title="Yazısız">
                  <Download size={14} /> {i + 1} temiz
                </a>
              ))}
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
                <p className="st-aciklama">Değiştirirsen yazılı dosya yeniden hazırlanır.</p>
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
