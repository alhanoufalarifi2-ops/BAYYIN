"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { SourcesBootstrap } from "@/components/layout/SourcesBootstrap";
import { SourceAttribution } from "@/components/layout/SourceAttribution";
import { ScopeNotice } from "@/components/layout/ScopeNotice";
import { Brand } from "@/components/layout/Brand";
import { Button } from "@/components/ui/Button";
import { IconBook, IconPlug, IconSearch } from "@/components/ui/Icons";
import { runVerification } from "@/lib/verify/engine";
import { buildDemoRun } from "@/lib/data/demo-case";
import { getSourceProvider } from "@/lib/sources/provider";
import { actions } from "@/lib/store";
import { countWords } from "@/lib/claims/segment";
import { STATUS_ORDER, statusMeta } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  requestContextReview,
  segmentsForReview,
  setContextReviewEnabled,
  useContextReviewEnabled,
} from "@/lib/ai/client";

export default function HomePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // يُعاد الرسم بعد تهيئة طبقة المصادر، فتعكس الواجهة الحالة الحقيقية.
  const [, setSourcesReady] = useState(0);
  const provider = getSourceProvider();
  const aiEnabled = useContextReviewEnabled();

  const words = countWords(text);
  const ready = words >= 6;

  const verify = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const run = await runVerification(text);

    // المراجعة السياقية اختيارية وتأتي بعد النتيجة الحتمية. مطفأة = لا طلب
    // إطلاقًا. والنتيجة تُعرض فورًا ولا تنتظرها.
    const segments = aiEnabled ? segmentsForReview(run) : [];
    actions.addRun(
      aiEnabled ? { ...run, aiReview: { state: "pending", requestedAt: Date.now() } } : run,
    );
    router.push("/result");
    if (aiEnabled) {
      void requestContextReview(segments).then((review) => actions.setAiReview(run.id, review));
    }
  };

  const openDemo = () => {
    const run = buildDemoRun();
    actions.addRun(run);
    router.push("/result");
  };

  return (
    <div className="min-h-dvh">
      <SourcesBootstrap onReady={() => setSourcesReady((n) => n + 1)} />
      <AppHeader />

      <main className="mx-auto max-w-[820px] px-5 pb-16">
        <section className="rise pt-12 text-center sm:pt-16">
          <div className="mx-auto w-fit">
            <Brand size="lg" />
          </div>
          <h1 className="mt-8 text-[30px] font-bold leading-tight tracking-tight text-ink sm:text-[38px]">
            تحقّق قبل أن تنشر.
          </h1>
          <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-relaxed text-ink-soft">
            الصق المحتوى، وسيقسّمه بَيِّن إلى ادعاءات قابلة للتحقق، ويعرض حالة كل ادعاء
            ومصدره وسبب تصنيفه.
          </p>
        </section>

        {/* ─── مربع اللصق ─── */}
        <section className="rise mt-9">
          <div className="rounded-[var(--radius-xl2)] border border-line bg-card p-4 soft sm:p-5">
            <label htmlFor="content" className="sr-only">
              المحتوى المراد التحقق منه
            </label>
            <textarea
              id="content"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              dir="rtl"
              placeholder="الصق هنا المحتوى الذي تريد التحقق منه قبل نشره…"
              className="w-full resize-y rounded-xl bg-surface/60 p-4 text-[15px] leading-[2] text-ink outline-none transition-colors duration-200 placeholder:text-ink-muted focus:bg-surface"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="num text-[14px] text-ink-muted">
                {words > 0 ? `${words} كلمة` : "لم تُدخل نصًا بعد"}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="md" onClick={openDemo}>
                  <IconBook width={16} height={16} />
                  مثال توضيحي
                </Button>
                <Button size="md" onClick={verify} disabled={!ready || busy}>
                  <IconSearch width={16} height={16} />
                  {busy ? "جارٍ التحقق…" : "تحقق الآن"}
                </Button>
              </div>
            </div>
          </div>

          {/* ─── المراجعة السياقية: مطفأة افتراضيًا، والإفصاح قبل التفعيل ─── */}
          <label
            htmlFor="ai-review"
            className="mt-3 flex min-h-[56px] cursor-pointer items-start gap-3.5 rounded-[var(--radius-xl2)] border border-dashed border-accent-border bg-accent-100/30 p-4"
          >
            <input
              id="ai-review"
              type="checkbox"
              role="switch"
              checked={aiEnabled}
              onChange={(e) => setContextReviewEnabled(e.target.checked)}
              className="mt-0.5 size-6 shrink-0 cursor-pointer accent-[var(--color-accent)]"
            />
            <span className="text-[14px] leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">مراجعة سياقية بالذكاء الاصطناعي</span> — عند
              التفعيل تُرسل المقاطع التي تحتاج مراجعة إلى مزود نموذج خارجي (Anthropic) لتحليل
              السياق فقط. لا يستخدم الذكاء الاصطناعي للتحقق من نص القرآن أو إنشاء المصادر أو
              إصدار الأحكام.
              <span className="mt-1 block text-[13.5px] text-ink-muted">
                {aiEnabled
                  ? "مفعّلة لهذه الزيارة فقط: المقاطع القرآنية الموثّقة لا تُرسل، ولا يُرسل السجل ولا نتائج المطابقة."
                  : "مطفأة: لا يُرسل أي نص خارج جهازك. تبدأ مطفأة في كل زيارة."}
              </span>
            </span>
          </label>

          {text.length > 0 && !ready ? (
            <p className="mt-2.5 px-1 text-[14px] text-ink-muted">
              أدخل ٦ كلمات على الأقل ليمكن تقسيم النص إلى ادعاءات.
            </p>
          ) : null}
        </section>

        {/* ─── حدود الأداة: ظاهرة دائمًا ─── */}
        <section className="rise mt-6">
          <ScopeNotice />
        </section>

        {/* ─── حالة المصادر: معلنة بصراحة ─── */}
        {!provider.connected ? (
        <section className="rise mt-6">
          <div className="flex items-start gap-3 rounded-[var(--radius-xl2)] border border-st-review/25 bg-st-review-soft p-4">
            <IconPlug width={18} height={18} className="mt-0.5 shrink-0 text-st-review" />
            <div>
              <p className="text-[15px] font-semibold text-st-review">
                لا توجد مصادر معتمدة مرتبطة حتى الآن
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-st-review/85">
                تقسيم النص إلى ادعاءات يعمل فعليًا ومحليًا على جهازك. أما تصنيف الإسناد فيحتاج
                مصادر مرتبطة، ولا يوجد منها شيء الآن — لذلك لن يظهر أي ادعاء بحالة «موثّق».
              </p>
            </div>
          </div>
        </section>
        ) : null}

        {/* ─── الحالات كما تظهر في صفحة النتيجة — المصدر واحد: statusMeta ─── */}
        <section className="rise mt-8">
          <h2 className="mb-3 px-1 text-[14.5px] font-semibold text-ink-soft">
            الحالات التي تظهر في النتيجة
          </h2>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {STATUS_ORDER.map((st) => (
              <li key={st} className="rounded-xl border border-line bg-card p-3.5">
                <StatusBadge status={st} size="sm" />
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                  {statusMeta[st].hint}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <SourceAttribution />

        <p className="mt-8 px-1 text-[13px] text-ink-muted">
          مزوّد المصادر الحالي: <span className="font-semibold">{provider.name}</span>
        </p>
      </main>
    </div>
  );
}
