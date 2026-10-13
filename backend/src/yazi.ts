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
import logo from '../yazitipi/kontak-logo.png';

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

/**
 * Marka imzası: sol üstte küçük "kontak.social". Hardlight'ta açık gri hafif
 * aydınlatır → videonun üstünde ince, filigran gibi bir iz (bağırmıyor).
 */
function imzaSvg(imza: string, w: number) {
  if (!imza) return '';
  const p = Math.round(w * 0.03);
  return `<text x="${Math.round(w * 0.06)}" y="${Math.round(w * 0.12)}" font-family="Sora" font-weight="800" font-size="${p}" fill="#D2D2D2">${kacis(temizle(imza))}</text>`;
}

export async function reelLevhasi(metin: string | null, w: number, h: number, imza = ''): Promise<Uint8Array> {
  if (!metin)
    return ciz(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${NOTR_GRI}"/>${imzaSvg(imza, w)}</svg>`, w);
  // 13 Eki gece (Şevval: "font ve arkasındaki siyah doldurma orantısız"): TikTok'un kendi
  // yazı stili — her satır ayrı beyaz etiket, siyah yazı, sıkı kenar. Hardlight'ta
  // beyaz → beyaz, siyah → siyah: keskin ve okunur.
  const punto = Math.round(w * 0.06);
  const satirlar = satirla(metin, punto, w * 0.8);
  const aralik = Math.round(punto * 1.42);
  const padX = Math.round(punto * 0.42);
  const padY = Math.round(punto * 0.2);
  const y0 = Math.round(h * 0.2);
  const etiketler = satirlar
    .map((s, i) => {
      const gen = Math.min(w * 0.9, s.length * punto * 0.6 + padX * 2);
      const x = (w - gen) / 2;
      const y = y0 + i * aralik;
      return `<rect x="${x}" y="${y}" width="${gen}" height="${punto + padY * 2}" rx="${Math.round(punto * 0.28)}" fill="#FFFFFF"/>
<text x="${w / 2}" y="${y + padY + punto * 0.84}" text-anchor="middle">${kacis(s)}</text>`
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${NOTR_GRI}"/>
<g font-family="Sora" font-weight="800" font-size="${punto}" fill="#000000">${etiketler}</g>
${imzaSvg(imza, w)}
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
  h = 1440,
  imza = ''
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
${imza ? `<text x="${Math.round(w * 0.06)}" y="${Math.round(w * 0.0835)}" font-family="Sora" font-weight="800" font-size="${Math.round(w * 0.028)}" fill="#FFFFFF" fill-opacity="0.85">${kacis(temizle(imza))}</text>` : ''}
</svg>`;
  return ciz(svg, w);
}

function base64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

// ─────────────────────────────────────────────
// Meme ve ürün kartları (13 Ekim gece, Şevval: "Halk Ekmek gibi kısa, günlük
// hayattan; araya doğal ürün yerleştirme").
// ─────────────────────────────────────────────

const LACIVERT = '#0000A8';

/**
 * Meme kartı: üstte beyaz bant + siyah büyük yazı (meme sayfası dili), altında
 * fotoğraf. Şakayı yazı taşır; fotoğraf sahneyi destekler.
 */
export async function memeKarti(
  gorsel: ArrayBuffer,
  mime: string,
  metin: string,
  sira: number,
  toplam: number,
  w = 1080,
  h = 1440,
  imza = ''
): Promise<Uint8Array> {
  const punto = Math.round(w * 0.058);
  const satirlar = metin ? satirla(metin, punto, w * 0.86) : [];
  const aralik = Math.round(punto * 1.25);
  const pad = Math.round(w * 0.05);
  const bant = satirlar.length ? pad * 2 + aralik * satirlar.length - (aralik - punto) : 0;
  const metinler = satirlar
    .map((s, i) => `<text x="${w / 2}" y="${pad + punto * 0.86 + i * aralik}" text-anchor="middle">${kacis(s)}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#FFFFFF"/>
<image x="0" y="${bant}" width="${w}" height="${h - bant}" preserveAspectRatio="xMidYMid slice" xlink:href="data:${mime};base64,${base64(gorsel)}"/>
<g font-family="Sora" font-weight="800" font-size="${punto}" fill="#111111">${metinler}</g>
${toplam > 1 ? `<text x="${w - pad}" y="${h - pad * 0.7}" text-anchor="end" font-family="Sora" font-weight="800" font-size="${Math.round(w * 0.026)}" fill="#FFFFFF" fill-opacity="0.9">${sira}/${toplam}</text>` : ''}
${imza ? `<text x="${pad}" y="${h - pad * 0.7}" font-family="Sora" font-weight="800" font-size="${Math.round(w * 0.026)}" fill="#FFFFFF" fill-opacity="0.9">${kacis(temizle(imza))}</text>` : ''}
</svg>`;
  return ciz(svg, w);
}

/**
 * Ürün kartı: lacivert zemin, üstte yazı, ortada telefon çerçevesinde GERÇEK
 * uygulama ekranı (kütüphaneden). Ekran yoksa yalnız logo + yazı ("marka").
 */
export async function urunKarti(
  ekran: { veri: ArrayBuffer; mime: string } | null,
  metin: string,
  w = 1080,
  h = 1440,
  imza = ''
): Promise<Uint8Array> {
  const punto = Math.round(w * (ekran ? 0.052 : 0.07));
  const satirlar = metin ? satirla(metin, punto, w * 0.84) : [];
  const aralik = Math.round(punto * 1.25);
  const ust = Math.round(h * 0.09);
  const metinler = satirlar
    .map((s, i) => `<text x="${w / 2}" y="${ust + punto + i * aralik}" text-anchor="middle">${kacis(s)}</text>`)
    .join('');
  let govde = '';
  if (ekran) {
    // Telefon: ekran görüntüsü 9:19.5 kabul; kartın kalan yüksekliğine sığdır.
    const tepe = ust + aralik * satirlar.length + Math.round(h * 0.04);
    const ph = h - tepe + Math.round(h * 0.12); // alttan taşsın: kart dışına kayan telefon
    const pw = Math.round(ph / 2.05);
    const px = (w - pw) / 2;
    const r = Math.round(pw * 0.12);
    govde = `<defs><clipPath id="ekran"><rect x="${px + 14}" y="${tepe + 14}" width="${pw - 28}" height="${ph - 28}" rx="${r - 10}"/></clipPath></defs>
<rect x="${px}" y="${tepe}" width="${pw}" height="${ph}" rx="${r}" fill="#0B0B12"/>
<image x="${px + 14}" y="${tepe + 14}" width="${pw - 28}" height="${ph - 28}" preserveAspectRatio="xMidYMin slice" clip-path="url(#ekran)" xlink:href="data:${ekran.mime};base64,${base64(ekran.veri)}"/>`;
  } else {
    // Marka kartı: ortada beyaz logo.
    const lw = Math.round(w * 0.42);
    const lh = Math.round(lw * 0.67);
    govde = `<defs><filter id="beyaz"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter></defs>
<image x="${(w - lw) / 2}" y="${Math.round(h * 0.52)}" width="${lw}" height="${lh}" filter="url(#beyaz)" xlink:href="data:image/png;base64,${base64(logo)}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${LACIVERT}"/>
<g font-family="Sora" font-weight="800" font-size="${punto}" fill="#FFFFFF">${metinler}</g>
${govde}
${imza ? `<text x="${w / 2}" y="${h - Math.round(h * 0.035)}" text-anchor="middle" font-family="Sora" font-weight="800" font-size="${Math.round(w * 0.028)}" fill="#FFFFFF" fill-opacity="${ekran ? 0 : 0.85}">${kacis(temizle(imza))}</text>` : ''}
</svg>`;
  return ciz(svg, w);
}
