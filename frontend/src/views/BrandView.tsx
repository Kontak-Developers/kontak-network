import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Brand } from '../types'
import { useStore } from '../store'
import { Avatar } from '../components/Phone'

const splitList = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim().replace(/^#/, ''))
    .filter(Boolean)

const DEFAULT_LIMITS: NonNullable<Brand['sinirlar']> = {
  konu_alani: '',
  yasak_konular: [],
  gorsel_kurallar: [],
  butce: { aktif_hashtag: 8, deneme_hashtag: 3, video_per_run: 1 },
}

export default function BrandView() {
  const { brand, saveBrand, toast } = useStore()
  const [draft, setDraft] = useState<Brand | null>(brand)
  const [saving, setSaving] = useState(false)
  if (!draft) return null

  const limits = draft.sinirlar ?? DEFAULT_LIMITS
  const total = draft.sutunlar.reduce((s, c) => s + (Number(c.oran) || 0), 0)
  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const setLimits = (patch: Partial<typeof limits>) => set('sinirlar', { ...limits, ...patch })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    setSaving(true)
    try {
      await saveBrand({
        ...draft,
        ton_kurallari: draft.ton_kurallari.map((s) => s.trim()).filter(Boolean),
      })
      toast('Kaydedildi. Ajan bir sonraki çalıştırmada bu profili kullanacak')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="page brand" onSubmit={save}>
      <section className="brand-card">
        <Avatar brand={draft} size={72} />
        <div className="brand-id">
          <input className="brand-name" value={draft.ad} onChange={(e) => set('ad', e.target.value)} aria-label="Marka adı" />
          <span className="brand-handle">
            @<input value={draft.kullanici_adi} onChange={(e) => set('kullanici_adi', e.target.value)} aria-label="Kullanıcı adı" />
          </span>
        </div>
        <label className="swatch" title="Vurgu rengi">
          <input type="color" value={draft.vurgu_rengi} onChange={(e) => set('vurgu_rengi', e.target.value)} />
          <span style={{ background: draft.vurgu_rengi }} />
          {draft.vurgu_rengi.toUpperCase()}
        </label>
      </section>

      <div className="brand-cols">
        <section className="panel">
          <h2>Kimlik</h2>
          <label className="field">
            Kısa tanım
            <textarea rows={2} value={draft.tanim} onChange={(e) => set('tanim', e.target.value)} />
          </label>
          <label className="field">
            Hedef kitle
            <textarea rows={2} value={draft.hedef_kitle} onChange={(e) => set('hedef_kitle', e.target.value)} />
          </label>
          <label className="field">
            Ton kuralları <small>her satır bir kural</small>
            <textarea rows={5} value={draft.ton_kurallari.join('\n')} onChange={(e) => set('ton_kurallari', e.target.value.split('\n'))} />
          </label>
        </section>

        <section className="panel">
          <div className="sec-head">
            <h2>İçerik sütunları</h2>
            <span className={total === 100 ? 'muted' : 'warn'}>%{total}</span>
          </div>
          <div className="pillar-bar-all">
            {draft.sutunlar.map((s, i) => (
              <span key={i} style={{ flex: Math.max(1, s.oran) }} title={`${s.ad} %${s.oran}`}>
                {s.oran >= 15 && s.ad}
              </span>
            ))}
          </div>
          {draft.sutunlar.map((s, i) => (
            <div key={i} className="pillar">
              <input
                aria-label="Sütun adı"
                value={s.ad}
                onChange={(e) => set('sutunlar', draft.sutunlar.map((x, j) => (j === i ? { ...x, ad: e.target.value } : x)))}
              />
              <input
                aria-label="Oran"
                type="number"
                min={0}
                max={100}
                value={s.oran}
                onChange={(e) => set('sutunlar', draft.sutunlar.map((x, j) => (j === i ? { ...x, oran: Number(e.target.value) } : x)))}
              />
              <button type="button" className="icon-btn" aria-label={`${s.ad} sil`} onClick={() => set('sutunlar', draft.sutunlar.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => set('sutunlar', [...draft.sutunlar, { ad: 'Yeni sütun', oran: 0 }])}>
            <Plus size={15} /> Sütun ekle
          </button>
        </section>

        <section className="panel">
          <h2>Ajanın sınırları</h2>
          <p className="muted">Ajan hangi etiketleri izleyeceğine kendisi karar verir. Sınırları sen çizersin.</p>
          <label className="field">
            Konu alanı
            <input value={limits.konu_alani} onChange={(e) => setLimits({ konu_alani: e.target.value })} />
          </label>
          <label className="field">
            Yasak konular <small>virgülle</small>
            <input defaultValue={limits.yasak_konular.join(', ')} onBlur={(e) => setLimits({ yasak_konular: splitList(e.target.value) })} />
          </label>
          <label className="field">
            Görsel kuralları <small>her satır bir kural</small>
            <textarea rows={6} value={limits.gorsel_kurallar.join('\n')} onChange={(e) => setLimits({ gorsel_kurallar: e.target.value.split('\n') })} />
          </label>
          <div className="budget-fields">
            {(
              [
                ['aktif_hashtag', 'Aktif etiket'],
                ['deneme_hashtag', 'Deneme etiket'],
                ['video_per_run', 'Video / gün'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="field">
                {label}
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={limits.butce[k]}
                  onChange={(e) => setLimits({ butce: { ...limits.butce, [k]: Number(e.target.value) } })}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Başlangıç noktası</h2>
          <p className="muted">İlk çalıştırmada buradan başlar, sonra listeyi kendisi büyütür.</p>
          <label className="field">
            TikTok etiketleri
            <textarea
              rows={2}
              defaultValue={draft.izlenecek.tiktok_hashtagler.join(', ')}
              onBlur={(e) => set('izlenecek', { ...draft.izlenecek, tiktok_hashtagler: splitList(e.target.value) })}
            />
          </label>
          <label className="field">
            Instagram etiketleri
            <textarea
              rows={2}
              defaultValue={draft.izlenecek.instagram_hashtagler.join(', ')}
              onBlur={(e) => set('izlenecek', { ...draft.izlenecek, instagram_hashtagler: splitList(e.target.value) })}
            />
          </label>
          <label className="field">
            Hesaplar
            <textarea
              rows={2}
              placeholder="herkese_acik_hesap, baska_hesap"
              defaultValue={draft.izlenecek.hesaplar.join(', ')}
              onBlur={(e) => set('izlenecek', { ...draft.izlenecek, hesaplar: splitList(e.target.value) })}
            />
          </label>
        </section>
      </div>

      <div className="savebar">
        <button className="btn btn-primary btn-lg" disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
