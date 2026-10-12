import { useState } from 'react'
import { Bot, Check, ChevronsUpDown, LayoutGrid, Layers, Palette, Plus, Sun } from 'lucide-react'
import { useStore } from '../store'
import { fmtTime } from '../lib'
import { Avatar } from './Phone'
import { NetworkMark } from './bits'

export type Tab = 'bugun' | 'icerikler' | 'seriler' | 'ajan' | 'marka'

export const NAV: { id: Tab; label: string; icon: typeof Sun }[] = [
  { id: 'bugun', label: 'Bugün', icon: Sun },
  { id: 'icerikler', label: 'İçerikler', icon: LayoutGrid },
  { id: 'seriler', label: 'Seriler', icon: Layers },
  { id: 'ajan', label: 'Ajan', icon: Bot },
  { id: 'marka', label: 'Marka', icon: Palette },
]

export default function Sidebar({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  const { brand, ideas, latest } = useStore()
  const [open, setOpen] = useState(false)
  const pending = ideas.filter((i) => i.durum === 'yeni').length
  const running = latest?.durum === 'calisiyor'

  return (
    <aside className="side">
      <div className="side-product">
        <NetworkMark />
        <span>
          network
          <small>Sosyal medya ajanı</small>
        </span>
      </div>

      {brand && (
        <div className="ws">
          <button className="ws-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <Avatar brand={brand} size={34} />
            <span className="ws-name">
              <b>{brand.ad}</b>
              <small>@{brand.kullanici_adi}</small>
            </span>
            <ChevronsUpDown size={16} />
          </button>
          {open && (
            <div className="ws-menu">
              <button className="ws-item" onClick={() => setOpen(false)}>
                <Avatar brand={brand} size={24} />
                {brand.ad}
                <Check size={15} className="ws-check" />
              </button>
              <button className="ws-item" disabled>
                <span className="ws-plus">
                  <Plus size={14} />
                </span>
                Marka ekle
                <small>yakında</small>
              </button>
            </div>
          )}
        </div>
      )}

      <nav className="side-nav">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`side-item ${tab === id ? 'on' : ''}`} onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon size={19} />
            <span>{label}</span>
            {id === 'icerikler' && pending > 0 && <span className="side-badge">{pending}</span>}
          </button>
        ))}
      </nav>

      <div className={`side-agent ${running ? 'running' : ''}`}>
        <span className="pulse" />
        <span>
          <b>{running ? 'Ajan çalışıyor' : 'Ajan aktif'}</b>
          <small>{running ? 'Gündem taranıyor…' : `Sonraki: yarın 08:00${latest?.bitis ? ` · son ${fmtTime(latest.bitis)}` : ''}`}</small>
        </span>
      </div>
    </aside>
  )
}

export function BottomNav({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  const { ideas } = useStore()
  const pending = ideas.filter((i) => i.durum === 'yeni').length
  return (
    <nav className="bnav">
      {NAV.map(({ id, label, icon: Icon }) => (
        <button key={id} className={tab === id ? 'on' : ''} onClick={() => go(id)}>
          <span className="bnav-icon">
            <Icon size={21} />
            {id === 'icerikler' && pending > 0 && <span className="side-badge">{pending}</span>}
          </span>
          {label}
        </button>
      ))}
    </nav>
  )
}
