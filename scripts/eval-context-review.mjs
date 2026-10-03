/**
 * قياس طبقة المراجعة السياقية بالذكاء الاصطناعي على مجموعة موسومة يدويًا.
 *
 *   npm run start            (في نافذة أخرى، مع ANTHROPIC_API_KEY في .env.local)
 *   node scripts/eval-context-review.mjs [BASE_URL]
 *
 * يرسل كل حالة وحدها إلى نقطة الخادم الحقيقية /api/context-review، فتمر
 * بالنموذج الحقيقي ثم بتحقق الخادم من الدليل — أي أن ما يُقاس هو ما يصل
 * الواجهة فعلًا. لا يقرأ المفتاح ولا يطبعه، ولا يعدّل أي شيء في التطبيق.
 *
 * ملاحظتان على القراءة:
 *   - نقطة الخادم لا تعيد إلا التنبيهات المقبولة. فالنتيجة none تعني أن
 *     النموذج لم ينبّه، أو نبّه بدليل رفضه الخادم؛ ولا يمكن التمييز من هنا.
 *   - الطلبات متباعدة عمدًا لتبقى تحت حدّ الطلبات المحلي (10 في الدقيقة).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.argv[2] ?? "http://localhost:3000";
const SPACING_MS = 6500;
const SIGNALS = [
  "interpretive_inference",
  "personal_religious_question",
  "possible_hadith_attribution",
  "context_requires_specialist",
  "none",
];

const dataset = JSON.parse(readFileSync(resolve(here, "../eval/context-review-cases.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reviewOne(text) {
  const startedAt = Date.now();
  const res = await fetch(`${BASE_URL}/api/context-review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ segments: [{ index: 0, text }] }),
  });
  const body = await res.json();
  return { http: res.status, ms: Date.now() - startedAt, body };
}

const rows = [];
for (const [i, c] of dataset.cases.entries()) {
  if (i > 0) await sleep(SPACING_MS);
  const r = await reviewOne(c.text);

  const findings = r.body.state === "done" ? r.body.findings : null;
  // التصنيف الفعلي: أول تنبيه مقبول، أو none إن لم يوجد. التعذر يُسجَّل على حدة.
  const actual = findings === null ? "unavailable" : (findings[0]?.signal ?? "none");

  rows.push({
    id: c.id,
    text: c.text,
    expected: c.expected,
    actual,
    correct: actual === c.expected,
    findings: findings ?? [],
    http: r.http,
    ms: r.ms,
    model: r.body.model ?? null,
  });
  console.log(`${c.id.padEnd(4)} expected=${c.expected.padEnd(30)} actual=${actual.padEnd(30)} ${actual === c.expected ? "✓" : "✗"}  ${r.ms}ms`);
}

/* ─────────────── المقاييس ─────────────── */

const answered = rows.filter((r) => r.actual !== "unavailable");
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

const matrix = Object.fromEntries(SIGNALS.map((e) => [e, Object.fromEntries(SIGNALS.map((a) => [a, 0]))]));
for (const r of answered) matrix[r.expected][r.actual]++;

const perSignal = SIGNALS.map((s) => {
  const expected = answered.filter((r) => r.expected === s);
  const predicted = answered.filter((r) => r.actual === s);
  const hit = expected.filter((r) => r.correct).length;
  return {
    signal: s,
    cases: expected.length,
    correct: hit,
    accuracy: pct(hit, expected.length),
    precision: pct(hit, predicted.length),
  };
});

const falsePositives = answered.filter((r) => r.expected === "none" && r.actual !== "none");
const falseNegatives = answered.filter((r) => r.expected !== "none" && r.actual === "none");
const wrongSignal = answered.filter((r) => r.expected !== "none" && r.actual !== "none" && !r.correct);
const times = answered.map((r) => r.ms).sort((a, b) => a - b);

const report = {
  ranAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  model: answered.find((r) => r.model)?.model ?? null,
  total: rows.length,
  unavailable: rows.length - answered.length,
  overall: { correct: answered.filter((r) => r.correct).length, of: answered.length, accuracy: pct(answered.filter((r) => r.correct).length, answered.length) },
  perSignal,
  confusionMatrix: matrix,
  falsePositives: falsePositives.map((r) => r.id),
  falseNegatives: falseNegatives.map((r) => r.id),
  wrongSignal: wrongSignal.map((r) => r.id),
  multipleFindings: answered.filter((r) => r.findings.length > 1).map((r) => r.id),
  latencyMs: times.length
    ? { mean: Math.round(times.reduce((a, b) => a + b, 0) / times.length), median: times[Math.floor(times.length / 2)], min: times[0], max: times[times.length - 1] }
    : null,
  errors: answered.filter((r) => !r.correct).map((r) => ({ id: r.id, text: r.text, expected: r.expected, actual: r.actual, findings: r.findings })),
  rows,
};

const outDir = resolve(here, "../eval/results");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `context-review-${report.ranAt.replace(/[:.]/g, "-")}.json`);
writeFileSync(outPath, JSON.stringify(report, null, 1), "utf8");

console.log("\n=== SUMMARY ===");
console.log(JSON.stringify({ ...report, rows: undefined }, null, 1));
console.log(`\nالنتائج الكاملة: ${outPath}`);
