import {
  PENDING_EXPIRY_MS,
  SIGNAL_TEXT,
  type ContextFinding,
  type ContextReview as Review,
} from "@/lib/ai/signals";

/**
 * «مراجعة سياقية بالذكاء الاصطناعي» — قسم مستقل عن حالة التحقق.
 *
 * يعرض تنبيهات فقط: لا يغيّر الحالة ولا الجاهزية ولا المصادر، ولا يعرض
 * أي نص كتبه النموذج. العنوان والشرح ثابتان في التطبيق، والدليل مقتبس
 * من نص المستخدم نفسه.
 */

const TITLE = "مراجعة سياقية بالذكاء الاصطناعي";

/** المراجعة المعلّقة التي طال انتظارها تُعرض غير متاحة. */
export function effectiveReview(review: Review | undefined, now: number): Review | undefined {
  if (review?.state === "pending" && now - review.requestedAt > PENDING_EXPIRY_MS) {
    return { state: "unavailable" };
  }
  return review;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-accent-border bg-accent-100/30 p-3.5">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-accent-700">
        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          AI
        </span>
        {TITLE}
      </p>
      {children}
    </div>
  );
}

/** القسم داخل بطاقة الادعاء. */
export function ClaimContextReview({ review, index }: { review: Review; index: number }) {
  if (review.state === "pending") {
    return (
      <Shell>
        <p className="mt-1.5 text-[14px] text-ink-muted">جارٍ تحليل السياق…</p>
      </Shell>
    );
  }

  // عند التعذر تكفي الرسالة العامة أعلى الصفحة؛ لا تُكرَّر في كل بطاقة.
  if (review.state === "unavailable") return null;

  if (!review.reviewed.includes(index)) {
    return (
      <Shell>
        <p className="mt-1.5 text-[14px] text-ink-muted">
          لم يُرسل هذا المقطع إلى النموذج، فلم يدخل المراجعة السياقية.
        </p>
      </Shell>
    );
  }

  const findings: ContextFinding[] = review.findings.filter((f) => f.index === index);
  if (findings.length === 0) {
    return (
      <Shell>
        <p className="mt-1.5 text-[14px] text-ink-muted">لم تُرصد إشارة سياقية في هذا المقطع.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <ul className="mt-2 space-y-2.5">
        {findings.map((f) => (
          <li key={f.signal}>
            <p className="text-[14.5px] font-semibold text-ink">{SIGNAL_TEXT[f.signal].label}</p>
            <p className="mt-0.5 text-[14px] leading-relaxed text-ink-soft">
              {SIGNAL_TEXT[f.signal].note}
            </p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
              موضع الإشارة في نصك: <span className="text-ink-soft">«{f.evidence}»</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 border-t border-accent-border/60 pt-2 text-[13px] leading-relaxed text-ink-muted">
        تنبيه مساعد فقط: لا يغيّر حالة التحقق ولا الجاهزية ولا المصادر.
      </p>
    </Shell>
  );
}

/** سطر الحالة العام أعلى صفحة النتيجة. */
export function ContextReviewStatus({ review }: { review: Review }) {
  const body =
    review.state === "pending"
      ? "جارٍ تحليل سياق المقاطع… نتيجة التحقق أدناه مكتملة ولا تنتظر هذه المراجعة."
      : review.state === "unavailable"
        ? "المراجعة السياقية غير متاحة حاليًا. نتيجة التحقق أدناه لم تتأثر."
        : review.reviewed.length === 0
          ? "لا توجد مقاطع تحتاج مراجعة سياقية، فلم يُرسل شيء إلى النموذج."
          : `راجع النموذج ${review.reviewed.length} من المقاطع ورصد ${review.findings.length} من الإشارات. التنبيهات لا تغيّر حالة التحقق ولا الجاهزية ولا المصادر.`;

  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-xl2)] border border-dashed border-accent-border bg-accent-100/30 p-4">
      <span className="mt-0.5 shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
        AI
      </span>
      <div>
        <p className="text-[14px] font-semibold text-accent-700">{TITLE}</p>
        <p className="num mt-1 text-[14px] leading-relaxed text-ink-soft">{body}</p>
      </div>
    </div>
  );
}
