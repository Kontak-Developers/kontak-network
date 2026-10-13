// Stüdyo sekmesi türleri. Arka uç: backend/src/ayarlar.ts, studyoApi.ts.

export type AjanAyarlari = {
  av: {
    tr_etiketler: string[]
    tr_aramalar: string[]
    global_aramalar: string[]
    creative_center: boolean
    etiket_basi_video: number
    arama_basi_video: number
    gun: number
    min_patlama: number
    min_izlenme_tr: number
    min_izlenme_global: number
    tr_secim: number
    global_secim: number
    hesap_basi: number
  }
  sok: { izlenecek_video: number; sure_dk: number; taze_saat: number }
  kreatif: { aday: number; secim: number; min_puan: number; karisim: string; odaklar: string[]; ek_talimat: string; sure_dk: number }
  studyo: { ses: string; muzik: boolean; altyazi: boolean; yazi_gom: boolean; hero_veo: boolean; kalite_denetimi: boolean; denetim_modeli: string }
  butce: { fal_gunluk_tavan: number; maliyet_katsayi: number }
}

export type PaletRengi = { ad: string; hex: string; kullanim: string }
export type Karakter = { kod: string; ad: string; tarif_en: string }
export type AltinPrompt = { tur: string; ne_zaman: string; prompt_en: string }

export type GorselKimlik = {
  surum?: string
  guncelleyen?: string
  ozet: string
  palet: PaletRengi[]
  isik: string
  lens: string
  renk_gradi: string
  karakterler: Karakter[]
  mekanlar: string[]
  asla: string[]
  asla_en?: string
  stil_eki: string
  cekim_kurali?: string
  altin_promptlar: AltinPrompt[]
}

export type PromptOzet = { ad: string; ozel: boolean; guncelleme: string | null; guncelleyen: string | null }
export type Harcama = { servis: string; usd: number }
export type SurenIs = { id: string; ozet: string; adim: string; baslangic: string; icerik: number; hazir: number }

export type StudyoOzet = {
  ayarlar: AjanAyarlari
  varsayilan: AjanAyarlari
  kimlik: GorselKimlik | null
  promptlar: PromptOzet[]
  harcama: { bugun: Harcama[]; toplam: Harcama[]; tavan: number }
  suren: SurenIs[]
}

export type Format = {
  id: string
  ad: string
  ozet: string
  kanca_kalibi: string
  yapi: string
  kurgu: string
  ses: string
  ekran_yazisi: string
  neden_tuttu: string
  kontak_acisi: string
  seslendirme: boolean
  ornekler: { link: string; izlenme?: number; patlama?: number; hesap?: string }[] | string[]
  gorulme: number
  ilk_gorulme: string
  son_gorulme: string
  durum: 'yukseliyor' | 'zirvede' | 'sonuyor'
  skor: number
  kullanim: number
  panel_karari: 'sabit' | 'kapali' | null
}

export type Patlayan = {
  link: string
  platform: string
  kaynak: 'tr_motor' | 'global_motor'
  hesap: string | null
  takipci: number
  izlenme: number
  begeni: number
  yorum: number
  paylasim: number
  kaydetme: number
  patlama: number
  sure_sn: number | null
  aciklama: string | null
  ses: string | null
  tarih: string
  format_id: string | null
  bulunma: string
}

export type RotaKarti = {
  id: string
  run_id: string
  ad: string
  il: string
  baslangic: string
  bitis: string
  duraklar: string[]
  km: number | null
  sure_dk: number | null
  en_iyi_zaman: string
  zorluk: string
  yol_tipi: string
  neden_git: string
  kaynaklar: string[]
  gorsel_url: string | null
  durum: 'taslak' | 'onaylandi' | 'reddedildi' | 'uygulamaya_gonderildi'
  olusturma: string
}
