import { Calendar, Trophy, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import type { Dict } from "@/lib/i18n/dict.en";

export function WhySmash({ t }: { t: Dict }) {
  const features = [
    { Icon: Zap, title: t.why.instant_title, body: t.why.instant_body },
    { Icon: Trophy, title: t.why.pro_title, body: t.why.pro_body },
    { Icon: Calendar, title: t.why.plan_title, body: t.why.plan_body },
  ];

  return (
    <section className="py-12 md:py-16">
      <Container>
        <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
          {t.why.title}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:mt-8 md:grid-cols-3">
          {features.map(({ Icon, title, body }) => (
            <Card
              key={title}
              className="group transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand transition-transform duration-200 group-hover:scale-110 motion-reduce:transform-none">
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
