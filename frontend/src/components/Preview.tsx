import { useEffect, useState } from 'react'
import { Check, ChevronDown, Copy, Info, MapPin, Music2, Send, Undo2, X } from 'lucide-react'
import { useStore } from '../store'
import { STATUS_LABEL, caption, copyText, hasVideo, scenesOf } from '../lib'
import { FeedView, PhoneFrame, ProfileView, ReelsView, TikTokView } from './Phone'

type Platform = 'instagram' | 'tiktok'

export default function Preview({ onClose }: { onClose?: () => void }) {
  const { brand, ideas, series, selectedId, select, setIdeaStatus, toast } = useStore()
  const idea = ideas.find((i) => i.id === selectedId) ?? null
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [details, setDetails] = useState(false)

  useEffect(() => {
    if (idea) setPlatform(idea.platform)
    setDetails(false)
  }, [idea?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!brand) return null

  const profileIdeas = ideas.filter((i) => i.durum === 'paylasildi' || i.durum === 'onaylandi')
  const dark = !!idea && (platform === 'tiktok' || idea.format === 'kisa_video')
  const ser = idea?.series_id ? series.find((s) => s.id === idea.series_id) : null

  const act = async (durum: Parameters<typeof setIdeaStatus>[1], msg: string) => {
    if (!idea) return
    await setIdeaStatus(idea.id, durum)
    toast(msg)
  }

  return (
    <div className="preview">
      <div className="preview-head">
        {idea ? (
          <>
            <div className="preview-title">
              {ser && (
                <span className="preview-series">
                  {ser.ad} · Bölüm {idea.bolum_no}
                </span>
              )}
              <b>{idea.baslik}</b>
              {idea.format === 'kisa_video' && !hasVideo(idea) && <span className="preview-note">Video klibi yok · görsel önizleme</span>}
            </div>
            <div className="seg" role="tablist" aria-label="Platform">
              {(['instagram', 'tiktok'] as Platform[]).map((p) => (
                <button key={p} role="tab" aria-selected={platform === p} className={platform === p ? 'on' : ''} onClick={() => setPlatform(p)}>
                  {p === 'instagram' ? 'Instagram' : 'TikTok'}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="preview-title">
            <span className="preview-series">Önizleme</span>
            <b>Profilin böyle görünecek</b>
          </div>
        )}
        {onClose && (
          <button className="icon-btn preview-close" onClick={onClose} aria-label="Kapat">
            <X size={20} />
          </button>
        )}
      </div>

      <PhoneFrame dark={dark}>
        {!idea ? (
          <ProfileView brand={brand} ideas={profileIdeas} onPick={select} />
        ) : platform === 'tiktok' ? (
          <TikTokView idea={idea} brand={brand} />
        ) : idea.format === 'kisa_video' ? (
          <ReelsView idea={idea} brand={brand} />
        ) : (
          <FeedView idea={idea} brand={brand} />
        )}
      </PhoneFrame>

      {idea && (
        <div className="preview-foot">
          <div className="actions">
            <span className={`pill pill-${idea.durum}`}>{STATUS_LABEL[idea.durum]}</span>
            <span className="actions-spacer" />
            <button
              className="icon-btn"
              title="Metni kopyala"
              aria-label="Metni kopyala"
              onClick={async () => (await copyText(caption(idea))) && toast('Açıklama ve etiketler kopyalandı')}
            >
              <Copy size={18} />
            </button>
            <button className={`icon-btn ${details ? 'on' : ''}`} title="Detaylar" aria-label="Detaylar" onClick={() => setDetails((d) => !d)}>
              <Info size={18} />
            </button>
            {idea.durum === 'yeni' && (
              <>
                <button className="icon-btn icon-btn-danger" title="Reddet" aria-label="Reddet" onClick={() => act('reddedildi', 'Reddedildi')}>
                  <X size={18} />
                </button>
                <button className="btn btn-primary" onClick={() => act('onaylandi', 'Onaylandı')}>
                  <Check size={17} /> Onayla
                </button>
              </>
            )}
            {idea.durum === 'onaylandi' && (
              <button className="btn btn-primary" onClick={() => act('paylasildi', 'Paylaşıldı olarak işaretlendi')}>
                <Send size={16} /> Paylaşıldı
              </button>
            )}
            {(idea.durum === 'reddedildi' || idea.durum === 'paylasildi') && (
              <button className="btn" onClick={() => act('yeni', 'Geri alındı')}>
                <Undo2 size={16} /> Geri al
              </button>
            )}
          </div>

          {details && (
            <div className="details">
              <p className="details-hook">“{idea.kanca}”</p>
              {idea.rota && (
                <p className="details-row">
                  <MapPin size={14} /> {idea.rota.ad} · {idea.rota.km} km
                </p>
              )}
              {idea.onerilen_ses && (
                <p className="details-row">
                  <Music2 size={14} /> {idea.onerilen_ses}
                </p>
              )}
              <details className="details-scenes">
                <summary>
                  {scenesOf(idea).length} sahne · fal.ai promptları <ChevronDown size={14} />
                </summary>
                <ol>
                  {scenesOf(idea).map((s) => (
                    <li key={s.sira}>
                      <b>{s.ekran_yazisi}</b>
                      <span>{s.prompt}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          )}
        </div>
      )}
      {!idea && <p className="preview-hint">Bir içeriğe tıkla, paylaşıldığında nasıl görüneceğini burada gör.</p>}
    </div>
  )
}
