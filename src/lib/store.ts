"use client";

import { useSyncExternalStore } from "react";
import type { BayyinState, VerificationRun } from "@/lib/types";
import type { ContextReview } from "@/lib/ai/signals";

const KEY = "bayyin:v1:state";
const MAX_RUNS = 20;

const EMPTY: BayyinState = { runs: [], activeRunId: null };

let state: BayyinState | null = null;
const listeners = new Set<() => void>();

function normalize(raw: Partial<BayyinState> | null): BayyinState {
  if (!raw) return { runs: [], activeRunId: null };
  const runs = Array.isArray(raw.runs) ? raw.runs : [];
  const ids = new Set(runs.map((r) => r.id));
  return {
    runs,
    activeRunId: raw.activeRunId && ids.has(raw.activeRunId) ? raw.activeRunId : runs[0]?.id ?? null,
  };
}

function read(): BayyinState {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(KEY);
    state = raw ? normalize(JSON.parse(raw) as Partial<BayyinState>) : { runs: [], activeRunId: null };
  } catch {
    state = { runs: [], activeRunId: null };
  }
  return state;
}

function commit(next: BayyinState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* التخزين غير متاح — الحالة تبقى في الذاكرة */
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useBayyin(): BayyinState {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export const actions = {
  /** يحفظ عملية تحقق جديدة ويجعلها النشطة. */
  addRun(run: VerificationRun) {
    const s = read();
    commit({
      runs: [run, ...s.runs.filter((r) => r.id !== run.id)].slice(0, MAX_RUNS),
      activeRunId: run.id,
    });
  },

  /**
   * يرفق نتيجة المراجعة السياقية بعملية محفوظة.
   * لا يمسّ إلا الحقل `aiReview`: الادعاءات والملخص والمصادر تبقى كما هي.
   */
  setAiReview(id: string, aiReview: ContextReview) {
    const s = read();
    if (!s.runs.some((r) => r.id === id)) return;
    commit({ ...s, runs: s.runs.map((r) => (r.id === id ? { ...r, aiReview } : r)) });
  },

  openRun(id: string) {
    const s = read();
    if (!s.runs.some((r) => r.id === id)) return;
    commit({ ...s, activeRunId: id });
  },

  removeRun(id: string) {
    const s = read();
    const runs = s.runs.filter((r) => r.id !== id);
    commit({ runs, activeRunId: s.activeRunId === id ? runs[0]?.id ?? null : s.activeRunId });
  },

  clearAll() {
    commit({ runs: [], activeRunId: null });
  },
};

export function activeRun(s: BayyinState): VerificationRun | null {
  return s.runs.find((r) => r.id === s.activeRunId) ?? null;
}
