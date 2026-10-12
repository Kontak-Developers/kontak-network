// SOZLESME.md ile birebir

export type Brand = {
  id: string
  ad: string
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

export type Idea = {
  id: string
  run_id: string
  trend_id: string
  platform: 'tiktok' | 'instagram'
  format: 'kisa_video' | 'carousel' | 'gonderi'
  baslik: string
  kanca: string
  senaryo: string[]
  aciklama_metni: string
  hashtagler: string[]
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
