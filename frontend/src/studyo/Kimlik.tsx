import { useEffect, useState } from 'react'
import { Plus, Trash2, WandSparkles } from 'lucide-react'
import { useStore } from '../store'
import { assetUrl } from '../api'
import { studyoApi } from './api'
import type { AltinPrompt, GorselKimlik, Karakter, PaletRengi } from './tipler'
import { Bolum, KaydetCubugu, ListeAlani, MetinAlani } from './parcalar'

const BOS: GorselKimlik = {
  ozet: '',
  palet: [],
  isik: '',
  lens: '',
  renk_gradi: '',
  karakterler: [],
  mekanlar: [],
  asla: [],
  stil_eki: '',
  altin_promptlar: [],
}

export default function Kimlik({ kimlik, kaydedildi }: { kimlik: GorselKimlik | null; kaydedildi: (k: GorselKimlik) => void }) {
  const { toast } = useStore()
  const kaynak = kimlik ?? BOS
  const [k, setK] = useState<GorselKimlik>(kaynak)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  useEffect(() => setK(kimlik ?? BOS), [kimlik])
  const kirli = JSON.stringify(k) !== JSON.stringify(kaynak)
  const d = <K extends keyof GorselKimlik>(alan: K, v: GorselKimlik[K]) => setK((x) => ({ ...x, [alan]: v }))

  const kaydet = async () => {
    setKaydediliyor(true)
    try {
      const yeni = await studyoApi.kimlikKaydet(k)
      kaydedildi(yeni)
      toast('Görsel kimlik kaydedildi; bundan sonraki her kare buna göre')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kaydedilemedi')
    } finally {
      setKaydediliyor(false)
    }
  }

  const palet = (i: number, p: Partial<PaletRengi>) => d('palet', k.palet.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const karakter = (i: number, p: Partial<Karakter>) => d('karakterler', k.karakterler.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const altin = (i: number, p: Partial<AltinPrompt>) => d('altin_promptlar', k.altin_promptlar.map((x, j) => (j === i ? { ...x, ...p } : x)))

  return (
    <>
      <Bolum
        baslik="Kimliğin özü"
        aciklama="Her karenin uyduğu kurallar."
      >
        <MetinAlani etiket="Özet" deger={k.ozet} degistir={(v) => d('ozet', v)} satir={3} />
        <MetinAlani
          etiket="Stil eki"
          ingilizce
          aciklama="Her kareye eklenir. Olumlu tarif et; 'no plates' gibi olumsuzlar o şeyi kareye sokar."
          deger={k.stil_eki}
          degistir={(v) => d('stil_eki', v)}
          satir={4}
        />
        <div className="st-izgara st-izgara-3">
          <MetinAlani etiket="Işık" deger={k.isik} degistir={(v) => d('isik', v)} satir={4} />
          <MetinAlani etiket="Lens ve açı" deger={k.lens} degistir={(v) => d('lens', v)} satir={4} />
          <MetinAlani etiket="Renk tonu" deger={k.renk_gradi} degistir={(v) => d('renk_gradi', v)} satir={4} />
        </div>
        {k.cekim_kurali !== undefined && <MetinAlani etiket="Çekim kuralı" deger={k.cekim_kurali ?? ''} degistir={(v) => d('cekim_kurali', v)} satir={2} />}
      </Bolum>

      <Bolum
        baslik="Palet"
        
        sag={
          <button className="btn btn-sm" onClick={() => d('palet', [...k.palet, { ad: 'Yeni renk', hex: '#888888', kullanim: '' }])}>
            <Plus size={14} /> Renk
          </button>
        }
      >
        <div className="st-palet">
          {k.palet.map((p, i) => (
            <div key={i} className="st-renk">
              <label className="st-renk-ornek" style={{ background: p.hex }}>
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(p.hex) ? p.hex : '#888888'} onChange={(e) => palet(i, { hex: e.target.value.toUpperCase() })} aria-label={`${p.ad} rengi`} />
              </label>
              <span className="st-renk-metin">
                <input value={p.ad} onChange={(e) => palet(i, { ad: e.target.value })} aria-label="Renk adı" />
                <code>{p.hex}</code>
                <textarea rows={2} value={p.kullanim} onChange={(e) => palet(i, { kullanim: e.target.value })} aria-label="Kullanım" placeholder="Nerede, ne kadar" />
              </span>
              <button className="icon-btn" aria-label={`${p.ad} sil`} onClick={() => d('palet', k.palet.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </Bolum>

      <Bolum
        baslik="Sabit karakterler"
        aciklama="Her içerikte biri, tarifi değişmeden."
        sag={
          <button
            className="btn btn-sm"
            onClick={() => d('karakterler', [...k.karakterler, { kod: `K${k.karakterler.length + 1}`, ad: '', tarif_en: '' }])}
          >
            <Plus size={14} /> Karakter
          </button>
        }
      >
        <div className="st-kartlar">
          {k.karakterler.map((c, i) => (
            <div key={i} className="st-kart">
              <div className="st-kart-bas">
                <input className="st-kod" value={c.kod} onChange={(e) => karakter(i, { kod: e.target.value })} aria-label="Kod" />
                <input value={c.ad} onChange={(e) => karakter(i, { ad: e.target.value })} placeholder="Ad (ör. Zeytin ceketli)" aria-label="Karakter adı" />
                <button className="icon-btn" aria-label="Karakteri sil" onClick={() => d('karakterler', k.karakterler.filter((_, j) => j !== i))}>
                  <Trash2 size={15} />
                </button>
              </div>
              <MetinAlani etiket="Tarif" ingilizce deger={c.tarif_en} degistir={(v) => karakter(i, { tarif_en: v })} satir={4} />
            </div>
          ))}
        </div>
      </Bolum>

      <div className="st-izgara st-izgara-2">
        <Bolum baslik="Mekânlar" >
          <ListeAlani etiket="Mekân" degerler={k.mekanlar} degistir={(v) => d('mekanlar', v)} yerTutucu="ör. Şile sahil yolu, sisli sabah" />
        </Bolum>
        <Bolum baslik="Asla" aciklama="Kreatif direktör okur; kareye yazılmaz.">
          <ListeAlani etiket="Yasak" degerler={k.asla} degistir={(v) => d('asla', v)} yerTutucu="ör. Görünen yüz" />
        </Bolum>
      </div>

      <Bolum
        baslik="Altın promptlar"
        aciklama="Her çekim türünün örnek karesi. 'Dene' tek kare üretir (~0,06$)."
        sag={
          <button className="btn btn-sm" onClick={() => d('altin_promptlar', [...k.altin_promptlar, { tur: 'yeni_tur', ne_zaman: '', prompt_en: '' }])}>
            <Plus size={14} /> Prompt
          </button>
        }
      >
        <div className="st-kartlar">
          {k.altin_promptlar.map((p, i) => (
            <AltinKart
              key={i}
              p={p}
              kimlik={k}
              degistir={(x) => altin(i, x)}
              sil={() => d('altin_promptlar', k.altin_promptlar.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      </Bolum>

      <KaydetCubugu kirli={kirli} kaydediliyor={kaydediliyor} kaydet={kaydet} vazgec={() => setK(kaynak)} />
    </>
  )
}

function AltinKart({ p, kimlik, degistir, sil }: { p: AltinPrompt; kimlik: GorselKimlik; degistir: (x: Partial<AltinPrompt>) => void; sil: () => void }) {
  const { toast } = useStore()
  const [karakter, setKarakter] = useState('')
  const [deneniyor, setDeneniyor] = useState(false)
  const [sonuc, setSonuc] = useState<string | null>(null)
  const dene = async () => {
    setDeneniyor(true)
    try {
      const tarif = kimlik.karakterler.find((c) => c.kod === karakter)?.tarif_en ?? ''
      const r = await studyoApi.kimlikDene(p.prompt_en, tarif, kimlik)
      setSonuc(r.url)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Denenemedi')
    } finally {
      setDeneniyor(false)
    }
  }
  return (
    <div className="st-kart st-altin">
      <div className="st-kart-bas">
        <input className="st-kod st-kod-genis" value={p.tur} onChange={(e) => degistir({ tur: e.target.value })} aria-label="Tür" />
        <input value={p.ne_zaman} onChange={(e) => degistir({ ne_zaman: e.target.value })} placeholder="Ne zaman kullanılır" aria-label="Ne zaman" />
        <button className="icon-btn" aria-label="Promptu sil" onClick={sil}>
          <Trash2 size={15} />
        </button>
      </div>
      <MetinAlani etiket="Kare" ingilizce deger={p.prompt_en} degistir={(v) => degistir({ prompt_en: v })} satir={5} />
      <div className="st-dene">
        <select value={karakter} onChange={(e) => setKarakter(e.target.value)} aria-label="Karakter ekle">
          <option value="">Karakter eklemeden</option>
          {kimlik.karakterler.map((c) => (
            <option key={c.kod} value={c.kod}>
              {c.kod} · {c.ad}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" onClick={dene} disabled={deneniyor || p.prompt_en.trim().length < 20}>
          <WandSparkles size={14} /> {deneniyor ? 'Üretiliyor…' : 'Dene'}
        </button>
      </div>
      {sonuc && (
        <a href={assetUrl(sonuc) ?? undefined} target="_blank" rel="noreferrer" className="st-dene-sonuc">
          <img src={assetUrl(sonuc) ?? undefined} alt={`${p.tur} deneme karesi`} />
        </a>
      )}
    </div>
  )
}
