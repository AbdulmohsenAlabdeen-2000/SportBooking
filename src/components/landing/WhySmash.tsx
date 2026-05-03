import { Calendar, Trophy, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

const FEATURES = [
  {
    Icon: Zap,
    title: "Instant booking",
    body: "Confirm in under a minute.",
  },
  {
    Icon: Trophy,
    title: "Pro-grade courts",
    body: "Maintained daily by our team.",
  },
  {
    Icon: Calendar,
    title: "Book up to 14 days ahead",
    body: "Plan your week with confidence.",
  },
] as const;

export function WhySmash() {
  return (
    <section className="py-12 md:py-16">
      <Container>
        <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
          Why Smash
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:mt-8 md:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <Card key={title}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {title}
              </h3>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
