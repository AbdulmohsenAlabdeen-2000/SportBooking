import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { FloatingSportsBg } from "@/components/landing/FloatingSportsBg";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-dark text-white">
      {/* Subtle court-line graphic, decorative only. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYMid slice"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="40" y="40" width="720" height="320" rx="2" />
          <line x1="400" y1="40" x2="400" y2="360" />
          <circle cx="400" cy="200" r="55" />
          <line x1="40" y1="200" x2="180" y2="200" />
          <line x1="620" y1="200" x2="760" y2="200" />
        </g>
      </svg>

      <FloatingSportsBg />

      {/* Soft top-right glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />

      <Container className="relative py-16 md:py-28">
        <div className="max-w-3xl">
          {/* Badge */}
          <span className="inline-flex animate-reveal-up items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur motion-reduce:animate-none">
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            Open daily · 8 AM – 11 PM
          </span>

          <h1 className="mt-5 animate-reveal-up text-4xl font-bold leading-[1.1] tracking-tight [animation-delay:80ms] sm:text-5xl md:text-6xl lg:text-7xl motion-reduce:animate-none">
            Book your court.
            <br />
            <span className="bg-gradient-to-r from-accent to-amber-300 bg-clip-text text-transparent">
              Play today.
            </span>
          </h1>

          <p className="mt-5 max-w-xl animate-reveal-up text-base text-white/85 [animation-delay:160ms] md:text-lg motion-reduce:animate-none">
            Smash Courts Kuwait — pro-grade padel, tennis, and football pitches
            in Salmiya. Pick a slot, type your name, you're playing in under a
            minute.
          </p>

          {/* Sport pills */}
          <div className="mt-6 flex animate-reveal-up flex-wrap gap-2 [animation-delay:240ms] motion-reduce:animate-none">
            {["Padel", "Tennis", "Football", "Open till 11 PM"].map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-8 flex animate-reveal-up flex-col items-stretch gap-3 [animation-delay:320ms] sm:flex-row sm:items-center motion-reduce:animate-none">
            <Link
              href="/book"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-base font-semibold text-white shadow-lg shadow-accent/30 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-accent-dark hover:shadow-xl hover:shadow-accent/40 active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand motion-reduce:transform-none motion-reduce:transition-colors"
            >
              Book a Court
              <ArrowRight
                className="h-5 w-5 transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
                aria-hidden
              />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/0 px-6 py-4 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
            >
              I have an account
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
