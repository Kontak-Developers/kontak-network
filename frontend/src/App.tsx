import { useEffect, useState } from 'react'
import { isUsingMock, onMockChange } from './api'
import { StoreProvider, useStore } from './store'
import Sidebar, { BottomNav, NAV } from './components/Sidebar'
import type { Tab } from './components/Sidebar'
import Preview from './components/Preview'
import { Avatar } from './components/Phone'
import Today from './views/Today'
import Content from './views/Content'
import SeriesView from './views/SeriesView'
import Agent from './views/Agent'
import BrandView from './views/BrandView'

const TITLES: Record<Tab, string> = {
  bugun: 'Bugün',
  icerikler: 'İçerikler',
  seriler: 'Seriler',
  ajan: 'Ajan',
  marka: 'Marka',
}

function readTab(): Tab {
  const h = location.hash.slice(1) as Tab
  return NAV.some((n) => n.id === h) ? h : 'bugun'
}

function useIsNarrow() {
  const q = '(max-width: 1023px)'
  const [narrow, setNarrow] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}

function Shell() {
  const { ready, brand, selectedId, select, toasts } = useStore()
  const [tab, setTab] = useState<Tab>(readTab)
  const [mock, setMock] = useState(isUsingMock())
  const narrow = useIsNarrow()

  useEffect(() => {
    const off = onMockChange(setMock)
    const onHash = () => setTab(readTab())
    window.addEventListener('hashchange', onHash)
    return () => {
      off()
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && select(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select])

  const go = (t: Tab) => {
    history.replaceState(null, '', `#${t}`)
    setTab(t)
    window.scrollTo(0, 0)
  }

  if (!ready || !brand)
    return (
      <div className="boot">
        <span className="boot-dot" />
      </div>
    )

  return (
    <div className="shell">
      <Sidebar tab={tab} go={go} />

      <div className="center">
        <header className="topbar">
          <span className="topbar-brand">
            <Avatar brand={brand} size={30} />
          </span>
          <h1>{TITLES[tab]}</h1>
          {mock && (
            <span className="mock" title="Backend'e ulaşılamadı, örnek veri gösteriliyor">
              Örnek veri
            </span>
          )}
        </header>
        <main>
          {tab === 'bugun' && <Today openAgent={() => go('ajan')} />}
          {tab === 'icerikler' && <Content />}
          {tab === 'seriler' && <SeriesView />}
          {tab === 'ajan' && <Agent />}
          {tab === 'marka' && <BrandView />}
        </main>
      </div>

      {!narrow && (
        <aside className="right">
          <Preview />
        </aside>
      )}

      {narrow && selectedId && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Önizleme">
          <Preview onClose={() => select(null)} />
        </div>
      )}

      <BottomNav tab={tab} go={go} />

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
