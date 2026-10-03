import type { ReactNode } from "react";
import { Brand } from "@/components/layout/Brand";

export function AppHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="border-b border-line bg-card/70">
      <div className="mx-auto flex h-[68px] max-w-[1120px] items-center justify-between px-5">
        <Brand size="sm" />
        {action}
      </div>
    </header>
  );
}
