import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildReviewMessage, REVIEW_SYSTEM } from "@/lib/ai/prompt";
import { ReviewOutputSchema, ReviewRequestSchema } from "@/lib/ai/schema";
import { REVIEW_LIMITS, type ContextReview } from "@/lib/ai/signals";
import { validateFindings } from "@/lib/ai/validate";

/**
 * نقطة الخادم الوحيدة للمراجعة السياقية.
 *
 * - المفتاح يُقرأ من بيئة الخادم فقط، ولا يصل المتصفح.
 * - لا يُكتب نص المستخدم ولا مخرجات النموذج في أي سجل؛ يُسجَّل سبب
 *   التعذر ومدته فقط.
 * - كل تعذر — مفتاح غائب، مهلة، خطأ مزوّد، مخرجات غير صالحة — يعيد
 *   النتيجة نفسها: «غير متاحة». نتيجة التحقق الأساسية لا تمر من هنا أصلًا.
 */

export const runtime = "nodejs";

const MODEL = "claude-opus-5-5";
const TIMEOUT_MS = Number(process.env.CONTEXT_REVIEW_TIMEOUT_MS) || 20_000;

/** حدّ بسيط للطلبات لكل عنوان، حمايةً للمفتاح من الاستنزاف. */
const RATE = { windowMs: 60_000, max: 10 } as const;
const hits = new Map<string, number[]>();

function rateLimited(request: Request): boolean {
  const who = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(who) ?? []).filter((t) => now - t < RATE.windowMs);
  recent.push(now);
  hits.set(who, recent);
  return recent.length > RATE.max;
}

const unavailable = (reason: string, startedAt: number, status = 200) => {
  // السبب والمدة فقط. لا نص ولا مخرجات.
  console.warn(`[context-review] unavailable: ${reason} (${Date.now() - startedAt}ms)`);
  const body: ContextReview = { state: "unavailable" };
  return Response.json(body, { status });
};

export async function POST(request: Request) {
  const startedAt = Date.now();

  if (rateLimited(request)) return unavailable("rate_limited_local", startedAt, 429);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return unavailable("bad_request", startedAt, 400);
  }

  const parsed = ReviewRequestSchema.safeParse(payload);
  if (!parsed.success) return unavailable("bad_request", startedAt, 400);

  const { segments } = parsed.data;
  const total = segments.reduce((n, s) => n + s.text.length, 0);
  if (total > REVIEW_LIMITS.maxTotalChars) return unavailable("too_large", startedAt, 413);

  if (!process.env.ANTHROPIC_API_KEY) return unavailable("not_configured", startedAt);

  try {
    // بلا إعادة محاولة: المهلة الكلية يجب أن تبقى ضمن ما ينتظره المتصفح.
    const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });

    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: REVIEW_SYSTEM,
      messages: [{ role: "user", content: buildReviewMessage(segments) }],
      output_config: {
        effort: "low",
        format: zodOutputFormat(ReviewOutputSchema),
      },
    });

    if (response.stop_reason === "refusal") return unavailable("refusal", startedAt);
    if (response.stop_reason === "max_tokens") return unavailable("truncated", startedAt);
    if (!response.parsed_output) return unavailable("invalid_output", startedAt);

    const body: ContextReview = {
      state: "done",
      // ما لم يجتز التحقق الحرفي من الدليل يُسقط هنا.
      findings: validateFindings(segments, response.parsed_output.results),
      reviewed: segments.map((s) => s.index),
      model: response.model,
    };
    return Response.json(body);
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) return unavailable("timeout", startedAt);
    if (error instanceof Anthropic.AuthenticationError) return unavailable("auth", startedAt);
    if (error instanceof Anthropic.RateLimitError) return unavailable("rate_limited", startedAt);
    if (error instanceof Anthropic.APIConnectionError) return unavailable("connection", startedAt);
    if (error instanceof Anthropic.APIError) return unavailable(`api_${error.status ?? "error"}`, startedAt);
    // مخرجات لا تطابق المخطط تُرمى من المحلِّل، وتُعامل كغيرها.
    return unavailable("invalid_output", startedAt);
  }
}
