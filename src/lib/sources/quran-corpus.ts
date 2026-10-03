import { normalizeArabic, normalizeArabicDaggerAsAlef } from "@/lib/sources/arabic";

/**
 * مخزن المدوّنة القرآنية.
 *
 * يُحمّل من ملف مُولَّد محليًا من نسخة Tanzil المعتمدة. لا يُضمَّن أي نص
 * في الكود، ولا يوجد أي مسار بديل: إن غاب الملف فالمخزن **غير متصل**،
 * وتبقى نتائج التحقق كما هي بلا مصادر.
 */

export interface CorpusAyah {
  /** معرّف ثابت داخلي. */
  id: string;
  sura: number;
  suraName: string;
  aya: number;
  /** النص كما ورد من المصدر — لا يُعدَّل ولا يُطبَّع. */
  text: string;
  /** بصمة النص الأصلي، للتحقق قبل الاستشهاد. */
  hash: string;
}

export interface CorpusManifest {
  corpusId: string;
  typeId: string;
  version: string;
  dataSource: string;
  dataSourceUrl: string;
  licenseNotice: string;
  /** بصمة المدوّنة كاملة. */
  corpusHash: string;
  ayahCount: number;
  builtAt: string;
}

export interface LoadedCorpus {
  manifest: CorpusManifest;
  ayat: CorpusAyah[];
  /**
   * صورة المطابقة لكل آية — **للبحث فقط**، ولا تُعرض أبدًا.
   * النص المخزَّن في `ayat[i].text` وبصمته يبقيان كما وردا من المصدر.
   */
  normalized: string[];
  /**
   * صورة ثانية تُثبت الألف الخنجرية ألفًا، لتلتقي بالرسم الإملائي.
   * `null` حين لا تختلف عن الأولى — فلا حاجة لقياسها مرتين.
   */
  normalizedAlt: (string | null)[];
}

/**
 * يبني صور المطابقة.
 *
 * في نسخة المصدر تُسبق الآية الأولى من كل سورة بالبسملة (عدا الفاتحة
 * والتوبة). وهذا يفسد المطابقة في الاتجاهين:
 *   - من يلصق السورة بلا بسملة تسقط آيتها الأولى إلى تغطية جزئية.
 *   - ومن يلصقها بالبسملة تتطابق مع أوائل كل السور فتكثر المرشحات الكاذبة.
 *
 * فتُستبعد البسملة من صورة المطابقة للآية الأولى وحدها. والفاتحة مستثناة
 * لأن البسملة فيها آية مستقلة لا مقدمة.
 *
 * نص البسملة يُشتق من المدوّنة نفسها (الآية 1:1) ولا يُكتب في الكود.
 */
function buildMatchForms(ayat: CorpusAyah[], norm: (s: string) => string): string[] {
  const basmala = (() => {
    const first = ayat.find((a) => a.sura === 1 && a.aya === 1);
    return first ? norm(first.text) : "";
  })();

  return ayat.map((a) => {
    const form = norm(a.text);
    if (!basmala || a.aya !== 1 || a.sura === 1) return form;
    if (!form.startsWith(basmala)) return form;
    const stripped = form.slice(basmala.length).trim();
    // حماية: لو لم يبق شيء بعد الاستبعاد تُترك الصورة كما هي.
    return stripped.length > 0 ? stripped : form;
  });
}

/** مسار الملف المُولَّد. غيابه حالة متوقَّعة لا خطأ. */
const CORPUS_URL = "/corpus/quran-tanzil.json";

let cache: LoadedCorpus | null = null;
let attempted = false;

/**
 * يحمّل المدوّنة مرة واحدة. يعيد null إن لم تكن موجودة —
 * وهذا هو السلوك الصحيح قبل تنزيل النسخة المعتمدة.
 */
export async function loadCorpus(): Promise<LoadedCorpus | null> {
  if (cache) return cache;
  if (attempted) return null;
  attempted = true;

  try {
    const res = await fetch(CORPUS_URL, { cache: "force-cache" });
    if (!res.ok) return null;

    const data = (await res.json()) as { manifest: CorpusManifest; ayat: CorpusAyah[] };
    if (!data?.manifest || !Array.isArray(data.ayat) || data.ayat.length === 0) return null;

    const base = buildMatchForms(data.ayat, normalizeArabic);
    const alt = buildMatchForms(data.ayat, normalizeArabicDaggerAsAlef);

    cache = {
      manifest: data.manifest,
      ayat: data.ayat,
      normalized: base,
      normalizedAlt: alt.map((s, i) => (s === base[i] ? null : s)),
    };
    return cache;
  } catch {
    // غياب الملف أو تعذّر قراءته ← لا مصادر. لا تخمين، ولا بديل.
    return null;
  }
}

/** تحقق السلامة قبل الاستشهاد: بصمة النص المجلوب تطابق المحفوظة. */
export async function verifyIntegrity(ayah: CorpusAyah): Promise<boolean> {
  try {
    const bytes = new TextEncoder().encode(ayah.text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return hex === ayah.hash;
  } catch {
    return false;
  }
}
