import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Bookmark,
  Camera,
  ChevronLeft,
  Clapperboard,
  Forward,
  Heart,
  Home,
  Inbox,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Plus,
  PlusSquare,
  Search,
  Send,
  User,
  Users,
} from 'lucide-react'
import type { Brand, Idea } from '../types'
import { sceneImage, scenesOf } from '../lib'
import { assetUrl } from '../api'
import DesignCard from './DesignCard'

/* ───────────── Çerçeve ───────────── */

const FRAME_W = 342
const FRAME_H = 716

/** Kapsayıcıya sığacak şekilde ölçeklenen iPhone 17 çerçevesi */
export function PhoneFrame({ children, dark }: { children: ReactNode; dark: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setScale(Math.min(1, width / FRAME_W, height / FRAME_H))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="phone-host" ref={host}>
      <div className="phone-sizer" style={{ width: FRAME_W * scale, height: FRAME_H * scale }}>
        <div className="phone" style={{ transform: `scale(${scale})` }}>
          <span className="phone-btn phone-btn-action" />
          <span className="phone-btn phone-btn-vol1" />
          <span className="phone-btn phone-btn-vol2" />
          <span className="phone-btn phone-btn-power" />
          <span className="phone-btn phone-btn-camera" />
          <div className={`screen ${dark ? 'screen-dark' : 'screen-light'}`}>
            <StatusBar />
            <div className="island" />
            {children}
            <div className="home-indicator" />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBar() {
  return (
    <div className="statusbar">
      <span className="sb-time">9:41</span>
      <span className="sb-icons">
        <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden>
          <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .4C5.2.4 2.7 1.5.8 3.3L2 4.6a8.6 8.6 0 0 1 6-2.4Zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.2-1.3A6.7 6.7 0 0 0 8 4c-1.8 0-3.4.7-4.6 1.8l1.2 1.3c.9-.8 2.1-1.3 3.4-1.3Zm0 3.6c.4 0 .8.1 1.1.4L8 11.6 6.9 9.8c.3-.3.7-.4 1.1-.4Z" />
        </svg>
        <span className="sb-battery">
          <span />
        </span>
      </span>
    </div>
  )
}

/* ───────────── Ortak ───────────── */

export function Avatar({ brand, size = 32, ring }: { brand: Brand; size?: number; ring?: boolean }) {
  const [broken, setBroken] = useState(false)
  const src = assetUrl(brand.logo_url ?? `brands/${brand.id}/logo.png`)
  return (
    <span className={`avatar ${ring ? 'avatar-ring' : ''}`} style={{ width: size, height: size }}>
      {src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : <b style={{ fontSize: size * 0.45 }}>{brand.ad[0]}</b>}
    </span>
  )
}

/**
 * Sahneleri sırayla oynatır. Sahnenin gerçek video klibi varsa klip oynar ve
 * bitince sıradakine geçer; yoksa görseli sure_sn kadar gösterir.
 */
/** ?sahne=3 ile belirli sahneden başla (demo ve test için) */
const ilkSahne = () => Math.max(0, Number(new URLSearchParams(location.search).get('sahne') ?? 1) - 1)

function usePlayback(idea: Idea, brand: Brand) {
  const scenes = scenesOf(idea)
  const [index, setIndex] = useState(() => Math.min(ilkSahne(), scenes.length - 1))
  const [frac, setFrac] = useState(0)
  const cur = scenes[Math.min(index, scenes.length - 1)]
  const isVideo = !!cur.video_url

  const onceki = useRef(idea.id)
  useEffect(() => {
    if (onceki.current === idea.id) return
    onceki.current = idea.id
    setIndex(0)
    setFrac(0)
  }, [idea.id])

  const next = () => {
    setIndex((i) => (i + 1) % scenes.length)
    setFrac(0)
  }

  useEffect(() => {
    if (isVideo) return
    const dur = Math.max(2, cur.sure_sn || 3) * 1000
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const f = (now - t0) / dur
      if (f >= 1) return next()
      setFrac(f)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [index, isVideo, idea.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const following = scenes[(index + 1) % scenes.length]
  const media = (
    <>
      {isVideo ? (
        <video
          key={cur.video_url!}
          className="media-fill"
          src={assetUrl(cur.video_url)!}
          autoPlay
          muted
          playsInline
          loop={scenes.length === 1}
          onTimeUpdate={(e) => setFrac(e.currentTarget.currentTime / (e.currentTarget.duration || 5))}
          onEnded={next}
        />
      ) : cur.tur === 'tasarim' && cur.tasarim ? (
        <div key={`${idea.id}-${index}`} className="media-fill media-design">
          <div className="media-design-box">
            <DesignCard spec={cur.tasarim} brand={brand} />
          </div>
        </div>
      ) : sceneImage(idea, cur) ? (
        <img key={`${idea.id}-${index}`} className="media-fill media-still" src={assetUrl(sceneImage(idea, cur))!} alt="" />
      ) : (
        <div className="media-fill media-empty" />
      )}
      {following !== cur && following.video_url && <video className="preload" src={assetUrl(following.video_url)!} preload="auto" muted />}
    </>
  )
  return { scenes, index, scene: cur, progress: (index + frac) / scenes.length, media }
}

function OverlayText({ text, variant }: { text: string; variant: 'tiktok' | 'reels' }) {
  if (!text) return null
  return (
    <div className={`overlay-text overlay-${variant}`} key={text}>
      <span>{text}</span>
    </div>
  )
}

function Marquee({ text }: { text: string }) {
  const part = `${text}\u00a0\u00a0·\u00a0\u00a0`
  return (
    <span className="marquee">
      <span>
        {part}
        {part}
      </span>
    </span>
  )
}

function Caption({ idea, brand, light }: { idea: Idea; brand: Brand; light?: boolean }) {
  return (
    <p className={`cap ${light ? 'cap-light' : ''}`}>
      {light && <b>{brand.kullanici_adi} </b>}
      {idea.aciklama_metni} <span className="cap-tags">{idea.hashtagler.join(' ')}</span>
    </p>
  )
}

/* ───────────── TikTok ───────────── */

export function TikTokView({ idea, brand }: { idea: Idea; brand: Brand }) {
  const isSlides = idea.format !== 'kisa_video'
  const { scenes, index, scene, progress, media } = usePlayback(idea, brand)

  return (
    <div className={`tt ${scene.tur === 'tasarim' ? 'is-design' : ''}`}>
      {media}
      <div className="shade-top" />
      <div className="shade-bottom" />
      <div className="tt-top">
        <span>Takip</span>
        <span className="tt-top-on">Sana Özel</span>
        <Search size={20} className="tt-search" />
      </div>
      {scene.tur !== 'tasarim' && <OverlayText text={scene.ekran_yazisi} variant="tiktok" />}
      {isSlides && scenes.length > 1 && (
        <div className="tt-dots">
          {scenes.map((s, i) => (
            <span key={s.sira} className={i === index ? 'on' : ''} />
          ))}
        </div>
      )}
      <div className="tt-rail">
        <span className="tt-avatar">
          <Avatar brand={brand} size={44} />
          <span className="tt-follow">
            <Plus size={12} strokeWidth={3} />
          </span>
        </span>
        <span className="tt-act">
          <Heart size={30} fill="#fff" strokeWidth={0} />
          <small>0</small>
        </span>
        <span className="tt-act">
          <MessageCircle size={28} fill="#fff" strokeWidth={0} />
          <small>0</small>
        </span>
        <span className="tt-act">
          <Bookmark size={27} fill="#fff" strokeWidth={0} />
          <small>0</small>
        </span>
        <span className="tt-act">
          <Forward size={28} fill="#fff" strokeWidth={0} />
          <small>Paylaş</small>
        </span>
        <span className="tt-disc">
          <Avatar brand={brand} size={26} />
        </span>
      </div>
      <div className="tt-info">
        <b className="tt-user">{brand.kullanici_adi}</b>
        <Caption idea={idea} brand={brand} />
        <span className="tt-music">
          <Music2 size={13} />
          <Marquee text={idea.onerilen_ses ?? `orijinal ses · ${brand.kullanici_adi}`} />
        </span>
      </div>
      {!isSlides && (
        <div className="tt-progress">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <nav className="tt-nav">
        <span className="on">
          <Home size={22} fill="#fff" />
          Ana Sayfa
        </span>
        <span>
          <Users size={22} />
          Arkadaşlar
        </span>
        <span className="tt-plus">
          <Plus size={18} strokeWidth={3} />
        </span>
        <span>
          <Inbox size={22} />
          Gelen Kutusu
        </span>
        <span>
          <User size={22} />
          Profil
        </span>
      </nav>
    </div>
  )
}

/* ───────────── Instagram Reels ───────────── */

export function ReelsView({ idea, brand }: { idea: Idea; brand: Brand }) {
  const { scene, progress, media } = usePlayback(idea, brand)
  return (
    <div className={`reels ${scene.tur === 'tasarim' ? 'is-design' : ''}`}>
      {media}
      <div className="shade-top" />
      <div className="shade-bottom" />
      <div className="reels-top">
        <b>Reels</b>
        <Camera size={22} />
      </div>
      {scene.tur !== 'tasarim' && <OverlayText text={scene.ekran_yazisi} variant="reels" />}
      <div className="reels-rail">
        <span>
          <Heart size={26} />
          <small>0</small>
        </span>
        <span>
          <MessageCircle size={26} />
          <small>0</small>
        </span>
        <span>
          <Send size={24} />
        </span>
        <span>
          <MoreHorizontal size={22} />
        </span>
        <span className="reels-audio">
          <Avatar brand={brand} size={24} />
        </span>
      </div>
      <div className="reels-info">
        <span className="reels-user">
          <Avatar brand={brand} size={30} />
          <b>{brand.kullanici_adi}</b>
          <span className="reels-follow">Takip et</span>
        </span>
        <Caption idea={idea} brand={brand} />
        <span className="tt-music">
          <Music2 size={12} />
          <Marquee text={idea.onerilen_ses ?? `${brand.kullanici_adi} · Orijinal ses`} />
        </span>
      </div>
      <div className="tt-progress reels-progress">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <IgNav active="reels" dark />
    </div>
  )
}

/* ───────────── Instagram akış gönderisi / carousel ───────────── */

export function FeedView({ idea, brand }: { idea: Idea; brand: Brand }) {
  const scenes = scenesOf(idea)
  const [slide, setSlide] = useState(() => Math.min(ilkSahne(), scenes.length - 1))
  const [auto, setAuto] = useState(!new URLSearchParams(location.search).has('sahne'))
  const startX = useRef<number | null>(null)

  const oncekiKare = useRef(idea.id)
  useEffect(() => {
    if (oncekiKare.current === idea.id) return
    oncekiKare.current = idea.id
    setSlide(0)
    setAuto(true)
  }, [idea.id])
  useEffect(() => {
    if (scenes.length < 2 || !auto) return
    const t = setInterval(() => setSlide((s) => (s + 1) % scenes.length), 3200)
    return () => clearInterval(t)
  }, [scenes.length, idea.id, auto])

  const go = (d: number) => setSlide((s) => Math.min(scenes.length - 1, Math.max(0, s + d)))

  return (
    <div className="feed">
      <div className="feed-top">
        <span className="feed-logo">Instagram</span>
        <span className="feed-top-icons">
          <Heart size={22} />
          <Send size={21} />
        </span>
      </div>
      <div className="feed-post">
        <div className="feed-head">
          <Avatar brand={brand} size={32} ring />
          <b>{brand.kullanici_adi}</b>
          <MoreHorizontal size={18} className="feed-more" />
        </div>
        <div
          className="feed-media"
          onPointerDown={(e) => (startX.current = e.clientX)}
          onPointerUp={(e) => {
            if (startX.current === null) return
            const dx = e.clientX - startX.current
            if (Math.abs(dx) > 30) go(dx < 0 ? 1 : -1)
            else go(1)
            startX.current = null
          }}
        >
          <div className="feed-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
            {scenes.map((s, i) => (
              <div className="feed-slide" key={s.sira}>
                {s.tur === 'tasarim' && s.tasarim ? (
                  <DesignCard spec={s.tasarim} brand={brand} />
                ) : (
                  <>
                {sceneImage(idea, s) && (
                  <img
                    src={assetUrl(sceneImage(idea, s))!}
                    alt=""
                    style={s.gorsel_url ? undefined : { objectPosition: `${30 + ((i * 23) % 50)}% 50%` }}
                  />
                )}
                {s.ekran_yazisi && (
                  <div className={`slide-card ${i === 0 ? 'slide-cover' : ''}`}>
                    <span>{s.ekran_yazisi}</span>
                  </div>
                )}
                  </>
                )}
              </div>
            ))}
          </div>
          {scenes.length > 1 && (
            <span className="feed-count">
              {slide + 1}/{scenes.length}
            </span>
          )}
        </div>
        <div className="feed-actions">
          <Heart size={24} />
          <MessageCircle size={23} />
          <Send size={22} />
          {scenes.length > 1 && (
            <span className="feed-dots">
              {scenes.map((s, i) => (
                <span key={s.sira} className={i === slide ? 'on' : ''} />
              ))}
            </span>
          )}
          <Bookmark size={23} className="feed-save" />
        </div>
        <div className="feed-text">
          <Caption idea={idea} brand={brand} light />
          <span className="feed-time">Şimdi</span>
        </div>
      </div>
      <IgNav active="home" />
    </div>
  )
}

/* ───────────── Instagram profil ızgarası ───────────── */

export function ProfileView({ brand, ideas, onPick }: { brand: Brand; ideas: Idea[]; onPick: (id: string) => void }) {
  return (
    <div className="profile">
      <div className="feed-top profile-top">
        <ChevronLeft size={24} />
        <b>{brand.kullanici_adi}</b>
        <MoreHorizontal size={20} />
      </div>
      <div className="profile-head">
        <Avatar brand={brand} size={76} ring />
        <div className="profile-stats">
          <span>
            <b>{ideas.length}</b>gönderi
          </span>
          <span>
            <b>—</b>takipçi
          </span>
          <span>
            <b>—</b>takip
          </span>
        </div>
      </div>
      <div className="profile-bio">
        <b>{brand.ad}</b>
        <p>{brand.tanim}</p>
      </div>
      <div className="profile-buttons">
        <span>Takip et</span>
        <span>Mesaj</span>
      </div>
      <div className="profile-tabs">
        <span className="on">
          <PlusSquare size={18} />
        </span>
        <span>
          <Clapperboard size={18} />
        </span>
      </div>
      <div className="profile-grid">
        {ideas.map((i) => (
          <button key={i.id} onClick={() => onPick(i.id)} aria-label={i.baslik}>
            {i.gorsel_url ? (
              <img src={assetUrl(i.gorsel_url)!} alt="" />
            ) : (
              scenesOf(i).find((x) => x.tasarim)?.tasarim && <DesignCard spec={scenesOf(i).find((x) => x.tasarim)!.tasarim!} brand={brand} />
            )}
            {i.format === 'kisa_video' && <Clapperboard size={14} className="grid-badge" />}
          </button>
        ))}
      </div>
      <IgNav active="profile" />
    </div>
  )
}

function IgNav({ active, dark }: { active: 'home' | 'reels' | 'profile'; dark?: boolean }) {
  return (
    <nav className={`ig-nav ${dark ? 'ig-nav-dark' : ''}`}>
      <Home size={23} strokeWidth={active === 'home' ? 2.6 : 1.8} />
      <Search size={23} strokeWidth={1.8} />
      <PlusSquare size={23} strokeWidth={1.8} />
      <Clapperboard size={23} strokeWidth={active === 'reels' ? 2.6 : 1.8} />
      <span className={`ig-nav-me ${active === 'profile' ? 'on' : ''}`} />
    </nav>
  )
}
