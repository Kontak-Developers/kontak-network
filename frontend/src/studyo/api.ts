import { API_TABAN, ApiError, request, yetkiBasligi } from '../api'
import type { AjanAyarlari, Format, GorselKimlik, MarkaRehberi, Patlayan, RotaKarti, StudyoOzet, UygulamaEkrani } from './tipler'

const e = encodeURIComponent

/** Uygulama ekranı yükle: ham görsel gövdesi, ad/açıklama sorguda. */
async function ekranYukle(dosya: File, ad: string, aciklama: string): Promise<UygulamaEkrani> {
  const q = new URLSearchParams({ ad, aciklama })
  const y = await fetch(`${API_TABAN}/api/studyo/ekran?${q}`, {
    method: 'POST',
    headers: { ...yetkiBasligi(), 'Content-Type': dosya.type || 'image/png' },
    body: dosya,
  })
  const d = await y.json().catch(() => null)
  if (!y.ok) throw new ApiError(y.status, d?.hata?.kod ?? 'hata', d?.hata?.mesaj ?? 'Yüklenemedi.')
  return d
}

export const studyoApi = {
  ekranYukle,
  ekranSil: (id: string) => request<{ ok: true }>('DELETE', `/api/studyo/ekran/${e(id)}`),
  ozet: () => request<StudyoOzet>('GET', '/api/studyo'),
  ayarlariKaydet: (a: AjanAyarlari) => request<AjanAyarlari>('PUT', '/api/studyo/ayarlar', a),
  rehberKaydet: (metin: string) => request<MarkaRehberi>('PUT', '/api/studyo/rehber', { metin }),
  kimlikKaydet: (k: GorselKimlik) => request<GorselKimlik>('PUT', '/api/studyo/kimlik', k),
  kimlikDene: (prompt: string, karakter: string, kimlik: GorselKimlik) =>
    request<{ url: string }>('POST', '/api/studyo/kimlik/dene', { prompt, karakter, kimlik }),
  prompt: (ad: string) =>
    request<{ ad: string; dosya: string; ozel: { metin: string; guncelleme: string; guncelleyen: string | null } | null; gecerli: string }>(
      'GET',
      `/api/studyo/promptlar/${e(ad)}`
    ),
  promptKaydet: (ad: string, metin: string) => request<{ ok: true }>('PUT', `/api/studyo/promptlar/${e(ad)}`, { metin }),
  promptSifirla: (ad: string) => request<{ ok: true }>('DELETE', `/api/studyo/promptlar/${e(ad)}`),
  stok: (b: { tur: number; karisim: string; odaklar: string[]; tavan: number }) => request<{ id: string }>('POST', '/api/studyo/stok', b),
  kartYenidenUret: (id: string, sira: number) =>
    request<{ ok: boolean; deneme: number; temiz: boolean; sorunlar: string[] }>('POST', `/api/studyo/kart/${e(id)}/${sira}`, {}),
  reelUret: (ids: string[]) => request<{ id: string }>('POST', '/api/studyo/reel', { ids }),
  yaziGom: (ids?: string[]) => request<{ id: string }>('POST', '/api/studyo/yazi', { ids: ids ?? [] }),
  formatlar: () => request<Format[]>('GET', '/api/formats'),
  formatKarari: (id: string, panel_karari: Format['panel_karari']) =>
    request<{ id: string }>('PATCH', `/api/formats/${e(id)}`, { panel_karari }),
  patlayanlar: () => request<Patlayan[]>('GET', '/api/patlayanlar'),
  rotalar: () => request<RotaKarti[]>('GET', '/api/rota-kartlari'),
  rotaKarari: (id: string, durum: 'taslak' | 'onaylandi' | 'reddedildi') =>
    request<{ id: string; durum: 'taslak' | 'onaylandi' | 'reddedildi' | 'uygulamaya_gonderildi'; km?: number }>('PATCH', `/api/rota-kartlari/${e(id)}`, { durum }),
  metinKaydet: (id: string, b: { kanca?: string; aciklama_metni?: string; hashtagler?: string[]; ekran_yazilari?: string[] }) =>
    request<{ ok: boolean; yazi_yeniden_gomulmeli: boolean }>('PATCH', `/api/ideas/${e(id)}/metin`, b),
}
