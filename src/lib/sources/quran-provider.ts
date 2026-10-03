import type { Claim, MatchVariance, SourceMatch } from "@/lib/types";
import type { SourceProvider } from "@/lib/sources/provider";
import { normalizeArabic, tokenize, tokensLength, type Token } from "@/lib/sources/arabic";
import { CONFIDENCE, THRESHOLDS, confidenceFrom } from "@/lib/sources/match";
import { loadCorpus, verifyIntegrity, type CorpusAyah, type LoadedCorpus } from "@/lib/sources/quran-corpus";
import { QURAN_TEXT_TYPE } from "@/lib/sources/types/quran-text";

/**
 * مزوّد المدوّنة القرآنية.
 *
 * المسار كله حتمي:
 *   ترشيح لفظي ← معرّفات فقط ← جلب من المخزن ← تحقق بصمة ← استشهاد.
 *
 * لا نموذج لغوي، ولا متجهات، ولا توليد نص، ولا رجوع لمعرفة النموذج.
 * إن لم تُحمَّل المدوّنة فالمزوّد يعلن أنه غير متصل ولا يعيد شيئًا.
 *
 * المطابقة على **كلمات كاملة**: المقياس أطول تتابع متصل من الكلمات
 * المشتركة بين الادعاء والآية، ثم يُمدّ التتابع على الجانبين. فلا يُعتد
 * بتوافق أجزاء من كلمات.
 */

let corpus: LoadedCorpus | null = null;
let ayahWords: AyahWords[] = [];

/** كلمات الآية بصورها الإملائية المحتملة — **للبحث فقط**، ولا تُعرض. */
interface AyahWords {
  /** لكل كلمة صورها؛ الأولى هي الصورة الأساسية. الصورة قد تكون كلمتين. */
  variants: string[][];
  /** مفتاح كل صورة بعد إسقاط الهمزة المفردة (انظر `keyOf`). */
  keys: string[][];
  /** الكلمة كما في المصدر حرفيًا — للعرض عند بيان موضع الفرق. */
  raw: string[];
}

const DAGGER = /ٰ/g;
/** واو أو ألف مقصورة تعلوها ألف خنجرية: تُنطق ألفًا (الصلوٰة، التورىٰة). */
const CARRIED_DAGGER = /[وى]ٰ/g;
/** ياء النداء المتصلة في الرسم العثماني (يَٰٓأَيُّهَا، يَٰمُوسَىٰ). */
const VOCATIVE = /^[وف]?ي[ً-ٟ]*ٰ/;

/**
 * مفتاح مقارنة يتجاوز فروقًا في الرسم لا في اللفظ:
 *   - الهمزة المفردة:  ءامنوا ↔ آمنوا،  شيـٔا ↔ شيئا
 *   - اللام المدغمة:   اليل ↔ الليل
 *   - الألف الأخيرة:   الأقصا ↔ الأقصى
 * لا يُستعمل إلا حين لا توجد الصورة الأساسية في الادعاء، ولا يُعتد به
 * لمفتاح أقصر من ثلاثة أحرف — حتى لا تلتقي به كلمتان مختلفتان.
 */
function keyOf(word: string): string {
  return word
    .replace(/ء/g, "")
    .replace(/^([وفبكل]{0,2})الل(?!ه)/, "$1ال")
    .replace(/ا$/, "ي");
}

/**
 * صور الكلمة الواحدة.
 *
 * الرسم العثماني في المدوّنة والرسم الإملائي الذي يكتبه الناس يختلفان في
 * مواضع معروفة. والاختيار بين الصور يقع **لكل كلمة على حدة** لا للآية
 * كلها، لأن الآية الواحدة تجمع الحالتين: «إِلَٰه» تُكتب بلا ألف،
 * و«ٱلسَّمَٰوَٰت» تُكتب بها.
 */
function variantsOf(rawWord: string): string[] {
  const base = normalizeArabic(rawWord);
  const out = [base];
  if (!rawWord.includes("ٰ")) return out;

  const add = (v: string) => {
    if (v && !out.includes(v)) out.push(v);
  };

  const asAlef = normalizeArabic(rawWord.replace(DAGGER, "ا"));
  add(asAlef);
  add(normalizeArabic(rawWord.replace(CARRIED_DAGGER, "ا").replace(DAGGER, "ا")));
  if (VOCATIVE.test(rawWord)) add(asAlef.replace(/^([وف]?يا)(?=.{2,})/, "$1 "));

  return out;
}

function wordsOfAyah(text: string): AyahWords {
  const w: AyahWords = { variants: [], keys: [], raw: [] };
  for (const rawWord of text.split(/\s+/)) {
    // علامات الوقف المنفردة تُطبَّع إلى لا شيء، وليست كلمات.
    if (!normalizeArabic(rawWord)) continue;
    const variants = variantsOf(rawWord);
    w.variants.push(variants);
    w.keys.push(variants.map(keyOf));
    w.raw.push(rawWord);
  }
  return w;
}

/**
 * في نسخة المصدر تُسبق الآية الأولى من كل سورة بالبسملة (عدا الفاتحة
 * والتوبة)، والمخزن يستبعدها من صورة المطابقة. تُستبعد هنا بالقدر نفسه
 * ليبقى السلوك واحدًا: عدد الكلمات المستبعدة يُشتق من صورة المخزن،
 * ولا يُكتب نص البسملة في الكود.
 */
function buildAyahWords(c: LoadedCorpus): AyahWords[] {
  return c.ayat.map((a, i) => {
    const w = wordsOfAyah(a.text);
    const drop = w.raw.length - c.normalized[i].split(" ").length;
    if (drop <= 0) return w;
    return {
      variants: w.variants.slice(drop),
      keys: w.keys.slice(drop),
      raw: w.raw.slice(drop),
    };
  });
}

/** يُستدعى مرة عند الإقلاع. يعيد true إن توفرت مدوّنة صالحة. */
export async function initQuranProvider(): Promise<boolean> {
  corpus = await loadCorpus();
  ayahWords = corpus ? buildAyahWords(corpus) : [];
  return corpus !== null;
}

export function corpusManifest() {
  return corpus?.manifest ?? null;
}

/* ─────────────── صورة الآية المكيَّفة على الادعاء ─────────────── */

interface ClaimIndex {
  /** كلمات الادعاء الداخلة في المطابقة (بلا الأرقام المجردة). */
  words: Token[];
  set: Set<string>;
  byKey: Map<string, string>;
  length: number;
}

function indexClaim(text: string): ClaimIndex {
  const all = tokenize(text);
  const words = all.filter((t) => !t.digits);
  const set = new Set(words.map((t) => t.norm));
  const byKey = new Map<string, string>();
  for (const t of words) {
    const k = keyOf(t.norm);
    if (k.length >= 3 && !byKey.has(k)) byKey.set(k, t.norm);
  }
  return { words, set, byKey, length: tokensLength(all) };
}

interface Adapted {
  words: string[];
  /** لكل كلمة مكيَّفة: فهرس كلمة المصدر التي جاءت منها. */
  origin: number[];
}

/**
 * لكل كلمة في الآية تُختار صورتها التي وردت في الادعاء، وإلا فالأساسية.
 * لا أثر لهذا على النص المخزَّن ولا على المعروض.
 */
function adapt(aw: AyahWords, claim: ClaimIndex): Adapted {
  const words: string[] = [];
  const origin: number[] = [];

  for (let k = 0; k < aw.variants.length; k++) {
    const variants = aw.variants[k];
    let chosen = [variants[0]];

    if (!claim.set.has(variants[0])) {
      let found = false;
      for (let v = 1; v < variants.length && !found; v++) {
        const parts = variants[v].split(" ");
        if (parts.every((p) => claim.set.has(p))) {
          chosen = parts;
          found = true;
        }
      }
      for (let v = 0; v < variants.length && !found; v++) {
        const key = aw.keys[k][v];
        const same = key.length >= 3 ? claim.byKey.get(key) : undefined;
        if (same) {
          chosen = [same];
          found = true;
        }
      }
    }

    for (const part of chosen) {
      words.push(part);
      origin.push(k);
    }
  }
  return { words, origin };
}

/* ─────────────── المحاذاة ─────────────── */

/** موضع فرق: مدى في كلمات الادعاء يقابله مدى في كلمات الآية. */
interface Deviation {
  claim: [number, number];
  passage: [number, number];
}

interface Alignment {
  c0: number;
  c1: number;
  p0: number;
  p1: number;
  /** عدد الكلمات المتطابقة فعلًا داخل المدى. */
  matched: number;
  deviations: Deviation[];
}

/** أطول تتابع متصل من الكلمات المشتركة. */
function longestRun(c: string[], p: string[]): { length: number; ci: number; pi: number } {
  let prev = new Uint16Array(p.length + 1);
  let curr = new Uint16Array(p.length + 1);
  let best = 0;
  let ci = -1;
  let pi = -1;

  for (let i = 1; i <= c.length; i++) {
    for (let j = 1; j <= p.length; j++) {
      if (c[i - 1] === p[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > best) {
          best = curr[j];
          ci = i - best;
          pi = j - best;
        }
      } else {
        curr[j] = 0;
      }
    }
    const t = prev;
    prev = curr;
    curr = t;
    curr.fill(0);
  }
  return { length: best, ci, pi };
}

/** أقصى عدد كلمات يُتجاوز في موضع فرق واحد، من كل جانب. */
const MAX_SKIP = 2;

/**
 * عند اختلاف كلمة: هل يعود الطرفان إلى التوافق بعد كلمة أو كلمتين؟
 *
 * يُقبل الرجوع بشرط محافظ: كلمتان متتاليتان متطابقتان بعد موضع الفرق،
 * أو انتهاء الادعاء والآية معًا عنده. `dir` = +1 للأمام و-1 للخلف.
 */
function resync(
  c: string[],
  p: string[],
  i: number,
  j: number,
  dir: 1 | -1,
): { dc: number; dp: number } | null {
  const cAt = (k: number) => c[i + dir * k];
  const pAt = (k: number) => p[j + dir * k];
  const cLeft = dir === 1 ? c.length - i : i + 1;
  const pLeft = dir === 1 ? p.length - j : j + 1;

  for (let total = 1; total <= MAX_SKIP * 2; total++) {
    for (let dc = Math.min(total, MAX_SKIP); dc >= 0; dc--) {
      const dp = total - dc;
      if (dp > MAX_SKIP || dc > cLeft || dp > pLeft) continue;

      const cRest = cLeft - dc;
      const pRest = pLeft - dp;

      // استبدال في آخر الادعاء والآية معًا.
      if (cRest === 0 && pRest === 0) {
        if (dc >= 1 && dp >= 1) return { dc, dp };
        continue;
      }
      if (cRest === 0 || pRest === 0) continue;
      if (cAt(dc) !== pAt(dp)) continue;

      const bothEndNext = cRest === 1 && pRest === 1;
      const nextMatches = cRest >= 2 && pRest >= 2 && cAt(dc + 1) === pAt(dp + 1);
      if (bothEndNext || nextMatches) return { dc, dp };
    }
  }
  return null;
}

function align(c: string[], p: string[], tolerant: boolean): Alignment | null {
  const seed = longestRun(c, p);
  if (seed.length === 0) return null;

  const a: Alignment = {
    c0: seed.ci,
    c1: seed.ci + seed.length,
    p0: seed.pi,
    p1: seed.pi + seed.length,
    matched: seed.length,
    deviations: [],
  };

  // للأمام
  while (a.c1 < c.length && a.p1 < p.length) {
    if (c[a.c1] === p[a.p1]) {
      a.c1++;
      a.p1++;
      a.matched++;
      continue;
    }
    const r = tolerant ? resync(c, p, a.c1, a.p1, 1) : null;
    if (!r) break;
    a.deviations.push({ claim: [a.c1, a.c1 + r.dc], passage: [a.p1, a.p1 + r.dp] });
    a.c1 += r.dc;
    a.p1 += r.dp;
  }

  // للخلف
  while (a.c0 > 0 && a.p0 > 0) {
    if (c[a.c0 - 1] === p[a.p0 - 1]) {
      a.c0--;
      a.p0--;
      a.matched++;
      continue;
    }
    const r = tolerant ? resync(c, p, a.c0 - 1, a.p0 - 1, -1) : null;
    if (!r) break;
    a.deviations.unshift({ claim: [a.c0 - r.dc, a.c0], passage: [a.p0 - r.dp, a.p0] });
    a.c0 -= r.dc;
    a.p0 -= r.dp;
  }

  return a;
}

/* ─────────────── من المحاذاة إلى موضع استدلال ─────────────── */

interface Hit {
  index: number;
  /** مدى الادعاء المغطّى، بكلمات الادعاء. */
  c0: number;
  c1: number;
  /** هل بلغ المدى أول الآية وآخرها. */
  fromStart: boolean;
  toEnd: boolean;
  /** موضعه في الادعاء المطبَّع، بالمحارف. */
  start: number;
  length: number;
  /** نسبة ما تطابق من الآية. */
  passageCoverage: number;
  confidence: number;
  variance: MatchVariance[];
  /** مدى كلمات الادعاء في كل موضع فرق (يوازي `variance`). */
  deviating: [number, number][];
  method: string;
}

const charsOf = (words: string[]) => words.reduce((n, w) => n + w.length, 0) + Math.max(0, words.length - 1);

/**
 * أقصر نص يُقبل مطابقًا لآية كاملة حين يكون الادعاء **كله** هو الآية.
 * دون ذلك (كلمة مفردة أو حروف مقطّعة) لا يُعتد به منفردًا: «طه» اسم،
 * و«الرحمن» اسم، ووجودهما آيةً لا يجعل كل ورود لهما اقتباسًا.
 */
const SHORT_EXACT = { minWords: 2, minChars: 8 } as const;

function toHit(index: number, a: Alignment, p: Adapted, claim: ClaimIndex, aw: AyahWords): Hit | null {
  const claimWords = claim.words;
  const matchedChars = matchedLength(claimWords, a);
  const passageChars = charsOf(p.words);
  const first = claimWords[a.c0];
  const last = claimWords[a.c1 - 1];

  const fromStart = a.p0 === 0;
  const toEnd = a.p1 === p.words.length;
  const exact = a.deviations.length === 0;
  const wholeBoth = exact && fromStart && toEnd && a.c0 === 0 && a.c1 === claimWords.length;

  const shortExact =
    wholeBoth && a.matched >= SHORT_EXACT.minWords && matchedChars >= SHORT_EXACT.minChars;

  if (matchedChars < THRESHOLDS.minSpan && !shortExact) return null;

  const passageCoverage = passageChars ? Math.min(1, matchedChars / passageChars) : 0;

  const variance: MatchVariance[] = a.deviations.map((d) => ({
    claim: claimWords
      .slice(d.claim[0], d.claim[1])
      .map((t) => t.raw)
      .join(" "),
    source: sourceWords(aw, p, d.passage),
  }));

  const confidence = !exact
    ? CONFIDENCE.partial
    : confidenceFrom({
        // شرط الطول حلّ محله هنا شرط أشد: الادعاء كله هو الآية كلها.
        spanLength: shortExact ? Math.max(matchedChars, THRESHOLDS.minSpan) : matchedChars,
        passageCoverage,
        claimCoverage: 0,
        passageStart: 0,
        claimStart: 0,
      });

  return {
    index,
    c0: a.c0,
    c1: a.c1,
    fromStart,
    toEnd,
    start: first.start,
    length: last.start + last.norm.length - first.start,
    passageCoverage,
    confidence,
    variance,
    deviating: a.deviations.map((d) => d.claim),
    method: exact ? "lexical-word-run" : "lexical-word-run-with-variance",
  };
}

/** طول ما تطابق فعلًا داخل المدى، بالمحارف. كلمات الفروق لا تُحتسب. */
function matchedLength(claimWords: Token[], a: Alignment): number {
  const skip = new Set<number>();
  for (const d of a.deviations) for (let k = d.claim[0]; k < d.claim[1]; k++) skip.add(k);
  const matched: string[] = [];
  for (let k = a.c0; k < a.c1; k++) if (!skip.has(k)) matched.push(claimWords[k].norm);
  return charsOf(matched);
}

/** كلمات المصدر في مدى، كما وردت حرفيًا. */
function sourceWords(aw: AyahWords, p: Adapted, range: [number, number]): string {
  const seen: number[] = [];
  for (let k = range[0]; k < range[1]; k++) {
    const o = p.origin[k];
    if (!seen.includes(o)) seen.push(o);
  }
  return seen.map((o) => aw.raw[o]).join(" ");
}

/** نسبة الفروق المقبولة إلى ما تطابق. فوقها لا يُعدّ النص قريبًا من الآية. */
const MAX_VARIANCE_RATIO = 1 / 3;

function matchAyah(index: number, claim: ClaimIndex): Hit | null {
  const aw = ayahWords[index];
  const p = adapt(aw, claim);
  const c = claim.words.map((t) => t.norm);

  let a = align(c, p.words, true);
  if (!a) return null;

  if (a.deviations.length) {
    const deviating = a.deviations.reduce(
      (n, d) => n + Math.max(d.claim[1] - d.claim[0], d.passage[1] - d.passage[0]),
      0,
    );
    if (deviating > a.matched * MAX_VARIANCE_RATIO) a = align(c, p.words, false);
    if (!a) return null;
  }

  return toHit(index, a, p, claim, aw);
}

/**
 * موضع لآية وردت **كاملة** في الادعاء ابتداءً من الكلمة `c0`.
 * شرط الطول يحلّ محله عند المستدعي شرط أشد (ملاصقة آية مطابَقة، أو تتابع
 * آيات كاملة من السورة نفسها).
 */
function wholePassageHit(
  index: number,
  c0: number,
  passage: string[],
  claim: ClaimIndex,
  method: string,
): Hit {
  const first = claim.words[c0];
  const last = claim.words[c0 + passage.length - 1];
  return {
    index,
    c0,
    c1: c0 + passage.length,
    fromStart: true,
    toEnd: true,
    start: first.start,
    length: last.start + last.norm.length - first.start,
    passageCoverage: 1,
    confidence: confidenceFrom({
      spanLength: Math.max(charsOf(passage), THRESHOLDS.minSpan),
      passageCoverage: 1,
      claimCoverage: 0,
      passageStart: 0,
      claimStart: 0,
    }),
    variance: [],
    deviating: [],
    method,
  };
}

/** أقل ما يُقبل لتتابع آيات قصيرة أقصر من أقل مقطع معتد به. */
const SHORT_RUN = { minPassages: 2, minWords: 3, minChars: 8 } as const;

/**
 * تتابع آيات قصيرة لا مرتكز بينها.
 *
 * حين يكون النص كله آيات قصيرة («الرحمن ۝ علّم القرآن ۝ خلق الإنسان»)
 * لا تبلغ أيٌّ منها أقل مقطع معتد به، فلا يوجد ما تتصل به. تُلتقط هنا
 * بشرط بنيوي لا بتخفيض الحد:
 *   - آيتان فأكثر **متتاليتان في المصحف** من السورة نفسها،
 *   - كلٌّ منها واردة **كاملة**، متصلة بما قبلها في الادعاء بلا فاصل،
 *   - ومجموعها يبلغ أقل مقطع معتد به؛ فإن لم يبلغه فلا يُقبل إلا أن يكون
 *     التتابع هو الادعاء كله (ثلاث كلمات فأكثر).
 * فالكلمة المفردة والحروف المقطعة لا تُلتقط وحدها بحال.
 */
function findShortRuns(hits: Hit[], claim: ClaimIndex, c: LoadedCorpus): void {
  const taken = new Set(hits.map((h) => h.index));
  const words = claim.words.map((t) => t.norm);
  const positions = new Map<string, number[]>();
  words.forEach((w, k) => {
    const list = positions.get(w);
    if (list) list.push(k);
    else positions.set(w, [k]);
  });

  const wholeAt = (index: number, c0: number): string[] | null => {
    const p = adapt(ayahWords[index], claim).words;
    if (p.length === 0 || c0 + p.length > words.length) return null;
    for (let k = 0; k < p.length; k++) if (words[c0 + k] !== p[k]) return null;
    return p;
  };

  for (let i = 0; i < c.ayat.length; i++) {
    if (taken.has(i)) continue;
    const firstWord = adapt(ayahWords[i], claim).words[0];
    for (const start of positions.get(firstWord) ?? []) {
      const run: { index: number; c0: number; passage: string[] }[] = [];
      let at = start;
      for (let j = i; j < c.ayat.length && c.ayat[j].sura === c.ayat[i].sura; j++) {
        if (taken.has(j)) break;
        const passage = wholeAt(j, at);
        if (!passage) break;
        run.push({ index: j, c0: at, passage });
        at += passage.length;
      }
      if (run.length < SHORT_RUN.minPassages) continue;

      const runWords = run.flatMap((r) => r.passage);
      const chars = charsOf(runWords);
      const wholeClaim = start === 0 && at === words.length;
      const accepted =
        chars >= THRESHOLDS.minSpan ||
        (wholeClaim && runWords.length >= SHORT_RUN.minWords && chars >= SHORT_RUN.minChars);
      if (!accepted) continue;

      for (const r of run) {
        hits.push(wholePassageHit(r.index, r.c0, r.passage, claim, "lexical-consecutive-whole-passages"));
        taken.add(r.index);
      }
      break;
    }
  }
}

/**
 * الآيات القصيرة المتصلة بآية مطابَقة.
 *
 * آية أقصر من أقل مقطع معتد به لا تُرشَّح منفردة داخل نص أطول، فتسقط من
 * السورة المنقولة كاملة. تُستعاد هنا بشرط أشد من الطول:
 *   - أن تليها أو تسبقها مباشرةً آية من السورة نفسها مطابَقة مطابقة قوية
 *     بلغت طرفها،
 *   - وأن ترد الآية القصيرة **كاملة** في الموضع الملاصق من الادعاء.
 * فلا يُخفَّض حد المطابقة عمومًا، ولا تُلتقط الكلمة القصيرة حيثما وردت.
 */
function extendToNeighbours(hits: Hit[], claim: ClaimIndex, c: LoadedCorpus): void {
  const taken = new Set(hits.map((h) => h.index));
  const words = claim.words.map((t) => t.norm);
  const queue = hits.filter((h) => h.confidence >= CONFIDENCE.strong);

  const tryNeighbour = (anchor: Hit, dir: 1 | -1) => {
    const index = anchor.index + dir;
    if (index < 0 || index >= c.ayat.length || taken.has(index)) return;
    if (c.ayat[index].sura !== c.ayat[anchor.index].sura) return;

    const aw = ayahWords[index];
    const p = adapt(aw, claim);
    const n = p.words.length;
    const c0 = dir === 1 ? anchor.c1 : anchor.c0 - n;
    if (n === 0 || c0 < 0 || c0 + n > words.length) return;
    for (let k = 0; k < n; k++) if (words[c0 + k] !== p.words[k]) return;

    const hit = wholePassageHit(index, c0, p.words, claim, "lexical-adjacent-whole-passage");
    taken.add(index);
    hits.push(hit);
    queue.push(hit);
  };

  while (queue.length) {
    const anchor = queue.shift()!;
    if (anchor.variance.length) continue;
    if (anchor.toEnd) tryNeighbour(anchor, 1);
    if (anchor.fromStart) tryNeighbour(anchor, -1);
  }
}

/**
 * المرشح المحتوى في مطابقة أقوى ليس دليلًا مساويًا لها.
 *
 * حين يغطي موضعٌ مقطعًا من الادعاء، وموضع آخر لا يغطي إلا جزءًا من ذلك
 * المقطع نفسه، فالثاني لا يضيف إسنادًا ويُسقط — ولو كان آية كاملة وردت
 * بلفظها (آل عمران 2 داخل اقتباس من آية الكرسي): المنقول هو الآية الأطول.
 *
 * تعدد المواضع الحقيقي — اللفظ نفسه بتمامه في أكثر من موضع — لا يُمس،
 * لأن أيًّا منها لا يحتوي الآخر احتواءً أطول.
 *
 * **المطابقة التامة مقدَّمة على القريبة.** الموضع القريب (ذو الفرق اللفظي)
 * يُردّ إذا كانت الكلمات التي عدّها مخالِفة واردة بتمامها في مواضع مطابقة
 * تامة: «طسم تلك آيات الكتاب المبين» نقل صحيح للشعراء 1–2، لا نقل خاطئ
 * ليوسف 1. ولا يُسقِط موضعٌ قريبٌ مردودٌ موضعًا تامًّا أبدًا. فإن بقي
 * الفرق بلا مطابقة تامة تغطيه («قولًا شديدًا») فهو فرق حقيقي ويبقى.
 */
function resolveDominated(hits: Hit[]): Hit[] {
  const contains = (g: Hit, h: Hit) => g.start <= h.start && g.start + g.length >= h.start + h.length;
  const exactStrong = (g: Hit) => g.confidence >= CONFIDENCE.strong;
  const exact = hits.filter(exactStrong);

  /** كلمات الادعاء التي تغطيها المطابقات التامة مجتمعة. */
  const exactWords = new Set<number>();
  for (const g of exact) for (let k = g.c0; k < g.c1; k++) exactWords.add(k);
  const allExact = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (!exactWords.has(k)) return false;
    return true;
  };

  const refuted = (h: Hit) =>
    allExact(h.c0, h.c1) ||
    (h.deviating.every(([from, to]) => to > from) && h.deviating.every(([from, to]) => allExact(from, to)));

  const variants = hits.filter((h) => h.variance.length > 0 && !refuted(h));
  const anchors = [...exact, ...variants];

  return hits.filter((h) => {
    if (h.variance.length && !variants.includes(h)) return false;
    return !anchors.some((g) => g !== h && contains(g, h) && g.length > h.length);
  });
}

/** أقصى عدد من المرشحات الجزئية يُعاد. المواضع التامة والقريبة لا تُقتطع. */
const MAX_PARTIAL = 20;

/** المرحلة ٢: جلب من المخزن بالمعرّف. معرّف لا يُحَل ← يُسقَط. */
function hydrate(id: string, c: LoadedCorpus): CorpusAyah | null {
  return c.ayat.find((a) => a.id === id) ?? null;
}

async function cite(hit: Hit, claim: ClaimIndex, c: LoadedCorpus): Promise<SourceMatch | null> {
  // المطابقة تُسلّم معرّفًا فقط؛ النص يُجلب من المخزن ثم تُتحقق بصمته.
  const a = hydrate(c.ayat[hit.index].id, c);
  if (!a) return null;

  // المرحلة ٣: تحقق السلامة قبل الاستشهاد.
  const integrityVerified = await verifyIntegrity(a);
  if (!integrityVerified) return null;

  const m = c.manifest;

  return {
    confidence: hit.confidence,
    source: {
      id: a.id,
      title: "القرآن الكريم",
      locator: `${a.suraName} — الآية ${a.aya}`,
      // نص الاستشهاد يُقرأ من المخزن كما هو. لا يُعاد إنتاجه ولا يُعدَّل.
      excerpt: a.text,
      collection: `${m.dataSource} · ${m.version}`,
      isDemo: false,
    },
    reference: {
      typeId: QURAN_TEXT_TYPE.id,
      fields: [
        { label: "المصدر", value: "القرآن الكريم" },
        { label: "السورة", value: `${a.suraName} (${a.sura})` },
        { label: "رقم الآية", value: String(a.aya) },
        { label: "المعرّف الداخلي", value: a.id },
      ],
      corpusVersion: m.version,
      dataSource: m.dataSource,
      dataSourceUrl: m.dataSourceUrl,
      group: a.suraName,
      ordinal: a.aya,
    },
    audit: {
      spanLength: hit.length,
      passageCoverage: Number(hit.passageCoverage.toFixed(3)),
      claimCoverage: Number((claim.length ? hit.length / claim.length : 0).toFixed(3)),
      claimStart: hit.start,
      claimLength: claim.length,
      integrityVerified,
      method: hit.method,
      ...(hit.variance.length ? { variance: hit.variance } : {}),
    },
  };
}

export const quranProvider: SourceProvider = {
  get name() {
    const m = corpus?.manifest;
    return m ? `${m.dataSource} — ${m.version}` : "بدون مصادر مرتبطة";
  },

  get connected() {
    return corpus !== null && corpus.ayat.length > 0;
  },

  async lookup(claim: Claim): Promise<SourceMatch[]> {
    if (!corpus) return [];

    const index = indexClaim(claim.text);
    if (index.words.length === 0) return [];

    // المرحلة ١: ترشيح.
    let hits: Hit[] = [];
    for (let i = 0; i < ayahWords.length; i++) {
      const hit = matchAyah(i, index);
      if (hit) hits.push(hit);
    }

    extendToNeighbours(hits, index, corpus);
    findShortRuns(hits, index, corpus);
    hits = resolveDominated(hits);

    // المواضع التامة أولًا بترتيب ورودها في الادعاء، ثم القريبة، ثم الجزئية
    // الأطول فالأطول.
    const rank = (h: Hit) => (h.confidence >= CONFIDENCE.strong ? 0 : h.variance.length ? 1 : 2);
    hits.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (rank(a) === 0 ? a.start - b.start || a.index - b.index : b.length - a.length),
    );

    // لا يُقتطع موضع تام ولا قريب: التحقق من تغطية الادعاء يحتاجها كلها،
    // وآية كثيرة المواضع لا يصح أن تُسقط آية مجاورة لها. حدّ العرض شأن الواجهة.
    const kept = hits.filter((h) => rank(h) < 2).concat(hits.filter((h) => rank(h) === 2).slice(0, MAX_PARTIAL));

    const out: SourceMatch[] = [];
    for (const hit of kept) {
      const m = await cite(hit, index, corpus);
      if (m) out.push(m);
    }
    return out;
  },
};
