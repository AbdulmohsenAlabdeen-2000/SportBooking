import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

      <Container className="relative py-14 md:py-24">
        <div className="max-w-2xl">
          <h1 className="animate-reveal-up text-3xl font-bold leading-tight tracking-tight md:text-5xl md:leading-tight motion-reduce:animate-none">
            Book Your Court. <br className="hidden sm:inline" />
            Play Today.
          </h1>
          <p className="mt-3 animate-reveal-up text-base text-white/90 [animation-delay:120ms] md:mt-5 md:text-lg motion-reduce:animate-none">
            Padel · Tennis · Football · Open daily 8 AM – 11 PM
          </p>
          <Link
            href="/book"
            className="mt-7 inline-flex w-full animate-reveal-up items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-base font-semibold text-white shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-accent-dark hover:shadow-lg active:translate-y-0 active:scale-[0.98] active:bg-accent-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand [animation-delay:240ms] md:mt-9 md:w-auto motion-reduce:animate-none motion-reduce:transform-none motion-reduce:transition-colors"
          >
            Book a Court
            <ArrowRight
              className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>
      </Container>
    </section>
  );
}
