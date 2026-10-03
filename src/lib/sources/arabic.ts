/**
 * تطبيع عربي — **لأغراض البحث فقط**.
 *
 * لا يُستخدم ناتج هذه الدالة في التخزين ولا في العرض إطلاقًا.
 * النص المخزَّن والنص المعروض يبقيان كما وردا من المصدر حرفًا بحرف.
 *
 * الغرض: أن يُعثر على اللفظ نفسه وإن اختلفت صورته الإملائية بين ما
 * يلصقه المستخدم وما في المدوّنة (تشكيل، صور الألف، ألف خنجرية…).
 */

/** التشكيل وعلامات الضبط. */
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g;

/** التطويل. */
const TATWEEL = /ـ/g;

/** علامات الوقف وأرقام الآي وعلامات السجدة والحزب. */
const MARKS = /[۔۝۞࣢ؕ۩]/g;

/** أي محرف ليس حرفًا عربيًا أو رقمًا أو مسافة. */
const NON_LETTER = /[^ء-غف-ي٠-٩0-90-9\s]/g;

export function normalizeArabic(input: string): string {
  return (
    input
      .normalize("NFC")
      .replace(DIACRITICS, "")
      .replace(TATWEEL, "")
      .replace(MARKS, "")
      // صور الألف كلها إلى ألف مجردة، بما فيها ألف الوصل
      .replace(/[آأإٱٲٳ]/g, "ا")
      // الألف المقصورة إلى ياء
      .replace(/ى/g, "ي")
      // التاء المربوطة إلى هاء
      .replace(/ة/g, "ه")
      // الهمزات المفردة والمحمولة
      .replace(/[ؤئ]/g, "ء")
      .replace(NON_LETTER, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * صورة مطابقة ثانية تُثبت الألف الخنجرية ألفًا.
 *
 * الألف الخنجرية (U+0670) علامة في الرسم العثماني تقابلها في الكتابة
 * الإملائية حالتان لا ثالثة لهما:
 *   - ألف مكتوبة:  أَعْطَيْنَٰكَ ← أعطيناك
 *   - ولا شيء:      ٱلرَّحْمَٰن ← الرحمن
 *
 * فلا يصح حذفها دائمًا ولا إثباتها دائمًا. لذلك يبقى التطبيع الأساسي
 * على حذفها (صورة «بلا ألف»)، وتُبنى هذه الصورة إلى جانبها، ثم تُجرَّب
 * المطابقة على الصورتين ويؤخذ أطول مقطع. بهذا يلتقي الرسمان في البحث
 * دون أن يُمسّ النص المخزَّن ولا بصمته ولا النص المعروض.
 */
export function normalizeArabicDaggerAsAlef(input: string): string {
  return normalizeArabic(input.replace(/ٰ/g, "ا"));
}

/**
 * تطبيع مع خريطة مواضع: يربط كل محرف في الناتج بموضعه في الأصل،
 * ليتسنى استخراج المقطع المطابق من **النص الأصلي** لا من المطبَّع.
 */
export function normalizeWithMap(input: string): { text: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];

  const src = input.normalize("NFC");
  let lastWasSpace = true;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const norm = normalizeArabic(ch);

    if (norm === "") continue;

    if (/\s/.test(norm)) {
      if (lastWasSpace) continue;
      out.push(" ");
      map.push(i);
      lastWasSpace = true;
      continue;
    }

    out.push(norm);
    map.push(i);
    lastWasSpace = false;
  }

  while (out.length && out[out.length - 1] === " ") {
    out.pop();
    map.pop();
  }

  return { text: out.join(""), map };
}

/** كلمة من نص المستخدم بصورتيها، وموضعها في النص المطبَّع. */
export interface Token {
  /** الصورة المطبَّعة — للمطابقة فقط. */
  norm: string;
  /** الكلمة كما كتبها المستخدم — للعرض عند بيان موضع الفرق. */
  raw: string;
  /** موضع بدايتها في النص المطبَّع الناتج عن وصل الكلمات بمسافة. */
  start: number;
  /** رقم مجرد (ترقيم آية أو نحوه) — لا يدخل المطابقة ولا يُحتسب نقصًا. */
  digits: boolean;
}

const DIGITS_ONLY = /^[0-9٠-٩۰-۹０-９]+$/;

/**
 * تقطيع النص إلى كلمات مطبَّعة مع حفظ الأصل.
 *
 * المزوّد والمحرك يعتمدان هذه الدالة نفسها، فإحداثيات المقاطع المطابَقة
 * التي يعيدها المزوّد هي عينها التي يحتسب عليها المحرك التغطية.
 */
export function tokenize(input: string): Token[] {
  const out: Token[] = [];
  let offset = 0;

  for (const rawWord of input.split(/\s+/)) {
    const norm = normalizeArabic(rawWord);
    if (!norm) continue;

    const parts = norm.split(" ");
    for (const part of parts) {
      out.push({
        norm: part,
        // كلمة انقسمت بالتطبيع لا يُعرف أصل كل جزء منها، فيُعرض المطبَّع.
        raw: parts.length === 1 ? rawWord : part,
        start: offset,
        digits: DIGITS_ONLY.test(part),
      });
      offset += part.length + 1;
    }
  }
  return out;
}

/** طول النص المطبَّع الذي تشير إليه مواضع `tokenize`. */
export function tokensLength(tokens: Token[]): number {
  const last = tokens[tokens.length - 1];
  return last ? last.start + last.norm.length : 0;
}
