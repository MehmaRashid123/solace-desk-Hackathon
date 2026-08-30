"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type FlowBoardProps = {
  children: ReactNode;
  className?: string;
};

export function FlowBoard({ children, className }: FlowBoardProps) {
  return (
    <div className={cn("-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1 touch-pan-x", className)}>
      <div className="flex min-w-max gap-3">{children}</div>
    </div>
  );
}
