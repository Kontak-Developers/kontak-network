// SOZLESME.md ile birebir

export type Brand = {
  id: string
  ad: string
  kullanici_adi: string
  logo_url: string | null
  tanim: string
  hedef_kitle: string
  ton_kurallari: string[]
  vurgu_rengi: string
  sutunlar: { ad: string; oran: number }[]
  izlenecek: {
    tiktok_hashtagler: string[]
    instagram_hashtagler: string[]
    hesaplar: string[]
  }
  sinirlar?: {
    konu_alani: string
    yasak_konular: string[]
    gorsel_kurallar: string[]
    butce: { aktif_hashtag: number; deneme_hashtag: number; video_per_run: number }
  }
}

export type RunStep = 'tara' | 'analiz' | 'uret' | 'kaydet'

export type Run = {
  id: string
  tetik: 'cron' | 'manuel'
  durum: 'calisiyor' | 'tamamlandi' | 'hata'
  adim: RunStep
  baslangic: string
  bitis: string | null
  taranan_gonderi: number
  ozet: string
  log?: { zaman: string; mesaj: string }[]
  hata?: string | null
  manus_linkleri?: string[]
}

export type Trend = {
  id: string
  run_id: string
  tip: 'konu' | 'ses' | 'format' | 'hashtag'
  baslik: string
  aciklama: string
  platform: 'tiktok' | 'instagram' | 'ikisi'
  ivme: number
  ornek_linkler: string[]
}

export type IdeaStatus = 'yeni' | 'onaylandi' | 'reddedildi' | 'paylasildi'

export type DesignSpec = {
  sablon: 'rota' | 'liste' | 'metin' | 'karsilastirma' | 'soru'
  baslik: string
  alt_baslik: string
  maddeler: string[]
  rota_id: string
}

export type KontakRota = {
  id: string
  ad: string
  aciklama: string | null
  sehir: string
  mesafe_m: number
  sure_s: number
  zorluk: string
  en_iyi_zaman: string | null
  noktalar: { ad: string; lat: number; lon: number }[]
  cizgi: string | null
}

export type Scene = {
  sira: number
  sure_sn: number
  tur?: 'foto' | 'video' | 'tasarim'
  tasarim?: DesignSpec | null
  prompt: string
  ekran_yazisi: string
  gorsel_url?: string | null
  video_url?: string | null
}

export type Idea = {
  id: string
  run_id: string
  trend_id: string
  series_id?: string | null
  bolum_no?: number | null
  bolum_adi?: string | null
  platform: 'tiktok' | 'instagram'
  format: 'kisa_video' | 'carousel' | 'gonderi'
  baslik: string
  kanca: string
  senaryo: string[]
  sahneler?: Scene[]
  aciklama_metni: string
  hashtagler: string[]
  onerilen_ses?: string | null
  rota?: { ad: string; km: number; duraklar: string[] } | null
  gorsel_prompt: string
  gorsel_url: string | null
  video_url: string | null
  durum: IdeaStatus
}

export type WeeklyItem = { baslik: string; ivme: number }

export type Weekly = {
  id: string
  hafta: string
  olusturma: string
  ozet: string
  kalici: WeeklyItem[]
  yukselen: WeeklyItem[]
  sonen: WeeklyItem[]
  onerilen_odak: string[]
}

export type WatchStatus = 'aktif' | 'deneme' | 'elendi' | 'sabit' | 'yasak'

export type WatchItem = {
  id: string
  etiket: string
  platform: 'tiktok' | 'instagram'
  durum: WatchStatus
  kaynak: 'profil' | 'kesif' | 'insan'
  skor: number
  eklenme: string
  neden: string
}

export type Decision = {
  id: string
  run_id: string
  tur: 'hashtag_ekle' | 'hashtag_kalici' | 'hashtag_cikar' | 'seri_ac' | 'bolum_planla' | 'icerik_uret'
  hedef: string
  neden: string
  zaman: string
}

export type Series = {
  id: string
  ad: string
  aciklama: string
  format: Idea['format']
  durum: 'aktif' | 'bitti'
  olusturan: 'ajan' | 'insan'
  bolum_sayisi: number
  planlanan_bolumler: string[]
  neden: string
}
