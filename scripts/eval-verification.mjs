/**
 * اختبار التحقق القرآني الحتمي على مجموعة حالات ثابتة.
 *
 *   node scripts/eval-verification.mjs            حالات eval/verification-cases.json
 *   node scripts/eval-verification.mjs --corpus   + اختبار كامل النص (كل آيات المصدر، نحو دقيقتين إلى ثلاث)
 *   node scripts/eval-verification.mjs --save     يحفظ النتيجة في eval/results/
 *
 * يشغّل محرك المشروع نفسه (src/lib/verify و src/lib/sources) كما هو، بلا خادم
 * وبلا متصفح وبلا أي نموذج ذكاء اصطناعي، وبلا تعديل أي ملف في src:
 *   - ملفات TypeScript تُحوَّل في الذاكرة بحزمة typescript الموجودة في المشروع.
 *   - المدوّنة تُقرأ من public/corpus/quran-tanzil.json مباشرة بدل طلبها عبر الشبكة.
 *
 * يخرج برمز 1 إن خالفت أي حالة المتوقع، فيصلح للتشغيل قبل أي تعديل وبعده.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");

/* ─────────── تحميل كود المشروع كما هو ─────────── */

// الاستيراد بالمسار المختصر "@/…" يُحلّ إلى src/ كما في tsconfig.
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = join(root, "src", request.slice(2));
  return resolveFilename.call(this, request, ...rest);
};
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};

// المحرك يطلب المدوّنة بـ fetch من /corpus/…؛ هنا تُقرأ من القرص نفسه.
const corpus = JSON.parse(readFileSync(join(root, "public/corpus/quran-tanzil.json"), "utf8"));
globalThis.fetch = async () => ({ ok: true, json: async () => corpus });

const { bootstrapSources } = require(join(root, "src/lib/sources/bootstrap.ts"));
const { runVerification } = require(join(root, "src/lib/verify/engine.ts"));
const { quranProvider } = require(join(root, "src/lib/sources/quran-provider.ts"));

await bootstrapSources();
if (!quranProvider.connected) {
  console.error("تعذّر تحميل المدوّنة القرآنية؛ لا يمكن تشغيل الاختبار.");
  process.exit(1);
}

/* ─────────── الحالات ─────────── */

const args = new Set(process.argv.slice(2));
const dataset = JSON.parse(readFileSync(join(root, "eval/verification-cases.json"), "utf8"));
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const strongSources = (claim) => claim.matches.filter((m) => m.confidence >= 0.82).map((m) => m.source.locator);

const rows = [];
for (const c of dataset.cases) {
  const run = await runVerification(c.text);
  const actual = run.claims.map((claim) => claim.status);
  const readinessOk = c.readiness === undefined || c.readiness === run.summary.readiness;
  rows.push({
    id: c.id,
    group: c.group,
    name: c.name,
    text: c.text,
    expected: c.expected,
    actual,
    readiness: run.summary.readiness,
    sources: run.claims.map(strongSources),
    pass: same(actual, c.expected) && readinessOk,
  });
}

const failed = rows.filter((r) => !r.pass);
const groups = {};
for (const r of rows) {
  groups[r.group] ??= { cases: 0, passed: 0 };
  groups[r.group].cases++;
  if (r.pass) groups[r.group].passed++;
}

console.log(`\nحالات التحقق: ${rows.length - failed.length} / ${rows.length} مطابقة للمتوقع`);
for (const [g, v] of Object.entries(groups)) console.log(`  ${g.padEnd(20)} ${v.passed} / ${v.cases}`);
for (const r of failed) {
  console.log(`\n✗ ${r.id} — ${r.name}`);
  console.log(`  النص:     ${r.text}`);
  console.log(`  المتوقع:  ${r.expected.join(", ")}`);
  console.log(`  الفعلي:   ${r.actual.join(", ")} (الجاهزية ${r.readiness})`);
}

/* ─────────── اختبار كامل النص (اختياري) ─────────── */

let corpusReport = null;
if (args.has("--corpus")) {
  const counts = {};
  const startedAt = Date.now();
  for (const ayah of corpus.ayat) {
    const run = await runVerification(ayah.text);
    const all = run.claims.map((claim) => claim.status);
    const key = all.every((s) => s === all[0]) ? all[0] : "mixed";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const expected = dataset.corpus.expected;
  const keys = new Set([...Object.keys(counts), ...Object.keys(expected)]);
  const pass = corpus.ayat.length === dataset.corpus.ayat && [...keys].every((k) => (counts[k] ?? 0) === (expected[k] ?? 0));
  corpusReport = { ayat: corpus.ayat.length, counts, expected, pass, seconds: Math.round((Date.now() - startedAt) / 1000) };

  console.log(`\nاختبار كامل النص: ${corpus.ayat.length} آية في ${corpusReport.seconds} ثانية`);
  for (const k of keys) console.log(`  ${k.padEnd(12)} ${String(counts[k] ?? 0).padStart(5)}   (المتوقع ${expected[k] ?? 0})`);
  console.log(pass ? "  مطابق للمتوقع" : "  ✗ يخالف المتوقع");
}

/* ─────────── الحفظ والخروج ─────────── */

const ok = failed.length === 0 && (corpusReport === null || corpusReport.pass);

if (args.has("--save")) {
  const report = {
    ranAt: new Date().toISOString(),
    corpus: { source: corpus.manifest.dataSource, version: corpus.manifest.version, hash: corpus.manifest.corpusHash },
    cases: { total: rows.length, passed: rows.length - failed.length, groups },
    failed: failed.map((r) => r.id),
    corpusTest: corpusReport,
    rows,
  };
  const outDir = join(root, "eval/results");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `verification-${report.ranAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 1), "utf8");
  console.log(`\nالنتائج الكاملة: ${outPath}`);
}

console.log(ok ? "\nالنتيجة: نجاح" : "\nالنتيجة: فشل");
process.exit(ok ? 0 : 1);
