/**
 * ─────────────────────────────────────────────────────────────
 *  المراجعة السياقية بالذكاء الاصطناعي — الأنواع والنصوص الثابتة
 *
 *  طبقة مستقلة تأتي **بعد** نتيجة التحقق الحتمية ولا تملك أي مسار
 *  لتغييرها: لا الحالة، ولا الجاهزية، ولا المصادر.
 *
 *  النموذج لا يكتب أي نص يُعرض للمستخدم. يختار نوع تنبيه من قائمة
 *  مغلقة، ويقتبس دليله حرفيًا من نص المستخدم نفسه. كل ما يُقرأ في
 *  الواجهة مكتوب هنا مسبقًا.
 * ─────────────────────────────────────────────────────────────
 */

/** القائمة المغلقة لأنواع الإشارات. لا يُقبل من النموذج غيرها. */
export const SIGNALS = [
  "interpretive_inference",
  "personal_religious_question",
  "possible_hadith_attribution",
  "context_requires_specialist",
  "none",
] as const;

export type ContextSignal = (typeof SIGNALS)[number];
export type AlertSignal = Exclude<ContextSignal, "none">;

/** ما يراه المستخدم لكل نوع — نص ثابت، لا شيء منه مولَّد. */
export const SIGNAL_TEXT: Record<AlertSignal, { label: string; note: string }> = {
  interpretive_inference: {
    label: "استنتاج أو تفسير",
    note: "يبدو أن المقطع يستنتج معنى أو دلالة من نص شرعي. التحقق اللفظي لا يثبت صحة الاستنتاج؛ يُراجع مع مختص قبل النشر.",
  },
  personal_religious_question: {
    label: "سؤال عن حالة شخصية",
    note: "يبدو سؤالًا عن واقعة شخصية لها أثر شرعي. بَيِّن لا يفتي ولا يحكم في الوقائع الفردية؛ يُرجع فيه إلى جهة إفتاء مؤهلة.",
  },
  possible_hadith_attribution: {
    label: "نسبة محتملة إلى السنة أو الأثر",
    note: "يبدو أن المقطع ينسب قولًا إلى السنة أو الأثر. مصادر الحديث غير مرتبطة في هذه النسخة؛ يُتحقق منه من مصدر حديثي معتمد قبل النشر.",
  },
  context_requires_specialist: {
    label: "سياق يحتاج مختصًا",
    note: "يبدو أن المقطع يتضمن حكمًا أو مسألة شرعية تحتاج نظر مختص قبل النشر.",
  },
};

/** مقطع يُرسل للمراجعة: رقمه ونصه كما كتبه المستخدم. لا شيء غيرهما. */
export interface ReviewSegment {
  index: number;
  text: string;
}

/** تنبيه واحد بعد أن تحقق الخادم من دليله. */
export interface ContextFinding {
  index: number;
  signal: AlertSignal;
  /** مقتبس حرفيًا من نص المقطع — تحقق الخادم من وجوده فيه. */
  evidence: string;
}

/**
 * نتيجة المراجعة السياقية لعملية تحقق واحدة.
 * تُحفظ في حقل مستقل على العملية، خارج الادعاءات والملخص.
 */
export type ContextReview =
  | { state: "pending"; requestedAt: number }
  | {
      state: "done";
      findings: ContextFinding[];
      /** أرقام المقاطع التي أُرسلت فعلًا. ما ليس هنا لم يغادر الجهاز. */
      reviewed: number[];
      model: string;
    }
  | { state: "unavailable" };

/** أقصى ما يُرسل في طلب واحد. ما زاد لا يُقتطع بصمت: تُعلن المراجعة غير متاحة. */
export const REVIEW_LIMITS = {
  maxSegments: 40,
  maxSegmentChars: 2000,
  maxTotalChars: 12000,
} as const;

/** بعد هذه المدة تُعدّ المراجعة المعلّقة غير متاحة (إغلاق الصفحة أثناء الطلب مثلًا). */
export const PENDING_EXPIRY_MS = 45_000;
