// Prodüksiyon Stüdyosu (v2 Faz 3, 13 Ekim) — çekim planından PAYLAŞILMAYA
// HAZIR 9:16 reel.
//
//   anahtar kareler  fal-ai/flux-pro/v1.1-ultra (9:16)
//   klipler          hero: fal-ai/veo3.1/fast/image-to-video (1080p, sesli)
//                    diğer: fal-ai/kling-video/v2.5-turbo/pro/image-to-video (5 sn)
//   seslendirme      fal-ai/elevenlabs/tts/eleven-v3 (language_code: tr) — formata göre
//   müzik            fal-ai/elevenlabs/music (sözsüz, reel boyu)
//   montaj           fal-ai/ffmpeg-api/compose (zaman çizelgesi, ms)
//   altyazı          fal-ai/auto-caption — yalnız seslendirme varsa
//
// Fiyatlar (fal model sayfaları, 13 Ekim): Veo 3.1 Fast 1080p sesli $0.15/sn
// (sessiz $0.10), ElevenLabs TTS $0.10/1000 karakter, compose $0.0002/sn.
// Kling 2.5 turbo pro ~$0.35/5 sn, Flux Ultra ~$0.06/kare, müzik ~$0.2
// (sayfada yok, temkinli tahmin).
//
// ⚠️ BÜTÇE: fal kredisi 50$ (hackathon). Her reel önce `maliyetTahmini`'nden
//    geçer; günlük tavan (FAL_GUNLUK_TAVAN) aşılacaksa önce hero Kling'e
//    düşer, yine aşılıyorsa reel üretilmez. Harcama defterine yazılır.
//
// ⚠️ compose'ta SES SEVİYESİ YOK: seslendirme + müzik birlikteyse müzik
//    "quiet, sparse, background" istenir; hero Veo sesi seslendirmeyle
//    çakışmasın diye seslendirmeli reelde Veo sessiz üretilir.

import type { Env } from './tipler';
import { metin, sayi } from './yardimci';

export type Cekim = {
  sira: number;
  /** Veo: 4 | 6 | 8; Kling: 5 */
  sure_sn: number;
  /** Anahtar kare, İngilizce, sahnenin donmuş hâli */
  kare_prompt: string;
  /** Hareket: kamera + eylem, İngilizce */
  hareket_prompt: string;
  hero: boolean;
  /** Türkçe ekran yazısı (görüntüye gömülmez; panelde ve paylaşırken) */
  ekran_yazisi?: string;
};

export type CekimPlani = {
  cekimler: Cekim[];
  /** Tüm karelere eklenen ortak görsel dil (ışık, renk, lens, karakter) */
  stil: string;
  /** Türkçe anlatım; yoksa null (format seslendirmesizse) */
  seslendirme: string | null;
  /** İngilizce müzik tarifi; yoksa null (Veo sesi yeter / trend ses paylaşırken) */
  muzik: string | null;
};

// ⚠️ PLAKA / TABELA (13 Ekim ilk reel): "no readable license plates" yetmedi,
//    son karede sarı plakanın parçası okunuyordu; arka planda kafe tabelası
//    vardı. Plaka kadraj dışında ya da boş, tabelalar yazısız/bulanık.
// ⚠️ 13 Eki kimlik testi: "no readable plates/text" yazmak plakayı ve
//    tabelayı kareye SOKUYOR (MILKVERKÉU CAFÉ, "10778"). Olumlu tarif:
//    motor önden/yandan (Türkiye'de ön plaka yok), düz tenteli cephe.
const KURALLAR =
  'photorealistic, cinematic, natural motion, clean frame free of typography and watermarks, ' +
  'motorcycles seen from the front or the side, plain unbranded bikes, plain unsigned storefronts with blank awnings, ' +
  'riders wearing closed full-face helmets with visors down, calm safe riding';

/**
 * Marka görsel kimliği (brands.veri.gorsel_kimlik) → her kareye eklenen
 * İngilizce ek. Kreatif direktörün `stil`'i sahneye özgü; bu ek ise bütün
 * içeriklerde aynı: palet, ışık, lens, renk ve "asla" listesi. Böylece
 * farklı günlerin reelleri tek bir hesabın işi gibi görünüyor.
 */
export function gorselKimlikEki(marka: any): string {
  const k = marka?.gorsel_kimlik;
  if (!k) return '';
  // ⚠️ asla_en prompta GİRMEZ: flux'ta negatif prompt yok, "alcohol, crash,
  //    children" gibi kelimeler kareye sızıyor ve güvenlik filtresi kareyi
  //    simsiyah döndürüyor (13 Eki testi). Yasaklar stil_eki'de olumlu tarif.
  return metin(k.stil_eki);
}

const FIYAT = {
  kare: 0.06,
  klingKlip: 0.35,
  veoSn: (sesli: boolean) => (sesli ? 0.15 : 0.1),
  ttsKarakter: 0.0001,
  muzik: 0.2,
  composeSn: 0.0002,
  altyazi: 0.05,
};

/**
 * ⚠️ 13 Eki stok: defter 31$ derken fal bakiyesi ~45$ düştü (Veo 1080p,
 *    Kling, compose yeniden denemeleri). Tahmin gerçeğe bu katsayıyla
 *    yaklaştırılıyor; tavan böylece gerçek harcamayı tutuyor.
 */
const GERCEK_KATSAYI = 1.45;

/** Plan için tahmini fal maliyeti (USD). */
export function maliyetTahmini(plan: CekimPlani, heroVeo = true, katsayi = GERCEK_KATSAYI): number {
  const veoSesli = !plan.seslendirme;
  const toplamSn = plan.cekimler.reduce((t, c) => t + c.sure_sn, 0);
  let usd = plan.cekimler.length * FIYAT.kare;
  for (const c of plan.cekimler) usd += c.hero && heroVeo ? c.sure_sn * FIYAT.veoSn(veoSesli) : FIYAT.klingKlip;
  if (plan.seslendirme) usd += plan.seslendirme.length * FIYAT.ttsKarakter + FIYAT.altyazi;
  if (plan.muzik) usd += FIYAT.muzik;
  usd += toplamSn * FIYAT.composeSn;
  return Math.round(usd * katsayi * 100) / 100;
}

async function falSenkron(env: Env, model: string, girdi: unknown): Promise<any> {
  const y = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(girdi),
  });
  if (!y.ok) throw new Error(`fal ${model} ${y.status}: ${(await y.text()).slice(0, 200)}`);
  return y.json();
}

export type KuyrukIsi = { model: string; durumUrl: string; sonucUrl: string };

async function falKuyruk(env: Env, model: string, girdi: unknown): Promise<KuyrukIsi> {
  const y = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(girdi),
  });
  if (!y.ok) throw new Error(`fal kuyruk ${model} ${y.status}: ${(await y.text()).slice(0, 200)}`);
  const v: any = await y.json();
  return { model, durumUrl: v.status_url, sonucUrl: v.response_url };
}

/** null: sürüyor · obje: bitti (sonuç gövdesi) · hata fırlatır */
export async function kuyrukYokla(env: Env, is: KuyrukIsi): Promise<any | null> {
  const h = { Authorization: `Key ${env.FAL_KEY}` };
  const d: any = await (await fetch(is.durumUrl, { headers: h })).json();
  if (d?.status === 'COMPLETED') return (await fetch(is.sonucUrl, { headers: h })).json();
  if (d?.status === 'FAILED' || d?.error) throw new Error(`fal ${is.model} başarısız`);
  return null;
}

/** 1) Anahtar kare (9:16). Senkron, saniyeler. */
export async function kareUret(env: Env, c: Cekim, stil: string, ek = ''): Promise<string> {
  const v = await falSenkron(env, 'fal-ai/flux-pro/v1.1-ultra', {
    prompt: `${c.kare_prompt}. ${stil}. ${ek ? `${ek}. ` : ''}${KURALLAR}`,
    aspect_ratio: '9:16',
    num_images: 1,
    output_format: 'jpeg',
    safety_tolerance: '2',
    raw: false,
  });
  const url = metin(v?.images?.[0]?.url);
  if (!url) throw new Error('kare adresi yok');
  return url;
}

/**
 * Carousel kartı / rota görseli: Flux Ultra, 3:4. Instagram 2025'ten beri
 * ızgarada 3:4 gösteriyor (1080×1440); 4:5 kart kenarlardan kırpılıyordu.
 * Prompt sahnePromptu ile hazır gelir (stil + kimlik + kurallar).
 */
export async function kartUret(env: Env, prompt: string): Promise<string> {
  const v = await falSenkron(env, 'fal-ai/flux-pro/v1.1-ultra', {
    prompt,
    aspect_ratio: '3:4',
    num_images: 1,
    output_format: 'jpeg',
    safety_tolerance: '2',
    raw: false,
  });
  const url = metin(v?.images?.[0]?.url);
  if (!url) throw new Error('kart adresi yok');
  return url;
}

/**
 * GÖRSEL DENETİM (13 Eki akşam). Kural promptu flux'u tam durduramıyor:
 * carousel'de "CHERE STOTE" tabelası, arka planda kasksız yüz çıktı. Her
 * kareye bir görü modeli bakıyor (fal → OpenRouter, ~0,0005$); kusurluysa
 * kare bir kez yeniden üretiliyor. İkincisi de kusurluysa daha az kusurlu
 * olan kalıyor (üretim durmasın), sorun günlüğe yazılıyor.
 */
export type Denetim = { temiz: boolean; sorunlar: string[] };

const DENETIM_PROMPTU = `You inspect AI-generated images for a motorcycle brand's TikTok/Instagram, viewed full-screen on a phone.
Flag ONLY defects a normal viewer would clearly notice at phone size. Ignore tiny, blurry, partial or ambiguous marks.
Defects:
1. A legible word or number a viewer can actually read: shop sign, street sign, license plate characters, screen text, big printed text. Gibberish that is clearly readable as letters ALSO counts.
2. A clearly visible human face (eyes/nose/mouth recognizable). Closed-visor helmets, backs of heads, tiny distant people are fine.
3. Someone riding or sitting on a motorcycle without a helmet.
4. A clearly readable brand name or famous logo (e.g. Honda wordmark). Small emblems or abstract shapes are fine.
5. Obviously deformed motorcycles (wrong number of wheels, melted parts) or people (extra limbs).
6. Children, alcohol, cigarettes, weapons, flags.
Reply with ONLY this JSON, no markdown: {"temiz": true|false, "sorunlar": ["short English description"]}`;

export async function kareDenetle(env: Env, url: string, model: string): Promise<Denetim> {
  try {
    const v = await falSenkron(env, 'openrouter/router/vision', {
      model,
      prompt: 'Inspect this image.',
      system_prompt: DENETIM_PROMPTU,
      image_urls: [url],
      temperature: 0,
      max_tokens: 200,
    });
    const m = metin(v?.output).match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : null;
    if (!j || typeof j.temiz !== 'boolean') return { temiz: true, sorunlar: [] }; // denetçi bozuksa üretimi durdurma
    return { temiz: j.temiz, sorunlar: Array.isArray(j.sorunlar) ? j.sorunlar.map(String).slice(0, 6) : [] };
  } catch {
    return { temiz: true, sorunlar: [] };
  }
}

/** Üret → denetle → kusurluysa bir kez daha üret. */
export async function denetliUret(
  env: Env,
  uret: (ek: string) => Promise<string>,
  denetim: { acik: boolean; model: string }
): Promise<{ url: string; denetim: Denetim | null; deneme: number }> {
  const ilk = await uret('');
  if (!denetim.acik) return { url: ilk, denetim: null, deneme: 1 };
  const d1 = await kareDenetle(env, ilk, denetim.model);
  if (d1.temiz) return { url: ilk, denetim: d1, deneme: 1 };
  // Sorunu olumlu tarifle düzelt (olumsuz kelime yazmadan).
  const ek = 'Every surface plain and blank, storefront awnings plain fabric, all riders in closed full-face helmets with dark visors down, background people far and out of focus';
  const ikinci = await uret(ek);
  const d2 = await kareDenetle(env, ikinci, denetim.model);
  if (d2.temiz || d2.sorunlar.length <= d1.sorunlar.length) return { url: ikinci, denetim: d2, deneme: 2 };
  return { url: ilk, denetim: d1, deneme: 2 };
}

/** 2) Klip kuyruğa. Hero → Veo 3.1 Fast (seslendirme yoksa sesli); diğer → Kling. */
export async function klipBaslat(env: Env, c: Cekim, kare: string, heroVeo: boolean, seslendirmeVar: boolean): Promise<KuyrukIsi> {
  const prompt = `${c.hareket_prompt}. Smooth cinematic camera motion, realistic physics, stable motorcycle geometry. ${KURALLAR}`;
  if (c.hero && heroVeo) {
    const sure = c.sure_sn >= 8 ? '8s' : c.sure_sn >= 6 ? '6s' : '4s';
    return falKuyruk(env, 'fal-ai/veo3.1/fast/image-to-video', {
      prompt,
      image_url: kare,
      aspect_ratio: '9:16',
      duration: sure,
      resolution: '1080p',
      generate_audio: !seslendirmeVar,
      negative_prompt: 'text, letters, license plate characters, readable signage, watermark, logo, face, crash, wheelie, distorted motorcycle, extra wheels',
      safety_tolerance: '2',
    });
  }
  return falKuyruk(env, 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', {
    prompt,
    image_url: kare,
    duration: '5',
    negative_prompt: 'text, letters, license plate characters, readable signage, watermark, logo, face, crash, wheelie, distorted motorcycle, extra wheels, blur, low quality',
    cfg_scale: 0.5,
  });
}

export function klipAdresi(sonuc: any): string {
  const url = metin(sonuc?.video?.url);
  if (!url) throw new Error('klip adresi yok');
  return url;
}

/** 3) Türkçe seslendirme. Ses adı FAL_SES (varsayılan "Brian": tok, sakin anlatıcı). */
export async function seslendir(env: Env, metinTr: string, ses?: string): Promise<string> {
  const v = await falSenkron(env, 'fal-ai/elevenlabs/tts/eleven-v3', {
    text: metinTr.slice(0, 900),
    voice: ses || env.FAL_SES || 'Brian',
    language_code: 'tr',
    stability: 0.5,
    apply_text_normalization: 'auto',
  });
  const url = metin(v?.audio?.url);
  if (!url) throw new Error('ses adresi yok');
  return url;
}

/** 4) Müzik (sözsüz). Seslendirme varsa arka planda kalacak tarzda istenir. */
export async function muzikBaslat(env: Env, tarif: string, sureMs: number, seslendirmeVar: boolean): Promise<KuyrukIsi> {
  return falKuyruk(env, 'fal-ai/elevenlabs/music', {
    prompt: seslendirmeVar ? `${tarif}. Quiet, sparse, low-energy background bed under a voiceover, no vocals.` : `${tarif}. No vocals.`,
    music_length_ms: Math.max(3000, Math.min(60000, sureMs)),
    force_instrumental: true,
  });
}

export function sesAdresi(sonuc: any): string {
  const url = metin(sonuc?.audio?.url ?? sonuc?.audio_file?.url);
  if (!url) throw new Error('müzik adresi yok');
  return url;
}

/** 5) Montaj: klipler sırayla, üstüne seslendirme (300 ms gecikmeli) ve müzik. */
export async function montajBaslat(
  env: Env,
  klipler: { url: string; sureMs: number }[],
  ses: string | null,
  muzik: string | null
): Promise<KuyrukIsi> {
  let t = 0;
  const video = klipler.map((k) => {
    const kf = { url: k.url, timestamp: t, duration: k.sureMs };
    t += k.sureMs;
    return kf;
  });
  const tracks: any[] = [{ id: 'video', type: 'video', keyframes: video }];
  if (ses) tracks.push({ id: 'ses', type: 'audio', keyframes: [{ url: ses, timestamp: 300, duration: Math.max(1000, t - 300) }] });
  if (muzik) tracks.push({ id: 'muzik', type: 'audio', keyframes: [{ url: muzik, timestamp: 0, duration: t }] });
  return falKuyruk(env, 'fal-ai/ffmpeg-api/compose', { tracks });
}

/** Bayt → fal deposu (herkese açık adres; compose ve modeller okuyabilsin). */
export async function falaYukle(env: Env, veri: Uint8Array | ArrayBuffer, mime: string, ad: string): Promise<string> {
  const i = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST',
    headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: mime, file_name: ad }),
  });
  if (!i.ok) throw new Error(`fal depo ${i.status}: ${(await i.text()).slice(0, 160)}`);
  const j: any = await i.json();
  const p = await fetch(j.upload_url, { method: 'PUT', headers: { 'Content-Type': mime }, body: veri });
  if (!p.ok) throw new Error(`fal depo yükleme ${p.status}`);
  return metin(j.file_url);
}

export type YaziAraligi = { basMs: number; bitMs: number; metin: string };

/**
 * Ekran yazısı aralıkları: her çekimin yazısı o çekim süresince. Aynı yazı
 * art arda sahnelerde sürüyorsa tek aralık. Seslendirmeli reelde altyazı
 * zaten konuşmayı yazıyor; orada yalnız kanca (ilk sahne).
 */
export function yaziAraliklari(plan: CekimPlani, sureler: number[]): YaziAraligi[] {
  const out: YaziAraligi[] = [];
  let t = 0;
  plan.cekimler.forEach((c, i) => {
    const bas = t;
    t += sureler[i];
    const yazi = (c.ekran_yazisi ?? '').trim();
    if (!yazi || (plan.seslendirme && i > 0)) return;
    const son = out[out.length - 1];
    if (son && son.metin === yazi && son.bitMs === bas) son.bitMs = t;
    else out.push({ basMs: bas, bitMs: t, metin: yazi });
  });
  return out;
}

/**
 * Yazı gömme üç fal adımı (hepsi ffmpeg, kuruşluk):
 *   1) levhalardan zaman çizelgesi videosu (images-to-video, 30 fps)
 *   2) reel + çizelge, hardlight karışım (blend-video)
 *   3) orijinal ses geri (merge-audio-video; karışım sesi taşımıyor olabilir)
 */
export const YAZI_FPS = 30;

export function yaziCizelgesiBaslat(env: Env, kareler: { url: string; frames: number }[]): Promise<KuyrukIsi> {
  return falKuyruk(env, 'fal-ai/ffmpeg-api/images-to-video', { fps: YAZI_FPS, images: kareler });
}

export function yaziKaristirBaslat(env: Env, videoUrl: string, cizelgeUrl: string): Promise<KuyrukIsi> {
  return falKuyruk(env, 'fal-ai/workflow-utilities/blend-video', {
    bottom_video_url: videoUrl,
    top_video_url: cizelgeUrl,
    blend_mode: 'hardlight',
    opacity: 1,
    shortest: true,
  });
}

export function sesGeriBaslat(env: Env, videoUrl: string, sesUrl: string): Promise<KuyrukIsi> {
  return falKuyruk(env, 'fal-ai/ffmpeg-api/merge-audio-video', { video_url: videoUrl, audio_url: sesUrl });
}

export function videoAdresi(sonuc: any): string {
  const url = metin(sonuc?.video?.url ?? sonuc?.video_url);
  if (!url) throw new Error(`video adresi yok: ${JSON.stringify(sonuc).slice(0, 160)}`);
  return url;
}

export function montajAdresi(sonuc: any): string {
  const url = metin(sonuc?.video_url);
  if (!url) throw new Error('montaj adresi yok');
  return url;
}

/** 6) Altyazı (yalnız seslendirmeli reel): kalın beyaz, alt üçte bir. */
export async function altyaziBaslat(env: Env, videoUrl: string): Promise<KuyrukIsi> {
  return falKuyruk(env, 'fal-ai/auto-caption', {
    video_url: videoUrl,
    txt_color: 'white',
    txt_font: 'Standard',
    font_size: 46,
    stroke_width: 3,
    top_align: 'bottom',
    left_align: 'center',
    refresh_interval: 1.2,
    text_case: 'default',
  });
}

export function altyaziAdresi(sonuc: any): string {
  const url = metin(sonuc?.video_url ?? sonuc?.video?.url);
  if (!url) throw new Error('altyazılı video adresi yok');
  return url;
}

/** Bugünkü fal harcaması (defterden) — bütçe bekçisi. */
export async function bugunkuFal(env: Env, bugun: string): Promise<number> {
  const r = await env.DB.prepare("SELECT COALESCE(SUM(tutar_usd), 0) AS t FROM harcamalar WHERE servis = 'fal' AND zaman >= ?")
    .bind(bugun).first<{ t: number }>();
  return sayi(r?.t);
}
