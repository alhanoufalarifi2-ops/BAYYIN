/**
 * المطابقة اللفظية المحافظة.
 *
 * لا تشابه دلالي، ولا متجهات، ولا نموذج لغوي. المقياس الوحيد هو
 * **أطول مقطع متصل مشترك** بين الادعاء ونص المدوّنة بعد التطبيع.
 *
 * السبب: في هذا النطاق، الاقتباس إما أن يكون منقولًا حرفًا بحرف أو
 * لا يكون. والتقارب الموضوعي ليس دليلًا على اقتباس.
 */

export interface MatchSignals {
  /** طول أطول مقطع متصل مشترك، بالمحارف المطبَّعة. */
  spanLength: number;
  /** نسبة تغطية نص المدوّنة بذلك المقطع. */
  passageCoverage: number;
  /** نسبة تغطية الادعاء بذلك المقطع. */
  claimCoverage: number;
  /** موضع المقطع داخل نص المدوّنة المطبَّع. */
  passageStart: number;
  /** موضع المقطع داخل الادعاء المطبَّع. */
  claimStart: number;
}

/**
 * أطول مقطع متصل مشترك.
 * خوارزمية برمجة ديناميكية بذاكرة سطر واحد — O(n·m) زمنًا، O(m) ذاكرة.
 */
export function longestCommonSpan(
  a: string,
  b: string,
): { length: number; aStart: number; bStart: number } {
  if (!a.length || !b.length) return { length: 0, aStart: -1, bStart: -1 };

  let prev = new Uint32Array(b.length + 1);
  let curr = new Uint32Array(b.length + 1);
  let best = 0;
  let bestA = -1;
  let bestB = -1;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > best) {
          best = curr[j];
          bestA = i - best;
          bestB = j - best;
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

  return { length: best, aStart: bestA, bStart: bestB };
}

export function measure(normClaim: string, normPassage: string): MatchSignals {
  const span = longestCommonSpan(normClaim, normPassage);
  return {
    spanLength: span.length,
    passageCoverage: normPassage.length ? span.length / normPassage.length : 0,
    claimCoverage: normClaim.length ? span.length / normClaim.length : 0,
    passageStart: span.bStart,
    claimStart: span.aStart,
  };
}

/**
 * عتبات محافظة — تُعاير لاحقًا على مجموعة موسومة.
 * حتى ذلك الحين يميل النظام إلى التحفظ عمدًا.
 */
export const THRESHOLDS = {
  /** أقل من هذا الطول لا يُعتد به إطلاقًا (تفادي مطابقة كلمات شائعة). */
  minSpan: 14,
  /** مقطع بهذا الطول يُعدّ اقتباسًا صريحًا ولو من نص طويل. */
  longSpan: 40,
  /** تغطية نص المدوّنة التي تكفي لاعتبار الاقتباس كاملًا. */
  fullCoverage: 0.9,
} as const;

/**
 * درجتا الترشيح اللتان يعيدهما المزوّد.
 * 0.86 فوق حد «موثّق» في المحرك العام (0.82)، و0.60 ضمن نطاق «يحتاج تحقق».
 */
export const CONFIDENCE = {
  /** أدنى درجة لمطابقة يُعتد بها إسنادًا. */
  strong: 0.86,
  /** مرشح جزئي: مرجعية محتملة لا إسناد. */
  partial: 0.6,
} as const;

/** درجة تُمرَّر لمحرك القرار العام. مشتقة من الإشارات، لا من نموذج. */
export function confidenceFrom(sig: MatchSignals): number {
  if (sig.spanLength < THRESHOLDS.minSpan) return 0;

  const strong =
    sig.passageCoverage >= THRESHOLDS.fullCoverage || sig.spanLength >= THRESHOLDS.longSpan;

  if (strong) return CONFIDENCE.strong + Math.min(0.13, sig.passageCoverage * 0.13);
  return CONFIDENCE.partial;
}
