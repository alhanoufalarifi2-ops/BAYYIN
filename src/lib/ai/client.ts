"use client";

import { useSyncExternalStore } from "react";
import type { VerificationRun } from "@/lib/types";
import {
  REVIEW_LIMITS,
  SIGNAL_TEXT,
  type ContextFinding,
  type ContextReview,
  type ReviewSegment,
} from "@/lib/ai/signals";

/**
 * جانب المتصفح من المراجعة السياقية.
 *
 * لا يُرسل شيء إلا إذا فعّل المستخدم المراجعة صراحةً **في هذه الزيارة**.
 * التفعيل لا يُحفظ: كل تحميل جديد للصفحة يبدأ مطفأً، حتى لا يُرسل نص جديد
 * إلى مزود خارجي بناءً على موافقة سابقة.
 */

const PREF_KEY = "bayyin:v1:context-review";
/** أطول قليلًا من مهلة الخادم، ليصل ردّه «غير متاحة» قبل قطع المتصفح. */
const CLIENT_TIMEOUT_MS = 25_000;

const listeners = new Set<() => void>();

/** في الذاكرة فقط: يعيش ما عاشت الصفحة، ويزول بإعادة تحميلها أو إغلاقها. */
let enabled = false;

function readPref(): boolean {
  return enabled;
}

export function setContextReviewEnabled(on: boolean) {
  enabled = on;
  try {
    // تنظيف تفضيل حفظته نسخة سابقة؛ لم يعد يُقرأ.
    window.localStorage.removeItem(PREF_KEY);
  } catch {
    /* التخزين غير متاح — لا شيء يُنظَّف */
  }
  listeners.forEach((l) => l());
}

export function useContextReviewEnabled(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    readPref,
    () => false,
  );
}

/**
 * ما يُرسل بالضبط: نص المقطع ورقمه، للمقاطع التي تحتاج مراجعة فقط.
 *
 * لا يُرسل النقل القرآني المحض («موثّق») ولا ما لم يدخل التحقق لقصره.
 * ولا يُرسل السجل، ولا نتائج المطابقة، ولا الحالة، ولا أي معرّف.
 */
export function segmentsForReview(run: VerificationRun): ReviewSegment[] {
  return run.claims
    .filter((c) => c.status !== "verified" && c.status !== "unevaluated")
    .map((c) => ({ index: c.index, text: c.text }));
}

const UNAVAILABLE: ContextReview = { state: "unavailable" };

/** يتحقق المتصفح بدوره من شكل الرد: لا يُعرض إلا نوع معروف ودليل موجود في النص. */
function sanitize(data: unknown, segments: ReviewSegment[]): ContextReview {
  if (!data || typeof data !== "object") return UNAVAILABLE;
  const d = data as Record<string, unknown>;
  if (d.state !== "done" || !Array.isArray(d.findings)) return UNAVAILABLE;

  const textOf = new Map(segments.map((s) => [s.index, s.text]));
  const findings: ContextFinding[] = [];
  for (const f of d.findings as Record<string, unknown>[]) {
    if (!f || typeof f.index !== "number" || typeof f.evidence !== "string") continue;
    if (typeof f.signal !== "string" || !(f.signal in SIGNAL_TEXT)) continue;
    if (!textOf.get(f.index)?.includes(f.evidence)) continue;
    findings.push({ index: f.index, signal: f.signal as ContextFinding["signal"], evidence: f.evidence });
  }

  return {
    state: "done",
    findings,
    reviewed: segments.map((s) => s.index),
    model: typeof d.model === "string" ? d.model : "",
  };
}

/**
 * يطلب المراجعة السياقية. لا يرمي أبدًا: كل تعذر يعود «غير متاحة»،
 * فلا يمسّ نتيجة التحقق الأساسية بحال.
 */
export async function requestContextReview(segments: ReviewSegment[]): Promise<ContextReview> {
  if (segments.length === 0) return { state: "done", findings: [], reviewed: [], model: "" };

  const total = segments.reduce((n, s) => n + s.text.length, 0);
  if (
    segments.length > REVIEW_LIMITS.maxSegments ||
    total > REVIEW_LIMITS.maxTotalChars ||
    segments.some((s) => s.text.length > REVIEW_LIMITS.maxSegmentChars)
  ) {
    return UNAVAILABLE;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch("/api/context-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments }),
      signal: controller.signal,
    });
    return sanitize(await res.json(), segments);
  } catch {
    return UNAVAILABLE;
  } finally {
    clearTimeout(timer);
  }
}
