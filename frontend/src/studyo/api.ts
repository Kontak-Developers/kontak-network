import { request } from '../api'
import type { AjanAyarlari, Format, GorselKimlik, Patlayan, RotaKarti, StudyoOzet } from './tipler'

const e = encodeURIComponent

export const studyoApi = {
  ozet: () => request<StudyoOzet>('GET', '/api/studyo'),
  ayarlariKaydet: (a: AjanAyarlari) => request<AjanAyarlari>('PUT', '/api/studyo/ayarlar', a),
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
