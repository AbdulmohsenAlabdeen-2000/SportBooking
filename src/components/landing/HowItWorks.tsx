import { Container } from "@/components/ui/Container";
import type { Dict } from "@/lib/i18n/dict.en";

export function HowItWorks({ t }: { t: Dict }) {
  const steps = [
    { n: 1, title: t.how.step1_title, body: t.how.step1_body },
    { n: 2, title: t.how.step2_title, body: t.how.step2_body },
    { n: 3, title: t.how.step3_title, body: t.how.step3_body },
  ];

  return (
    <section className="bg-white py-12 md:py-16">
      <Container>
        <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
          {t.how.title}
        </h2>
        <ol className="mt-6 grid grid-cols-1 gap-6 md:mt-8 md:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.n}
              className="flex items-start gap-4 md:flex-col md:items-start"
            >
              <span
                aria-hidden
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand text-base font-bold text-white shadow-sm"
              >
                {step.n}
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
