// Ajan beyni: tek arayüz, iki sağlayıcı.
//
//   MANUS_API_KEY varsa → Manus API v2 (asenkron görev; şef Manus, jüri kriteri)
//   yoksa ya da Manus düşerse → Cloudflare Workers AI (anahtarsız yedek)
//
// Manus görevi dakikalar sürebilir. Bu yüzden iki aşamalı: brainBaslat()
// görevi açar, Workflow step.sleep ile bekleyip brainYokla() çağırır.
// Tek step.do içinde beklenseydi step süre sınırına takılırdı.
//
// Çıktı her iki sağlayıcıda da aynı JSON şemasına zorlanır:
// Manus'ta structured_output_schema, Workers AI'da response_format.

import type { Env } from './tipler';
import { jsonCikar } from './yardimci';
import { PROMPTLAR } from './promptlar.gen';

export type PromptAdi = 'analiz' | 'uretim' | 'haftalik';

// ─────────────────────────────────────────────
// Şemalar. Manus kuralı: her nesnede additionalProperties:false ve
// required TÜM alanlar; isteğe bağlı alan ["tip","null"].
// minItems/pattern gibi kısıtlar Manus'ta 400 döndürüyor, kullanılmadı.
// ─────────────────────────────────────────────
const S = { type: 'string' } as const;
const SN = { type: ['string', 'null'] } as const;
const N = { type: 'number' } as const;
const SD = { type: 'array', items: S } as const;
const nesne = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const PLATFORM2 = { type: 'string', enum: ['tiktok', 'instagram'] };

export const SEMALAR: Record<PromptAdi, Record<string, unknown>> = {
  analiz: nesne({
    ozet: { ...S, description: 'Günün gündemi, tek cümle, Türkçe' },
    trendler: {
      type: 'array',
      items: nesne({
        tip: { type: 'string', enum: ['konu', 'ses', 'format', 'hashtag'] },
        baslik: S,
        aciklama: S,
        platform: { type: 'string', enum: ['tiktok', 'instagram', 'ikisi'] },
        ivme: { ...N, description: '0-100; girdideki ivme sayılarına dayan' },
        ornek_linkler: { ...SD, description: 'Yalnız girdide geçen linkler' },
      }),
    },
    takip: {
      type: 'array',
      description: 'Takip listesi kararları. Bütçe: en fazla 8 aktif + 3 deneme.',
      items: nesne({
        etiket: { ...S, description: '# olmadan, küçük harf' },
        platform: PLATFORM2,
        karar: { type: 'string', enum: ['ekle', 'kalici', 'cikar'] },
        neden: S,
      }),
    },
  }),
  uretim: nesne({
    seriler: {
      type: 'array',
      description: 'Yalnız YENİ açılacak seriler. Var olan seriye bölüm eklemek için fikirde seri alanını kullan.',
      items: nesne({
        ad: S,
        aciklama: S,
        format: { type: 'string', enum: ['kisa_video', 'carousel', 'gonderi'] },
        planlanan_bolumler: SD,
        neden: S,
      }),
    },
    fikirler: {
      type: 'array',
      description: 'Tam 3 içerik fikri',
      items: nesne({
        trend_id: { ...S, description: 'Girdideki gündem maddesinin id alanı' },
        seri: { ...SN, description: 'Var olan serinin id alanı ya da yeni açılan serinin adı; seri dışıysa null' },
        bolum_no: { type: ['number', 'null'] },
        bolum_adi: SN,
        platform: PLATFORM2,
        format: { type: 'string', enum: ['kisa_video', 'carousel', 'gonderi'] },
        baslik: S,
        kanca: S,
        senaryo: SD,
        aciklama_metni: S,
        hashtagler: SD,
        gorsel_prompt: { ...S, description: 'fal.ai için İngilizce, dikey 1080x1350, görsel kurallara uygun' },
        sahneler: {
          type: 'array',
          items: nesne({
            sira: N,
            sure_sn: N,
            tur: {
              type: 'string',
              enum: ['foto', 'video', 'tasarim'],
              description: 'foto: fal.ai fotoğraf · video: fotoğraftan 5 sn klip · tasarim: uygulamanın tasarım dilinde kart (görsel üretilmez)',
            },
            prompt: { ...S, description: 'foto/video için İngilizce kare tarifi; tasarim için boş string' },
            ekran_yazisi: S,
            // ⚠️ tasarim alanları DÜZ ve dizisiz: iç içe nesne/dizi Manus'ta 400 verdi
            // (derinlik sınırı, 12 Ekim). Workflow kaydederken tasarim nesnesine toplar.
            tasarim_sablon: { type: 'string', enum: ['yok', 'rota', 'liste', 'metin', 'karsilastirma', 'soru'], description: 'tur tasarim değilse yok' },
            tasarim_baslik: S,
            tasarim_alt_baslik: S,
            // Dizi DEĞİL, satır satır metin: sahne içindeki dizi Manus derinlik sınırını aşıyor (400).
            tasarim_maddeler: {
              ...S,
              description: 'Her madde ayrı satırda (\\n). liste: maddeler · karsilastirma: sol başlık, sol maddeler, "|" satırı, sağ başlık, sağ maddeler · soru: seçenekler · yoksa boş string',
            },
            tasarim_rota_id: { ...S, description: 'rota şablonunda uygulama_rotalari içindeki id; yoksa boş string' },
          }),
        },
        // anyOf(nesne | null) Manus'ta 400 verdi (12 Ekim); rota hep nesne,
        // rota yoksa ad boş string ve duraklar boş dizi.
        rota: nesne({ ad: { ...S, description: 'Rota yoksa boş string' }, km: N, duraklar: SD }),
        onerilen_ses: SN,
      }),
    },
  }),
  haftalik: nesne({
    ozet: S,
    kalici: { type: 'array', items: nesne({ baslik: S, ivme: N }) },
    yukselen: { type: 'array', items: nesne({ baslik: S, ivme: N }) },
    sonen: { type: 'array', items: nesne({ baslik: S, ivme: N }) },
    onerilen_odak: SD,
  }),
};

// Nida'nın prompts/*.md dosyası yoksa bunlar kullanılır.
const VARSAYILAN: Record<PromptAdi, string> = {
  analiz: `Sen Kontak'ın sosyal medya ajanısın. Kontak, Türkiye'de motosiklet kültürü üzerine kurulu tanışma ve topluluk uygulaması.
Girdi: marka profili, takip listesi, son 48 saatin en güçlü TikTok/Instagram gönderileri ve her hashtag/ses için ivme puanı (0-100; 50 durağan, 75 iki kat büyüme, 100 dört kat).
Görev:
1) Günün gündemini çıkar: 4-8 madde (konu, ses, format, hashtag). Popüler ama durağan olanı değil, YÜKSELENİ seç; ivme puanına dayan, uydurma. ornek_linkler yalnız girdideki linklerden.
2) Takip listesini yönet: yükselen gönderilerde sık geçen yeni etiketi "ekle" (denemeye alınır), birkaç gündür güçlü denemeyi "kalici" yap, verimsiz olanı "cikar". "sabit" ve "yasak" durumundakilere dokunma. Bütçe: en fazla 8 aktif + 3 deneme. Marka sınırlarındaki yasak konulara giren etiketi asla ekleme.
3) Tek cümlelik Türkçe özet yaz.
Yalnız şemaya uygun JSON döndür.`,
  uretim: `Sen Kontak'ın içerik şefisin. Girdi: marka profili (ton kuralları, sütun oranları, sınırlar), bugünün gündemi ve aktif seriler.
Görev: Kontak'a uygun TAM 3 içerik fikri üret. Tek tek gönderi değil seri düşün: uygunsa var olan serinin sıradaki bölümünü planla ya da gündeme dayanan yeni bir seri aç (seriler alanında).
Her fikir: gündemden bir trend_id'ye dayansın, ilk 2 saniyelik kanca, sahne sahne senaryo, paylaşım açıklaması, hashtagler, fal.ai için İngilizce görsel promptu.
Kurallar: ton kurallarına ve sütun oranlarına uy; marka sınırlarındaki görsel kurallara harfiyen uy (yüzü görünen gerçekçi insan yok, güvensiz sürüş yok, logo/plaka yok, görselin içine yazı yok). Rota önerirsen gerçek yerler kullan, km'yi uydurma. Vurgu rengi lacivert #0000A8.
Yalnız şemaya uygun JSON döndür.`,
  haftalik: `Sen Kontak'ın sosyal medya ajanısın. Girdi: son 7 günün gündem listeleri (her biri ivme puanıyla).
Görev: haftalık özet. kalici: hafta boyu güçlü kalanlar; yukselen: haftanın sonuna doğru hızlananlar; sonen: düşenler. onerilen_odak: bu hafta için 2-4 somut, uygulanabilir öneri. ozet tek cümle.
Yalnız şemaya uygun JSON döndür.`,
};

export function promptMetni(ad: PromptAdi): string {
  const dosya = PROMPTLAR[ad];
  return dosya && dosya.trim().length > 40 ? dosya : VARSAYILAN[ad];
}

export type BrainBaslangic =
  | { saglayici: 'manus'; taskId: string; taskUrl: string }
  | { saglayici: 'workersai'; sonuc: unknown };

export type BrainYoklama =
  | { bitti: false }
  | { bitti: true; sonuc: unknown }
  | { bitti: true; hata: string };

/**
 * Manus varsa Manus'u başlatır; HATA FIRLATIR, yedeğe kendisi düşmez.
 *
 * ⚠️ Bir görev bittikten hemen sonra açılan ikinci görev "400
 *    invalid_argument unexpected error from node server" alıyordu
 *    (12 Ekim, analiz → üretim arası). Aynı istek birkaç saniye sonra
 *    geçiyor. Bu yüzden Workflow bu adımı beklemeli yeniden dener,
 *    ancak tükenince Workers AI'ye düşer.
 */
export async function brainBaslat(
  env: Env,
  ad: PromptAdi,
  girdi: unknown,
  baslik: string
): Promise<BrainBaslangic> {
  if (env.MANUS_API_KEY) return manusBaslat(env, ad, girdi, baslik);
  return { saglayici: 'workersai', sonuc: await workersAi(env, ad, girdi) };
}

export async function brainYokla(env: Env, taskId: string): Promise<BrainYoklama> {
  return manusYokla(env, taskId);
}

export async function workersAi(env: Env, ad: PromptAdi, girdi: unknown): Promise<unknown> {
  const sema = SEMALAR[ad];
  const messages = [
    {
      role: 'system',
      content: `${promptMetni(ad)}\n\nÇıktı JSON şeması:\n${JSON.stringify(sema)}`,
    },
    { role: 'user', content: JSON.stringify(girdi) },
  ];
  const model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as const;
  // response_format: json_schema bu büyüklükteki şemada dakikalarca takıldı
  // (12 Ekim yerel deneme). Şema sistem promptunda, JSON metinden ayıklanıyor.
  const y: any = await env.AI.run(model, { messages, max_tokens: 3000, temperature: 0.4 } as any);
  const yanit = y?.response;
  return typeof yanit === 'string' ? jsonCikar(yanit) : yanit;
}

// ─────────────────────────────────────────────
// Manus API v2 — https://open.manus.ai/docs (v1 kullanımdan kalkıyor)
// ─────────────────────────────────────────────
const MANUS = 'https://api.manus.ai/v2';

async function manus(env: Env, yol: string, govde?: unknown): Promise<any> {
  const y = await fetch(MANUS + yol, {
    method: govde ? 'POST' : 'GET',
    headers: { 'x-manus-api-key': env.MANUS_API_KEY!, 'Content-Type': 'application/json' },
    body: govde ? JSON.stringify(govde) : undefined,
  });
  const v: any = await y.json().catch(() => ({}));
  if (!y.ok || v?.ok === false) {
    throw new Error(`Manus ${y.status}: ${v?.error?.code ?? ''} ${v?.error?.message ?? ''}`.trim());
  }
  return v;
}

function base64Utf8(metin: string): string {
  const baytlar = new TextEncoder().encode(metin);
  let ikili = '';
  for (let i = 0; i < baytlar.length; i += 0x8000) {
    ikili += String.fromCharCode(...baytlar.subarray(i, i + 0x8000));
  }
  return btoa(ikili);
}

async function manusBaslat(env: Env, ad: PromptAdi, girdi: unknown, baslik: string): Promise<BrainBaslangic> {
  // Manus metin mesajı ~5000 token sınırlı; veri dosya olarak eklenir.
  const veri = JSON.stringify(girdi);
  const r = await manus(env, '/task.create', {
    message: {
      content: [
        { type: 'text', text: `${promptMetni(ad)}\n\nGirdi ekteki girdi.json dosyasında.` },
        {
          type: 'file',
          file_data: `data:application/json;base64,${base64Utf8(veri)}`,
          filename: 'girdi.json',
          mime_type: 'application/json',
        },
      ],
    },
    agent_profile: env.MANUS_PROFIL || 'standard',
    interactive_mode: false,
    structured_output_schema: SEMALAR[ad],
    title: baslik,
  });
  return { saglayici: 'manus', taskId: r.task_id, taskUrl: r.task_url };
}

async function manusYokla(env: Env, taskId: string): Promise<BrainYoklama> {
  const d = await manus(env, `/task.detail?task_id=${encodeURIComponent(taskId)}`);
  const durum = d?.task?.status as string;
  if (durum === 'error') return { bitti: true, hata: 'Manus görevi hata verdi' };
  if (durum !== 'stopped') return { bitti: false };

  const m = await manus(env, `/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=30`);
  const olaylar: any[] = Array.isArray(m?.messages) ? m.messages : [];

  const yapisal = olaylar.find((o) => o?.type === 'structured_output_result');
  if (yapisal) {
    // Sonuç alındı; görevi kapat ki sıradaki görev açılabilsin (yukarıdaki not).
    await manus(env, '/task.stop', { task_id: taskId }).catch(() => undefined);
    const r = yapisal.structured_output_result;
    return r?.success ? { bitti: true, sonuc: r.value } : { bitti: true, hata: `Manus yapısal çıktı: ${r?.error ?? 'başarısız'}` };
  }
  // Yapısal çıktı çıkarma adımı ayrı çalışıyor; arka plan işi sürüyorsa bekle.
  if (d?.task?.has_running_background_jobs !== false) return { bitti: false };

  // Yedek: son asistan mesajındaki JSON.
  const son = olaylar.find((o) => o?.type === 'assistant_message' && typeof o.assistant_message?.content === 'string');
  if (!son) return { bitti: true, hata: 'Manus çıktı vermedi' };
  try {
    return { bitti: true, sonuc: jsonCikar(son.assistant_message.content) };
  } catch {
    return { bitti: true, hata: 'Manus çıktısı JSON değil' };
  }
}
