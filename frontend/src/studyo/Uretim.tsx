import { useState } from 'react'
import { Coins, Film, HelpCircle, Images, LoaderCircle, Minus, Plus, Rocket, Type } from 'lucide-react'
import { useStore } from '../store'
import { assetUrl } from '../api'
import { InstagramGlyph, TikTokGlyph } from '../components/bits'
import { fmtTime } from '../lib'
import { studyoApi } from './api'
import type { StudyoOzet } from './tipler'
import { Bolum, ListeAlani, usd } from './parcalar'

export const KARISIMLAR = ['2 reel + 1 carousel', '1 reel + 2 carousel', '3 reel', '3 carousel']

export const ODAK_ONERILERI = [
  'Dating tarafı: motorcu flört, ilk buluşmaya motorla gitmek',
  'Kadın sürücüler: klişe sorulara esprili cevaplar',
  'Yeni başlayanlar: ilk motor, ehliyet, ilk uzun yol',
  'Motorcu mizahı: trafik, yağmur, kask saçı, aile',
  'Motor tipine göre sürücüler: liste ve karşılaştırma',
  'Hafta sonu rota kaçamakları',
  'Bakım ve ekipman ritüelleri: detay, ASMR',
  'Kulüp ve grup sürüşü kültürü: artçı, işaretler, mola',
  'Pazar sabahı / gece sürüşü: sessizlik, boş yol',
]

/** 13 Ekim ölçümü (katsayı dahil): reel ~3$, carousel ~0,55$, rota görseli 0,06$. */
const REEL_USD = 3
const CAROUSEL_USD = 0.55
const ROTA_USD = 0.06

export function karisimSay(k: string) {
  const reel = Number(k.match(/(\d+)\s*reel/i)?.[1] ?? 0)
  const carousel = Number(k.match(/(\d+)\s*carousel/i)?.[1] ?? 0)
  return { reel, carousel }
}

/** Çalıştırma kimliğinden kısa ad (özet alanı bazen uzun analiz metni). */
function isAdi(id: string, ozet: string) {
  if (id.startsWith('stok_')) return ozet.startsWith('Stok') ? ozet.split(' · ').slice(0, 2).join(' · ') : 'Stok üretimi'
  if (id.startsWith('yazi_')) return 'Ekran yazısı gömme'
  if (id.startsWith('reel_')) return 'Reel yeniden üretimi'
  return 'Sabah taraması ve üretim'
}

export default function Uretim({ ozet, yenile }: { ozet: StudyoOzet; yenile: () => Promise<unknown> }) {
  const { toast, ideas, select } = useStore()
  const a = ozet.ayarlar
  const bugunFal = ozet.harcama.bugun.find((h) => h.servis === 'fal')?.usd ?? 0
  const [tur, setTur] = useState(3)
  const [karisim, setKarisim] = useState(a.kreatif.karisim || KARISIMLAR[0])
  const [odaklar, setOdaklar] = useState<string[]>(a.kreatif.odaklar.length ? a.kreatif.odaklar : ODAK_ONERILERI.slice(0, 3))
  const { reel, carousel } = karisimSay(karisim)
  const tahmin = tur * (reel * REEL_USD + carousel * CAROUSEL_USD + ROTA_USD)
  const [tavan, setTavan] = useState(Math.ceil(bugunFal + tahmin + 2))
  const [basliyor, setBasliyor] = useState(false)
  const [yaziBasliyor, setYaziBasliyor] = useState(false)

  const aktif = ideas.filter((i) => i.durum !== 'reddedildi')
  const hazirReel = aktif.filter((i) => i.format === 'kisa_video' && i.video_url).length
  const hazirCarousel = aktif.filter((i) => i.format === 'carousel' && i.gorsel_url).length
  const bekleyen = ideas.filter((i) => i.durum === 'yeni').length
  const sonUretilen = aktif.filter((i) => i.gorsel_url && i.puan != null).slice(0, 10)
  const ac = (id: string) => {
    select(id)
    location.hash = 'icerikler'
  }

  const baslat = async () => {
    setBasliyor(true)
    try {
      await studyoApi.stok({ tur, karisim, odaklar, tavan })
      toast('Stok üretimi başladı; ilk içerikler ~15 dk sonra')
      await yenile()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Stok başlatılamadı')
    } finally {
      setBasliyor(false)
    }
  }

  const yaziGom = async () => {
    setYaziBasliyor(true)
    try {
      await studyoApi.yaziGom()
      toast('Eksik ekran yazıları gömülüyor')
      await yenile()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Başlatılamadı')
    } finally {
      setYaziBasliyor(false)
    }
  }

  return (
    <>
      <div className="st-kpi">
        <div>
          <span>Hazır reel</span>
          <b>{hazirReel}</b>
        </div>
        <div>
          <span>Hazır carousel</span>
          <b>{hazirCarousel}</b>
        </div>
        <div>
          <span>Onay bekleyen</span>
          <b>{bekleyen}</b>
        </div>
        <div>
          <span>Bugün fal</span>
          <b>{usd(bugunFal)}</b>
        </div>
      </div>

      {sonUretilen.length > 0 && (
        <section className="ur-serit" aria-label="Son üretilenler">
          {sonUretilen.map((i) => (
            <button key={i.id} className="ur-kart" onClick={() => ac(i.id)} title={i.baslik}>
              <img src={assetUrl(i.gorsel_url) ?? undefined} alt="" loading="lazy" />
              <span className={`av-mini av-mini-${i.platform}`}>{i.platform === 'instagram' ? <InstagramGlyph size={11} /> : <TikTokGlyph size={11} />}</span>
              <span className="ur-kart-alt">
                {i.format === 'kisa_video' ? <Film size={12} /> : <Images size={12} />}
                {i.baslik}
              </span>
            </button>
          ))}
        </section>
      )}

      <Bolum baslik="Stok üret" aciklama="Trend formatlarla art arda içerik turu. Her tur 3 içerik ve 1 rota kartı.">
        <div className="st-uretim-satir">
          <div className="st-alan">
            <span className="st-etiket">Tur</span>
            <div className="st-adim">
              <button className="icon-btn" aria-label="Azalt" onClick={() => setTur((t) => Math.max(1, t - 1))} disabled={tur <= 1}>
                <Minus size={15} />
              </button>
              <b>{tur}</b>
              <button className="icon-btn" aria-label="Artır" onClick={() => setTur((t) => Math.min(8, t + 1))} disabled={tur >= 8}>
                <Plus size={15} />
              </button>
            </div>
          </div>
          <div className="st-alan st-genis">
            <span className="st-etiket">Karışım</span>
            <div className="st-segment" role="radiogroup" aria-label="Karışım">
              {KARISIMLAR.map((k) => (
                <button key={k} role="radio" aria-checked={karisim === k} className={karisim === k ? 'on' : ''} onClick={() => setKarisim(k)}>
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className="st-alan st-tavan">
            <label className="st-etiket" htmlFor="st-tavan">
              Günlük tavan
            </label>
            <span className="st-sayi-kutu">
              <input id="st-tavan" type="number" min={1} max={200} value={tavan} onChange={(e) => setTavan(Number(e.target.value) || 0)} />
              <span className="st-birim">$</span>
            </span>
          </div>
        </div>
        <ListeAlani etiket="Odaklar" degerler={odaklar} degistir={setOdaklar} yerTutucu="Yeni odak ekle" oneriler={ODAK_ONERILERI} />
        <div className="st-baslat">
          <span className="st-tahmin">
            <span>
              <Film size={15} /> {tur * reel} reel
            </span>
            <span>
              <Images size={15} /> {tur * carousel} carousel
            </span>
            <span>
              <Coins size={15} /> ~{usd(tahmin)}
            </span>
            <span>~{Math.round(tur * 18)} dk</span>
          </span>
          <button className="btn btn-primary btn-lg" onClick={baslat} disabled={basliyor || !odaklar.length}>
            <Rocket size={17} /> {basliyor ? 'Başlatılıyor…' : 'Üretimi başlat'}
          </button>
        </div>
      </Bolum>

      <Bolum
        baslik="Süren işler"
        sag={
          <button className="btn btn-sm" onClick={yaziGom} disabled={yaziBasliyor} title="Yazısı olmayan reel ve carousel'lere ekran yazısını göm">
            <Type size={14} /> Eksik yazıları göm
          </button>
        }
      >
        {ozet.suren.length === 0 ? (
          <p className="st-sessiz">Şu an süren iş yok. Ajan yalnız siz başlatınca çalışır: Bugün → "Şimdi tara" ya da yukarıdan üretim.</p>
        ) : (
          <ul className="st-isler">
            {ozet.suren.map((s) => (
              <li key={s.id}>
                <LoaderCircle size={16} className="st-don" />
                <b>{isAdi(s.id, s.ozet)}</b>
                <span className="st-is-ilerleme">
                  {s.icerik} içerik · {s.hazir} hazır
                </span>
                <time>{fmtTime(s.baslangic)}</time>
              </li>
            ))}
          </ul>
        )}
      </Bolum>

      <details className="panel st-yardim">
        <summary>
          <HelpCircle size={16} /> Nasıl kullanılır
        </summary>
        <ol className="st-rehber">
          <li>
            <b>Seç</b>İçerikler'de yeni gelenlere bak; sağda telefonda nasıl görüneceği.
          </li>
          <li>
            <b>Kancayı değiştir</b>Önizlemenin altındaki varyantlardan daha iyisini "Kullan"la seç.
          </li>
          <li>
            <b>Düzelt</b>"Metni düzenle" ile açıklama, etiket ve ekran yazıları.
          </li>
          <li>
            <b>Paylaş</b>Yazılı dosyayı indir, açıklamayı kopyala, paylaş ve panelde işaretle.
          </li>
          <li>
            <b>Reddet</b>Reddettiklerine ajan bir daha benzemez.
          </li>
        </ol>
      </details>
    </>
  )
}
