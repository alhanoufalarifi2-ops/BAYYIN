import type { SourceMatch, VerificationRun, VerifiedClaim } from "@/lib/types";
import { segmentClaims } from "@/lib/claims/segment";
import { classify, summarize } from "@/lib/verify/engine";

/**
 * ─────────────────────────────────────────────────────────────
 *  المثال التوضيحي
 *
 *  غرضه الوحيد إظهار شكل الواجهة والحالات الأربع.
 *
 *  لا يتضمن أي مصدر شرعي — لا حقيقيًا ولا مُفترضًا. النص المُدخل
 *  والسجلات أدناه محتوى محايد عن مراجعة النشر، والسجلات موسومة
 *  صراحةً بأنها تجريبية وليست مراجع.
 *
 *  التصنيف هنا يمر على محرك التحقق نفسه المستخدم في المسار الحقيقي؛
 *  الفرق الوحيد أن نتائج المزوّد مُمرَّرة يدويًا بدل استدعائه.
 * ─────────────────────────────────────────────────────────────
 */

export const DEMO_INPUT = `تمر مراجعة المحتوى قبل النشر بثلاث مراحل أساسية في أغلب فرق التحرير.
يعتمد فريق التحرير على قائمة تحقق موحّدة قبل اعتماد أي مادة.
لا يجوز نشر المادة قبل اعتماد المسؤول عنها.
تنخفض نسبة التصحيحات اللاحقة حين تُراجع المصادر قبل النشر.`;

/** سجلات عرض لا تمثل أي مرجع — أسماؤها صريحة في ذلك. */
const demoMatch = (n: number, confidence: number, excerpt: string): SourceMatch => ({
  confidence,
  source: {
    id: `demo-src-${n}`,
    title: `سجل تجريبي ${n}`,
    locator: `موضع تجريبي ${n}-١`,
    excerpt,
    collection: "مجموعة سجلات تجريبية — ليست مصادر",
    isDemo: true,
  },
});

/** درجات مُمرَّرة يدويًا لإظهار كل حالة. الفهرس = ترتيب الادعاء. */
const SCRIPTED: Record<number, SourceMatch[]> = {
  0: [demoMatch(1, 0.91, "نص تجريبي يمثل موضع الاستدلال كما سيظهر عند ربط مصدر فعلي.")],
  1: [demoMatch(2, 0.58, "نص تجريبي يمثل مرجعية محتملة يحتاج سياقها إلى مراجعة.")],
  2: [],
  3: [],
};

export function buildDemoRun(): VerificationRun {
  const claims = segmentClaims(DEMO_INPUT);

  const verified: VerifiedClaim[] = claims.map((claim) => {
    const matches = SCRIPTED[claim.index] ?? [];
    const { status, rationale } = classify(claim, matches, { inCoverage: true });
    return { ...claim, status, matches, rationale };
  });

  return {
    id: "r-demo",
    createdAt: Date.now(),
    input: DEMO_INPUT,
    claims: verified,
    summary: summarize(verified),
    provider: "مثال توضيحي — سجلات تجريبية",
    sourcesConnected: false,
    isDemo: true,
  };
}
