// Ekran yazısı katmanı (13 Ekim akşam).
//
// Stüdyonun ürettiği görüntüde yazı yok (flux yazıyı bozuyor); ekran yazısı
// ayrı katman. Bu modül yazıyı markanın yazı tipiyle (Sora ExtraBold, uygulama
// ile aynı, OFL) PNG'ye çiziyor:
//   - reel: şeffaf 9:16 levha → fal compose'da görüntü katmanı (sahne süresince)
//   - carousel: kartın kendisi + alt karartma + yazı + sayfa no → hazır JPG/PNG
// resvg (WebAssembly) Worker'da çalışıyor; fal kredisi harcamıyor.

import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import sora from '../yazitipi/Sora-ExtraBold.ttf';

let hazir: Promise<void> | null = null;
const baslat = () => (hazir ??= initWasm(resvgWasm));

const kacis = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Sora'da emoji yok (kutu çiziyor); emojiler ve değişken seçiciler atılır. */
const temizle = (s: string) =>
  s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();

/**
 * Kelime kaydırma. Sora ExtraBold'da ortalama harf genişliği ~0,62 em;
 * Türkçe'de geniş harf (M, W, Ğ) az, bu oran satırı taşırmıyor (13 Eki deneme).
 */
function satirla(metin: string, puntoPx: number, genislikPx: number): string[] {
  const sinir = Math.max(8, Math.floor(genislikPx / (puntoPx * 0.62)));
  const satirlar: string[] = [];
  let satir = '';
  for (const kelime of temizle(metin).split(' ')) {
    if (!satir) satir = kelime;
    else if ((satir + ' ' + kelime).length <= sinir) satir += ' ' + kelime;
    else {
      satirlar.push(satir);
      satir = kelime;
    }
  }
  if (satir) satirlar.push(satir);
  return satirlar;
}

async function ciz(svg: string, genislik: number): Promise<Uint8Array> {
  await baslat();
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: genislik },
    font: { fontBuffers: [new Uint8Array(sora)], defaultFontFamily: 'Sora', loadSystemFonts: false },
  });
  return r.render().asPng();
}

/**
 * Reel yazı levhası, HARDLIGHT karışımı için (13 Eki: fal compose görüntü
 * katmanını "Multiple video tracks are not supported" diye reddediyor;
 * saydamlık taşıyan bindirme yok). Hardlight'ta üst katman:
 *   %50 gri (#808080) → alttaki video aynen
 *   koyu gri (#262626) → video ~%30'a kararır (yazının arkasındaki kutu)
 *   beyaz → beyaz (yazı)
 * Böylece tek opak katman hem kutuyu hem yazıyı taşıyor.
 * Kutu üst üçte birde (TikTok/Reels arayüzü altı ve sağı kapatıyor).
 */
export const NOTR_GRI = '#808080';

export async function reelLevhasi(metin: string | null, w: number, h: number): Promise<Uint8Array> {
  if (!metin) return ciz(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${NOTR_GRI}"/></svg>`, w);
  const punto = Math.round(w * 0.056);
  const satirlar = satirla(metin, punto, w * 0.78);
  const aralik = Math.round(punto * 1.3);
  const pad = Math.round(punto * 0.6);
  const enUzun = Math.max(...satirlar.map((s) => s.length));
  const kutuW = Math.min(w * 0.9, enUzun * punto * 0.62 + pad * 2);
  const kutuH = aralik * satirlar.length + pad * 1.2;
  const x0 = (w - kutuW) / 2;
  const y0 = Math.round(h * 0.22);
  const metinler = satirlar
    .map((s, i) => `<text x="${w / 2}" y="${y0 + pad * 0.6 + punto + i * aralik - punto * 0.12}" text-anchor="middle">${kacis(s)}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${NOTR_GRI}"/>
<rect x="${x0}" y="${y0}" width="${kutuW}" height="${kutuH}" rx="${Math.round(punto * 0.45)}" fill="#262626"/>
<g font-family="Sora" font-weight="800" font-size="${punto}" fill="#FFFFFF">${metinler}</g>
</svg>`;
  return ciz(svg, w);
}

/**
 * Carousel kartı: görsel + alttan lacivert karartma + yazı + "2/6".
 * Kapak (ilk kart) daha büyük punto. Görsel data URI olarak gömülü.
 */
export async function carouselKarti(
  gorsel: ArrayBuffer,
  mime: string,
  metin: string,
  sira: number,
  toplam: number,
  w = 1080,
  h = 1440
): Promise<Uint8Array> {
  const kapak = sira === 1;
  const punto = Math.round(w * (kapak ? 0.074 : 0.056));
  const satirlar = metin ? satirla(metin, punto, w * 0.84) : [];
  const aralik = Math.round(punto * 1.22);
  const altBosluk = Math.round(h * 0.075);
  const ilkY = h - altBosluk - aralik * (satirlar.length - 1);
  const b64 = base64(gorsel);
  const metinler = satirlar
    .map((s, i) => `<text x="${Math.round(w * 0.08)}" y="${ilkY + i * aralik}">${kacis(s)}</text>`)
    .join('');
  const karartmaY = Math.max(0, ilkY - punto * 2.6);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="k" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#05061C" stop-opacity="0"/><stop offset="0.55" stop-color="#05061C" stop-opacity="0.62"/><stop offset="1" stop-color="#05061C" stop-opacity="0.9"/>
</linearGradient></defs>
<image x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" xlink:href="data:${mime};base64,${b64}"/>
${satirlar.length ? `<rect x="0" y="${karartmaY}" width="${w}" height="${h - karartmaY}" fill="url(#k)"/>` : ''}
<g font-family="Sora" font-weight="800" font-size="${punto}" fill="#FFFFFF">${metinler}</g>
${toplam > 1 ? `<rect x="${w - Math.round(w * 0.155)}" y="${Math.round(w * 0.05)}" width="${Math.round(w * 0.105)}" height="${Math.round(w * 0.05)}" rx="${Math.round(w * 0.025)}" fill="#080A28" fill-opacity="0.6"/>
<text x="${w - Math.round(w * 0.1025)}" y="${Math.round(w * 0.0835)}" text-anchor="middle" font-family="Sora" font-weight="800" font-size="${Math.round(w * 0.028)}" fill="#FFFFFF">${sira}/${toplam}</text>` : ''}
</svg>`;
  return ciz(svg, w);
}

function base64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
