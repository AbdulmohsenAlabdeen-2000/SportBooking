import { Container } from "@/components/ui/Container";

const STEPS = [
  { n: 1, title: "Pick a court & time", body: "Choose your sport and an open slot." },
  { n: 2, title: "Enter your name & number", body: "Quick form, no account needed." },
  { n: 3, title: "Show up & play", body: "Get a confirmation by phone." },
] as const;

export function HowItWorks() {
  return (
    <section className="bg-white py-12 md:py-16">
      <Container>
        <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
          How it works
        </h2>
        <ol className="mt-6 grid grid-cols-1 gap-6 md:mt-8 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="flex items-start gap-4 md:flex-col md:items-start">
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
