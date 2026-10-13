import { useEffect, useState } from 'react'
import { ExternalLink, Flame } from 'lucide-react'
import { relDay } from '../lib'
import { studyoApi } from './api'
import type { AjanAyarlari, Patlayan } from './tipler'
import type { AyarDegistir } from './Studyo'
import { Anahtar, Bolum, ListeAlani, SayiAlani, binlik } from './parcalar'

export default function Avci({ ayar, varsayilan, degistir }: { ayar: AjanAyarlari; varsayilan: AjanAyarlari; degistir: AyarDegistir }) {
  const av = ayar.av
  const a = <K extends keyof AjanAyarlari['av']>(k: K, v: AjanAyarlari['av'][K]) => degistir((x) => ({ ...x, av: { ...x.av, [k]: v } }))
  const s = <K extends keyof AjanAyarlari['sok']>(k: K, v: AjanAyarlari['sok'][K]) => degistir((x) => ({ ...x, sok: { ...x.sok, [k]: v } }))

  return (
    <>
      <Bolum
        baslik="Nereye bakıyor"
        aciklama="Her sabah 08:00'de TikTok'ta taranan kaynaklar."
      >
        <ListeAlani
          etiket="TR etiketleri"
          
          onEk="#"
          degerler={av.tr_etiketler}
          degistir={(v) => a('tr_etiketler', v)}
          yerTutucu="ör. motorcukızlar"
          oneriler={varsayilan.av.tr_etiketler}
        />
        <ListeAlani
          etiket="TR aramaları"
          
          degerler={av.tr_aramalar}
          degistir={(v) => a('tr_aramalar', v)}
          yerTutucu="ör. motor pov"
          oneriler={['motorcu kız', 'motor kursu', 'scooter', 'motor vlog', 'motorcu mizah']}
        />
        <ListeAlani
          etiket="Dünya aramaları"
          
          degerler={av.global_aramalar}
          degistir={(v) => a('global_aramalar', v)}
          yerTutucu="ör. motorcycle date"
          oneriler={['motorcycle date', 'moto girl', 'motorcycle humor', 'motorcycle asmr']}
        />
        <Anahtar
          etiket="TikTok Creative Center Türkiye trendleri"
          aciklama="Son 7 gün; ajan yalnız markaya uygunları kullanır."
          acik={av.creative_center}
          degistir={(v) => a('creative_center', v)}
        />
      </Bolum>

      <Bolum baslik="Neye 'patlamış' der" aciklama="Patlama = izlenme ÷ takipçi. 449 takipçili hesapta 175 bin izlenme = 175×.">
        <div className="st-izgara st-izgara-4">
          <SayiAlani etiket="En az patlama" deger={av.min_patlama} degistir={(n) => a('min_patlama', n)} min={1} max={1000} birim="×" />
          <SayiAlani etiket="Son kaç gün" deger={av.gun} degistir={(n) => a('gun', n)} min={2} max={60} birim="gün" />
          <SayiAlani etiket="TR en az izlenme" deger={av.min_izlenme_tr} degistir={(n) => a('min_izlenme_tr', n)} min={0} max={10_000_000} adim={1000} />
          <SayiAlani etiket="Dünya en az izlenme" deger={av.min_izlenme_global} degistir={(n) => a('min_izlenme_global', n)} min={0} max={50_000_000} adim={1000} />
          <SayiAlani etiket="TR'den seçilen" deger={av.tr_secim} degistir={(n) => a('tr_secim', n)} min={0} max={15}  />
          <SayiAlani etiket="Dünyadan seçilen" deger={av.global_secim} degistir={(n) => a('global_secim', n)} min={0} max={10} />
          <SayiAlani etiket="Hesap başına en fazla" deger={av.hesap_basi} degistir={(n) => a('hesap_basi', n)} min={1} max={5}  />
          <SayiAlani etiket="Etiket başına video" deger={av.etiket_basi_video} degistir={(n) => a('etiket_basi_video', n)} min={5} max={100}  />
        </div>
        <div className="st-izgara st-izgara-4">
          <SayiAlani etiket="Arama başına video" deger={av.arama_basi_video} degistir={(n) => a('arama_basi_video', n)} min={5} max={100} />
        </div>
      </Bolum>

      <Bolum baslik="Söküm" aciklama="Manus seçilen videoları izleyip formata çevirir.">
        <div className="st-izgara st-izgara-4">
          <SayiAlani etiket="İzlenen video" deger={ayar.sok.izlenecek_video} degistir={(n) => s('izlenecek_video', n)} min={1} max={10}  />
          <SayiAlani etiket="Manus süresi" deger={ayar.sok.sure_dk} degistir={(n) => s('sure_dk', n)} min={10} max={60} birim="dk" />
          <SayiAlani
            etiket="Tazelik"
            deger={ayar.sok.taze_saat}
            degistir={(n) => s('taze_saat', n)}
            min={0}
            max={72}
            birim="saat"
            
          />
        </div>
      </Bolum>

      <Patlayanlar />
    </>
  )
}

function Patlayanlar() {
  const [liste, setListe] = useState<Patlayan[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  useEffect(() => {
    studyoApi.patlayanlar().then(setListe, (e) => setHata(e instanceof Error ? e.message : 'Yüklenemedi'))
  }, [])
  return (
    <Bolum baslik="Son bulunan patlayanlar" >
      {hata && <p className="st-sessiz">{hata}</p>}
      {!liste && !hata && <div className="st-yukleniyor kucuk" aria-busy="true" />}
      {liste && (
        <div className="st-tablo-kap">
          <table className="st-tablo">
            <thead>
              <tr>
                <th>Patlama</th>
                <th>Hesap</th>
                <th>İzlenme</th>
                <th>Takipçi</th>
                <th>Kaydetme</th>
                <th>Kaynak</th>
                <th>Açıklama</th>
                <th>Bulundu</th>
                <th aria-label="Link" />
              </tr>
            </thead>
            <tbody>
              {liste.map((p) => (
                <tr key={p.link}>
                  <td>
                    <span className={`st-patlama ${p.patlama >= 50 ? 'cok' : ''}`}>
                      <Flame size={12} /> {Math.round(p.patlama)}×
                    </span>
                  </td>
                  <td>@{p.hesap ?? '—'}</td>
                  <td>{binlik(p.izlenme)}</td>
                  <td>{binlik(p.takipci)}</td>
                  <td>{binlik(p.kaydetme)}</td>
                  <td>{p.kaynak === 'tr_motor' ? 'TR' : 'Dünya'}</td>
                  <td className="st-tablo-uzun" title={p.aciklama ?? ''}>
                    {p.aciklama}
                  </td>
                  <td>{relDay(p.bulunma)}</td>
                  <td>
                    <a href={p.link} target="_blank" rel="noreferrer" aria-label="Videoyu aç">
                      <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Bolum>
  )
}
