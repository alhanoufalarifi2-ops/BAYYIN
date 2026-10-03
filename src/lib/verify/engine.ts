import type {
  Claim,
  ClaimStatus,
  SourceMatch,
  VerificationRun,
  VerificationSummary,
  VerifiedClaim,
} from "@/lib/types";
import { segmentClaims } from "@/lib/claims/segment";
import { normalizeArabic, tokenize, type Token } from "@/lib/sources/arabic";
import { THRESHOLDS } from "@/lib/sources/match";
import { getSourceProvider } from "@/lib/sources/provider";
import { attributionOf, coverageLabel, typeMandatedEscalation } from "@/lib/sources/types/registry";

/**
 * محرك التحقق.
 *
 * يأخذ ادعاءً ونتائج المزوّد، ويقرر الحالة. لا يعرف شيئًا عن هوية
 * المصادر ولا عن مضمونها — يعمل على درجات الترشيح ومواضعها فقط.
 *
 * حين لا يوجد مزوّد متصل، لا يمكن لأي ادعاء أن يكون "موثّقًا"،
 * وهذا سلوك مقصود لا نقص في التنفيذ.
 */

/** الحد الذي يُعدّ عنده الترشيح دعمًا كافيًا. */
export const STRONG = 0.82;
/** الحد الذي يُعدّ عنده الترشيح مرجعية محتملة تحتاج مراجعة. */
const WEAK = 0.45;

const norms = (list: string[]) => new Set(list.map(normalizeArabic));

/**
 * ألفاظ حكم صريحة: ورودها كلمةً مستقلة يكفي للإحالة.
 * المقارنة على **الكلمة كاملة** لا على جزء منها — فـ«قياسية» ليست
 * «قياس»، و«محكمة» ليست «حكم».
 */
const RULING_MARKERS = norms([
  "يجوز",
  "تجوز",
  "جائز",
  "حرام",
  "حلال",
  "مكروه",
  "مستحب",
  "فتوى",
  "بدعة",
  "راجح",
  "مرجوح",
]);

/**
 * ألفاظ لها معنى شرعي ومعنى دنيوي شائع («حكم المباراة»، «خلاف إداري»،
 * «واجب مدرسي»). لا تُحيل إلا إذا كان السياق شرعيًا فعلًا.
 */
const CONTEXTUAL_MARKERS = norms([
  "واجب",
  "حكم",
  "أحكام",
  "محرم",
  "إجماع",
  "خلاف",
  "قياس",
  "ترجيح",
  "كفر",
]);

/** ألفاظ تدل على أن موضوع المقطع شرعي. */
const SHARI_CONTEXT = norms([
  "شرع",
  "شرعي",
  "شرعية",
  "شرعا",
  "شريعة",
  "فقه",
  "فقهي",
  "فقهية",
  "فقهاء",
  "علماء",
  "مذهب",
  "مذاهب",
  "آية",
  "آيات",
  "سورة",
  "قرآن",
  "الله",
  "لله",
  "تعالى",
  "نبي",
  "رسول",
  "صلاة",
  "زكاة",
  "صيام",
  "صوم",
  "حج",
  "عمرة",
  "إسلام",
  "إسلامي",
  "إسلامية",
  "مسلم",
  "مسلمين",
  "مسلمون",
  "عبادة",
  "عبادات",
  "ربا",
  "طلاق",
  "نكاح",
  "وضوء",
  "طهارة",
]);

/** ضمائر المتكلم وما يدل على واقعة تخص السائل نفسه. */
const PERSONAL_MARKERS = norms([
  "لي",
  "أنا",
  "إني",
  "أنني",
  "زوجتي",
  "زوجي",
  "زواجي",
  "طلاقي",
  "صلاتي",
  "صيامي",
  "صومي",
  "حالتي",
  "عندي",
  "لنا",
  "علينا",
]);

/** عبارات تدل على نسبة النص إلى السنة النبوية. */
const HADITH_HINTS = [
  "قال رسول الله",
  "قال النبي",
  "عن النبي",
  "عن رسول الله",
  "صلى الله عليه وسلم",
  "رواه البخاري",
  "رواه مسلم",
  "متفق عليه",
  "في الحديث",
  "الحديث الشريف",
].map(normalizeArabic);

/**
 * صور الكلمة بعد نزع ما يتصل بأولها من حروف العطف والجر وأداة التعريف،
 * لتُقارن بالألفاظ أعلاه كلمةً بكلمة.
 */
function wordForms(tokens: Token[]): Set<string> {
  const out = new Set<string>();
  for (const { norm: w } of tokens) {
    out.add(w);
    const a = w.replace(/^[وف](?=.{2,})/, "");
    const b = a.replace(/^[بلك](?=.{2,})/, "");
    out.add(a);
    out.add(b);
    for (const x of [a, b]) out.add(x.replace(/^ال(?=.{2,})/, ""));
    if (a.startsWith("لل")) out.add(a.slice(2));
  }
  return out;
}

const hasAny = (forms: Set<string>, markers: Set<string>) => {
  for (const m of markers) if (forms.has(m)) return true;
  return false;
};

/**
 * كلمات الادعاء التي لم يغطّها موضع قوي.
 *
 * التوثيق يقوم على أن **كل** لفظ الادعاء وارد في المصدر. الأرقام المجردة
 * (ترقيم الآيات) وعبارات التأطير («قال تعالى») ليست من النص المنقول،
 * فلا تُحتسب نقصًا. موضع بلا بيانات مواضع (سجل لم يحددها مزوّده) يُعدّ
 * مغطيًا للادعاء كله.
 */
function uncoveredWords(tokens: Token[], strong: SourceMatch[], framing: boolean[]): Token[] {
  if (strong.some((m) => !m.audit)) return [];

  const spans = strong.map((m) => [m.audit!.claimStart, m.audit!.claimStart + m.audit!.spanLength]);
  return tokens.filter((t, i) => {
    if (t.digits || framing[i]) return false;
    return !spans.some(([s, e]) => t.start >= s && t.start + t.norm.length <= e);
  });
}

const quote = (words: string[], max = 8) =>
  `«${words.slice(0, max).join(" ")}${words.length > max ? " …" : ""}»`;

/**
 * هل يمكن أصلًا أن يُطابَق هذا المقطع؟
 *
 * دون عتبة أقصر مقطع معتد به، لا يمكن لأي مطابقة أن تُنتج شيئًا، فالحكم
 * عليه بـ«غير مسند» تقرير كاذب. ومع ذلك **لا يُسقط**: يُعلَن «لم يُقيَّم»
 * ويُحتسب في مقام الجاهزية، لأن إخفاءه يجعل الجاهزية محسوبة على جزء من
 * النص دون بقيته. يُستثنى ما أعاد له المزوّد موضعًا رغم قصره (آية قصيرة
 * وردت بتمامها).
 */
export function isEvaluable(text: string): boolean {
  return normalizeArabic(text).length >= THRESHOLDS.minSpan;
}

/** ما يحيط بالادعاء ولا يُعرف من نصه وحده. */
export interface ClassifyContext {
  /** الادعاء المجاور طابق مصدرًا مرتبطًا — فالسياق سياق استشهاد. */
  adjacentSourced?: boolean;
  /** هل يوجد مزوّد مصادر متصل. */
  connected?: boolean;
  /** يُعامَل الادعاء كأنه داخل تغطية المصادر (للمثال التوضيحي). */
  inCoverage?: boolean;
}

/** وصف موضع الفرق بين لفظ الادعاء ونص المصدر. */
function describeVariance(m: SourceMatch): string {
  return (m.audit?.variance ?? [])
    .map((v) => {
      if (v.claim && v.source) return `ورد «${v.claim}» ويقابله في المصدر «${v.source}»`;
      if (v.claim) return `ورد «${v.claim}» وليس في هذا الموضع من المصدر`;
      return `لم يرد «${v.source}» وهو في المصدر`;
    })
    .join("، و");
}

export function classify(
  claim: Claim,
  matches: SourceMatch[],
  ctx: ClassifyContext = {},
): {
  status: ClaimStatus;
  rationale: string;
} {
  const tokens = tokenize(claim.text);
  const attribution = attributionOf(tokens.map((t) => t.norm));

  const strong = matches.filter((m) => m.confidence >= STRONG);
  const leftover = uncoveredWords(tokens, strong, attribution.framing);
  // نقل محض: كل لفظ الادعاء وارد في المصدر.
  const pureQuotation = strong.length > 0 && leftover.length === 0;

  // كلام المستخدم نفسه: ما ليس نقلًا عن المصدر، مطابقًا كان النقل أو قريبًا.
  // قرائن الحكم والاستنباط تُطلب فيه وحده — فلفظ «الحرام» في آية منقولة
  // ليس حكمًا يصدره الناقل.
  const quoted = matches.filter((m) => m.confidence >= STRONG || m.audit?.variance?.length);
  const own = quoted.length ? uncoveredWords(tokens, quoted, attribution.framing) : tokens;

  if (own.length > 0) {
    const forms = wordForms(own);
    const shariContext =
      matches.length > 0 ||
      !!ctx.adjacentSourced ||
      attribution.attributed ||
      hasAny(forms, SHARI_CONTEXT);

    const ruling =
      hasAny(forms, RULING_MARKERS) || (shariContext && hasAny(forms, CONTEXTUAL_MARKERS));

    // البوابة العامة: الأحكام والترجيح تُحال أولًا، ولو وُجد ترشيح.
    if (ruling) {
      const personal = own.some((t) => PERSONAL_MARKERS.has(t.norm));
      return {
        status: "expert",
        rationale: personal
          ? "يبدو هذا سؤالًا عن حالة شخصية، والحكم فيها فتوى تتوقف على معرفة الواقعة. بَيِّن لا يفتي ولا يحكم في الوقائع الفردية؛ يُرجع فيها إلى جهة إفتاء مؤهلة."
          : "يتضمن الادعاء حكمًا أو ترجيحًا، ولا يصدر بَيِّن نتيجة في مثل هذا. يلزم عرضه على مختص.",
      };
    }

    // البوابة النوعية: إحالة إلزامية يعلنها نوع المدوّنة المسجَّل. لا تُستشار
    // إلا في سياق شرعي — فـ«يدل على» في جملة دنيوية ليست استنباطًا من نص.
    const typeReason = shariContext
      ? typeMandatedEscalation({ ...claim, text: own.map((t) => t.raw).join(" ") })
      : null;
    if (typeReason) {
      return { status: "expert", rationale: typeReason };
    }
  }

  if (pureQuotation) {
    return {
      status: "verified",
      rationale: "لفظ الادعاء وارد بتمامه في المصدر المرتبط، في المواضع المبيّنة.",
    };
  }

  // لفظ قريب من نص المصدر لا مطابق له: يُنبَّه إليه ولا يُبنى عليه.
  const variant = matches.find((m) => m.audit?.variance?.length);
  if (variant) {
    return {
      status: "review",
      rationale: `اللفظ الوارد لا يطابق نص المصدر تمامًا في ${variant.source.title} (${variant.source.locator}): ${describeVariance(
        variant,
      )}. قد يكون ذلك سهوًا في النقل أو فرقًا في الرسم الإملائي؛ يُراجع على نص المصدر المعروض أدناه قبل النشر.`,
    };
  }

  if (strong.length > 0) {
    return {
      status: "review",
      rationale: `طابق جزء من الادعاء مواضع في مصدر مرتبط، وبقي منه بلا إسناد: ${quote(
        leftover.map((t) => t.raw),
      )}. يحتاج مراجعة قبل الاعتماد.`,
    };
  }

  const best = matches.length ? Math.max(...matches.map((m) => m.confidence)) : 0;
  if (best >= WEAK) {
    return {
      status: "review",
      rationale:
        "عُثر على مرجعية محتملة، لكن التطابق جزئي ويحتاج السياق والدلالة إلى مراجعة قبل الاعتماد.",
    };
  }

  // لا إسقاط صامت: المقطع القصير يظهر موسومًا بأنه لم يُقيَّم.
  if (!isEvaluable(claim.text)) {
    return {
      status: "unevaluated",
      rationale:
        "هذا المقطع أقصر من أن يُطابَق لفظيًا، فلم يدخل التحقق. يظهر هنا ويُحتسب في مقام الجاهزية لأن تجاهله يجعل النتيجة محسوبة على جزء من النص دون بقيته.",
    };
  }

  // «غير مسند» حكم على نص نُسب إلى مصدر مرتبط فلم يوجد فيه.
  if (ctx.inCoverage || (ctx.connected !== false && attribution.attributed)) {
    return {
      status: "unsourced",
      rationale: ctx.inCoverage
        ? "لم يُعثر على موضع استدلال في المصادر المرتبطة حاليًا."
        : `نُسب هذا النص إلى ${coverageLabel()}، ولم يُعثر عليه بهذا اللفظ في المصدر المرتبط. تُراجع النسبة واللفظ قبل النشر.`,
    };
  }

  // وما سواه خارج التغطية: لا يُنفى ولا يُوثَّق.
  if (ctx.connected === false) {
    return {
      status: "uncovered",
      rationale:
        "لا توجد مصادر مرتبطة حاليًا، فلا يملك بَيِّن ما يقيس عليه هذا المقطع. ليس ذلك حكمًا عليه ولا توثيقًا له.",
    };
  }

  const text = normalizeArabic(claim.text);
  const hadith = HADITH_HINTS.some((h) => text.includes(h));
  return {
    status: "uncovered",
    rationale: hadith
      ? `يبدو هذا النص منسوبًا إلى السنة النبوية، ومصادر الحديث غير مرتبطة في هذه النسخة (المرتبط حاليًا: ${coverageLabel()} فقط). لا يعني ذلك أنه بلا أصل، ولا يُعدّ توثيقًا له؛ يُتحقق منه من مصدر حديثي معتمد قبل النشر.`
      : `هذا المقطع خارج تغطية المصادر المرتبطة حاليًا (${coverageLabel()} فقط). لا يعني ذلك أنه بلا أصل، ولا يُعدّ توثيقًا له.`,
  };
}

export function summarize(claims: VerifiedClaim[]): VerificationSummary {
  const count = (s: ClaimStatus) => claims.filter((c) => c.status === s).length;
  const total = claims.length;
  const verified = count("verified");
  const review = count("review");
  const unsourced = count("unsourced");
  const expert = count("expert");
  const uncovered = count("uncovered");
  const unevaluated = count("unevaluated");

  // الجاهزية: الموثّق يرفعها كاملًا، وما يحتاج تحققًا نصفًا، وما سواهما
  // لا يرفعها. ما خرج عن التغطية وما لم يُقيَّم داخلان في المقام عن قصد:
  // لا تبلغ الجاهزية 100 وجزء من النص لم يُتحقق منه.
  const readiness = total === 0 ? 0 : Math.round(((verified + review * 0.5) / total) * 100);

  return { total, verified, review, unsourced, expert, uncovered, unevaluated, readiness };
}

/** يشغّل المسار كاملًا على نص المستخدم. لا يتصل بأي خدمة خارجية. */
export async function runVerification(input: string): Promise<VerificationRun> {
  const provider = getSourceProvider();
  const claims = segmentClaims(input);

  // البحث أولًا لكل الادعاءات: سياق الادعاء يتوقف على ما جاوره.
  const lookups: SourceMatch[][] = [];
  for (const claim of claims) {
    lookups.push(provider.connected ? await provider.lookup(claim) : []);
  }
  const sourced = lookups.map((ms) => ms.some((m) => m.confidence >= STRONG));

  const verified: VerifiedClaim[] = claims.map((claim, i) => {
    const matches = lookups[i];
    const { status, rationale } = classify(claim, matches, {
      adjacentSourced: !!sourced[i - 1] || !!sourced[i + 1],
      connected: provider.connected,
    });
    return { ...claim, status, matches, rationale };
  });

  return {
    id: `r-${Date.now().toString(36)}`,
    createdAt: Date.now(),
    input,
    claims: verified,
    summary: summarize(verified),
    provider: provider.name,
    sourcesConnected: provider.connected,
    isDemo: false,
  };
}
