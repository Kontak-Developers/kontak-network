import { useEffect, useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { useStore } from '../store'
import { relDay, fmtTime } from '../lib'
import { studyoApi } from './api'
import type { PromptOzet } from './tipler'
import { Bolum } from './parcalar'

const TARIF: Record<string, { ad: string; ne: string }> = {
  sok: { ad: 'Format sökücü', ne: 'Patlayan videoları izleyip tekrar üretilebilir formata çevirir.' },
  kreatif: { ad: 'Kreatif direktör', ne: 'Adayları puanlar, kanca atölyesi, çekim planı, rota kartı.' },
  analiz: { ad: 'Gündem analizi', ne: 'Etiket ivmesi ve takip listesi (eski yol, hâlâ çalışıyor).' },
  uretim: { ad: 'Yedek üretim', ne: 'Format kütüphanesi boşken devreye giren eski üretim.' },
  haftalik: { ad: 'Haftalık özet', ne: 'Pazartesi: haftanın kalıcı, yükselen ve sönen trendleri.' },
}

export default function Promptlar({ ozetler, yenile }: { ozetler: PromptOzet[]; yenile: () => Promise<unknown> }) {
  const { toast } = useStore()
  const [secili, setSecili] = useState('kreatif')
  const [metin, setMetin] = useState<string | null>(null)
  const [kaynak, setKaynak] = useState('')
  const [dosya, setDosya] = useState('')
  const [isliyor, setIsliyor] = useState(false)

  useEffect(() => {
    let aktif = true
    setMetin(null)
    studyoApi.prompt(secili).then(
      (p) => {
        if (!aktif) return
        setMetin(p.gecerli)
        setKaynak(p.gecerli)
        setDosya(p.dosya)
      },
      (e) => toast(e instanceof Error ? e.message : 'Prompt yüklenemedi')
    )
    return () => {
      aktif = false
    }
  }, [secili, toast])

  const ozet = ozetler.find((o) => o.ad === secili)
  const kirli = metin !== null && metin !== kaynak

  const kaydet = async () => {
    if (metin === null) return
    setIsliyor(true)
    try {
      await studyoApi.promptKaydet(secili, metin)
      setKaynak(metin)
      toast('Prompt kaydedildi; bir sonraki çalıştırmada geçerli')
      await yenile()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kaydedilemedi')
    } finally {
      setIsliyor(false)
    }
  }

  const sifirla = async () => {
    setIsliyor(true)
    try {
      await studyoApi.promptSifirla(secili)
      setMetin(dosya)
      setKaynak(dosya)
      toast('Dosyadaki sürüme dönüldü')
      await yenile()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sıfırlanamadı')
    } finally {
      setIsliyor(false)
    }
  }

  return (
    <div className="st-promptlar">
      <nav className="panel st-prompt-liste" aria-label="Promptlar">
        {ozetler.map((o) => (
          <button key={o.ad} className={secili === o.ad ? 'on' : ''} onClick={() => setSecili(o.ad)} disabled={kirli && secili !== o.ad}>
            <b>{TARIF[o.ad]?.ad ?? o.ad}</b>
            <small>{TARIF[o.ad]?.ne}</small>
            <span className={`st-rozet ${o.ozel ? 'ozel' : ''}`}>{o.ozel ? 'Panelden düzenlendi' : 'Dosyadaki sürüm'}</span>
          </button>
        ))}
      </nav>
      <Bolum
        baslik={TARIF[secili]?.ad ?? secili}
        aciklama={
          ozet?.ozel && ozet.guncelleme
            ? `Son düzenleme ${relDay(ozet.guncelleme)} ${fmtTime(ozet.guncelleme)}${ozet.guncelleyen ? ` · ${ozet.guncelleyen}` : ''}`
            : 'Depodaki prompts/ dosyası kullanılıyor.'
        }
        sag={
          <span className="st-prompt-dugmeler">
            {ozet?.ozel && (
              <button className="btn btn-sm" onClick={sifirla} disabled={isliyor}>
                <RotateCcw size={14} /> Dosyaya dön
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={kaydet} disabled={!kirli || isliyor}>
              <Save size={14} /> Kaydet
            </button>
          </span>
        }
      >
        <p className="st-uyari">
          "Çıktı biçimi" bölümündeki alan adlarını değiştirme: kod o adlarla okuyor. Ton, kurallar, örnekler, süreç serbest.
        </p>
        {metin === null ? (
          <div className="st-yukleniyor kucuk" aria-busy="true" />
        ) : (
          <>
            <textarea className="st-prompt-metin" value={metin} onChange={(e) => setMetin(e.target.value)} spellCheck={false} aria-label="Prompt metni" />
            <p className="st-sessiz">{metin.length.toLocaleString('tr-TR')} karakter</p>
          </>
        )}
      </Bolum>
    </div>
  )
}
