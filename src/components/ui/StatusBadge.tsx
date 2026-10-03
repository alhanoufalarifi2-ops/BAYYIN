import type { ClaimStatus } from "@/lib/types";
import { statusMeta } from "@/lib/format";
import { IconAlert, IconCheck, IconExpert, IconInfo, IconMinus, IconPlug } from "@/components/ui/Icons";

const icons: Record<ClaimStatus, typeof IconCheck> = {
  verified: IconCheck,
  review: IconAlert,
  unsourced: IconMinus,
  expert: IconExpert,
  uncovered: IconPlug,
  unevaluated: IconInfo,
};

/** الحالة تُعرض دائمًا بأيقونة ونص، لا باللون وحده. */
export function StatusBadge({ status, size = "md" }: { status: ClaimStatus; size?: "sm" | "md" }) {
  const m = statusMeta[status];
  const Icon = icons[status];
  const s = size === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold leading-none ${
        s ? "px-2.5 py-1 text-[13px]" : "px-3 py-1.5 text-[14px]"
      }`}
      style={{ background: m.soft, color: m.color }}
    >
      <Icon width={s ? 12 : 14} height={s ? 12 : 14} />
      {m.label}
    </span>
  );
}
