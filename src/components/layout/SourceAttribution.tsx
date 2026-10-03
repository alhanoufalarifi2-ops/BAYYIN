"use client";

import { corpusManifest } from "@/lib/sources/quran-provider";

/**
 * إسناد مصدر البيانات.
 *
 * يظهر فقط حين تكون مدوّنة محمّلة فعلًا — فلا يُنسب للمشروع نص غير موجود.
 * شروط Tanzil تقتضي إظهار المصدر بوضوح ووضع رابط إلى tanzil.net.
 */
export function SourceAttribution() {
  const m = corpusManifest();
  if (!m) return null;

  return (
    <section className="mt-8 rounded-[var(--radius-xl2)] border border-line bg-card/60 p-4">
      <p className="text-[13px] font-semibold text-ink-soft">مصدر النص القرآني</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
        النص القرآني في هذا التطبيق مأخوذ من{" "}
        <a
          href={m.dataSourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold text-accent underline underline-offset-2 hover:text-accent-700"
        >
          {m.dataSource}
        </a>{" "}
        — <span className="num">{m.version}</span>، بترخيص Creative Commons Attribution 3.0،
        ويُعرض حرفيًا دون أي تعديل. لمتابعة التحديثات:{" "}
        <a
          href="https://tanzil.net"
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold text-accent underline underline-offset-2 hover:text-accent-700"
        >
          tanzil.net
        </a>
      </p>
    </section>
  );
}
