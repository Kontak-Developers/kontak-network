import { useState } from 'react'
import { Ban, CalendarPlus, CheckCheck, Layers, Minus, Pin, Plus, Sparkles, Undo2 } from 'lucide-react'
import type { Decision, WatchItem, WatchStatus } from '../types'
import { useStore } from '../store'
import { fmtTime, relDay, runDuration } from '../lib'
import { PlatformGlyph } from '../components/bits'

const DECISION_ICON: Record<Decision['tur'], typeof Plus> = {
  hashtag_ekle: Plus,
  hashtag_kalici: CheckCheck,
  hashtag_cikar: Minus,
  seri_ac: Layers,
  bolum_planla: CalendarPlus,
  icerik_uret: Sparkles,
}

const GROUPS: { id: WatchStatus; label: string }[] = [
  { id: 'sabit', label: 'Sabit' },
  { id: 'aktif', label: 'Aktif' },
  { id: 'deneme', label: 'Deneme' },
  { id: 'elendi', label: 'Elenen' },
  { id: 'yasak', label: 'Yasak' },
]

export default function Agent() {
  const { brand, watchlist, decisions, runs, setWatch, toast } = useStore()
  const [menu, setMenu] = useState<string | null>(null)
  const budget = brand?.sinirlar?.butce ?? { aktif_hashtag: 8, deneme_hashtag: 3, video_per_run: 1 }
  const count = (d: WatchStatus) => watchlist.filter((w) => w.durum === d).length

  const change = async (w: WatchItem, durum: WatchStatus, msg: string) => {
    setMenu(null)
    await setWatch(w.id, durum)
    toast(msg)
  }

  // kararları güne göre grupla
  const byDay = new Map<string, Decision[]>()
  decisions.forEach((d) => {
    const k = relDay(d.zaman)
    byDay.set(k, [...(byDay.get(k) ?? []), d])
  })

  return (
    <div className="page agent">
      <section className="panel">
        <div className="sec-head">
          <h2>Takip listesi</h2>
          <span className="muted">Ajan kendisi yönetir</span>
        </div>
        <div className="budget">
          <Meter label="Aktif" value={count('aktif') + count('sabit')} max={budget.aktif_hashtag} />
          <Meter label="Deneme" value={count('deneme')} max={budget.deneme_hashtag} />
        </div>
        {GROUPS.map((g) => {
          const items = watchlist.filter((w) => w.durum === g.id)
          if (!items.length) return null
          return (
            <div key={g.id} className="wgroup">
              <h3>{g.label}</h3>
              <div className="wchips">
                {items.map((w) => (
                  <span key={w.id} className="wwrap">
                    <button className={`tag tag-${w.durum} ${menu === w.id ? 'on' : ''}`} onClick={() => setMenu(menu === w.id ? null : w.id)} title={w.neden}>
                      <PlatformGlyph platform={w.platform} size={11} />#{w.etiket}
                      {w.durum !== 'yasak' && <small>{w.skor}</small>}
                      {w.kaynak === 'kesif' && w.durum === 'deneme' && <Sparkles size={11} />}
                    </button>
                    {menu === w.id && (
                      <span className="tag-menu">
                        <span className="tag-why">{w.neden}</span>
                        {w.durum !== 'sabit' && w.durum !== 'yasak' && (
                          <>
                            <button onClick={() => change(w, 'sabit', `#${w.etiket} sabitlendi`)}>
                              <Pin size={14} /> Sabitle
                            </button>
                            <button onClick={() => change(w, 'yasak', `#${w.etiket} yasaklandı`)}>
                              <Ban size={14} /> Yasakla
                            </button>
                          </>
                        )}
                        {(w.durum === 'sabit' || w.durum === 'yasak') && (
                          <button onClick={() => change(w, 'deneme', `#${w.etiket} ajana bırakıldı`)}>
                            <Undo2 size={14} /> Ajana bırak
                          </button>
                        )}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <section className="panel">
        <div className="sec-head">
          <h2>Kararlar</h2>
          <span className="muted">Her kararın gerekçesi</span>
        </div>
        {[...byDay.entries()].map(([day, list]) => (
          <div key={day} className="tl-day">
            <h3>{day}</h3>
            <ol className="timeline">
              {list.map((d) => {
                const Icon = DECISION_ICON[d.tur]
                return (
                  <li key={d.id} className={`tl tl-${d.tur}`}>
                    <span className="tl-icon">
                      <Icon size={14} />
                    </span>
                    <span className="tl-body">
                      <b>{d.hedef}</b>
                      <span>{d.neden}</span>
                    </span>
                    <time>{fmtTime(d.zaman)}</time>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </section>

      <section className="panel panel-wide">
        <div className="sec-head">
          <h2>Çalıştırmalar</h2>
          <span className="muted">Her gün 08:00</span>
        </div>
        <div className="runs">
          {runs.slice(0, 8).map((r) => (
            <div key={r.id} className={`run run-${r.durum}`} title={r.ozet}>
              <span className="run-dot" />
              <b>
                {relDay(r.baslangic)} {fmtTime(r.baslangic)}
              </b>
              <span>{r.tetik === 'cron' ? 'Otomatik' : 'Elle'}</span>
              <span>{r.taranan_gonderi.toLocaleString('tr-TR')} gönderi</span>
              <span>{r.durum === 'calisiyor' ? 'çalışıyor' : r.durum === 'hata' ? 'hata' : runDuration(r)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="meter">
      <span className="meter-label">
        {label}
        <b>
          {value}/{max}
        </b>
      </span>
      <span className="meter-cells">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < value ? 'on' : ''} />
        ))}
      </span>
    </div>
  )
}
