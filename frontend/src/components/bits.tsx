import { Clapperboard, Flame, Hash, Image, Images, Layers, Music2 } from 'lucide-react'
import type { Idea, Trend } from '../types'

export function InstagramGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Instagram">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TikTokGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-label="TikTok">
      <path d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.3 6.3 0 1 0 5.3 6.2V8.7a7.6 7.6 0 0 0 4.4 1.4V6.8a4.4 4.4 0 0 1-4.4-4.4Z" />
    </svg>
  )
}

export function PlatformGlyph({ platform, size }: { platform: Idea['platform'] | Trend['platform']; size?: number }) {
  if (platform === 'tiktok') return <TikTokGlyph size={size} />
  if (platform === 'instagram') return <InstagramGlyph size={size} />
  return (
    <span className="glyph-pair">
      <TikTokGlyph size={size} />
      <InstagramGlyph size={size} />
    </span>
  )
}

export function FormatIcon({ format, size = 14 }: { format: Idea['format']; size?: number }) {
  if (format === 'kisa_video') return <Clapperboard size={size} />
  if (format === 'carousel') return <Images size={size} />
  return <Image size={size} />
}

export function TrendIcon({ tip, size = 16 }: { tip: Trend['tip']; size?: number }) {
  if (tip === 'format') return <Clapperboard size={size} />
  if (tip === 'ses') return <Music2 size={size} />
  if (tip === 'hashtag') return <Hash size={size} />
  return <Flame size={size} />
}

export function SeriesIcon({ size = 14 }: { size?: number }) {
  return <Layers size={size} />
}

/** Network ürün işareti: markadan bağımsız */
export function NetworkMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <g stroke="var(--yan)" strokeWidth="2.2" strokeLinecap="round">
        <path d="M10 11 16 21 22 11" fill="none" />
      </g>
      <g fill="var(--yan)">
        <circle cx="10" cy="11" r="3" />
        <circle cx="22" cy="11" r="3" />
        <circle cx="16" cy="21" r="3" />
      </g>
    </svg>
  )
}
