"use client";

import { useState } from "react";
import type { VerifiedClaim } from "@/lib/types";
import { statusMeta } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconArrow, IconBook } from "@/components/ui/Icons";
import { formatRange, mergeMatchRanges } from "@/lib/verify/ranges";
import { STRONG } from "@/lib/verify/engine";
import type { ContextReview } from "@/lib/ai/signals";
import { ClaimContextReview } from "@/components/verify/ContextReview";

/** حدّ ما يُعرض من المواضع في التفاصيل. للعرض فقط: التحقق يجري على الكل. */
const MAX_SHOWN = 20;
/** فوق هذا العدد تُختصر الترويسة إلى عدد المواضع بدل سردها، فلا تُقص. */
const MAX_LISTED = 6;

export function ClaimCard({
  claim,
  order,
  review,
}: {
  claim: VerifiedClaim;
  order: number;
  /** المراجعة السياقية للعملية، إن وُجدت. تُعرض في قسم مستقل ولا تمسّ ما فوقه. */
  review?: ContextReview;
}) {
  const meta = statusMeta[claim.status];
  const hasSources = claim.matches.length > 0;
  // الترويسة تسند إلى المواضع القوية وحدها. المرشحات الضعيفة تبقى
  // معروضة في التفاصيل، ولا تُقدَّم كإسناد.
  const strongMatches = claim.matches.filter((m) => m.confidence >= STRONG);
  // لفظ قريب من نص المصدر لا مطابق له: الموضع المقصود هو ما خالفه اللفظ.
  const variantMatches = claim.matches.filter((m) => m.audit?.variance?.length);
  const headline = strongMatches.length
    ? strongMatches
    : variantMatches.length
      ? variantMatches
      : claim.matches;
  const ranges = mergeMatchRanges(headline);
  // سرد عشرات الأرقام في سطر واحد يُقص حتمًا؛ يُذكر العدد لكل سورة بدلًا منه.
  const summary =
    headline.length > MAX_LISTED
      ? ranges.map((r) => `${r.group} — ${r.count} موضعًا`).join(" · ")
      : ranges.map((r) => formatRange(r, "الآية", "الآيات")).join(" · ");
  // عند مخالفة اللفظ يُعرض نص المصدر مباشرة، بلا حاجة إلى فتح التفاصيل.
  const [open, setOpen] = useState(strongMatches.length === 0 && variantMatches.length > 0);

  return (
    <article className="overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-card soft">
      {/* شريط الحالة */}
      <div className="h-1" style={{ background: meta.color }} />

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <span className="num grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-[13.5px] font-bold text-ink-soft">
              {order}
            </span>
            <StatusBadge status={claim.status} />
          </span>
          {hasSources ? (
            <span className="num text-[13px] text-ink-muted">
              {claim.matches.length === 1
                ? "موضع استدلال واحد"
                : `${claim.matches.length} مواضع استدلال`}
            </span>
          ) : null}
        </div>

        {/* الادعاء */}
        <p className="mt-3.5 text-[15.5px] font-medium leading-[1.95] text-ink">{claim.text}</p>

        {/* سبب التصنيف */}
        <div className="mt-4 rounded-xl bg-surface/70 p-3.5">
          <p className="text-[13px] font-semibold text-ink-muted">سبب التصنيف</p>
          <p className="mt-1 text-[14.5px] leading-relaxed text-ink-soft">{claim.rationale}</p>
          {claim.status === "verified" ? (
            <p className="mt-2 border-t border-line pt-2 text-[13.5px] leading-relaxed text-ink-muted">
              «موثّق» يثبت وجود النص ونسبته إلى المصدر المرتبط فقط، ولا يعني صحة تفسيره أو
              الاستدلال به أو ما يُستنبط منه.
            </p>
          ) : null}
        </div>

        {/* المصدر */}
        {hasSources ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3 text-right transition-colors duration-200 hover:border-accent-border hover:bg-accent-100/35"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <IconBook width={16} height={16} className="shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {headline[0].source.title}
                  </span>
                  {/* كل المواضع مدموجة في مدى، بدل الموضع الأول وحده */}
                  <span className="block truncate text-[13px] text-ink-muted">
                    {ranges.length ? summary : headline[0].source.locator}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[13.5px] font-semibold text-accent">
                {open ? "إخفاء التفاصيل" : "تفاصيل المصدر"}
                <IconArrow
                  width={14}
                  height={14}
                  className={`transition-transform duration-200 ${open ? "-rotate-90" : ""}`}
                />
              </span>
            </button>

            {open ? (
              /* ارتفاع محدود وتمرير داخلي: آية كثيرة المواضع لا تمدّ البطاقة. */
              <ul className="scroll-slim mt-2.5 max-h-[460px] space-y-2.5 overflow-y-auto pe-1">
                {claim.matches.slice(0, MAX_SHOWN).map((m) => (
                  <li key={m.source.id} className="rounded-xl border border-line bg-surface/60 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[14.5px] font-semibold text-ink">{m.source.title}</span>
                      {m.source.isDemo ? (
                        <span className="rounded-full bg-st-review-soft px-2 py-0.5 text-[12px] font-semibold text-st-review">
                          سجل تجريبي — ليس مرجعًا
                        </span>
                      ) : null}
                    </div>

                    {/* الموضع بمخطط نوع المدوّنة — الواجهة محايدة تجاه النوع */}
                    <dl className="mt-2.5 space-y-1.5 text-[13.5px]">
                      {m.reference ? (
                        m.reference.fields.map((f) => (
                          <div key={f.label} className="flex gap-2">
                            <dt className="w-[92px] shrink-0 text-ink-muted">{f.label}</dt>
                            <dd className="num text-ink-soft">{f.value}</dd>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <dt className="w-[92px] shrink-0 text-ink-muted">الجهة</dt>
                            <dd className="text-ink-soft">{m.source.collection}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="w-[92px] shrink-0 text-ink-muted">الموضع</dt>
                            <dd className="text-ink-soft">{m.source.locator}</dd>
                          </div>
                        </>
                      )}
                      <div className="flex gap-2">
                        <dt className="w-[92px] shrink-0 text-ink-muted">درجة الترشيح</dt>
                        <dd className="num text-ink-soft">{Math.round(m.confidence * 100)}%</dd>
                      </div>
                    </dl>

                    <p className="mt-2.5 text-[13px] font-semibold text-ink-muted">نص الاستدلال</p>
                    <blockquote className="mt-1 border-r-2 border-accent-border pr-3 text-[15px] leading-[2.15] text-ink">
                      {m.source.excerpt}
                    </blockquote>

                    {m.reference ? (
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-[12.5px] text-ink-muted">
                        <span>
                          مصدر البيانات:{" "}
                          <span className="font-semibold text-ink-soft">
                            {m.reference.dataSource}
                          </span>
                        </span>
                        <span>
                          الإصدار:{" "}
                          <span className="num font-semibold text-ink-soft">
                            {m.reference.corpusVersion}
                          </span>
                        </span>
                        <a
                          href={m.reference.dataSourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="font-semibold text-accent underline underline-offset-2 hover:text-accent-700"
                        >
                          {m.reference.dataSourceUrl.replace(/^https?:\/\//, "")}
                        </a>
                        {m.audit?.integrityVerified ? (
                          <span className="text-st-verified">بصمة النص مطابقة</span>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
                {claim.matches.length > MAX_SHOWN ? (
                  <li className="num px-1 text-[13.5px] text-ink-muted">
                    يُعرض هنا {MAX_SHOWN} من {claim.matches.length} موضعًا. المواضع كلها داخلة في
                    التحقق، وبقيتها غير معروضة.
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-line-strong px-3.5 py-3 text-[14px] text-ink-muted">
            لا يوجد مصدر مرتبط بهذا الادعاء.
          </p>
        )}

        {review ? <ClaimContextReview review={review} index={claim.index} /> : null}
      </div>
    </article>
  );
}
