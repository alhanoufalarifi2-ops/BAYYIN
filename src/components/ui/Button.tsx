"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "soft" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-700 soft disabled:bg-line-strong disabled:text-white/80",
  soft: "bg-card text-ink border border-line hover:border-accent-border hover:bg-accent-100/40 soft",
  ghost: "bg-transparent text-ink-soft hover:text-ink hover:bg-card",
};

const sizes = {
  lg: "h-[54px] px-8 text-[16px] rounded-xl",
  md: "h-[44px] px-5 text-[14.5px] rounded-lg",
  sm: "h-[44px] sm:h-[34px] px-3 text-[13px] rounded-lg",
} as const;

interface Common {
  variant?: Variant;
  size?: keyof typeof sizes;
  full?: boolean;
  className?: string;
  children: ReactNode;
}

const cls = (p: Common) =>
  `inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[.99] disabled:cursor-not-allowed disabled:active:scale-100 ${
    styles[p.variant ?? "primary"]
  } ${sizes[p.size ?? "md"]} ${p.full ? "w-full" : ""} ${p.className ?? ""}`;

export function Button({
  onClick,
  disabled,
  type = "button",
  ...p
}: Common & { onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls(p)}>
      {p.children}
    </button>
  );
}

export function ButtonLink({ href, ...p }: Common & { href: string }) {
  return (
    <Link href={href} className={cls(p)}>
      {p.children}
    </Link>
  );
}
