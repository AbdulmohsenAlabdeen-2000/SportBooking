import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";

export default function Loading() {
  return (
    <Container className="py-6 md:py-10">
      <div className="h-4 w-12 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="mt-1 h-4 w-56 animate-pulse rounded bg-slate-200" />
      <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i}>
            <Card className="flex animate-pulse items-center gap-4">
              <div className="h-16 w-16 flex-none rounded-xl bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="h-4 w-40 rounded bg-slate-200" />
                <div className="h-3 w-28 rounded bg-slate-200" />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </Container>
  );
}
