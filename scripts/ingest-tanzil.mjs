/**
 * استيعاب نسخة Tanzil المعتمدة وتحويلها إلى مدوّنة بَيِّن.
 *
 *   node scripts/ingest-tanzil.mjs <ملف-النص> [ملف-البيانات-الوصفية]
 *
 * الملف الأول: ناتج Tanzil بصيغة "Text (with aya numbers)" — أسطر
 *              على هيئة  sura|aya|text
 * الملف الثاني (اختياري): quran-data.xml من Tanzil، لأسماء السور.
 *              إن غاب، يُعرض «سورة رقم N» بدل الاسم.
 *
 * لا يُعدَّل النص إطلاقًا: يُقرأ كما هو، وتُحسب بصمته، ويُخزَّن حرفًا بحرف.
 * التطبيع يحدث وقت البحث داخل التطبيق، لا هنا.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const LICENSE_NOTICE = [
  "Tanzil Quran Text",
  "Copyright (C) 2007-2021 Tanzil Project",
  "License: Creative Commons Attribution 3.0",
  "",
  "This copy of the Quran text is carefully produced, highly",
  "verified and continuously monitored by a group of specialists",
  "in Tanzil Project.",
  "",
  "TERMS OF USE:",
  "",
  "- Permission is granted to copy and distribute verbatim copies",
  "  of this text, but CHANGING IT IS NOT ALLOWED.",
  "",
  "- This Quran text can be used in any website or application,",
  "  provided that its source (Tanzil Project) is clearly indicated,",
  "  and a link is made to tanzil.net to enable users to keep",
  "  track of changes.",
  "",
  "- This copyright notice shall be included in all verbatim copies",
  "  of the text, and shall be reproduced appropriately in all files",
  "  derived from or containing substantial portion of this text.",
  "",
  "Please check updates at: http://tanzil.net/updates/",
].join("\n");

const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

const [, , textPath, metaPath] = process.argv;

if (!textPath) {
  console.error("الاستخدام: node scripts/ingest-tanzil.mjs <ملف-النص> [quran-data.xml]");
  process.exit(1);
}
if (!existsSync(textPath)) {
  console.error(`الملف غير موجود: ${textPath}`);
  process.exit(1);
}

/* ---------- أسماء السور، إن توفرت ---------- */
const suraNames = new Map();
if (metaPath && existsSync(metaPath)) {
  const xml = readFileSync(metaPath, "utf8");
  // يُلتقط كل وسم <sura> ثم تُستخرج سماته منفردة.
  // المسافة قبل name= ضرورية: بدونها يلتقط النمط tname= و ename=
  // فيعود الاسم بالحروف اللاتينية بدل العربية.
  for (const tag of xml.matchAll(/<sura\b[^>]*>/g)) {
    const index = /\sindex="(\d+)"/.exec(tag[0])?.[1];
    const name = /\sname="([^"]+)"/.exec(tag[0])?.[1];
    if (index && name) suraNames.set(Number(index), name);
  }
  const arabic = [...suraNames.values()].filter((n) => /[ء-ي]/.test(n)).length;
  console.log(`أسماء السور: ${suraNames.size} (عربية: ${arabic})`);
  if (arabic < suraNames.size) {
    console.error("تحذير: بعض الأسماء ليست عربية — راجعي بنية ملف البيانات الوصفية.");
  }
} else {
  console.log("لم يُمرَّر ملف بيانات وصفية — ستُعرض السور بأرقامها.");
}

/* ---------- قراءة النص ---------- */
const raw = readFileSync(textPath, "utf8");
const ayat = [];
let skipped = 0;

for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;

  const parts = t.split("|");
  if (parts.length < 3) {
    skipped++;
    continue;
  }

  const sura = Number(parts[0]);
  const aya = Number(parts[1]);
  // النص قد يحتوي "|" فيُعاد وصله كما هو.
  const text = parts.slice(2).join("|");

  if (!Number.isInteger(sura) || !Number.isInteger(aya) || !text) {
    skipped++;
    continue;
  }

  ayat.push({
    id: `q:${sura}:${aya}`,
    sura,
    suraName: suraNames.get(sura) ?? `سورة رقم ${sura}`,
    aya,
    text,
    hash: sha256(text),
  });
}

if (ayat.length === 0) {
  console.error("لم يُقرأ أي سطر صالح. تأكدي أن الصيغة هي Text (with aya numbers).");
  process.exit(1);
}

/* ---------- المخرج ---------- */
const manifest = {
  corpusId: "tanzil-quran",
  typeId: "quran-text",
  version: "Tanzil Quran Text 1.1",
  dataSource: "Tanzil Project",
  dataSourceUrl: "https://tanzil.net",
  licenseNotice: LICENSE_NOTICE,
  corpusHash: sha256(ayat.map((a) => a.hash).join("")),
  ayahCount: ayat.length,
  builtAt: new Date().toISOString(),
};

const outPath = resolve("public/corpus/quran-tanzil.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ manifest, ayat }), "utf8");

console.log("");
console.log(`آيات مستوعَبة : ${ayat.length}`);
console.log(`أسطر متخطّاة  : ${skipped}`);
console.log(`سور مميّزة    : ${new Set(ayat.map((a) => a.sura)).size}`);
console.log(`بصمة المدوّنة : ${manifest.corpusHash.slice(0, 16)}…`);
console.log(`المخرج        : ${outPath}`);
console.log("");
console.log("راجعي العدد أعلاه قبل الاعتماد.");
