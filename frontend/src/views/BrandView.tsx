import { useState } from 'react'
import { api } from '../api'
import type { Brand } from '../types'

const splitList = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim().replace(/^#/, ''))
    .filter(Boolean)

export default function BrandView({ brand, onSaved }: { brand: Brand; onSaved: (b: Brand) => void }) {
  const [draft, setDraft] = useState<Brand>(brand)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const total = draft.sutunlar.reduce((s, c) => s + (Number(c.oran) || 0), 0)

  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setSaved(false)
  }
  const setWatch = (k: keyof Brand['izlenecek'], v: string) =>
    set('izlenecek', { ...draft.izlenecek, [k]: splitList(v) })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const b = await api.saveBrand(draft)
      onSaved(b)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="brand-form stack" onSubmit={save}>
      <section className="card">
        <h2>Marka</h2>
        <div className="form-grid">
          <label>
            Ad
            <input value={draft.ad} onChange={(e) => set('ad', e.target.value)} required />
          </label>
          <label>
            Vurgu rengi
            <span className="color-field">
              <input type="color" value={draft.vurgu_rengi} onChange={(e) => set('vurgu_rengi', e.target.value)} />
              <input value={draft.vurgu_rengi} onChange={(e) => set('vurgu_rengi', e.target.value)} />
            </span>
          </label>
          <label className="span-2">
            Kısa tanım
            <textarea rows={2} value={draft.tanim} onChange={(e) => set('tanim', e.target.value)} />
          </label>
          <label className="span-2">
            Hedef kitle
            <textarea rows={2} value={draft.hedef_kitle} onChange={(e) => set('hedef_kitle', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Ton kuralları</h2>
        <p className="muted">Ajan her içeriği bu kurallara göre yazar. Her satır bir kural.</p>
        <textarea
          rows={5}
          value={draft.ton_kurallari.join('\n')}
          onChange={(e) => set('ton_kurallari', e.target.value.split('\n'))}
          onBlur={() => set('ton_kurallari', draft.ton_kurallari.map((s) => s.trim()).filter(Boolean))}
        />
      </section>

      <section className="card">
        <div className="section-head">
          <h2>İçerik sütunları</h2>
          <span className={total === 100 ? 'muted' : 'warn'}>Toplam %{total}</span>
        </div>
        <div className="pillars">
          {draft.sutunlar.map((s, i) => (
            <div key={i} className="pillar">
              <input
                aria-label="Sütun adı"
                value={s.ad}
                onChange={(e) =>
                  set(
                    'sutunlar',
                    draft.sutunlar.map((x, j) => (j === i ? { ...x, ad: e.target.value } : x)),
                  )
                }
              />
              <input
                aria-label="Oran"
                type="number"
                min={0}
                max={100}
                value={s.oran}
                onChange={(e) =>
                  set(
                    'sutunlar',
                    draft.sutunlar.map((x, j) => (j === i ? { ...x, oran: Number(e.target.value) } : x)),
                  )
                }
              />
              <span className="pillar-bar">
                <span style={{ width: `${Math.min(100, s.oran)}%` }} />
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`${s.ad} sütununu sil`}
                onClick={() => set('sutunlar', draft.sutunlar.filter((_, j) => j !== i))}
              >
                Sil
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => set('sutunlar', [...draft.sutunlar, { ad: 'Yeni sütun', oran: 0 }])}
        >
          Sütun ekle
        </button>
      </section>

      <section className="card">
        <h2>Ajanın izlediği kaynaklar</h2>
        <p className="muted">Virgülle ya da satır satır yaz. Sadece herkese açık hashtag ve hesaplar.</p>
        <div className="form-grid">
          <label>
            TikTok hashtag'leri
            <textarea
              rows={3}
              defaultValue={draft.izlenecek.tiktok_hashtagler.join(', ')}
              onBlur={(e) => setWatch('tiktok_hashtagler', e.target.value)}
            />
          </label>
          <label>
            Instagram hashtag'leri
            <textarea
              rows={3}
              defaultValue={draft.izlenecek.instagram_hashtagler.join(', ')}
              onBlur={(e) => setWatch('instagram_hashtagler', e.target.value)}
            />
          </label>
          <label className="span-2">
            Hesaplar
            <textarea
              rows={2}
              defaultValue={draft.izlenecek.hesaplar.join(', ')}
              onBlur={(e) => setWatch('hesaplar', e.target.value)}
              placeholder="herkese_acik_hesap, baska_hesap"
            />
          </label>
        </div>
      </section>

      <div className="save-bar">
        {saved && <span className="muted">Kaydedildi. Ajan bir sonraki çalıştırmada bu profili kullanacak.</span>}
        <button className="btn btn-primary btn-lg" disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
