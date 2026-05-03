import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 ${className}`}
    >
      {children}
    </div>
  );
}
