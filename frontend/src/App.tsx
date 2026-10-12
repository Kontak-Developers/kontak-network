import { useEffect, useState } from 'react'
import { api, isUsingMock, onMockChange } from './api'
import type { Brand } from './types'
import BrandView from './views/BrandView'
import History from './views/History'
import Ideas from './views/Ideas'
import Today from './views/Today'

type Tab = 'bugun' | 'icerikler' | 'gecmis' | 'marka'
const TABS: { id: Tab; label: string }[] = [
  { id: 'bugun', label: 'Bugün' },
  { id: 'icerikler', label: 'İçerikler' },
  { id: 'gecmis', label: 'Geçmiş' },
  { id: 'marka', label: 'Marka profili' },
]

function readTab(): Tab {
  const h = location.hash.slice(1) as Tab
  return TABS.some((t) => t.id === h) ? h : 'bugun'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readTab)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [mock, setMock] = useState(isUsingMock())

  useEffect(() => {
    api.brand().then(setBrand)
    const off = onMockChange(setMock)
    const onHash = () => setTab(readTab())
    window.addEventListener('hashchange', onHash)
    return () => {
      off()
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  useEffect(() => {
    if (brand) document.documentElement.style.setProperty('--accent', brand.vurgu_rengi)
  }, [brand])

  const go = (t: Tab) => {
    location.hash = t
    setTab(t)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-mark">
            <span className="logo" aria-hidden>
              {brand?.ad[0] ?? 'K'}
            </span>
            <span>
              <strong>{brand?.ad ?? 'Kontak'}</strong>
              <small>Sosyal medya ajanı</small>
            </span>
          </div>
          {mock && (
            <span className="mock-badge" title="Backend'e ulaşılamadı, örnek veri gösteriliyor">
              Örnek veri
            </span>
          )}
        </div>
        <nav className="tabs" aria-label="Bölümler">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'tab-on' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {tab === 'bugun' && <Today onOpenIdeas={() => go('icerikler')} />}
        {tab === 'icerikler' && <Ideas />}
        {tab === 'gecmis' && <History />}
        {tab === 'marka' && brand && <BrandView brand={brand} onSaved={setBrand} />}
      </main>
    </div>
  )
}
