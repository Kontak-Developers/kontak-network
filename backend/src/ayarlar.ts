// Ajan ayarları (Stüdyo sekmesi, 13 Ekim akşam).
//
// Burak: "AI'ların nelere baktığının, her şeyin ayarlanabilir olması lazım."
// Ajanın her düğmesi burada; varsayılanlar koddaki değerlerle birebir.
// D1'de (ayarlar.anahtar = 'ajan') yalnız panelde değiştirilenler durur,
// okurken varsayılanların üstüne derinlemesine birleşir. Böylece koda yeni
// ayar eklenince eski kayıt bozulmaz.

import type { Env } from './tipler';
import { jsonAc, simdiIst } from './yardimci';

export type AjanAyarlari = {
  av: {
    /** TikTok'ta taranan TR etiketleri (takip listesine ek) */
    tr_etiketler: string[];
    /** TikTok TR araması: etiketsiz videoları da yakalar */
    tr_aramalar: string[];
    /** Dünyadan format ilhamı için aramalar */
    global_aramalar: string[];
    /** TikTok Creative Center Türkiye trendleri */
    creative_center: boolean;
    etiket_basi_video: number;
    arama_basi_video: number;
    /** Kaç günlük video sayılır */
    gun: number;
    /** izlenme ÷ takipçi en az */
    min_patlama: number;
    min_izlenme_tr: number;
    min_izlenme_global: number;
    tr_secim: number;
    global_secim: number;
    hesap_basi: number;
  };
  sok: {
    /** Manus'un izlediği video (Manus en fazla 10 ek görüyor) */
    izlenecek_video: number;
    sure_dk: number;
    /** Elle çalıştırmada bu kadar saat içinde söküm yapıldıysa atla */
    taze_saat: number;
  };
  kreatif: {
    aday: number;
    secim: number;
    min_puan: number;
    /** "2 reel + 1 carousel" gibi */
    karisim: string;
    /** Boşsa serbest; doluysa her tur sıradaki odak */
    odaklar: string[];
    /** Kreatif direktöre her turda eklenen serbest talimat */
    ek_talimat: string;
    sure_dk: number;
  };
  studyo: {
    /** ElevenLabs v3 ses adı */
    ses: string;
    muzik: boolean;
    /** Seslendirmeli reelde otomatik altyazı */
    altyazi: boolean;
    /** Ekran yazısını videoya / carousel kartına göm */
    yazi_gom: boolean;
    /** Hero çekim Veo 3.1 Fast (sesli, pahalı) mı, Kling mi */
    hero_veo: boolean;
  };
  butce: {
    fal_gunluk_tavan: number;
    /** Tahmin × katsayı = gerçek (13 Eki ölçümü 1,45) */
    maliyet_katsayi: number;
  };
};

export const VARSAYILAN_AYARLAR: AjanAyarlari = {
  av: {
    tr_etiketler: ['motosiklet', 'motorcu', 'motovlog', 'motorcuyuz', 'motorcukızlar'],
    tr_aramalar: ['motosiklet', 'motorcu kız', 'motor pov', 'ilk motorum'],
    global_aramalar: ['motorcycle pov', 'biker life', 'motorcycle couple', 'first motorcycle'],
    creative_center: true,
    etiket_basi_video: 30,
    arama_basi_video: 25,
    gun: 14,
    min_patlama: 5,
    min_izlenme_tr: 15_000,
    min_izlenme_global: 50_000,
    tr_secim: 9,
    global_secim: 4,
    hesap_basi: 2,
  },
  sok: { izlenecek_video: 10, sure_dk: 35, taze_saat: 6 },
  kreatif: { aday: 6, secim: 3, min_puan: 35, karisim: '2 reel + 1 carousel', odaklar: [], ek_talimat: '', sure_dk: 30 },
  studyo: { ses: 'Brian', muzik: true, altyazi: true, yazi_gom: true, hero_veo: true },
  butce: { fal_gunluk_tavan: 3, maliyet_katsayi: 1.45 },
};

type Duz = Record<string, unknown>;

/** Varsayılanın şekline göre birleştir; tür uymayan değer yok sayılır. */
function birlestir<T>(varsayilan: T, ust: unknown): T {
  if (Array.isArray(varsayilan)) return (Array.isArray(ust) ? ust.map(String).map((s) => s.trim()).filter(Boolean) : varsayilan) as T;
  if (varsayilan && typeof varsayilan === 'object') {
    const out: Duz = { ...(varsayilan as Duz) };
    const u = (ust && typeof ust === 'object' ? ust : {}) as Duz;
    for (const k of Object.keys(out)) if (k in u) out[k] = birlestir((varsayilan as Duz)[k], u[k]);
    return out as T;
  }
  if (typeof varsayilan === 'number') return (typeof ust === 'number' && Number.isFinite(ust) ? ust : varsayilan) as T;
  if (typeof varsayilan === 'boolean') return (typeof ust === 'boolean' ? ust : varsayilan) as T;
  if (typeof varsayilan === 'string') return (typeof ust === 'string' ? ust.slice(0, 4000) : varsayilan) as T;
  return varsayilan;
}

/** Güvenlik sınırları: panelden yanlışlıkla kredi yakan değer girilmesin. */
function sinirla(a: AjanAyarlari): AjanAyarlari {
  const s = (n: number, alt: number, ust: number) => Math.min(ust, Math.max(alt, n));
  a.av.etiket_basi_video = s(a.av.etiket_basi_video, 5, 100);
  a.av.arama_basi_video = s(a.av.arama_basi_video, 5, 100);
  a.av.tr_etiketler = a.av.tr_etiketler.map((e) => e.replace(/^#/, '')).slice(0, 15);
  a.av.tr_aramalar = a.av.tr_aramalar.slice(0, 10);
  a.av.global_aramalar = a.av.global_aramalar.slice(0, 10);
  a.av.gun = s(a.av.gun, 2, 60);
  a.av.min_patlama = s(a.av.min_patlama, 1, 1000);
  a.av.tr_secim = s(a.av.tr_secim, 0, 15);
  a.av.global_secim = s(a.av.global_secim, 0, 10);
  a.av.hesap_basi = s(a.av.hesap_basi, 1, 5);
  a.sok.izlenecek_video = s(a.sok.izlenecek_video, 1, 10);
  a.sok.sure_dk = s(a.sok.sure_dk, 10, 60);
  a.sok.taze_saat = s(a.sok.taze_saat, 0, 72);
  a.kreatif.aday = s(a.kreatif.aday, 3, 12);
  a.kreatif.secim = s(a.kreatif.secim, 1, 5);
  a.kreatif.min_puan = s(a.kreatif.min_puan, 0, 50);
  a.kreatif.sure_dk = s(a.kreatif.sure_dk, 10, 60);
  a.kreatif.odaklar = a.kreatif.odaklar.slice(0, 12);
  a.butce.fal_gunluk_tavan = s(a.butce.fal_gunluk_tavan, 0, 200);
  a.butce.maliyet_katsayi = s(a.butce.maliyet_katsayi, 1, 3);
  return a;
}

export async function ayarlariOku(env: Env): Promise<AjanAyarlari> {
  const r = await env.DB.prepare("SELECT veri FROM ayarlar WHERE anahtar = 'ajan'").first<{ veri: string }>().catch(() => null);
  return sinirla(birlestir(VARSAYILAN_AYARLAR, jsonAc<unknown>(r?.veri, {})));
}

export async function ayarlariYaz(env: Env, yeni: unknown, kim: string | null): Promise<AjanAyarlari> {
  const a = sinirla(birlestir(VARSAYILAN_AYARLAR, yeni));
  await env.DB.prepare(
    "INSERT INTO ayarlar (anahtar, veri, guncelleme, guncelleyen) VALUES ('ajan', ?, ?, ?) ON CONFLICT(anahtar) DO UPDATE SET veri = excluded.veri, guncelleme = excluded.guncelleme, guncelleyen = excluded.guncelleyen"
  ).bind(JSON.stringify(a), simdiIst(), kim).run();
  return a;
}
