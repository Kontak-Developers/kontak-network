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

export default function Kreatif({ ayar, degistir }: { ayar: AjanAyarlari; varsayilan: AjanAyarlari; degistir: AyarDegistir }) {
  const k = ayar.kreatif
  const kr = <K extends keyof AjanAyarlari['kreatif']>(x: K, v: AjanAyarlari['kreatif'][K]) => degistir((a) => ({ ...a, kreatif: { ...a.kreatif, [x]: v } }))
  const st = <K extends keyof AjanAyarlari['studyo']>(x: K, v: AjanAyarlari['studyo'][K]) => degistir((a) => ({ ...a, studyo: { ...a.studyo, [x]: v } }))
  const bt = <K extends keyof AjanAyarlari['butce']>(x: K, v: AjanAyarlari['butce'][K]) => degistir((a) => ({ ...a, butce: { ...a.butce, [x]: v } }))

  return (
    <>
      <Bolum
        baslik="Kreatif direktör"
        aciklama="Aday üretir, puanlar, en iyileri seçer; her birine 5 kanca yazar."
      >
        <div className="st-alan">
          <span className="st-etiket">Varsayılan karışım</span>
          
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
          aciklama="Her taramada sıradaki odak (gün gün döner). Boşsa ajan seçer."
          degerler={k.odaklar}
          degistir={(v) => kr('odaklar', v)}
          yerTutucu="ör. Kadın sürücüler"
          oneriler={ODAK_ONERILERI}
        />
        <div className="st-izgara st-izgara-4">
          <SayiAlani etiket="Aday" deger={k.aday} degistir={(n) => kr('aday', n)} min={3} max={12}  />
          <SayiAlani etiket="Seçilen" deger={k.secim} degistir={(n) => kr('secim', n)} min={1} max={5}  />
          <SayiAlani etiket="En az puan" deger={k.min_puan} degistir={(n) => kr('min_puan', n)} min={0} max={50} birim="/50"  />
          <SayiAlani etiket="Manus süresi" deger={k.sure_dk} degistir={(n) => kr('sure_dk', n)} min={10} max={60} birim="dk" />
        </div>
        <MetinAlani
          etiket="Ek talimat"
          
          deger={k.ek_talimat}
          degistir={(v) => kr('ek_talimat', v)}
          satir={3}
          yerTutucu="ör. Bu hafta yağmur var, yağmur mizahına ağırlık ver"
        />
      </Bolum>

      <Bolum baslik="Stüdyo" aciklama="Flux Ultra → Veo 3.1 / Kling 2.5 → ElevenLabs → montaj">
        <div className="st-izgara st-izgara-2">
          <Anahtar
            etiket="Ekran yazısını göm"
            aciklama="Sora yazı tipiyle; temiz sürüm de kalır."
            acik={ayar.studyo.yazi_gom}
            degistir={(v) => st('yazi_gom', v)}
          />
          <Anahtar
            etiket="Hero çekim Veo 3.1 ile"
            aciklama="Sesli, sinematik (~1,2$). Kapalı: Kling (~0,35$)."
            acik={ayar.studyo.hero_veo}
            degistir={(v) => st('hero_veo', v)}
          />
          <Anahtar etiket="Müzik üret" aciklama="Telifsiz enstrümantal." acik={ayar.studyo.muzik} degistir={(v) => st('muzik', v)} />
          <Anahtar etiket="Seslendirmeye altyazı"  acik={ayar.studyo.altyazi} degistir={(v) => st('altyazi', v)} />
          <Anahtar
            etiket="Ham fotoğraf (raw)"
            aciklama="Parlatılmamış, telefonla çekilmiş gibi gerçek doku. Yapay zekâ hissini en çok azaltan ayar."
            acik={ayar.studyo.ham_foto}
            degistir={(v) => st('ham_foto', v)}
          />
          <Anahtar
            etiket="Video denetimi"
            aciklama="Her klibin ortasından ve sonundan kare alınıp denetlenir; uydurma tabela/arayüz varsa klip yeniden üretilir."
            acik={ayar.studyo.video_denetimi}
            degistir={(v) => st('video_denetimi', v)}
          />
          <Anahtar
            etiket="Görsel kalite denetimi"
            aciklama="Yazı/plaka, yüz, logo, bozuk motor varsa kare yeniden üretilir."
            acik={ayar.studyo.kalite_denetimi}
            degistir={(v) => st('kalite_denetimi', v)}
          />
          <MetinAlani
            etiket="Marka imzası"
            aciklama="Videonun köşesinde ve kartlarda. Boş bırakırsan yok."
            deger={ayar.studyo.imza}
            degistir={(v) => st('imza', v)}
            satir={1}
          />
          <MetinAlani
            etiket="Denetim modeli"
            
            deger={ayar.studyo.denetim_modeli}
            degistir={(v) => st('denetim_modeli', v)}
            satir={1}
          />
        </div>
        <div className="st-alan">
          <span className="st-etiket">Seslendirme sesi</span>
          
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

      <Bolum baslik="Bütçe" aciklama="Tavana yaklaşınca Veo yerine Kling, sonra reel atlanır.">
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
            
          />
        </div>
      </Bolum>
    </>
  )
}
