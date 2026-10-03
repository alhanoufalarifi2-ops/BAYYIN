import { z } from "zod";
import { REVIEW_LIMITS, SIGNALS } from "@/lib/ai/signals";

/**
 * المخطط المغلق لمخرجات النموذج (Structured Output).
 *
 * لا يوجد فيه حقل لشرح حر، ولا لسورة أو آية أو حديث أو مرجع أو حالة —
 * فلا قناة أصلًا يستطيع النموذج أن ينشئ بها شيئًا من ذلك.
 */
export const ReviewOutputSchema = z.object({
  results: z.array(
    z.object({
      /** رقم المقطع من القائمة المرسلة. */
      index: z.number().int(),
      signal: z.enum(SIGNALS),
      /** اقتباس حرفي من نص المقطع نفسه؛ فارغ عند none. */
      evidence: z.string(),
    }),
  ),
});

export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

/** شكل الطلب الوارد من المتصفح. أي حقل زائد يُرفض. */
export const ReviewRequestSchema = z
  .object({
    segments: z
      .array(
        z
          .object({
            index: z.number().int().min(0),
            text: z.string().min(1).max(REVIEW_LIMITS.maxSegmentChars),
          })
          .strict(),
      )
      .min(1)
      .max(REVIEW_LIMITS.maxSegments),
  })
  .strict();
