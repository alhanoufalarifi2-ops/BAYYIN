import type { Claim } from "@/lib/types";
import { normalizeArabic } from "@/lib/sources/arabic";

/**
 * ─────────────────────────────────────────────────────────────
 *  سجل أنواع المدوّنات
 *
 *  النواة لا تعرف أي مجال. كل معرفة مجالية تُعلَن هنا عبر واصف نوع.
 *  إضافة نوع جديد = تسجيل واصف، بلا تعديل في النواة ولا في محرك
 *  القرار ولا في الواجهة.
 * ─────────────────────────────────────────────────────────────
 */

/** أقصى حالة يستطيع النوع بلوغها مهما بلغت درجة المطابقة. */
export type StatusCeiling = "verified" | "review" | "unsourced";

export interface SourceTypeDescriptor {
  readonly id: string;
  readonly label: string;

  /** ما الذي يثبته هذا النوع — ويُعرض للمستخدم كي لا يُفهم أكثر مما يحتمل. */
  readonly evidentiaryModel: string;

  /** ما يغطيه هذا النوع، بعبارة تُعرض للمستخدم عند بيان حدود التغطية. */
  readonly coverage: string;

  /**
   * عبارات تأطير تُقدَّم بها نصوص هذا النوع أو تُختم («قال تعالى»…).
   * تدل على نسبة النص إلى هذا النوع، وليست من النص نفسه — فلا تُحتسب
   * نقصًا في تغطية الادعاء.
   */
  readonly framingPhrases: readonly string[];

  /** ألفاظ تدل على نسبة النص إلى هذا النوع دون أن تكون تأطيرًا مباشرًا. */
  readonly attributionWords: readonly string[];

  /** ما لا يثبته، صراحةً. */
  readonly doesNotEstablish: readonly string[];

  /**
   * السقف المعلَن. يُخفَّض تلقائيًا إن غابت الطبقات المصاحبة اللازمة
   * (انظر requiredCompanions).
   */
  readonly declaredCeiling: StatusCeiling;

  /** طبقات لا يبلغ النوع سقفه بدونها. فارغة = لا يحتاج شيئًا. */
  readonly requiredCompanions: readonly string[];

  /**
   * إحالة إلزامية خاصة بهذا النوع.
   * تُعيد سبب الإحالة إن وجب، وإلا null.
   */
  mandatoryEscalation(claim: Claim): string | null;
}

const types = new Map<string, SourceTypeDescriptor>();

export function registerSourceType(t: SourceTypeDescriptor) {
  types.set(t.id, t);
}

export function getSourceType(id: string): SourceTypeDescriptor | undefined {
  return types.get(id);
}

export function registeredTypes(): SourceTypeDescriptor[] {
  return [...types.values()];
}

/**
 * البوابة النوعية: تُستشار بعد البوابة العامة وقبل النظر في الدرجات.
 * حين لا يُسجَّل أي نوع تعيد null، فيبقى سلوك النظام كما هو تمامًا.
 */
export function typeMandatedEscalation(claim: Claim): string | null {
  for (const t of types.values()) {
    const reason = t.mandatoryEscalation(claim);
    if (reason) return reason;
  }
  return null;
}

export interface Attribution {
  /** هل ينسب الادعاء نفسه إلى نوع مسجَّل (فيكون داخل تغطيته). */
  attributed: boolean;
  /** لكل كلمة: هل هي من عبارة تأطير. */
  framing: boolean[];
}

const phraseCache = new Map<string, string[][]>();

function phrasesOf(typeId: string, list: readonly string[], kind: string): string[][] {
  const key = `${typeId}:${kind}`;
  let hit = phraseCache.get(key);
  if (!hit) {
    hit = list.map((p) => normalizeArabic(p).split(" ")).filter((p) => p[0] !== "");
    phraseCache.set(key, hit);
  }
  return hit;
}

/** الكلمة الأولى قد تتصل بها واو أو فاء أو كاف («وقال تعالى»، «كقوله تعالى»). */
function startsPhrase(words: string[], at: number, phrase: string[]): boolean {
  if (at + phrase.length > words.length) return false;
  for (let k = 0; k < phrase.length; k++) {
    const w = words[at + k];
    if (w === phrase[k]) continue;
    if (k === 0 && /^[وفك]/.test(w) && w.slice(1) === phrase[0]) continue;
    return false;
  }
  return true;
}

/**
 * نسبة الادعاء إلى الأنواع المسجَّلة.
 * تعمل على كلمات مطبَّعة، وتبقى محايدة تجاه الأنواع: كل نوع يعلن عباراته.
 */
export function attributionOf(words: string[]): Attribution {
  const framing = words.map(() => false);
  let attributed = false;

  for (const t of types.values()) {
    for (const phrase of phrasesOf(t.id, t.framingPhrases, "framing")) {
      for (let i = 0; i < words.length; i++) {
        if (!startsPhrase(words, i, phrase)) continue;
        attributed = true;
        for (let k = 0; k < phrase.length; k++) framing[i + k] = true;
      }
    }
    for (const phrase of phrasesOf(t.id, t.attributionWords, "attribution")) {
      for (let i = 0; i < words.length; i++) {
        if (startsPhrase(words, i, phrase)) attributed = true;
      }
    }
  }
  return { attributed, framing };
}

/** ما تغطيه الأنواع المسجَّلة، بعبارة تُعرض للمستخدم. */
export function coverageLabel(): string {
  return [...types.values()].map((t) => t.coverage).join("، ");
}

/** السقف الفعلي بعد احتساب الطبقات المصاحبة المتوفرة. */
export function effectiveCeiling(
  t: SourceTypeDescriptor,
  availableCompanions: readonly string[],
): StatusCeiling {
  const missing = t.requiredCompanions.filter((c) => !availableCompanions.includes(c));
  return missing.length > 0 ? "review" : t.declaredCeiling;
}
