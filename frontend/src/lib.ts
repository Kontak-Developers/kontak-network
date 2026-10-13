import type { Idea, IdeaStatus, Run, RunStep, Scene, Trend } from './types'

export const STEPS: RunStep[] = ['tara', 'analiz', 'uret', 'kaydet']
export const STEP_LABEL: Record<RunStep, string> = { tara: 'Tara', analiz: 'Analiz', uret: 'Üret', kaydet: 'Kaydet' }
export const STEP_HINT: Record<RunStep, string> = {
  tara: 'Apify · TikTok + Instagram',
  analiz: 'Manus · gündem',
  uret: 'Manus + fal.ai',
  kaydet: 'Panel',
}

export const STATUS_LABEL: Record<IdeaStatus, string> = {
  yeni: 'Onay bekliyor',
  onaylandi: 'Onaylandı',
  reddedildi: 'Reddedildi',
  paylasildi: 'Paylaşıldı',
}

export const FORMAT_LABEL: Record<Idea['format'], string> = {
  kisa_video: 'Video',
  carousel: 'Carousel',
  gonderi: 'Gönderi',
}

export const TREND_LABEL: Record<Trend['tip'], string> = { konu: 'Konu', ses: 'Ses', format: 'Format', hashtag: 'Etiket' }

const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' })
const fullFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const fmtTime = (iso: string) => timeFmt.format(new Date(iso))
export const fmtDay = (iso: string) => dayFmt.format(new Date(iso))
export const fmtFull = (iso: string) => fullFmt.format(new Date(iso))

export function relDay(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Dün'
  return fmtDay(iso)
}

/** Çalışma kimliğinden tür adı: run_ tarama, stok_ stok üretimi, reel_ yeniden üretim. */
export function isTuru(runId: string) {
  if (runId.startsWith('stok_')) return 'Stok üretimi'
  if (runId.startsWith('reel_')) return 'Reel yeniden üretimi'
  if (runId.startsWith('yazi_')) return 'Yazı gömme'
  return 'Tarama ve üretim'
}

/** "Bugün 18:54" / "Dün 09:12" / "11 Eki 14:03" */
export const zamanEtiketi = (iso: string) => `${relDay(iso)} ${fmtTime(iso)}`

export function runDuration(run: Run) {
  if (!run.bitis) return null
  const sec = Math.round((new Date(run.bitis).getTime() - new Date(run.baslangic).getTime()) / 1000)
  return sec < 60 ? `${sec} sn` : `${Math.floor(sec / 60)} dk`
}

export const caption = (idea: Idea) => `${idea.aciklama_metni}\n\n${idea.hashtagler.join(' ')}`

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** Sahne listesi yoksa tek sahne üret */
export function scenesOf(idea: Idea): Scene[] {
  const base: Scene[] = idea.sahneler?.length
    ? idea.sahneler
    : [{ sira: 1, sure_sn: 4, prompt: idea.gorsel_prompt, ekran_yazisi: idea.kanca }]
  // Tek parça eski video: ilk sahneye bağla
  if (idea.video_url && !base.some((s) => s.video_url)) return base.map((s, i) => (i === 0 ? { ...s, video_url: idea.video_url } : s))
  return base
}

/** Fikrin gerçek video klibi var mı */
export const hasVideo = (idea: Idea) => scenesOf(idea).some((s) => s.video_url)

/** Sahnenin görseli; yoksa fikrin kapağı */
export const sceneImage = (idea: Idea, s: Scene) => s.gorsel_url ?? idea.gorsel_url
