import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-dark active:bg-accent-dark disabled:bg-slate-300 disabled:text-slate-500",
  secondary:
    "bg-brand text-white hover:bg-brand-dark active:bg-brand-dark disabled:bg-slate-300 disabled:text-slate-500",
  ghost:
    "bg-white text-brand border border-brand hover:bg-brand/5 disabled:border-slate-300 disabled:text-slate-400",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 font-semibold text-base min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:transform-none disabled:shadow-none motion-reduce:transform-none motion-reduce:transition-colors";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      type={rest.type ?? "button"}
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
