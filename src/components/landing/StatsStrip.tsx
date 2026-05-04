"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  CalendarRange,
  Clock,
  LandPlot,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/Container";

type Stat = {
  value: number;
  suffix?: string;
  label: string;
  Icon: LucideIcon;
};

// Counts up from 0 to `target` once the strip enters the viewport.
// Skips the animation when prefers-reduced-motion is set (returns the
// final value immediately).
function useCountOnVisible(target: number, ref: React.RefObject<HTMLElement>) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const start = performance.now();
            const duration = 900;
            function tick(now: number) {
              const t = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - t, 3);
              setValue(Math.round(target * eased));
              if (t < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
            observer.disconnect();
            return;
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, ref]);

  return value;
}

function StatTile({ stat }: { stat: Stat }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const value = useCountOnVisible(stat.value, ref);
  const { Icon } = stat;
  return (
    <div
      ref={ref}
      className="rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
        {value}
        {stat.suffix ? (
          <span className="text-slate-500">{stat.suffix}</span>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
    </div>
  );
}

export function StatsStrip({ courtCount }: { courtCount: number }) {
  // Live court count comes from the page (Server Component); the rest
  // are constants of the booking model that don't change at runtime.
  const stats: Stat[] = [
    { value: courtCount, label: "Pro courts", Icon: LandPlot },
    { value: 14, suffix: "d", label: "Booking window", Icon: CalendarRange },
    { value: 15, suffix: "h", label: "Open per day", Icon: Clock },
    { value: 60, suffix: "s", label: "Average booking", Icon: Calendar },
  ];

  return (
    <section className="border-b border-slate-200 bg-white py-12 md:py-16">
      <Container>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {stats.map((s) => (
            <StatTile key={s.label} stat={s} />
          ))}
        </div>
      </Container>
    </section>
  );
}
