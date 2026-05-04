import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import type { Dict } from "@/lib/i18n/dict.en";

export function FinalCTA({ t }: { t: Dict }) {
  return (
    <section className="bg-accent py-14 text-white md:py-20">
      <Container className="text-center">
        <h2 className="text-2xl font-bold md:text-4xl">{t.final_cta.title}</h2>
        <p className="mt-2 text-base text-white/90 md:mt-3 md:text-lg">
          {t.final_cta.sub}
        </p>
        <Link
          href="/book"
          className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-accent-dark shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-lg active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-accent md:mt-8 md:w-auto motion-reduce:transform-none motion-reduce:transition-colors"
        >
          {t.final_cta.cta}
          <ArrowRight
            className="h-5 w-5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 motion-reduce:transform-none"
            aria-hidden
          />
        </Link>
      </Container>
    </section>
  );
}
