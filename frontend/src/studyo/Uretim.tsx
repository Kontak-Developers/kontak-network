import { useState } from 'react'
import { Coins, Film, Images, LoaderCircle, Rocket, Type } from 'lucide-react'
import { useStore } from '../store'
import { fmtTime, relDay } from '../lib'
import { studyoApi } from './api'
import type { StudyoOzet } from './tipler'
import { Bolum, ListeAlani, SayiAlani, usd } from './parcalar'

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

export default function Uretim({ ozet, yenile }: { ozet: StudyoOzet; yenile: () => Promise<unknown> }) {
  const { toast } = useStore()
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

  const baslat = async () => {
    setBasliyor(true)
    try {
      const r = await studyoApi.stok({ tur, karisim, odaklar, tavan })
      toast(`Stok üretimi başladı (${r.id}); ilk içerikler ~15 dk sonra`)
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
      toast('Yazı gömme başladı: yazısız reel ve carousel’ler sırayla işleniyor')
      await yenile()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Başlatılamadı')
    } finally {
      setYaziBasliyor(false)
    }
  }

  return (
    <>
      <Bolum baslik="Günlük akış" aciklama="Ajan her sabah 08:00'de trend olmuş videoları avlar, formatları söker ve içerik üretir. Senin işin seçmek, düzeltmek, paylaşmak.">
        <ol className="st-rehber">
          <li>
            <b>İçerikler'e bak</b>
            Turuncu noktalılar yeni. Karta tıkla, sağda telefonda nasıl görüneceğini gör.
          </li>
          <li>
            <b>Kancayı seç</b>
            Altta 5 kanca varyantı var. Daha iyisini "Kullan"la seç; yazılı video kendiliğinden yenilenir.
          </li>
          <li>
            <b>Metni düzelt</b>
            "Metni düzenle" ile açıklama, etiket ve ekran yazılarını değiştir.
          </li>
          <li>
            <b>İndir ve paylaş</b>
            "Yazılı MP4" ya da yazılı slaytları indir, açıklamayı kopyala, paylaş; panelde paylaşıldı olarak işaretle.
          </li>
          <li>
            <b>Beğenmediğini reddet</b>
            Reddedilenler ajanın "bunu tekrar etme" listesine girer.
          </li>
        </ol>
      </Bolum>

      <Bolum
        baslik="Stok üret"
        aciklama="Tarama ve söküm yapmadan, format kütüphanesindeki trend olmuş kalıplarla art arda içerik turu. Her tur 3 içerik + 1 rota kartı; her tur bir odakla."
      >
        <div className="st-izgara st-izgara-3">
          <SayiAlani etiket="Tur" deger={tur} degistir={(n) => setTur(Math.min(8, Math.max(1, Math.round(n))))} min={1} max={8} aciklama={`${tur * 3} içerik`} />
          <div className="st-alan">
            <span className="st-etiket">Karışım</span>
            <div className="st-secenekler" role="radiogroup" aria-label="Karışım">
              {KARISIMLAR.map((k) => (
                <button key={k} role="radio" aria-checked={karisim === k} className={karisim === k ? 'on' : ''} onClick={() => setKarisim(k)}>
                  {k}
                </button>
              ))}
            </div>
          </div>
          <SayiAlani
            etiket="Bugünkü fal tavanı"
            deger={tavan}
            degistir={setTavan}
            min={1}
            max={200}
            birim="$"
            aciklama={`Bugün harcanan ${usd(bugunFal)}. Tavana gelince Veo yerine Kling'e iner, sonra durur.`}
          />
        </div>
        <ListeAlani
          etiket="Odaklar (tur sırasıyla)"
          aciklama="1. tur ilk odakla, 2. tur ikinciyle… Liste biterse başa döner."
          degerler={odaklar}
          degistir={setOdaklar}
          yerTutucu="ör. Motorcu mizahı: yağmurda sürüş"
          oneriler={ODAK_ONERILERI}
        />
        <div className="st-baslat">
          <span className="st-tahmin">
            <Film size={15} /> {tur * reel} reel <Images size={15} /> {tur * carousel} carousel
            <span className="st-ayrac" />
            <Coins size={15} /> tahmini <b>{usd(tahmin)}</b> fal · ~{Math.round(tur * 18)} dk
          </span>
          <button className="btn btn-primary btn-lg" onClick={baslat} disabled={basliyor || !odaklar.length}>
            <Rocket size={17} /> {basliyor ? 'Başlatılıyor…' : 'Stok üretimini başlat'}
          </button>
        </div>
      </Bolum>

      <div className="st-izgara st-izgara-2">
        <Bolum baslik="Süren işler" aciklama="Stok ve yazı gömme çalıştırmaları; sayfa 20 sn'de bir tazelenir.">
          {ozet.suren.length === 0 ? (
            <p className="st-sessiz">Şu an süren iş yok. Ajan her sabah 08:00'de kendiliğinden tarar ve üretir.</p>
          ) : (
            <ul className="st-isler">
              {ozet.suren.map((s) => (
                <li key={s.id}>
                  <LoaderCircle size={16} className="st-don" />
                  <span>
                    <b>{s.ozet || s.id}</b>
                    <small>
                      {relDay(s.baslangic)} {fmtTime(s.baslangic)} · {s.icerik} içerik yazıldı · {s.hazir} medya hazır
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bolum>

        <Bolum baslik="Harcama" aciklama="Tahmini defter; fal bakiyesini fal.ai panelinden doğrula.">
          <div className="st-metre">
            <span>
              Bugün fal <b>{usd(bugunFal)}</b> / {usd(ozet.harcama.tavan)} varsayılan tavan
            </span>
            <span className="st-metre-cubuk">
              <span style={{ width: `${Math.min(100, (bugunFal / Math.max(1, ozet.harcama.tavan)) * 100)}%` }} />
            </span>
          </div>
          <table className="st-tablo">
            <thead>
              <tr>
                <th>Servis</th>
                <th>Bugün</th>
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {ozet.harcama.toplam.map((h) => (
                <tr key={h.servis}>
                  <td>{h.servis}</td>
                  <td>{usd(ozet.harcama.bugun.find((b) => b.servis === h.servis)?.usd ?? 0)}</td>
                  <td>{usd(h.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Bolum>
      </div>

      <Bolum
        baslik="Ekran yazılarını göm"
        aciklama="Hazır reel ve carousel'lerin yazısız olanlarına ekran yazısını markanın yazı tipiyle (Sora) gömer. Temiz sürüm de kalır; yazıyı TikTok/Instagram'da kendin eklemek istersen onu indir."
        sag={
          <button className="btn" onClick={yaziGom} disabled={yaziBasliyor}>
            <Type size={16} /> {yaziBasliyor ? 'Başlatılıyor…' : 'Eksik yazıları göm'}
          </button>
        }
      >
        <p className="st-sessiz">Yeni üretimde bu kendiliğinden yapılır (Kreatif & stüdyo → "Ekran yazısını göm").</p>
      </Bolum>
    </>
  )
}
