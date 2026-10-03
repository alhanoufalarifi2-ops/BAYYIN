"use client";

import { useEffect, useRef } from "react";
import { bootstrapSources } from "@/lib/sources/bootstrap";

/**
 * يهيّئ طبقة المصادر مرة واحدة عند الإقلاع، ثم يُعلم بقية الشجرة.
 * لا يعرض شيئًا.
 *
 * التأثير يعمل مرة واحدة فقط: `onReady` تُمرَّر عادةً كدالة ضمنية، فتتغير
 * هويتها في كل رسم. وضعها في قائمة الاعتماديات كان يُعيد تشغيل التأثير
 * بعد كل رسم، وكل تشغيل يُحدث حالة تُسبب رسمًا جديدًا — حلقة لا نهائية
 * تُشبع المسار الرئيسي فتتوقف الصفحة عن استقبال أي إدخال.
 * لذلك تُحفظ الدالة في مرجع ويبقى الاعتماد فارغًا.
 */
export function SourcesBootstrap({ onReady }: { onReady?: () => void }) {
  const onReadyRef = useRef(onReady);

  // المزامنة داخل تأثير: تعديل المرجع أثناء الرسم غير مسموح.
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let alive = true;
    bootstrapSources().then(() => {
      if (alive) onReadyRef.current?.();
    });
    return () => {
      alive = false;
    };
  }, []);

  return null;
}
