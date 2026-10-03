import { IconInfo } from "@/components/ui/Icons";

/**
 * حدود الأداة — تُعرض دائمًا في الصفحتين، لا في حالة دون أخرى.
 *
 * النص ثابت عن قصد: ما تفعله الأداة وما لا تفعله لا يتغير بحسب النتيجة
 * ولا بحسب حالة المصادر.
 */
export function ScopeNotice() {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-xl2)] border border-line bg-card p-4">
      <IconInfo width={18} height={18} className="mt-0.5 shrink-0 text-accent" />
      <div className="text-[14px] leading-relaxed text-ink-soft">
        <p>
          <span className="font-semibold text-ink">
            بَيِّن أداة للتحقق والتتبّع قبل النشر، وليس جهة فتوى ولا بديلًا عن المختص.
          </span>{" "}
          لا يصدر أحكامًا شرعية مستقلة ولا يرجّح بين الأقوال، ويحيل إلى المختص عند الحاجة،
          ولا تُعتمد نتائجه وحدها قبل النشر.
        </p>
        <p className="mt-1.5 text-[13.5px] text-ink-muted">
          التحقق من المصدر وحالة كل مقطع مطابقة لفظية حتمية على المصدر المرتبط، بلا أي نموذج.
          المراجعة السياقية بالذكاء الاصطناعي اختيارية، وتضيف تنبيهات فقط: لا تغيّر الحالة ولا
          المصادر، ولا يُعرض أي نص مولَّد.
        </p>
      </div>
    </div>
  );
}
