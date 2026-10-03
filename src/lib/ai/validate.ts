import {
  SIGNALS,
  type AlertSignal,
  type ContextFinding,
  type ReviewSegment,
} from "@/lib/ai/signals";

/** أقل عدد كلمات في الدليل: كلمة مفردة لا تدل على سياق. */
const MIN_EVIDENCE_WORDS = 2;
/** أقصى عدد تنبيهات للمقطع الواحد. */
const MAX_PER_SEGMENT = 2;

const isAlert = (s: unknown): s is AlertSignal =>
  typeof s === "string" && s !== "none" && (SIGNALS as readonly string[]).includes(s);

/**
 * يتحقق الخادم من مخرجات النموذج قبل قبولها. ما لا يجتاز يُسقط:
 *   - رقم مقطع لم يُرسل،
 *   - نوع ليس من القائمة المغلقة،
 *   - دليل ليس موجودًا **حرفيًا** في نص ذلك المقطع (بلا تطبيع ولا تساهل).
 *
 * دالة خالصة: لا تعدّل المدخل، ولا تعرف شيئًا عن حالة التحقق أو المصادر.
 */
export function validateFindings(segments: ReviewSegment[], results: unknown): ContextFinding[] {
  if (!Array.isArray(results)) return [];

  const textOf = new Map(segments.map((s) => [s.index, s.text]));
  const perSegment = new Map<number, number>();
  const seen = new Set<string>();
  const out: ContextFinding[] = [];

  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const { index, signal, evidence } = r as Record<string, unknown>;

    if (typeof index !== "number" || !isAlert(signal) || typeof evidence !== "string") continue;

    const text = textOf.get(index);
    if (text === undefined) continue;

    const quoted = evidence.trim();
    if (quoted.split(/\s+/).filter(Boolean).length < MIN_EVIDENCE_WORDS) continue;
    if (!text.includes(quoted)) continue;

    const key = `${index}:${signal}`;
    if (seen.has(key)) continue;
    const count = perSegment.get(index) ?? 0;
    if (count >= MAX_PER_SEGMENT) continue;

    seen.add(key);
    perSegment.set(index, count + 1);
    out.push({ index, signal, evidence: quoted });
  }

  return out;
}
