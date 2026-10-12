import { useEffect, useState } from 'react'
import { Check, ChevronDown, Copy, Download, Info, MapPin, Music2, Send, Undo2, X } from 'lucide-react'
import { api, assetUrl } from '../api'
import type { InstagramPublishPreview, InstagramPublishResult } from '../types'
import { useStore } from '../store'
import { STATUS_LABEL, caption, copyText, hasVideo, scenesOf } from '../lib'
import { FeedView, PhoneFrame, ProfileView, ReelsView, TikTokView } from './Phone'

type Platform = 'instagram' | 'tiktok'

export default function Preview({ onClose }: { onClose?: () => void }) {
  const { brand, ideas, series, selectedId, select, setIdeaStatus, toast } = useStore()
  const idea = ideas.find((i) => i.id === selectedId) ?? null
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [details, setDetails] = useState(false)
  const [instagramPreview, setInstagramPreview] = useState<InstagramPublishPreview | null>(null)
  const [confirmInstagram, setConfirmInstagram] = useState(false)
  const [confirmTikTok, setConfirmTikTok] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const [publishState, setPublishState] = useState<InstagramPublishResult['status'] | null>(null)
  const [publishMessage, setPublishMessage] = useState<string | null>(null)

  useEffect(() => {
    if (idea) setPlatform(idea.platform)
    setDetails(false)
    setInstagramPreview(null)
    setConfirmInstagram(false)
    setConfirmTikTok(false)
    setPublishBusy(false)
    setPublishState(null)
    setPublishMessage(null)
  }, [idea?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!brand) return null

  const profileIdeas = ideas.filter((i) => i.durum === 'paylasildi' || i.durum === 'onaylandi')
  const dark = !!idea && (platform === 'tiktok' || idea.format === 'kisa_video')
  const ser = idea?.series_id ? series.find((s) => s.id === idea.series_id) : null
  const manualAssets: string[] = idea?.format === 'carousel'
    ? (idea.sahneler ?? []).map((scene) => scene.gorsel_url ?? null).filter((asset): asset is string => !!asset)
    : [idea?.format === 'kisa_video' ? idea.video_url : idea?.format === 'gonderi' ? idea.gorsel_url : null].filter((asset): asset is string => !!asset)
  const manualAsset = manualAssets[0] ?? null
  const manualExportReady = idea?.format === 'carousel'
    ? manualAssets.length >= 2 && manualAssets.length <= 35 && manualAssets.length === (idea.sahneler?.length ?? 0)
    : !!manualAsset

  const act = async (durum: Parameters<typeof setIdeaStatus>[1], msg: string) => {
    if (!idea) return
    await setIdeaStatus(idea.id, durum)
    toast(msg)
  }

  const openInstagramApproval = async () => {
    if (!idea) return
    setPublishBusy(true)
    setPublishMessage(null)
    try {
      const preview = await api.instagramPublishPreview(idea.id)
      setInstagramPreview(preview)
      setConfirmInstagram(true)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Yayın önizlemesi alınamadı.')
    } finally {
      setPublishBusy(false)
    }
  }

  const publishInstagram = async () => {
    if (!idea || !instagramPreview?.can_publish) return
    setPublishBusy(true)
    setPublishMessage(null)
    try {
      const result = await api.instagramPublish(idea.id, instagramPreview.fingerprint)
      setPublishState(result.status)
      if (result.status === 'published') {
        await setIdeaStatus(idea.id, 'paylasildi')
        setConfirmInstagram(false)
        toast('Instagram gönderisi yayımlandı')
      } else if (result.status === 'processing') {
        setPublishMessage('Instagram medyayı özel bir taslak container içinde hazırlıyor; henüz yayımlanmadı. Hazır olduğunda ayrı son onay isteyeceğim.')
      } else if (result.status === 'ready') {
        setPublishMessage('Medya hazır. Gönderi, aşağıdaki ayrı “Instagram’da yayımla” onayına basana kadar yayınlanmaz.')
      } else if (result.status === 'uncertain') {
        setPublishMessage(result.last_error ?? 'Instagram yanıtı belirsiz; hesabı kontrol et. Güvenlik için otomatik tekrar yapılmayacak.')
      } else {
        setPublishMessage(result.last_error ?? 'Yayın tamamlanamadı.')
      }
    } catch (e) {
      setPublishMessage(e instanceof Error ? e.message : 'Instagram yayını başlatılamadı.')
    } finally {
      setPublishBusy(false)
    }
  }

  const checkInstagramStatus = async () => {
    if (!idea) return
    setPublishBusy(true)
    try {
      const result = await api.instagramPublishStatus(idea.id)
      setPublishState(result.status)
      if (result.status === 'published') {
        await setIdeaStatus(idea.id, 'paylasildi')
        setConfirmInstagram(false)
        toast('Instagram gönderisi yayımlandı')
      } else if (result.status === 'processing' || result.status === 'publishing') {
        setPublishMessage('Instagram medyayı hazırlamaya devam ediyor; henüz yayımlanmadı. Bir dakika sonra tekrar kontrol edebilirsin.')
      } else if (result.status === 'ready') {
        setPublishMessage('Medya hazır. Yayınlamak için aşağıdaki ayrı son onay düğmesine bas.')
      } else if (result.status === 'uncertain') {
        setPublishMessage(result.last_error ?? 'Instagram hesabını kontrol et; çift paylaşımı önlemek için otomatik tekrar kapalı.')
      } else {
        setPublishMessage(result.last_error ?? 'Yayın durumu: ' + result.status)
      }
    } catch (e) {
      setPublishMessage(e instanceof Error ? e.message : 'Yayın durumu alınamadı.')
    } finally {
      setPublishBusy(false)
    }
  }

  const completeInstagramPublish = async () => {
    if (!idea || publishState !== 'ready') return
    setPublishBusy(true)
    setPublishMessage(null)
    try {
      const result = await api.instagramPublishComplete(idea.id)
      setPublishState(result.status)
      if (result.status === 'published') {
        await setIdeaStatus(idea.id, 'paylasildi')
        setConfirmInstagram(false)
        toast('Instagram gönderisi yayımlandı')
      } else if (result.status === 'processing') {
        setPublishMessage('Medya henüz hazır değil; Instagram’da hiçbir şey yayımlanmadı.')
      } else if (result.status === 'uncertain') {
        setPublishMessage(result.last_error ?? 'Instagram yanıtı belirsiz; çift paylaşımı önlemek için otomatik tekrar yapılmadı. Hesabı kontrol et.')
      } else {
        setPublishMessage(result.last_error ?? `Yayın durumu: ${result.status}`)
      }
    } catch (e) {
      setPublishMessage(e instanceof Error ? e.message : 'Instagram yayını tamamlanamadı.')
    } finally {
      setPublishBusy(false)
    }
  }

  const approveTikTokExport = async () => {
    await act('onaylandi', 'Onaylandı; medyayı indirip TikTok uygulamasında elle paylaşabilirsin.')
    setConfirmTikTok(false)
  }

  return (
    <div className="preview">
      <div className="preview-head">
        {idea ? (
          <>
            <div className="preview-title">
              {ser && <span className="preview-series">{ser.ad} · Bölüm {idea.bolum_no}</span>}
              <b>{idea.baslik}</b>
              {idea.format === 'kisa_video' && !hasVideo(idea) && <span className="preview-note">Video klibi yok · görsel önizleme</span>}
            </div>
            <div className="seg" role="tablist" aria-label="Platform önizlemesi">
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
        {onClose && <button className="icon-btn preview-close" onClick={onClose} aria-label="Kapat"><X size={20} /></button>}
      </div>

      <PhoneFrame dark={dark}>
        {!idea ? <ProfileView brand={brand} ideas={profileIdeas} onPick={select} /> : platform === 'tiktok' ? <TikTokView idea={idea} brand={brand} /> : idea.format === 'kisa_video' ? <ReelsView idea={idea} brand={brand} /> : <FeedView idea={idea} brand={brand} />}
      </PhoneFrame>

      {idea && (
        <div className="preview-foot">
          <div className="actions">
            <span className={`pill pill-${idea.durum}`}>{STATUS_LABEL[idea.durum]}</span>
            <span className="actions-spacer" />
            <button className="icon-btn" title="Metni kopyala" aria-label="Metni kopyala" onClick={async () => (await copyText(caption(idea))) && toast('Açıklama ve etiketler kopyalandı')}><Copy size={18} /></button>
            <button className={`icon-btn ${details ? 'on' : ''}`} title="Detaylar" aria-label="Detaylar" onClick={() => setDetails((d) => !d)}><Info size={18} /></button>
            {idea.durum === 'yeni' && <button className="icon-btn icon-btn-danger" title="Reddet" aria-label="Reddet" onClick={() => act('reddedildi', 'Reddedildi')}><X size={18} /></button>}
            {idea.platform === 'instagram' && idea.durum !== 'paylasildi' && idea.durum !== 'reddedildi' && (
              <button className="btn btn-primary" onClick={openInstagramApproval} disabled={publishBusy}>
                <Send size={16} /> {publishBusy ? 'Önizleme…' : 'İncele ve yayımla'}
              </button>
            )}
            {idea.platform === 'tiktok' && idea.durum === 'yeni' && (
              <button className="btn btn-primary" onClick={() => setConfirmTikTok(true)}><Check size={17} /> İncele ve onayla</button>
            )}
            {idea.platform === 'tiktok' && idea.durum === 'onaylandi' && manualExportReady && manualAssets.map((asset, index) => (
              <a key={`${idea.id}-${index}`} className="btn" href={assetUrl(asset) ?? undefined} download={`kontak-${idea.id}${idea.format === 'carousel' ? `-slayt-${index + 1}` : ''}.${idea.format === 'kisa_video' ? 'mp4' : 'jpg'}`}>
                <Download size={16} /> {idea.format === 'carousel' ? `Slayt ${index + 1}` : 'Medyayı indir'}
              </a>
            ))}
            {idea.platform === 'tiktok' && idea.durum === 'onaylandi' && (
              <button className="btn btn-primary" onClick={() => act('paylasildi', 'TikTok’ta paylaşıldı olarak işaretlendi')} disabled={!manualExportReady}>
                <Check size={17} /> Paylaşıldı
              </button>
            )}
            {idea.durum === 'reddedildi' && <button className="btn" onClick={() => act('yeni', 'Karar geri alındı')}><Undo2 size={16} /> Geri al</button>}
          </div>

          {idea.platform === 'tiktok' && idea.durum === 'onaylandi' && !manualExportReady && (
            <p className="publish-hint">{idea.format === 'kisa_video' ? 'Video dosyası henüz üretilmedi; gerçek bir klip hazır olmadan dışa aktarılamaz.' : idea.format === 'carousel' ? 'Carousel onayı için en az iki görselin her slayt için ayrı ayrı hazır olması gerekiyor.' : 'Gönderi görseli henüz hazır değil.'}</p>
          )}
          {publishState && publishState !== 'published' && <div className="publish-status"><span>{publishMessage ?? (publishState === 'ready' ? 'Instagram medyası hazır; insanın son onayı bekleniyor.' : `Yayın durumu: ${publishState}`)}</span>{(publishState === 'processing' || publishState === 'publishing') && <button className="btn" onClick={checkInstagramStatus} disabled={publishBusy}>{publishBusy ? 'Kontrol ediliyor…' : 'Durumu kontrol et'}</button>}</div>}

          {details && (
            <div className="details">
              <p className="details-hook">“{idea.kanca}”</p>
              {idea.rota && <p className="details-row"><MapPin size={14} /> {idea.rota.ad} · {idea.rota.km} km</p>}
              {idea.onerilen_ses && <p className="details-row"><Music2 size={14} /> {idea.onerilen_ses}</p>}
              <details className="details-scenes">
                <summary>{scenesOf(idea).length} sahne · fal.ai promptları <ChevronDown size={14} /></summary>
                <ol>{scenesOf(idea).map((s) => <li key={s.sira}><b>{s.ekran_yazisi}</b><span>{s.prompt}</span></li>)}</ol>
              </details>
            </div>
          )}
        </div>
      )}

      {confirmInstagram && idea && instagramPreview && (
        <div className="publish-overlay" role="dialog" aria-modal="true" aria-labelledby="ig-publish-title">
          <div className="publish-modal">
            <button className="icon-btn publish-close" onClick={() => setConfirmInstagram(false)} aria-label="Kapat"><X size={18} /></button>
            <span className="publish-kicker">INSTAGRAM · YAYIN ÖNCESİ SON KONTROL</span>
            <h2 id="ig-publish-title">İçeriğin son hâlini incele</h2>
            <p className="publish-account">Hedef hesap: <b>{instagramPreview.account ? `@${instagramPreview.account.replace(/^@/, '')}` : 'Instagram hesabı bağlı değil'}</b> · {instagramPreview.format}</p>
            {instagramPreview.media_type === 'REELS' && instagramPreview.media_url ? (
              <video className="publish-media" src={assetUrl(instagramPreview.media_url) ?? undefined} controls />
            ) : instagramPreview.media_type === 'CAROUSEL' && instagramPreview.media_urls.length ? (
              <div className="publish-media-grid">{instagramPreview.media_urls.map((url, index) => <img key={url} className="publish-media" src={assetUrl(url) ?? undefined} alt={`Yayımlanacak carousel slaytı ${index + 1}`} />)}</div>
            ) : instagramPreview.media_url ? (
              <img className="publish-media" src={assetUrl(instagramPreview.media_url) ?? undefined} alt="Yayımlanacak görsel" />
            ) : idea.gorsel_url ? <img className="publish-media publish-media-preview" src={assetUrl(idea.gorsel_url) ?? undefined} alt="Hazırlanmış görsel önizleme; yayın dosyası henüz hazır değil" /> : null}
            <label className="publish-caption-label">Yayımlanacak tam açıklama</label>
            <pre className="publish-caption">{instagramPreview.caption || 'Açıklama boş.'}</pre>
            {!instagramPreview.can_publish && <p className="publish-block">{instagramPreview.block_reason}</p>}
            {publishMessage && <p className="publish-block">{publishMessage}</p>}
            <div className="publish-actions">
              <button className="btn" onClick={() => setConfirmInstagram(false)} disabled={publishBusy}>İptal</button>
              {publishState === 'processing' || publishState === 'publishing' ? (
                <button className="btn btn-primary" onClick={checkInstagramStatus} disabled={publishBusy}>{publishBusy ? 'Kontrol ediliyor…' : 'Yayınlanmadı · durumu kontrol et'}</button>
              ) : publishState === 'ready' ? (
                <button className="btn btn-primary" onClick={completeInstagramPublish} disabled={publishBusy}>
                  <Send size={16} /> {publishBusy ? 'Yayımlanıyor…' : 'Evet, Instagram’da yayımla'}
                </button>
              ) : (
                <button className="btn btn-primary" onClick={publishInstagram} disabled={!instagramPreview.can_publish || publishBusy || (publishState !== null && publishState !== 'not_started')}>
                  <Check size={16} /> {publishBusy ? 'Hazırlanıyor…' : publishState === 'failed' ? 'Hazırlık başarısız' : publishState === 'uncertain' ? 'Sonuç belirsiz' : 'Medyayı hazırla · henüz yayımlamaz'}
                </button>
              )}
            </div>
            <p className="publish-small">Medya hazırlama özel bir taslak oluşturur; herkese açık paylaşım ancak hazır olduktan sonra bu ekrandaki ayrı son onayla yapılır. Yanıt belirsiz kalırsa çift paylaşımı önlemek için otomatik tekrar yapılmaz.</p>
          </div>
        </div>
      )}

      {confirmTikTok && idea && (
        <div className="publish-overlay" role="dialog" aria-modal="true" aria-labelledby="tt-export-title">
          <div className="publish-modal">
            <button className="icon-btn publish-close" onClick={() => setConfirmTikTok(false)} aria-label="Kapat"><X size={18} /></button>
            <span className="publish-kicker">ONAY · TIKTOK UYGULAMASINDA ELLE PAYLAŞIM</span>
            <h2 id="tt-export-title">Taslağı incele ve dışa aktar</h2>
            <p className="publish-account">Kontak iç aracından TikTok’a otomatik gönderim yapılmaz. Onaydan sonra hazır dosyaları indirip TikTok uygulamasında sen yüklersin.</p>
            {idea.format === 'kisa_video' && manualAsset ? (
              <video className="publish-media" src={assetUrl(manualAsset) ?? undefined} controls />
            ) : idea.format === 'carousel' && manualAssets.length ? (
              <div className="publish-media-grid">{manualAssets.map((asset, index) => <img key={asset} className="publish-media" src={assetUrl(asset) ?? undefined} alt={`TikTok carousel slaytı ${index + 1}`} />)}</div>
            ) : manualAsset ? <img className="publish-media" src={assetUrl(manualAsset) ?? undefined} alt="TikTok taslak önizlemesi" /> : null}
            <label className="publish-caption-label">Kopyalanacak açıklama</label>
            <pre className="publish-caption">{caption(idea)}</pre>
            {!manualExportReady && <p className="publish-block">{idea.format === 'kisa_video' ? 'Gerçek video dosyası henüz üretilmedi.' : idea.format === 'carousel' ? 'Tüm carousel slaytlarının ayrı görsel dosyası hazır değil.' : 'Gönderi görseli henüz hazır değil.'}</p>}
            <div className="publish-actions">
              <button className="btn" onClick={() => setConfirmTikTok(false)}>İptal</button>
              <button className="btn btn-primary" onClick={approveTikTokExport} disabled={!manualExportReady}><Check size={16} /> Onayla ve dışa aktar</button>
            </div>
            <p className="publish-small">Onay yalnızca panel durumunu değiştirir; TikTok’a gönderi yüklemez.</p>
          </div>
        </div>
      )}

      {!idea && <p className="preview-hint">Bir içeriğe tıkla, paylaşıldığında nasıl görüneceğini burada gör.</p>}
    </div>
  )
}
