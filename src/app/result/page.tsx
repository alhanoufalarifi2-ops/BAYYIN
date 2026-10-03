"use client";

import Link from "next/link";
import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Meter } from "@/components/ui/Meter";
import { ClaimCard } from "@/components/verify/ClaimCard";
import { ScopeNotice } from "@/components/layout/ScopeNotice";
import { ContextReviewStatus, effectiveReview } from "@/components/verify/ContextReview";
import {
  IconArrow,
  IconClock,
  IconPlug,
  IconSearch,
  IconTrash,
} from "@/components/ui/Icons";
import { STATUS_ORDER, claimsLabel, clockTime, friendlyDate, snippet, statusMeta } from "@/lib/format";
import { actions, activeRun, useBayyin, useHydrated } from "@/lib/store";
import type { ClaimStatus } from "@/lib/types";

type Filter = "all" | ClaimStatus;

export default function ResultPage() {
  const state = useBayyin();
  const hydrated = useHydrated();
  const run = activeRun(state);
  const [filter, setFilter] = useState<Filter>("all");
  // لحظة فتح الصفحة: مراجعة معلّقة أقدم من مهلتها تُعرض «غير متاحة».
  const [openedAt] = useState(() => Date.now());

  if (hydrated && !run) {
    return (
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-[620px] px-5 pt-24 text-center">
          <h1 className="text-[22px] font-bold text-ink">لا توجد نتيجة لعرضها</h1>
          <p className="mx-auto mt-2 max-w-[380px] text-[14px] leading-relaxed text-ink-soft">
            ابدأ بلصق محتوى في الصفحة الرئيسية، أو افتح المثال التوضيحي.
          </p>
          <div className="mt-7">
            <ButtonLink href="/" size="lg">
              <IconSearch width={16} height={16} />
              ابدأ تحققًا جديدًا
            </ButtonLink>
          </div>
        </main>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-dvh">
        <AppHeader />
      </div>
    );
  }

  const s = run.summary;
  const review = effectiveReview(run.aiReview, openedAt);
  const shown = filter === "all" ? run.claims : run.claims.filter((c) => c.status === filter);

  /**
   * المؤشر الرقمي يظهر فقط حين يكون للرقم معنى: أي حين توجد مصادر مرتبطة
   * فعليًا. يُستثنى المثال التوضيحي لأن غرضه إظهار شكل المؤشر، وهو موسوم
   * بوضوح بأنه توضيحي. بعد ربط مصادر معتمدة يعود المؤشر للعمل تلقائيًا —
   * وحينها يصبح الصفر نتيجة حقيقية لا أثرًا لغياب المصادر.
   */
  // ?? 0: نتائج محفوظة قبل إضافة «خارج التغطية» لا تحمل هذا الحقل.
  const uncovered = s.uncovered ?? 0;

  const counts: Record<ClaimStatus, number> = {
    verified: s.verified,
    review: s.review,
    unsourced: s.unsourced,
    expert: s.expert,
    uncovered,
    unevaluated: s.unevaluated,
  };

  // وكذلك حين يكون النص كله خارج ما تغطيه المصادر المرتبطة: لا يوجد ما
  // يُقاس، والصفر عندها ليس تقييمًا.
  const measurable = s.verified + s.review + s.unsourced + s.expert > 0;
  const sourcesAvailable = run.sourcesConnected || run.isDemo;
  const readinessEvaluable = sourcesAvailable && measurable;

  return (
    <div className="min-h-dvh">
      <AppHeader
        action={
          <ButtonLink href="/" variant="soft" size="sm">
            <IconSearch width={14} height={14} />
            تحقق جديد
          </ButtonLink>
        }
      />

      <main className="mx-auto max-w-[1120px] px-5 pb-16">
        <div className="rise pt-5 sm:pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-bold tracking-tight text-ink">نتيجة التحقق</h1>
              <p className="num mt-1.5 text-[14px] text-ink-muted">
                {friendlyDate(run.createdAt)} · {clockTime(run.createdAt)} · {claimsLabel(s.total)}
              </p>
            </div>
            {run.isDemo ? (
              <span className="rounded-full bg-st-review-soft px-3 py-1.5 text-[13.5px] font-semibold text-st-review">
                مثال توضيحي — سجلات تجريبية لا مصادر
              </span>
            ) : null}
          </div>
        </div>

        {/* ─── الملخص + مؤشر الجاهزية ─── */}
        <section className="rise mt-4 grid gap-3 sm:mt-5 lg:grid-cols-[1fr_320px]">
          <div className="rounded-[var(--radius-xl2)] border border-line bg-card p-4 soft sm:p-5">
            <div className="grid grid-cols-4 gap-x-2 gap-y-3 lg:grid-cols-7">
              <Stat label="الادعاءات" value={s.total} color="var(--color-ink)" />
              {STATUS_ORDER.map((st) => (
                <Stat
                  key={st}
                  label={statusMeta[st].label}
                  value={counts[st]}
                  color={statusMeta[st].color}
                />
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-xl2)] border border-line bg-card p-4 soft sm:p-5">
            <p className="text-[14px] font-semibold text-ink-soft">جاهزية المحتوى</p>

            {readinessEvaluable ? (
              <>
                <p className="mt-2 flex items-baseline gap-1.5">
                  <span className="num text-[38px] font-bold leading-none text-ink">
                    {s.readiness}
                  </span>
                  <span className="text-[14px] text-ink-muted">/ 100</span>
                </p>
                <div className="mt-3">
                  <Meter
                    value={s.readiness}
                    color={
                      s.readiness >= 70
                        ? "var(--color-st-verified)"
                        : s.readiness >= 35
                          ? "var(--color-st-review)"
                          : "var(--color-st-unsourced)"
                    }
                    label="جاهزية المحتوى للنشر"
                  />
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">
                  يُحتسب المؤشر من نسبة الموثّق ونصف ما يحتاج تحققًا. ليس حكمًا على صحة المحتوى.
                </p>
                {uncovered > 0 ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-st-review">
                    يشمل المقام{" "}
                    <span className="num font-semibold">{uncovered}</span> مقطعًا خارج تغطية
                    المصادر المرتبطة. لم يُتحقق منها، فلا ترفع الجاهزية — وليس ذلك حكمًا عليها.
                  </p>
                ) : null}
                {s.unevaluated > 0 ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-st-review">
                    يشمل المقام{" "}
                    <span className="num font-semibold">{s.unevaluated}</span> مقطعًا لم يُقيَّم،
                    فلا تبلغ الجاهزية 100 وجزء من النص خارج التحقق.
                  </p>
                ) : null}
              </>
            ) : (
              /* بلا مصادر مرتبطة، الرقم صفر حتمًا لا لضعف المحتوى بل لغياب ما يُقاس
                 عليه — وعرضه 0/100 يقرؤه المستخدم تقييمًا سلبيًا. */
              <>
                <p className="mt-2.5 text-[21px] font-bold leading-tight text-ink-soft">
                  غير قابلة للتقييم
                </p>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                  {sourcesAvailable
                    ? "لا يتضمن النص ما تغطيه المصادر المرتبطة حاليًا، فلا يوجد ما يُقاس عليه الإسناد."
                    : "لا توجد مصادر معتمدة مرتبطة حاليًا، فلا يوجد ما يُقاس عليه الإسناد."}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                  {sourcesAvailable
                    ? "هذا ليس تقييمًا لصحة المحتوى ولا حكمًا عليه، ولا توثيقًا له."
                    : "هذا ليس تقييمًا لصحة المحتوى ولا حكمًا عليه. يعود المؤشر الرقمي للعمل تلقائيًا بعد ربط مصادر معتمدة."}
                </p>
              </>
            )}
          </div>
        </section>

        {/* ─── حدود الأداة: ظاهرة دائمًا. على الشاشات العريضة قبل النتائج؛
             وعلى الجوال بعدها مباشرة، ليصل المستخدم إلى النتيجة أسرع. ─── */}
        <section className="rise mt-3 hidden lg:block">
          <ScopeNotice />
        </section>

        {/* ─── المراجعة السياقية: قسم مستقل عن النتيجة ─── */}
        {review ? (
          <section className="rise mt-3">
            <ContextReviewStatus review={review} />
          </section>
        ) : null}

        {/* ─── إعلان حالة المصادر ─── */}
        {!run.sourcesConnected ? (
          <section className="rise mt-3">
            <div className="flex items-start gap-3 rounded-[var(--radius-xl2)] border border-st-review/25 bg-st-review-soft p-4">
              <IconPlug width={18} height={18} className="mt-0.5 shrink-0 text-st-review" />
              <p className="text-[14px] leading-relaxed text-st-review">
                {run.isDemo
                  ? "هذه نتيجة مثال توضيحي. السجلات المعروضة تجريبية وليست مراجع، وقد أُدرجت لبيان شكل الواجهة فقط."
                  : "لم تُربط مصادر معتمدة بعد، لذا لا يمكن توثيق أي ادعاء. التقسيم أعلاه نتيجة تحليل فعلي لنصك، والتصنيف يعكس غياب المصادر لا ضعف المحتوى."}
              </p>
            </div>
          </section>
        ) : null}

        {/* ─── تصفية + بطاقات الادعاءات ─── */}
        <section className="rise mt-5 sm:mt-7">
          {/* على الجوال صف واحد يُمرَّر أفقيًا، فلا تأخذ المرشحات صفّين */}
          <div className="scroll-slim mb-3 flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              الكل ({s.total})
            </FilterChip>
            {STATUS_ORDER.filter((st) => counts[st] > 0).map((st) => (
              <FilterChip
                key={st}
                active={filter === st}
                onClick={() => setFilter(st)}
                color={statusMeta[st].color}
              >
                {statusMeta[st].label} ({counts[st]})
              </FilterChip>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-[var(--radius-xl2)] border border-dashed border-line-strong p-10 text-center text-[15px] text-ink-muted">
              لا توجد ادعاءات في هذه الحالة.
            </p>
          ) : (
            /* items-start: البطاقة القصيرة لا تتمدد بارتفاع جارتها */
            <div className="grid items-start gap-3 lg:grid-cols-2">
              {shown.map((c) => (
                <ClaimCard key={c.id} claim={c} order={c.index + 1} review={review} />
              ))}
            </div>
          )}
        </section>

        <section className="rise mt-4 lg:hidden">
          <ScopeNotice />
        </section>

        {/* ─── سجل عمليات التحقق ─── */}
        <section className="rise mt-9">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-[14.5px] font-semibold text-ink-soft">
              <IconClock width={15} height={15} />
              سجل عمليات التحقق
            </h2>
            {state.runs.length > 1 ? (
              <Button variant="ghost" size="sm" onClick={() => actions.clearAll()}>
                <IconTrash width={13} height={13} />
                مسح السجل
              </Button>
            ) : null}
          </div>

          <ul className="grid gap-2.5 sm:grid-cols-2">
            {state.runs.map((r) => {
              const isActive = r.id === run.id;
              return (
                /* min-w-0: عنصر الشبكة يأخذ min-width:auto افتراضيًا، فيوسّع
                   المسار بعرض السطر غير المنكسر بدل أن يقتطعه. */
                <li key={r.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => actions.openRun(r.id)}
                    className={`w-full rounded-xl border p-3.5 text-right transition-colors duration-200 ${
                      isActive
                        ? "border-accent-border bg-accent-100/40"
                        : "border-line bg-card hover:border-accent-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="num text-[13.5px] font-semibold text-ink">
                        {friendlyDate(r.createdAt)} · {clockTime(r.createdAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {r.isDemo ? (
                          <span className="rounded-full bg-st-review-soft px-2 py-0.5 text-[10px] font-semibold text-st-review">
                            توضيحي
                          </span>
                        ) : null}
                        <span className="num text-[12.5px] text-ink-muted">
                          {r.summary.total} ادعاء
                        </span>
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-[13.5px] text-ink-soft">{snippet(r.input)}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {STATUS_ORDER.map((st) => {
                        const n = r.claims.filter((c) => c.status === st).length;
                        if (!n) return null;
                        return (
                          <span
                            key={st}
                            className="num rounded px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ background: statusMeta[st].soft, color: statusMeta[st].color }}
                          >
                            {n}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 px-1 text-[13px] text-ink-muted">
            السجل محفوظ على هذا الجهاز فقط، ولا يُرسل إلى أي جهة. وعند تفعيل المراجعة السياقية
            تُرسل نصوص المقاطع التي تحتاج مراجعة — دون السجل — إلى مزود النموذج.
          </p>
        </section>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-accent transition-colors duration-200 hover:text-accent-700"
          >
            الرجوع للصفحة الرئيسية
            <IconArrow width={14} height={14} />
          </Link>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col-reverse gap-1">
      <span className="text-[12px] sm:text-[13px] leading-tight text-ink-muted">{label}</span>
      <span className="num text-[22px] font-bold leading-none sm:text-[26px]" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[14px] font-semibold transition-colors duration-200 sm:min-h-[34px] ${
        active ? "border-transparent text-white" : "border-line bg-card text-ink-soft hover:border-accent-border"
      }`}
      style={active ? { background: color ?? "var(--color-ink)" } : undefined}
    >
      {children}
    </button>
  );
}
