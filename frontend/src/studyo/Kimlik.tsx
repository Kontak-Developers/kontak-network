import { useEffect, useState } from 'react'
import { ChevronDown, ImagePlus, Pencil, Plus, Trash2, WandSparkles } from 'lucide-react'
import { useStore } from '../store'
import { assetUrl } from '../api'
import { studyoApi } from './api'
import type { AltinPrompt, GorselKimlik, Karakter, PaletRengi, UygulamaEkrani } from './tipler'
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

const TUR_AD: Record<string, string> = {
  hero_sinematik: 'Sinematik hero',
  kask_pov: 'Kask POV',
  detay_asmr: 'Detay / ASMR',
  kafe_sosyal: 'Kafe, tanışma',
  grup_surus: 'Grup sürüşü',
  rota_manzara: 'Rota manzarası',
}

/** Açık renk üstünde koyu yazı. */
const acikMi = (hex: string) => {
  const m = hex.replace('#', '').match(/.{2}/g)
  if (!m) return false
  const [r, g, b] = m.map((x) => parseInt(x, 16))
  return r * 0.299 + g * 0.587 + b * 0.114 > 160
}

export default function Kimlik({ kimlik, kaydedildi }: { kimlik: GorselKimlik | null; kaydedildi: (k: GorselKimlik) => void }) {
  const { toast } = useStore()
  const kaynak = kimlik ?? BOS
  const [k, setK] = useState<GorselKimlik>(kaynak)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [paletDuzenle, setPaletDuzenle] = useState(false)
  useEffect(() => setK(kimlik ?? BOS), [kimlik])
  const kirli = JSON.stringify(k) !== JSON.stringify(kaynak)
  const d = <K extends keyof GorselKimlik>(alan: K, v: GorselKimlik[K]) => setK((x) => ({ ...x, [alan]: v }))

  const kaydet = async () => {
    setKaydediliyor(true)
    try {
      kaydedildi(await studyoApi.kimlikKaydet(k))
      toast('Görsel kimlik kaydedildi')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kaydedilemedi')
    } finally {
      setKaydediliyor(false)
    }
  }

  const palet = (i: number, p: Partial<PaletRengi>) => d('palet', k.palet.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const karakter = (i: number, p: Partial<Karakter>) => setK((x) => ({ ...x, karakterler: x.karakterler.map((c, j) => (j === i ? { ...c, ...p } : c)) }))
  const altin = (i: number, p: Partial<AltinPrompt>) => setK((x) => ({ ...x, altin_promptlar: x.altin_promptlar.map((c, j) => (j === i ? { ...c, ...p } : c)) }))

  return (
    <>
      <section className="panel ki-pano">
        <div className="ki-pano-bas">
          <span>
            <h2>Marka panosu</h2>
            <p>{k.ozet}</p>
          </span>
          <button className="btn btn-sm" onClick={() => setPaletDuzenle((v) => !v)} aria-expanded={paletDuzenle}>
            <Pencil size={14} /> Paleti düzenle
          </button>
        </div>
        <div className="ki-palet">
          {k.palet.map((p) => (
            <div key={p.ad} className="ki-renk" style={{ background: p.hex, color: acikMi(p.hex) ? '#16203a' : '#fff' }} title={p.kullanim}>
              <b>{p.ad}</b>
              <code>{p.hex}</code>
            </div>
          ))}
        </div>
        {paletDuzenle && (
          <div className="st-palet">
            {k.palet.map((p, i) => (
              <div key={i} className="st-renk">
                <label className="st-renk-ornek" style={{ background: p.hex }}>
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(p.hex) ? p.hex : '#888888'} onChange={(e) => palet(i, { hex: e.target.value.toUpperCase() })} aria-label={`${p.ad} rengi`} />
                </label>
                <span className="st-renk-metin">
                  <input value={p.ad} onChange={(e) => palet(i, { ad: e.target.value })} aria-label="Renk adı" />
                  <code>{p.hex}</code>
                  <textarea rows={2} value={p.kullanim} onChange={(e) => palet(i, { kullanim: e.target.value })} aria-label="Kullanım" />
                </span>
                <button className="icon-btn" aria-label={`${p.ad} sil`} onClick={() => d('palet', k.palet.filter((_, j) => j !== i))}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => d('palet', [...k.palet, { ad: 'Yeni renk', hex: '#888888', kullanim: '' }])}>
              <Plus size={14} /> Renk
            </button>
          </div>
        )}
      </section>

      <Bolum
        baslik="Karakterler"
        aciklama="Her içerikte biri, tarifi değişmeden. Vizör hep kapalı."
        sag={
          <button className="btn btn-sm" onClick={() => d('karakterler', [...k.karakterler, { kod: `K${k.karakterler.length + 1}`, ad: 'Yeni karakter', tarif_en: '' }])}>
            <Plus size={14} /> Karakter
          </button>
        }
      >
        <div className="ki-kartlar">
          {k.karakterler.map((c, i) => (
            <GorselKart
              key={i}
              baslik={c.ad}
              rozet={c.kod}
              gorsel={c.gorsel_url}
              kimlik={k}
              uretPrompt={`Three-quarter front view of the rider standing beside the motorcycle on a quiet Istanbul side street at blue hour, full body, 50mm`}
              karakterTarif={c.tarif_en}
              uretildi={(u) => karakter(i, { gorsel_url: u })}
              sil={() => d('karakterler', k.karakterler.filter((_, j) => j !== i))}
            >
              <div className="ki-cift">
                <input value={c.kod} onChange={(e) => karakter(i, { kod: e.target.value })} aria-label="Kod" className="st-kod" />
                <input value={c.ad} onChange={(e) => karakter(i, { ad: e.target.value })} aria-label="Ad" />
              </div>
              <MetinAlani etiket="Tarif" ingilizce deger={c.tarif_en} degistir={(v) => karakter(i, { tarif_en: v })} satir={4} />
            </GorselKart>
          ))}
        </div>
      </Bolum>

      <Bolum
        baslik="Çekim türleri"
        aciklama="Kreatif direktör her kareyi bu örneklerin çizgisinde yazar."
        sag={
          <button className="btn btn-sm" onClick={() => d('altin_promptlar', [...k.altin_promptlar, { tur: 'yeni_tur', ne_zaman: '', prompt_en: '' }])}>
            <Plus size={14} /> Tür
          </button>
        }
      >
        <div className="ki-kartlar">
          {k.altin_promptlar.map((p, i) => (
            <GorselKart
              key={i}
              baslik={TUR_AD[p.tur] ?? p.tur}
              alt={p.ne_zaman}
              gorsel={p.ornek_url}
              kimlik={k}
              uretPrompt={p.prompt_en}
              uretildi={(u) => altin(i, { ornek_url: u })}
              sil={() => d('altin_promptlar', k.altin_promptlar.filter((_, j) => j !== i))}
            >
              <div className="ki-cift">
                <input value={p.tur} onChange={(e) => altin(i, { tur: e.target.value })} aria-label="Tür kodu" />
                <input value={p.ne_zaman} onChange={(e) => altin(i, { ne_zaman: e.target.value })} aria-label="Ne zaman" placeholder="Ne zaman" />
              </div>
              <MetinAlani etiket="Kare" ingilizce deger={p.prompt_en} degistir={(v) => altin(i, { prompt_en: v })} satir={5} />
            </GorselKart>
          ))}
        </div>
      </Bolum>

      <UygulamaEkranlari
        liste={k.uygulama_ekranlari ?? []}
        degisti={(liste) => {
          // Yükleme/silme sunucuda hemen kalıcı; taslak ve kaynak birlikte güncellenir (kirli sayılmasın).
          setK((x) => ({ ...x, uygulama_ekranlari: liste }))
          kaydedildi({ ...kaynak, uygulama_ekranlari: liste })
        }}
      />

      <div className="st-izgara st-izgara-2">
        <Bolum baslik="Mekânlar">
          <ListeAlani etiket="Mekân" degerler={k.mekanlar} degistir={(v) => d('mekanlar', v)} yerTutucu="ör. Şile sahil yolu, sisli sabah" />
        </Bolum>
        <Bolum baslik="Asla" aciklama="Kreatif direktör okur; kareye yazılmaz.">
          <ListeAlani etiket="Yasak" degerler={k.asla} degistir={(v) => d('asla', v)} yerTutucu="ör. Görünen yüz" />
        </Bolum>
      </div>

      <details className="panel st-yardim ki-kurallar">
        <summary>
          <ChevronDown size={16} /> Kurallar: stil eki, ışık, lens, renk
        </summary>
        <div className="st-bolum">
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
        </div>
      </details>

      <KaydetCubugu kirli={kirli} kaydediliyor={kaydediliyor} kaydet={kaydet} vazgec={() => setK(kaynak)} not="Üretilen görseller de kaydedince kalıcı olur." />
    </>
  )
}

/** Görselli kart: üstte örnek kare, altta ad; düzenleme ve "üret" düğmesi. */
function GorselKart({
  baslik,
  rozet,
  alt,
  gorsel,
  kimlik,
  uretPrompt,
  karakterTarif = '',
  uretildi,
  sil,
  children,
}: {
  baslik: string
  rozet?: string
  alt?: string
  gorsel?: string
  kimlik: GorselKimlik
  uretPrompt: string
  karakterTarif?: string
  uretildi: (u: string) => void
  sil: () => void
  children: React.ReactNode
}) {
  const { toast } = useStore()
  const [duzenle, setDuzenle] = useState(false)
  const [uretiliyor, setUretiliyor] = useState(false)
  const uret = async () => {
    setUretiliyor(true)
    try {
      const r = await studyoApi.kimlikDene(uretPrompt, karakterTarif, kimlik)
      uretildi(r.url)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Üretilemedi')
    } finally {
      setUretiliyor(false)
    }
  }
  return (
    <article className="ki-kart">
      <div className="ki-gorsel">
        {gorsel ? <img src={assetUrl(gorsel) ?? undefined} alt={baslik} loading="lazy" /> : <span className="ki-gorsel-bos">Örnek kare yok</span>}
        {uretiliyor && <span className="ki-gorsel-yukleniyor" aria-label="Üretiliyor" />}
        <button className="ki-uret" onClick={uret} disabled={uretiliyor || uretPrompt.trim().length < 20} title="Bu kimlikle bir kare üret (~0,06$)">
          <WandSparkles size={14} /> {gorsel ? 'Yeniden' : 'Üret'}
        </button>
      </div>
      <div className="ki-kart-alt">
        <span>
          {rozet && <span className="ki-rozet">{rozet}</span>}
          <b>{baslik}</b>
          {alt && <small>{alt}</small>}
        </span>
        <span className="ki-kart-dugmeler">
          <button className={`icon-btn ${duzenle ? 'on' : ''}`} aria-label="Düzenle" onClick={() => setDuzenle((v) => !v)}>
            <Pencil size={15} />
          </button>
          <button className="icon-btn" aria-label="Sil" onClick={sil}>
            <Trash2 size={15} />
          </button>
        </span>
      </div>
      {duzenle && <div className="ki-duzenle">{children}</div>}
    </article>
  )
}

/** Ürün yerleştirme kütüphanesi: gerçek uygulama ekranları (yapay zekâ arayüz uydurmasın). */
function UygulamaEkranlari({ liste, degisti }: { liste: UygulamaEkrani[]; degisti: (l: UygulamaEkrani[]) => void }) {
  const { toast } = useStore()
  const [ad, setAd] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const yukle = async (dosya: File | undefined) => {
    if (!dosya) return
    setYukleniyor(true)
    try {
      const e = await studyoApi.ekranYukle(dosya, ad.trim() || dosya.name.replace(/\.[a-z]+$/i, ''), aciklama.trim())
      degisti([...liste, e])
      setAd('')
      setAciklama('')
      toast('Ekran eklendi; ajan ürün yerleştirmede bunu kullanacak')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Yüklenemedi')
    } finally {
      setYukleniyor(false)
    }
  }
  const sil = async (e: UygulamaEkrani) => {
    try {
      await studyoApi.ekranSil(e.id)
      degisti(liste.filter((x) => x.id !== e.id))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Silinemedi')
    }
  }
  return (
    <Bolum
      baslik="Uygulama ekranları"
      aciklama="Ürün yerleştirme için gerçek ekran görüntüleri. Ajan carousel'in son kartında bunları markalı çerçevede gösterir; yapay zekâ arayüz uydurmaz. Gerçek ve güzel verili ekranlar yükle."
    >
      <div className="ki-ekranlar">
        {liste.map((e) => (
          <figure key={e.id} className="ki-ekran">
            <img src={assetUrl(`api/medya/${e.anahtar}`) ?? undefined} alt={e.ad} loading="lazy" />
            <figcaption>
              <b>{e.ad}</b>
              {e.aciklama && <small>{e.aciklama}</small>}
            </figcaption>
            <button className="icon-btn" aria-label={`${e.ad} sil`} onClick={() => sil(e)}>
              <Trash2 size={14} />
            </button>
          </figure>
        ))}
        <div className="ki-ekran-ekle">
          <input value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Ad (ör. Konvoy ekranı)" aria-label="Ekran adı" />
          <input value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Ne gösteriyor (ör. hafta sonu grup sürüşü bulma)" aria-label="Açıklama" />
          <label className={`btn btn-primary btn-sm ${yukleniyor ? 'disabled' : ''}`}>
            <ImagePlus size={14} /> {yukleniyor ? 'Yükleniyor…' : 'Ekran görüntüsü yükle'}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={yukleniyor} onChange={(e) => yukle(e.target.files?.[0])} />
          </label>
        </div>
      </div>
      {liste.length === 0 && <p className="st-sessiz">Henüz ekran yok; ürün kartında lacivert Kontak logolu kart kullanılır.</p>}
    </Bolum>
  )
}
