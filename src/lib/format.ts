import type { ClaimStatus } from "@/lib/types";

export const statusMeta: Record<
  ClaimStatus,
  { label: string; color: string; soft: string; hint: string }
> = {
  verified: {
    label: "موثّق",
    color: "var(--color-st-verified)",
    soft: "var(--color-st-verified-soft)",
    hint: "النص موجود في المصدر المرتبط ومنسوب إليه. لا يعني صحة تفسيره أو الاستدلال به",
  },
  review: {
    label: "يحتاج تحقق",
    color: "var(--color-st-review)",
    soft: "var(--color-st-review-soft)",
    hint: "تطابق جزئي، أو لفظ يخالف نص المصدر. يُراجع قبل النشر",
  },
  unsourced: {
    label: "غير مسند",
    color: "var(--color-st-unsourced)",
    soft: "var(--color-st-unsourced-soft)",
    hint: "نُسب إلى مصدر مرتبط ولم يُعثر عليه فيه",
  },
  expert: {
    label: "إحالة لمختص",
    color: "var(--color-st-expert)",
    soft: "var(--color-st-expert-soft)",
    hint: "حكم أو استنباط أو حالة شخصية: لا يصدر بَيِّن نتيجة، ويلزم مختص",
  },
  uncovered: {
    label: "خارج التغطية",
    color: "var(--color-st-uncovered)",
    soft: "var(--color-st-uncovered-soft)",
    hint: "خارج المصادر المرتبطة حاليًا: لا يُنفى ولا يُوثَّق",
  },
  unevaluated: {
    label: "لم يُقيَّم",
    color: "var(--color-st-unevaluated)",
    soft: "var(--color-st-unevaluated-soft)",
    hint: "مقطع أقصر من أن يُطابَق، فلم يدخل التحقق",
  },
};

export const STATUS_ORDER: ClaimStatus[] = [
  "verified",
  "review",
  "unsourced",
  "expert",
  "uncovered",
  "unevaluated",
];

export const claimsLabel = (n: number) =>
  n === 1 ? "ادعاء واحد" : n === 2 ? "ادعاءان" : n <= 10 ? `${n} ادعاءات` : `${n} ادعاءً`;

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function friendlyDate(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = new Date(ts);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return "اليوم";
  if (diff === 1) return "أمس";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function clockTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${h < 12 ? "ص" : "م"}`;
}

/** مقتطف قصير من النص لعرضه في السجل. */
export function snippet(s: string, max = 90): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max).trimEnd() + "…";
}
