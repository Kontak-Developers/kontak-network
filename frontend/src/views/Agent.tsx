import { useEffect, useState } from 'react'
import { Ban, CalendarPlus, CheckCheck, ExternalLink, Layers, Minus, Pin, Plus, Sparkles, Undo2 } from 'lucide-react'
import type { Decision, SocialStatus, WatchItem, WatchStatus } from '../types'
import { useStore } from '../store'
import { fmtTime, relDay, runDuration } from '../lib'
import { PlatformGlyph } from '../components/bits'
import { api } from '../api'

// Bilinmeyen karar türü sayfayı çökertmesin (13 Eki: 'adaylar' beyaz sayfa yaptı).
const DECISION_ICON: Record<string, typeof Plus> = {
  adaylar: Sparkles,
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
  const [tumKararlar, setTumKararlar] = useState(false)
  const [acikKarar, setAcikKarar] = useState<string | null>(null)
  const [social, setSocial] = useState<SocialStatus | null>(null)
  const [socialError, setSocialError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<'instagram' | 'tiktok' | null>(null)
  const budget = brand?.sinirlar?.butce ?? { aktif_hashtag: 8, deneme_hashtag: 3, video_per_run: 1 }
  const count = (d: WatchStatus) => watchlist.filter((w) => w.durum === d).length

  useEffect(() => {
    let active = true
    const loadSocial = () => api.socialStatus().then((s) => { if (active) { setSocial(s); setSocialError(null) } })
      .catch((e) => { if (active) setSocialError(e instanceof Error ? e.message : 'Hesap durumu alınamadı.') })
    loadSocial()
    const params = new URLSearchParams(location.search)
    const platform = params.get('sosyal')
    const result = params.get('sonuc')
    if ((platform === 'instagram' || platform === 'tiktok') && result) {
      toast(result === 'baglandi' ? `${platform === 'instagram' ? 'Instagram' : 'TikTok'} hesabı bağlandı` : 'Hesap bağlantısı tamamlanmadı; ayarları kontrol edip yeniden dene.')
      loadSocial()
      const clean = new URL(location.href)
      clean.searchParams.delete('sosyal')
      clean.searchParams.delete('sonuc')
      history.replaceState(null, '', clean.toString())
    }
    return () => { active = false }
  }, [toast])

  const connectSocial = async (platform: 'instagram' | 'tiktok') => {
    setConnecting(platform)
    try {
      const result = await api.socialConnect(platform)
      if (!result.url.startsWith('https://')) throw new Error('Güvenli bağlantı adresi alınamadı.')
      location.assign(result.url)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Hesap bağlantısı başlatılamadı.')
      setConnecting(null)
    }
  }

  const change = async (w: WatchItem, durum: WatchStatus, msg: string) => {
    setMenu(null)
    await setWatch(w.id, durum)
    toast(msg)
  }

  // kararları güne göre grupla; varsayılan son 8 karar (liste yüzlerce satıra uzuyordu)
  const KISA = 8
  const gorunenKararlar = tumKararlar ? decisions : decisions.slice(0, KISA)
  const byDay = new Map<string, Decision[]>()
  gorunenKararlar.forEach((d) => {
    const k = relDay(d.zaman)
    byDay.set(k, [...(byDay.get(k) ?? []), d])
  })

  return (
    <div className="page agent">
      <section className="panel panel-wide">
        <div className="sec-head">
          <h2>Sosyal hesap bağlantıları</h2>
          <span className="muted">Instagram: panelden onaylı yayın · TikTok: indir ve elle yükle</span>
        </div>
        <div className="social-grid">
          <SocialConnection platform="instagram" title="Instagram" status={social?.instagram} connecting={connecting === 'instagram'} onConnect={() => connectSocial('instagram')} />
          <SocialConnection platform="tiktok" title="TikTok" status={social?.tiktok} connecting={connecting === 'tiktok'} onConnect={() => connectSocial('tiktok')} />
        </div>
        <details className="social-howto">
          <summary>Paylaşım nasıl yapılır?</summary>
        <div className="social-workflow-grid">
          <article className="social-workflow">
            <h3 className="social-workflow-title"><PlatformGlyph platform="instagram" size={15} /> Instagram · panelden onaylı yayın</h3>
            <ol>
              <li>Fikri açıp hedef hesabı, gerçek medya dosyasını ve açıklamayı kontrol et.</li>
              <li>Önce medyayı taslak olarak hazırla; bu adım herkese açık paylaşım yapmaz.</li>
              <li>Medya hazır olduğunda ayrı <b>“Evet, Instagram’da yayımla”</b> onayını ver.</li>
            </ol>
            <p>{social?.instagram.connected ? 'Hesap bağlı. Yayın izni olsa bile her gönderide ayrı son onay gerekir.' : 'Panelden Instagram yayını için hesabı bağla; yayın önizlemesi her içeriğin hazır olup olmadığını ayrıca denetler.'}</p>
          </article>
          <article className="social-workflow">
            <h3 className="social-workflow-title"><PlatformGlyph platform="tiktok" size={15} /> TikTok · indir ve elle yükle</h3>
            <ol>
              <li>Fikri onayla; yalnız hazır dosyalar için indirme düğmeleri açılır.</li>
              <li>Gerçek video hazırsa MP4’ü; carousel ise JPG slaytlarını indir.</li>
              <li>Dosyayı TikTok veya TikTok Studio’ya kendin yükle, açıklamayı kopyala.</li>
              <li>Paylaşım tamamlanınca panelde <b>“TikTok’ta paylaştım”</b> olarak kaydet.</li>
            </ol>
            <p>TikTok API bağlantısı yalnız kendi gönderi metriklerini okumak içindir; manuel paylaşım için gerekmez ve panel otomatik gönderi yüklemez.</p>
          </article>
        </div>
        </details>
        {socialError && <p className="social-error">Bağlantı durumu alınamadı: {socialError}</p>}
        {social && !social.instagram.configured && (
          <p className="social-setup">Instagram’da panelden yayın için Meta hesabı bağlantısı gerekir. TikTok ve Instagram gündem taraması ile TikTok’ta elle dosya paylaşımı hesap bağlantısından bağımsızdır.</p>
        )}
      </section>

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
                const Icon = DECISION_ICON[d.tur] ?? Sparkles
                const acik = acikKarar === d.id
                return (
                  <li key={d.id} className={`tl tl-${d.tur}`}>
                    <span className="tl-icon">
                      <Icon size={14} />
                    </span>
                    <button className={`tl-body tl-toggle ${acik ? 'acik' : ''}`} onClick={() => setAcikKarar(acik ? null : d.id)} aria-expanded={acik}>
                      <b>{d.hedef}</b>
                      <span>{d.neden}</span>
                    </button>
                    <time>{fmtTime(d.zaman)}</time>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
        {decisions.length > KISA && (
          <button className="btn btn-sm tl-more" onClick={() => setTumKararlar((v) => !v)}>
            {tumKararlar ? 'Daha az göster' : `Tüm kararlar (${decisions.length})`}
          </button>
        )}
      </section>

      <section className="panel panel-wide">
        <div className="sec-head">
          <h2>Çalıştırmalar</h2>
          <span className="muted">Her gün 08:00</span>
        </div>
        <div className="runs">
          {runs.slice(0, 8).map((r) => (
            <div key={r.id} className={`run run-${r.durum}`} title={r.hata ?? r.ozet}>
              <span className="run-dot" />
              <b>
                {relDay(r.baslangic)} {fmtTime(r.baslangic)}
              </b>
              <span>{r.tetik === 'cron' ? 'Otomatik' : 'Elle'}</span>
              <span>{r.taranan_gonderi.toLocaleString('tr-TR')} gönderi</span>
              <span className="run-end">
                {r.durum === 'calisiyor' ? 'çalışıyor' : r.durum === 'hata' ? 'hata' : runDuration(r)}
                {r.manus_linkleri?.[0] && (
                  <a href={r.manus_linkleri[0]} target="_blank" rel="noreferrer" title="Manus görevi" aria-label="Manus görevi">
                    <ExternalLink size={13} />
                  </a>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SocialConnection({
  platform, title, status, connecting, onConnect,
}: {
  platform: 'instagram' | 'tiktok'; title: string; status?: SocialStatus['instagram']; connecting: boolean; onConnect: () => void
}) {
  const connected = !!status?.connected
  const configured = !!status?.configured
  const needsReconnect = !!status?.needs_reconnect
  const hasPublishPermission = platform === 'instagram' && !!status?.scopes.includes('instagram_business_content_publish')
  return (
    <article className={`social-card ${connected ? 'social-connected' : ''}`}>
      <div className="social-card-title"><PlatformGlyph platform={platform} size={17} /><b>{title}</b><span className={`social-dot ${connected ? 'on' : ''}`} /></div>
      <p>{connected ? `${status?.username ?? 'Hesap bağlı'} · ${status?.posts_read ?? 0} gönderi okundu` : needsReconnect ? 'Yetki yenilenmeli' : configured ? platform === 'tiktok' ? 'Kendi TikTok metrikleri bağlı değil' : 'Instagram hesabı bağlı değil' : platform === 'tiktok' ? 'TikTok hesap metriği ayarı bekleniyor' : 'Meta Developer uygulama ayarı bekleniyor'}</p>
      {connected && platform === 'instagram' && <small>{hasPublishPermission ? 'Instagram yayın izni bağlı; son onay her gönderide ayrı alınır.' : 'Hesap okuma bağlantısı var; yayın izni bağlı değil.'}</small>}
      {connected && platform === 'tiktok' && <small>Bu bağlantı yalnızca kendi hesap metriklerini okur; paylaşım yapmaz.</small>}
      {connected && status?.last_sync && <small>Son okuma: {relDay(status.last_sync)} {fmtTime(status.last_sync)}</small>}
      {configured && <button className="btn" onClick={onConnect} disabled={connecting}>{connecting ? 'Bağlanıyor…' : connected || needsReconnect ? 'Yetkiyi yeniden bağla' : platform === 'tiktok' ? 'Kendi metriklerini bağla · isteğe bağlı' : 'Instagram’ı bağla'}</button>}
    </article>
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
