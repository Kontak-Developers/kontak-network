// Trend ivmesi (SOZLESME.md "Trend tespiti").
//
// Her hashtag / ses için:
//   son   = son 48 saatin GÜNLÜK ortalaması (gönderi sayısı ve etkileşim)
//   once  = ondan önceki 7 günün günlük ortalaması
//   oran  = √( (son_adet+1)/(once_adet+1) × (son_etk+1)/(once_etk+1) )
//   ivme  = 50 + 25·log2(oran), 0-100'e kırpılır
//
// +1: hiç geçmişi olmayan yeni etiket sonsuz oran üretmesin.
// log2: 1× → 50 (durağan), 2× → 75, 4× → 100, ½× → 25 (sönüyor).
// Geometrik ortalama: tek viral gönderi (etkileşim) ya da çok sayıda ölü
// gönderi (adet) tek başına ivmeyi uçurmasın.

import type { Gonderi } from './tipler';
import { sinirla } from './yardimci';

export type IvmeSatiri = {
  ad: string;
  tur: 'hashtag' | 'ses';
  ivme: number;
  son48_gunluk_gonderi: number;
  once7_gunluk_gonderi: number;
  son48_etkilesim: number;
  platformlar: string[];
};

const etkilesim = (g: Gonderi) => g.begeni + g.yorum * 3 + g.paylasim * 5;

export function ivmeHesapla(gonderiler: Gonderi[], simdi = Date.now()): IvmeSatiri[] {
  const sinir48 = simdi - 48 * 3600_000;
  const sinir9g = simdi - 9 * 86400_000;
  type Kova = { sonA: number; sonE: number; onceA: number; onceE: number; pl: Set<string> };
  const kovalar = new Map<string, Kova>();

  const ekle = (anahtar: string, g: Gonderi, son: boolean) => {
    let k = kovalar.get(anahtar);
    if (!k) kovalar.set(anahtar, (k = { sonA: 0, sonE: 0, onceA: 0, onceE: 0, pl: new Set() }));
    if (son) {
      k.sonA++;
      k.sonE += etkilesim(g);
    } else {
      k.onceA++;
      k.onceE += etkilesim(g);
    }
    k.pl.add(g.platform);
  };

  for (const g of gonderiler) {
    const t = Date.parse(g.tarih);
    if (!Number.isFinite(t) || t < sinir9g || t > simdi + 3600_000) continue;
    const son = t >= sinir48;
    for (const h of new Set(g.hashtagler)) ekle(`hashtag:${h}`, g, son);
    if (g.ses) ekle(`ses:${g.ses}`, g, son);
  }

  const satirlar: IvmeSatiri[] = [];
  for (const [anahtar, k] of kovalar) {
    const [tur, ...ad] = anahtar.split(':');
    const sonA = k.sonA / 2, onceA = k.onceA / 7;
    const sonE = k.sonE / 2, onceE = k.onceE / 7;
    const oran = Math.sqrt(((sonA + 1) / (onceA + 1)) * ((sonE + 1) / (onceE + 1)));
    satirlar.push({
      ad: ad.join(':'),
      tur: tur as 'hashtag' | 'ses',
      ivme: Math.round(sinirla(50 + 25 * Math.log2(oran), 0, 100)),
      son48_gunluk_gonderi: Math.round(sonA * 10) / 10,
      once7_gunluk_gonderi: Math.round(onceA * 10) / 10,
      son48_etkilesim: k.sonE,
      platformlar: [...k.pl],
    });
  }
  // Tek gönderilik gürültüyü ele: en az 2 gönderi görülmüş olsun.
  return satirlar
    .filter((s) => s.son48_gunluk_gonderi * 2 + s.once7_gunluk_gonderi * 7 >= 2)
    .sort((a, b) => b.ivme - a.ivme || b.son48_etkilesim - a.son48_etkilesim);
}

/** Beyne gidecek örnek gönderiler: son 48 saatin en çok etkileşim alanları. */
export function ornekGonderiler(gonderiler: Gonderi[], adet: number, simdi = Date.now()) {
  const sinir48 = simdi - 48 * 3600_000;
  return gonderiler
    .filter((g) => Date.parse(g.tarih) >= sinir48)
    .sort((a, b) => etkilesim(b) - etkilesim(a))
    .slice(0, adet)
    .map((g) => ({
      link: g.link,
      platform: g.platform,
      hesap: g.hesap,
      aciklama: g.aciklama.slice(0, 160),
      hashtagler: g.hashtagler.slice(0, 8),
      ses: g.ses,
      format: g.format,
      izlenme: g.izlenme,
      begeni: g.begeni,
      yorum: g.yorum,
      paylasim: g.paylasim,
      tarih: g.tarih,
    }));
}
