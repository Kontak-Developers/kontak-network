import { useEffect, useState } from 'react'
import { PANEL_URL, agOturumuMu, cikisYap, girisYap, mockLevel, mockedEndpoints, onMockChange } from './api'
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
  const { ready, error, auth, brand, selectedId, select, toasts } = useStore()
  const [tab, setTab] = useState<Tab>(readTab)
  const [mock, setMock] = useState(mockLevel())
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

  if (auth === 'yetkisiz')
    return (
      <div className="gate">
        <span className="gate-mark" />
        <h1>Bu bölüm moderatörlere açık</h1>
        <p>Hesabının Büyüme Ajanı yetkisi yok.</p>
      </div>
    )
  if (auth !== 'tamam') return <Giris />

  if (error && !ready)
    return (
      <div className="gate">
        <span className="gate-mark" />
        <h1>Ajana ulaşılamadı</h1>
        <p>{error}</p>
        <button className="btn btn-primary btn-lg" onClick={() => location.reload()}>
          Tekrar dene
        </button>
      </div>
    )

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
          {agOturumuMu() && (
            <button
              className="btn btn-sm cikis"
              onClick={async () => {
                await cikisYap()
                location.reload()
              }}
            >
              Çıkış yap
            </button>
          )}
          {mock !== 'yok' && (
            <span
              className="mock"
              title={mock === 'tam' ? "Backend'e ulaşılamadı, örnek veri gösteriliyor" : `Örnek veriden gelen uçlar:\n${mockedEndpoints().join('\n')}`}
            >
              {mock === 'tam' ? 'Örnek veri' : 'Kısmen örnek veri'}
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

/** E-posta + şifre girişi (ajan hesapları). Moderatörler Kontak panelinden gelir. */
function Giris() {
  const [eposta, setEposta] = useState('')
  const [sifre, setSifre] = useState('')
  const [goster, setGoster] = useState(false)
  const [bekliyor, setBekliyor] = useState(false)
  const [hataMesaji, setHataMesaji] = useState('')

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault()
    setBekliyor(true)
    setHataMesaji('')
    try {
      await girisYap(eposta, sifre)
      location.reload()
    } catch (err) {
      setHataMesaji(err instanceof Error ? err.message : 'Giriş yapılamadı.')
      setBekliyor(false)
    }
  }

  return (
    <div className="gate">
      <span className="gate-mark" />
      <h1>Büyüme Ajanı</h1>
      <p>Hesabınla giriş yap.</p>
      <form className="giris" onSubmit={gonder}>
        <label className="field" htmlFor="giris-eposta">
          E-posta
          <input
            id="giris-eposta"
            type="email"
            autoComplete="username"
            required
            autoFocus
            value={eposta}
            onChange={(e) => setEposta(e.target.value)}
          />
        </label>
        <label className="field" htmlFor="giris-sifre">
          Şifre
          <span className="giris-sifre">
            <input
              id="giris-sifre"
              type={goster ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
            />
            <button type="button" className="giris-goster" onClick={() => setGoster(!goster)}>
              {goster ? 'Gizle' : 'Göster'}
            </button>
          </span>
        </label>
        {hataMesaji && (
          <p className="giris-hata" role="alert">
            {hataMesaji}
          </p>
        )}
        <button className="btn btn-primary btn-lg" type="submit" disabled={bekliyor}>
          {bekliyor ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
      {PANEL_URL && (
        <a className="giris-panel" href={PANEL_URL}>
          Kontak moderatörüysen yönetim panelinden gir
        </a>
      )}
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
