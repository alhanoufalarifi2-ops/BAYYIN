"use client";

import { registerSourceType } from "@/lib/sources/types/registry";
import { QURAN_TEXT_TYPE } from "@/lib/sources/types/quran-text";
import { initQuranProvider, quranProvider } from "@/lib/sources/quran-provider";
import { setSourceProvider } from "@/lib/sources/provider";

/**
 * تهيئة طبقة المصادر.
 *
 * يُسجَّل النوع دائمًا (فتعمل بوابة الإحالة الإلزامية الخاصة به حتى قبل
 * توفر المدوّنة)، بينما لا يُسجَّل المزوّد إلا إذا حُمّلت مدوّنة صالحة.
 * غياب المدوّنة حالة متوقَّعة: يبقى النظام بلا مصادر مرتبطة.
 */
let done = false;

export async function bootstrapSources(): Promise<void> {
  if (done) return;
  done = true;

  registerSourceType(QURAN_TEXT_TYPE);

  const ok = await initQuranProvider();
  if (ok) setSourceProvider(quranProvider);
}
