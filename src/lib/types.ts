/** بَيِّن | BAYYIN — أنواع المجال. */

import type { ContextReview } from "@/lib/ai/signals";

/**
 * حالات التحقق الأربع، ومعها حالتان ليستا حكمًا على الادعاء:
 *
 * - `uncovered`: المقطع من نوع لا تغطيه المصادر المرتبطة حاليًا. ليس
 *   «غير مسند»: غير المسند نصٌّ نُسب إلى مصدر مرتبط فلم يوجد فيه، أما هذا
 *   فلا يملك النظام ما يقيسه عليه أصلًا — فلا يُنفى ولا يُوثَّق.
 * - `unevaluated`: المقطع أقصر من أن يدخل التحقق. وُجدت لئلا يُسقط أي
 *   جزء من نص المستخدم في صمت.
 */
export type ClaimStatus =
  | "verified"
  | "review"
  | "unsourced"
  | "expert"
  | "uncovered"
  | "unevaluated";

/** ادعاء مرشّح استُخرج من النص المُدخل. */
export interface Claim {
  id: string;
  /** نص الادعاء كما ورد في المحتوى. */
  text: string;
  /** ترتيبه في النص الأصلي. */
  index: number;
  /** موضعه في النص الأصلي، لإبرازه لاحقًا. */
  offset: { start: number; end: number };
}

/**
 * سجل مصدر.
 *
 * هذا النوع يصف *شكل* المصدر فقط. لا يحتوي المشروع على أي مصدر شرعي
 * حقيقي أو مُفترض؛ تُملأ هذه السجلات من مزوّد مصادر خارجي يُربط لاحقًا.
 */
export interface SourceRecord {
  id: string;
  /** اسم المرجع كما يورده المزوّد. */
  title: string;
  /** موضع الاستدلال داخل المرجع (رقم، باب، صفحة… حسب المزوّد). */
  locator: string;
  /** نص الاستدلال كما ورد في المرجع. */
  excerpt: string;
  /** جهة المصدر التي قدّمت السجل. */
  collection: string;
  /** true إذا كان السجل بيانات عرض لا مصدرًا حقيقيًا. */
  isDemo: boolean;
}

/**
 * الموضع المرجعي بمخطط نوع المدوّنة.
 * الحقول تُبنى عند الاستيعاب بأسماء يحددها النوع، فتبقى الواجهة
 * محايدة تجاه الأنواع ولا تعرف شيئًا عن مخطط أي نوع بعينه.
 */
export interface SourceReference {
  typeId: string;
  /** أزواج (التسمية، القيمة) بترتيب العرض. */
  fields: { label: string; value: string }[];
  corpusVersion: string;
  /** جهة البيانات كما تُنسب للمستخدم. */
  dataSource: string;
  dataSourceUrl: string;
  /**
   * لدمج المواضع المتجاورة في مدى واحد: اسم المجموعة ورقم الموضع داخلها.
   * حقلان عامّان يملؤهما كل نوع بمخططه، فيبقى الدمج في الواجهة محايدًا
   * تجاه الأنواع.
   */
  group?: string;
  ordinal?: number;
}

/** إشارات المطابقة الخام — لسجل التدقيق ولشفافية سبب التصنيف. */
export interface MatchAudit {
  spanLength: number;
  passageCoverage: number;
  claimCoverage: number;
  /** موضع بداية المقطع المطابَق داخل الادعاء المطبَّع. */
  claimStart: number;
  /** طول الادعاء المطبَّع — مقام احتساب تغطية الادعاء. */
  claimLength: number;
  /** هل تحققت بصمة النص قبل الاستشهاد. */
  integrityVerified: boolean;
  /** آلية المطابقة المستخدمة. */
  method: string;
  /**
   * مواضع يخالف فيها لفظ الادعاء نص المصدر داخل المقطع المطابَق.
   * وجودها يعني أن الادعاء قريب من النص لا مطابق له، فلا يُوثَّق.
   */
  variance?: MatchVariance[];
}

/** فرق واحد بين لفظ الادعاء ونص المصدر. أحد الطرفين قد يكون فارغًا. */
export interface MatchVariance {
  /** ما كتبه المستخدم في هذا الموضع (فارغ = كلمة سقطت من نقله). */
  claim: string;
  /** ما في المصدر في هذا الموضع، كما ورد حرفيًا (فارغ = زيادة ليست فيه). */
  source: string;
}

/** نتيجة مطابقة ادعاء بمصدر، كما يعيدها مزوّد المصادر. */
export interface SourceMatch {
  source: SourceRecord;
  /** درجة الترشيح كما يقدّمها المزوّد، من 0 إلى 1. */
  confidence: number;
  reference?: SourceReference;
  audit?: MatchAudit;
}

/** الادعاء بعد المرور على محرك التحقق. */
export interface VerifiedClaim extends Claim {
  status: ClaimStatus;
  matches: SourceMatch[];
  /** سبب التصنيف، بصيغة يقرؤها المستخدم. */
  rationale: string;
}

export interface VerificationSummary {
  total: number;
  verified: number;
  review: number;
  unsourced: number;
  expert: number;
  /** مقاطع خارج تغطية المصادر المرتبطة. تُحتسب في `total` ولا ترفع الجاهزية. */
  uncovered: number;
  /** مقاطع لم تدخل التحقق. تُحتسب في `total` ولا ترفع الجاهزية. */
  unevaluated: number;
  /** جاهزية المحتوى للنشر، من 0 إلى 100. */
  readiness: number;
}

export interface VerificationRun {
  id: string;
  createdAt: number;
  /** النص الأصلي كما أدخله المستخدم. */
  input: string;
  claims: VerifiedClaim[];
  summary: VerificationSummary;
  /** اسم مزوّد المصادر الذي أنتج هذه النتيجة. */
  provider: string;
  /** هل كان هناك مزوّد مصادر متصل أثناء هذا التحقق. */
  sourcesConnected: boolean;
  /** true إذا كانت هذه نتيجة المثال التوضيحي لا تحققًا لنص المستخدم. */
  isDemo: boolean;
  /**
   * المراجعة السياقية بالذكاء الاصطناعي — إن فعّلها المستخدم.
   * حقل مستقل عن `claims` و`summary`: تنبيهات فقط، لا تدخل في الحالة
   * ولا في الجاهزية ولا في المصادر.
   */
  aiReview?: ContextReview;
}

export interface BayyinState {
  runs: VerificationRun[];
  activeRunId: string | null;
}
