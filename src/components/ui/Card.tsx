import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div" | "li";
}) {
  return (
    <Tag className={`rounded-[var(--radius-xl2)] border border-line bg-card p-5 soft ${className}`}>
      {children}
    </Tag>
  );
}
