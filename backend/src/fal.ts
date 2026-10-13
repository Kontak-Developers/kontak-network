// fal.ai: görsel (eşzamanlı, saniyeler) ve video (kuyruk, dakikalar).
// Üretilen dosya fal'ın geçici adresinden indirilip R2'ye yazılır;
// fal linkleri bir süre sonra ölüyor, panel R2'den okur.
//
// Her sahnenin KENDİ görseli üretilir (carousel'de her kart farklı kare).
// Fikrin gorsel_prompt'u ortak stil olarak her sahneye eklenir: kareler
// farklı ama aynı dünyadan. Kısa videoda her sahne görseli image-to-video
// ile 5 sn'lik gerçek bir klibe dönüşür; panel klipleri sırayla oynatır.

import type { Env } from './tipler';

// Olumlu tarif (bkz. studyo.ts KURALLAR notu): "no plates/text" plakayı kareye sokuyor.
const KURALLAR =
  'photorealistic, high detail, clean frame free of typography and watermarks, ' +
  'motorcycles seen from the front or the side, plain unbranded bikes, plain unsigned storefronts with blank awnings, ' +
  'riders wearing closed full-face helmets with visors down, calm safe riding';

const VIDEO_NEGATIF =
  'text, letters, watermark, logo, distorted motorcycle, extra wheels, melting, morphing, face, crash, wheelie, blur, low quality';

export type Boyut = { width: number; height: number };
export const DIKEY_4_5: Boyut = { width: 1080, height: 1350 };
export const DIKEY_9_16: Boyut = { width: 1080, height: 1920 };

/** Sahne + ortak stil + değişmez kurallar */
export function sahnePromptu(sahne: string, stil: string) {
  const s = sahne.trim() || stil.trim();
  return `${s}. ${stil.trim() ? `Visual style: ${stil.trim()}. ` : ''}${KURALLAR}`;
}

export type Uretilen = { anahtar: string; falUrl: string };

export async function gorselUret(env: Env, prompt: string, anahtar: string, boyut: Boyut = DIKEY_4_5): Promise<Uretilen> {
  const y = await fetch(`https://fal.run/${env.FAL_GORSEL_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: boyut,
      num_images: 1,
      output_format: 'jpeg',
      enable_safety_checker: true,
      safety_tolerance: '2',
    }),
  });
  if (!y.ok) throw new Error(`fal görsel ${y.status}: ${(await y.text()).slice(0, 200)}`);
  const v: any = await y.json();
  const url = v?.images?.[0]?.url;
  if (!url) throw new Error('fal görsel adresi dönmedi');
  return { anahtar: await r2yeYaz(env, url, anahtar), falUrl: url };
}

export type VideoIsi = { durumUrl: string; sonucUrl: string };

/** Sahne görselinden 5 sn'lik klip (image-to-video). Görsel yoksa metinden. */
export async function videoBaslat(env: Env, prompt: string, gorselUrl?: string | null): Promise<VideoIsi> {
  const model = gorselUrl ? env.FAL_VIDEO_MODEL : env.FAL_VIDEO_MODEL.replace('image-to-video', 'text-to-video');
  const govde: Record<string, unknown> = {
    prompt: `${prompt}. Smooth cinematic camera motion, natural realistic movement, stable motorcycle geometry.`,
    duration: '5',
    negative_prompt: VIDEO_NEGATIF,
    cfg_scale: 0.5,
  };
  if (gorselUrl) govde.image_url = gorselUrl;
  else govde.aspect_ratio = '9:16';
  const y = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(govde),
  });
  if (!y.ok) throw new Error(`fal video ${y.status}: ${(await y.text()).slice(0, 200)}`);
  const v: any = await y.json();
  return { durumUrl: v.status_url, sonucUrl: v.response_url };
}

/** null: sürüyor; string: R2 anahtarı */
export async function videoYokla(env: Env, is: VideoIsi, anahtar: string): Promise<string | null> {
  const h = { Authorization: `Key ${env.FAL_KEY}` };
  const d: any = await (await fetch(is.durumUrl, { headers: h })).json();
  if (d?.status !== 'COMPLETED') {
    if (d?.status === 'FAILED' || d?.error) throw new Error('fal video başarısız');
    return null;
  }
  const s: any = await (await fetch(is.sonucUrl, { headers: h })).json();
  const url = s?.video?.url;
  if (!url) throw new Error(`fal video adresi dönmedi: ${JSON.stringify(s).slice(0, 200)}`);
  return r2yeYaz(env, url, anahtar);
}

export async function r2yeYaz(env: Env, url: string, anahtar: string): Promise<string> {
  const d = await fetch(url);
  if (!d.ok) throw new Error(`fal dosyası indirilemedi ${d.status}`);
  // arrayBuffer: R2 uzunluğu bilinmeyen akışı reddediyor (chunked yanıt).
  await env.MEDYA.put(anahtar, await d.arrayBuffer(), {
    httpMetadata: { contentType: d.headers.get('content-type') ?? 'application/octet-stream' },
  });
  return anahtar;
}
