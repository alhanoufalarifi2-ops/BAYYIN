import type { Claim } from "@/lib/types";

/**
 * تقسيم النص إلى ادعاءات مرشّحة.
 *
 * هذه عملية حقيقية تعمل محليًا: تجزئة لغوية حتمية بلا ذكاء اصطناعي
 * وبلا أي اتصال خارجي. لا تفهم المعنى، وإنما تفصل الجمل عند علامات
 * الترقيم العربية والفواصل السطرية.
 *
 * **ولا تُسقط شيئًا من نص المستخدم.** كل مقطع يدخل النتيجة؛ وما كان
 * أقصر من أن يُطابَق لفظيًا يُعلَن في الواجهة «لم يُقيَّم» ويُحتسب في
 * مقام الجاهزية. الإسقاط الصامت — الذي كان هنا بعتبة أربع كلمات —
 * جعل النظام يعطي 100/100 على جزء من النص وقد تجاهل بقيته بلا إشارة،
 * وذلك مساس بصدق النتيجة. قرار القابلية للتقييم في `engine.isEvaluable`
 * لا هنا، لأنه يعتمد على عتبة المطابقة نفسها.
 *
 * تمييزها عن الاستخراج الدلالي مقصود: الاستخراج الدلالي يحتاج نموذجًا
 * لغويًا لم يُربط بعد.
 */

/** نهايات الجمل في النص العربي. */
const TERMINATORS = /([.؟!،؛\n]+)/;

export function segmentClaims(input: string): Claim[] {
  const text = input.replace(/\r\n/g, "\n");
  const out: Claim[] = [];

  let cursor = 0;
  let index = 0;

  for (const piece of text.split(TERMINATORS)) {
    if (!piece) continue;
    const start = text.indexOf(piece, cursor);
    cursor = start + piece.length;

    // الفواصل نفسها تُتخطى، لكن المؤشر تقدّم فوقها بالفعل
    if (TERMINATORS.test(piece) && piece.trim().length <= 2) continue;

    const trimmed = piece.trim();
    if (!trimmed) continue;

    const offsetStart = start + piece.indexOf(trimmed);
    out.push({
      id: `c-${index}`,
      text: trimmed,
      index,
      offset: { start: offsetStart, end: offsetStart + trimmed.length },
    });
    index++;
  }

  return out;
}

export function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
