import type { AjanAyarlari } from './tipler'
import type { AyarDegistir } from './Studyo'
import { Anahtar, Bolum, ListeAlani, MetinAlani, SayiAlani } from './parcalar'
import { KARISIMLAR, ODAK_ONERILERI } from './Uretim'

// fal ElevenLabs v3 sesleri (Türkçe okuyabiliyor; tını İngilizce adına göre).
const SESLER: { ad: string; tarif: string }[] = [
  { ad: 'Brian', tarif: 'erkek, derin, sakin anlatıcı' },
  { ad: 'George', tarif: 'erkek, sıcak, olgun' },
  { ad: 'Liam', tarif: 'erkek, genç, enerjik' },
  { ad: 'Chris', tarif: 'erkek, rahat, samimi' },
  { ad: 'Daniel', tarif: 'erkek, net, haber dili' },
  { ad: 'Will', tarif: 'erkek, genç, arkadaşça' },
  { ad: 'Callum', tarif: 'erkek, pürüzlü' },
  { ad: 'Sarah', tarif: 'kadın, yumuşak, güvenilir' },
  { ad: 'Jessica', tarif: 'kadın, genç, canlı' },
  { ad: 'Laura', tarif: 'kadın, esprili, hızlı' },
  { ad: 'Alice', tarif: 'kadın, net, kendinden emin' },
  { ad: 'Matilda', tarif: 'kadın, sıcak, arkadaşça' },
  { ad: 'Lily', tarif: 'kadın, yumuşak, sakin' },
  { ad: 'River', tarif: 'cinsiyetsiz, sakin' },
]

export default function Kreatif({ ayar, varsayilan, degistir }: { ayar: AjanAyarlari; varsayilan: AjanAyarlari; degistir: AyarDegistir }) {
  const k = ayar.kreatif
  const kr = <K extends keyof AjanAyarlari['kreatif']>(x: K, v: AjanAyarlari['kreatif'][K]) => degistir((a) => ({ ...a, kreatif: { ...a.kreatif, [x]: v } }))
  const st = <K extends keyof AjanAyarlari['studyo']>(x: K, v: AjanAyarlari['studyo'][K]) => degistir((a) => ({ ...a, studyo: { ...a.studyo, [x]: v } }))
  const bt = <K extends keyof AjanAyarlari['butce']>(x: K, v: AjanAyarlari['butce'][K]) => degistir((a) => ({ ...a, butce: { ...a.butce, [x]: v } }))

  return (
    <>
      <Bolum
        baslik="Kreatif direktör"
        aciklama="Her turda kazanan formatlardan aday üretir, beş eksende puanlar (durdurma, trend, kimlik, paylaş, üretilebilirlik), en iyileri seçer ve her biri için 5 kanca varyantı yazıp en iyisini kullanır."
      >
        <div className="st-alan">
          <span className="st-etiket">Varsayılan karışım</span>
          <p className="st-aciklama">Sabah otomatik çalıştırmasında kullanılır; stok üretiminde ayrıca seçilir.</p>
          <div className="st-secenekler" role="radiogroup" aria-label="Varsayılan karışım">
            {KARISIMLAR.map((x) => (
              <button key={x} role="radio" aria-checked={k.karisim === x} className={k.karisim === x ? 'on' : ''} onClick={() => kr('karisim', x)}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <ListeAlani
          etiket="Günlük odak döngüsü"
          aciklama="Sabah çalıştırması her gün sıradaki odağı alır. Boş bırakırsan ajan serbest seçer."
          degerler={k.odaklar}
          degistir={(v) => kr('odaklar', v)}
          yerTutucu="ör. Kadın sürücüler"
          oneriler={ODAK_ONERILERI}
        />
        <div className="st-izgara st-izgara-4">
          <SayiAlani etiket="Aday" deger={k.aday} degistir={(n) => kr('aday', n)} min={3} max={12} aciklama="Önce bu kadar fikir" />
          <SayiAlani etiket="Seçilen" deger={k.secim} degistir={(n) => kr('secim', n)} min={1} max={5} aciklama="Üretime giren" />
          <SayiAlani etiket="En az puan" deger={k.min_puan} degistir={(n) => kr('min_puan', n)} min={0} max={50} birim="/50" aciklama="Altındakiler seçilmez" />
          <SayiAlani etiket="Manus süresi" deger={k.sure_dk} degistir={(n) => kr('sure_dk', n)} min={10} max={60} birim="dk" />
        </div>
        <MetinAlani
          etiket="Ek talimat"
          aciklama="Kreatif direktöre her turda eklenir. Örnek: 'Bu hafta yağmur var, yağmur sürüşü mizahına ağırlık ver' ya da 'Kontak'ı hiç anma'."
          deger={k.ek_talimat}
          degistir={(v) => kr('ek_talimat', v)}
          satir={3}
          yerTutucu="Boş bırakabilirsin"
        />
      </Bolum>

      <Bolum baslik="Stüdyo" aciklama="Görüntü: Flux Ultra kare → hero çekim Veo 3.1 Fast (sesli) ya da Kling, diğerleri Kling 2.5 Turbo → ElevenLabs müzik ve Türkçe seslendirme → montaj.">
        <div className="st-izgara st-izgara-2">
          <Anahtar
            etiket="Ekran yazısını göm"
            aciklama="Kanca ve sahne yazıları Sora yazı tipiyle videoya ve carousel kartlarına gömülür. Temiz sürüm de saklanır."
            acik={ayar.studyo.yazi_gom}
            degistir={(v) => st('yazi_gom', v)}
          />
          <Anahtar
            etiket="Hero çekim Veo 3.1 ile"
            aciklama="En çarpıcı çekim sesli ve sinematik olur (~1,2$). Kapalıysa Kling (~0,35$)."
            acik={ayar.studyo.hero_veo}
            degistir={(v) => st('hero_veo', v)}
          />
          <Anahtar etiket="Müzik üret" aciklama="Formatın tarifine göre telifsiz enstrümantal (ElevenLabs)." acik={ayar.studyo.muzik} degistir={(v) => st('muzik', v)} />
          <Anahtar etiket="Seslendirmeye altyazı" aciklama="Anlatımlı reellerde konuşma alttan yazılır." acik={ayar.studyo.altyazi} degistir={(v) => st('altyazi', v)} />
        </div>
        <div className="st-alan">
          <span className="st-etiket">Seslendirme sesi</span>
          <p className="st-aciklama">Yalnız anlatımlı formatlarda; ajan seslendirme gerekip gerekmediğine formata göre karar verir.</p>
          <div className="st-secenekler st-sesler" role="radiogroup" aria-label="Seslendirme sesi">
            {SESLER.map((s) => (
              <button key={s.ad} role="radio" aria-checked={ayar.studyo.ses === s.ad} className={ayar.studyo.ses === s.ad ? 'on' : ''} onClick={() => st('ses', s.ad)}>
                <b>{s.ad}</b>
                <small>{s.tarif}</small>
              </button>
            ))}
          </div>
        </div>
      </Bolum>

      <Bolum baslik="Bütçe" aciklama="Sabah otomatik çalıştırmasının günlük fal tavanı. Tavana yaklaşınca önce Veo yerine Kling'e iner, sonra reeli atlar.">
        <div className="st-izgara st-izgara-4">
          <SayiAlani etiket="Günlük fal tavanı" deger={ayar.butce.fal_gunluk_tavan} degistir={(n) => bt('fal_gunluk_tavan', n)} min={0} max={200} birim="$" />
          <SayiAlani
            etiket="Maliyet katsayısı"
            deger={ayar.butce.maliyet_katsayi}
            degistir={(n) => bt('maliyet_katsayi', n)}
            min={1}
            max={3}
            adim={0.05}
            birim="×"
            aciklama={`Tahmin × katsayı = gerçek. Varsayılan ${varsayilan.butce.maliyet_katsayi}.`}
          />
        </div>
      </Bolum>
    </>
  )
}
