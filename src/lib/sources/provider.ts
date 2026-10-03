import type { Claim, SourceMatch } from "@/lib/types";

/**
 * ─────────────────────────────────────────────────────────────
 *  طبقة المصادر
 *
 *  هذه الطبقة معزولة تمامًا عن منطق التحقق. محرك التحقق لا يعرف
 *  من أين تأتي المصادر، ولا يصل إلى أي مرجع مباشرة — يسأل المزوّد
 *  فقط. تغيير المزوّد لا يمس المحرك.
 *
 *  لا يتضمن هذا المشروع أي مصدر شرعي: لا حقيقيًا ولا مُفترضًا.
 *  المزوّد الافتراضي لا يعيد أي نتيجة، ويُعلن أنه غير متصل.
 *
 *  لربط مصادر معتمدة لاحقًا (RAG أو فهرس أو واجهة برمجية):
 *    1. نفّذ SourceProvider في ملف جديد داخل هذا المجلد.
 *    2. سجّله عبر setSourceProvider عند إقلاع التطبيق.
 *  لا يلزم تعديل أي ملف في verify/ ولا في الواجهة.
 * ─────────────────────────────────────────────────────────────
 */
export interface SourceProvider {
  /** اسم يظهر للمستخدم ويُحفظ مع كل عملية تحقق. */
  readonly name: string;
  /** هل هذا المزوّد مرتبط بمصادر فعلية يمكن الاستناد إليها. */
  readonly connected: boolean;
  /** يبحث عن مواضع استدلال محتملة لادعاء واحد. */
  lookup(claim: Claim): Promise<SourceMatch[]>;
}

/**
 * المزوّد الافتراضي: لا مصادر.
 * صادق بشكل متعمّد — لا يعيد نتائج، فلا يمكن للمحرك أن يوثّق شيئًا.
 */
export const disconnectedProvider: SourceProvider = {
  name: "بدون مصادر مرتبطة",
  connected: false,
  async lookup() {
    return [];
  },
};

let current: SourceProvider = disconnectedProvider;

export function setSourceProvider(p: SourceProvider) {
  current = p;
}

export function getSourceProvider(): SourceProvider {
  return current;
}
