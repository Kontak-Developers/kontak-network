// fal.ai: görsel (eşzamanlı, saniyeler) ve video (kuyruk, dakikalar).
// Üretilen dosya fal'ın geçici adresinden indirilip R2'ye yazılır;
// fal linkleri bir süre sonra ölüyor, panel R2'den okur.

import type { Env } from './tipler';

const GORSEL_EK =
  ', vertical 4:5 composition, no text, no letters, no logos, no readable license plates, no visible faces, riders wear helmets';

export async function gorselUret(env: Env, prompt: string, anahtar: string): Promise<string> {
  const y = await fetch(`https://fal.run/${env.FAL_GORSEL_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt + GORSEL_EK,
      image_size: { width: 1080, height: 1350 },
      num_images: 1,
      enable_safety_checker: true,
    }),
  });
  if (!y.ok) throw new Error(`fal görsel ${y.status}: ${(await y.text()).slice(0, 200)}`);
  const v: any = await y.json();
  const url = v?.images?.[0]?.url;
  if (!url) throw new Error('fal görsel adresi dönmedi');
  return r2yeYaz(env, url, anahtar);
}

export async function videoBaslat(env: Env, prompt: string): Promise<{ durumUrl: string; sonucUrl: string }> {
  const y = await fetch(`https://queue.fal.run/${env.FAL_VIDEO_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt + GORSEL_EK, aspect_ratio: '9:16', duration: '5' }),
  });
  if (!y.ok) throw new Error(`fal video ${y.status}: ${(await y.text()).slice(0, 200)}`);
  const v: any = await y.json();
  return { durumUrl: v.status_url, sonucUrl: v.response_url };
}

/** null: sürüyor; string: R2 anahtarı */
export async function videoYokla(
  env: Env,
  is: { durumUrl: string; sonucUrl: string },
  anahtar: string
): Promise<string | null> {
  const h = { Authorization: `Key ${env.FAL_KEY}` };
  const d: any = await (await fetch(is.durumUrl, { headers: h })).json();
  if (d?.status !== 'COMPLETED') {
    if (d?.status === 'FAILED' || d?.error) throw new Error('fal video başarısız');
    return null;
  }
  const s: any = await (await fetch(is.sonucUrl, { headers: h })).json();
  const url = s?.video?.url;
  if (!url) throw new Error('fal video adresi dönmedi');
  return r2yeYaz(env, url, anahtar);
}

async function r2yeYaz(env: Env, url: string, anahtar: string): Promise<string> {
  const d = await fetch(url);
  if (!d.ok) throw new Error(`fal dosyası indirilemedi ${d.status}`);
  // arrayBuffer: R2 uzunluğu bilinmeyen akışı reddediyor (chunked yanıt).
  await env.MEDYA.put(anahtar, await d.arrayBuffer(), {
    httpMetadata: { contentType: d.headers.get('content-type') ?? 'application/octet-stream' },
  });
  return anahtar;
}
