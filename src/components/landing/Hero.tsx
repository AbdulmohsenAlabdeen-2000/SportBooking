import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";

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

      <Container className="relative py-14 md:py-24">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-5xl md:leading-tight">
            Book Your Court. <br className="hidden sm:inline" />
            Play Today.
          </h1>
          <p className="mt-3 text-base text-white/90 md:mt-5 md:text-lg">
            Padel · Tennis · Football · Open daily 8 AM – 11 PM
          </p>
          <Link
            href="/book"
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-base font-semibold text-white shadow-md transition-colors hover:bg-accent-dark active:bg-accent-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand md:mt-9 md:w-auto"
          >
            Book a Court
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
