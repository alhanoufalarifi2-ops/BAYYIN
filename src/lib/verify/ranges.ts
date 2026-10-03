import type { SourceMatch } from "@/lib/types";

/**
 * دمج المواضع المتجاورة في مدى واحد.
 *
 * محايد تجاه الأنواع: يعتمد على الحقلين العامّين `group` و`ordinal`
 * في المرجع، فأي نوع يملؤهما يستفيد من الدمج بلا تعديل هنا.
 */
export interface MergedRange {
  group: string;
  /** مدى أو أكثر داخل المجموعة، بعد دمج المتتالي. */
  ranges: [number, number][];
  /** عدد المواضع المندمجة. */
  count: number;
}

export function mergeMatchRanges(matches: SourceMatch[]): MergedRange[] {
  const byGroup = new Map<string, number[]>();

  for (const m of matches) {
    const g = m.reference?.group;
    const o = m.reference?.ordinal;
    if (!g || typeof o !== "number") continue;
    const list = byGroup.get(g) ?? [];
    if (!list.includes(o)) list.push(o);
    byGroup.set(g, list);
  }

  const out: MergedRange[] = [];
  for (const [group, ordinals] of byGroup) {
    const sorted = [...ordinals].sort((a, b) => a - b);
    const ranges: [number, number][] = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
        continue;
      }
      ranges.push([start, prev]);
      start = sorted[i];
      prev = sorted[i];
    }
    ranges.push([start, prev]);

    out.push({ group, ranges, count: sorted.length });
  }

  return out;
}

/** «الكوثر — الآيات 1–3» أو «الكوثر — الآية 2». */
export function formatRange(r: MergedRange, unitOne: string, unitMany: string): string {
  const parts = r.ranges.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`));
  const single = r.ranges.length === 1 && r.ranges[0][0] === r.ranges[0][1];
  return `${r.group} — ${single ? unitOne : unitMany} ${parts.join("، ")}`;
}
