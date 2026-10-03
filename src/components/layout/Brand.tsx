import Link from "next/link";

/**
 * علامة بَيِّن: خط رأسي يمثل "الفصل/التمييز" قبل الاسم.
 * عنصر هادئ متكرر، لا زخرفة تقليدية.
 */
export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const big = size === "lg";
  const sm = size === "sm";
  return (
    <Link href="/" className="inline-flex items-center gap-3" aria-label="بَيِّن — الصفحة الرئيسية">
      <span
        className="block rounded-full bg-accent"
        style={{ width: big ? 5 : sm ? 3 : 4, height: big ? 42 : sm ? 22 : 30 }}
      />
      <span className="leading-none">
        <span
          className={`block font-bold tracking-tight text-ink ${
            big ? "text-[34px]" : sm ? "text-[17px]" : "text-[22px]"
          }`}
        >
          بَيِّن
        </span>
        <span
          className={`mt-1.5 block font-semibold tracking-[0.3em] text-accent ${
            big ? "text-[12px]" : "text-[9.5px]"
          }`}
        >
          BAYYIN
        </span>
      </span>
    </Link>
  );
}
