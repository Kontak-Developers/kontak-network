// Küçük ortak yardımcılar.

/** İstanbul saatiyle ISO (Türkiye'de yaz saati yok, sabit +03:00). */
export function simdiIst(d = new Date()): string {
  const t = new Date(d.getTime() + 3 * 3600_000);
  return t.toISOString().replace(/\.\d{3}Z$/, '+03:00');
}

/** run_2026-10-12_0800 biçiminde, İstanbul saatiyle. */
export function runIdUret(d = new Date()): string {
  const t = new Date(d.getTime() + 3 * 3600_000).toISOString();
  return `run_${t.slice(0, 10)}_${t.slice(11, 13)}${t.slice(14, 16)}`;
}

export function kisaId(onek: string): string {
  return `${onek}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

/** İstanbul saatiyle pazartesi mi. */
export function pazartesiMi(d = new Date()): boolean {
  return new Date(d.getTime() + 3 * 3600_000).getUTCDay() === 1;
}

/** ISO hafta: 2026-W42 */
export function isoHafta(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const gun = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - gun);
  const yilBasi = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const hafta = Math.ceil(((t.getTime() - yilBasi.getTime()) / 86400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(hafta).padStart(2, '0')}`;
}

export function json(veri: unknown, status = 200): Response {
  return new Response(JSON.stringify(veri), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function hata(kod: string, mesaj: string, status: number): Response {
  return json({ hata: { kod, mesaj } }, status);
}

export function jsonAc<T>(metin: string | null | undefined, varsayilan: T): T {
  if (!metin) return varsayilan;
  try {
    return JSON.parse(metin) as T;
  } catch {
    return varsayilan;
  }
}

/** Model metninden ilk JSON nesnesini/dizisini çıkarır (```json bloklarını da). */
export function jsonCikar(metin: string): unknown {
  const blok = metin.match(/```(?:json)?\s*([\s\S]*?)```/);
  const aday = blok ? blok[1] : metin;
  const bas = aday.search(/[[{]/);
  if (bas < 0) throw new Error('Yanıtta JSON yok');
  const kapanis = aday[bas] === '{' ? '}' : ']';
  const son = aday.lastIndexOf(kapanis);
  return JSON.parse(aday.slice(bas, son + 1));
}

export function dizi<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function metin(v: unknown, varsayilan = ''): string {
  return typeof v === 'string' ? v : v == null ? varsayilan : String(v);
}

export function sayi(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function sinirla(n: number, alt: number, ust: number): number {
  return Math.max(alt, Math.min(ust, n));
}

export function hataMetni(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
