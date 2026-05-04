"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Wraps children in a div that is initially translated + faded, then
// animates to the resting state when 30% of it scrolls into view.
// Uses IntersectionObserver — no scroll listener, no rAF loop.
//
// Respects prefers-reduced-motion: users with the OS preference set
// see the children rendered normally with no entrance animation.
export function RevealOnScroll({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number; // ms — chained sections can stagger via this
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If the user prefers reduced motion, skip the observer and reveal
    // immediately. The CSS already handles the visual side via the
    // motion-reduce: classes below.
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      el.dataset.revealed = "true";
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const t = window.setTimeout(() => {
              el.dataset.revealed = "true";
            }, delay);
            observer.disconnect();
            return () => window.clearTimeout(t);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`opacity-0 translate-y-4 transition-all duration-700 ease-out data-[revealed=true]:opacity-100 data-[revealed=true]:translate-y-0 motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none ${className}`}
    >
      {children}
    </div>
  );
}
