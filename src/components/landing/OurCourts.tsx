import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Activity, CircleDot, LandPlot, Star } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { format, getDict } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dict.en";
import type { Court, Sport } from "@/lib/types";

const SPORT_ICON: Record<Sport, typeof Activity> = {
  padel: Activity,
  tennis: CircleDot,
  football: LandPlot,
};

function sportLabel(sport: Sport, t: Dict): string {
  if (sport === "padel") return t.hero.pill_padel;
  if (sport === "tennis") return t.hero.pill_tennis;
  return t.hero.pill_football;
}

function getBaseUrl() {
  const h = headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function fetchCourts(): Promise<Court[]> {
  const res = await fetch(`${getBaseUrl()}/api/courts`, { cache: "no-store" });
  if (!res.ok) throw new Error(`courts_fetch_failed_${res.status}`);
  const json = (await res.json()) as { courts: Court[] };
  return json.courts;
}

type ReviewSummary = { count: number; average: number | null };

async function fetchReviewSummary(courtId: string): Promise<ReviewSummary> {
  try {
    const res = await fetch(
      `${getBaseUrl()}/api/courts/${courtId}/reviews`,
      { cache: "no-store" },
    );
    if (!res.ok) return { count: 0, average: null };
    const json = (await res.json()) as { summary: ReviewSummary };
    return json.summary;
  } catch {
    return { count: 0, average: null };
  }
}

function formatPriceKwd(price: number): string {
  return `${price.toFixed(3)} KWD`;
}

function CourtCard({
  court,
  review,
  t,
}: {
  court: Court;
  review: ReviewSummary;
  t: Dict;
}) {
  const Icon = SPORT_ICON[court.sport];
  return (
    <Link
      href={`/book?court=${court.id}`}
      className="group block focus:outline-none"
    >
      <Card className="flex h-full flex-col gap-4 overflow-hidden transition-all duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-brand group-active:translate-y-0 group-active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none">
        {court.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={court.image_url}
            alt={`${court.name}`}
            loading="lazy"
            decoding="async"
            className="h-32 w-full rounded-xl object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none"
          />
        ) : (
          <div className="flex h-32 items-center justify-center rounded-xl bg-brand/10 text-brand transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none">
            <Icon className="h-12 w-12" aria-hidden />
          </div>
        )}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">
              {sportLabel(court.sport, t)}
            </p>
            {review.average !== null ? (
              <span
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-700"
                title={`${review.count} review${review.count === 1 ? "" : "s"}`}
              >
                <Star
                  className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                  aria-hidden
                />
                {review.average.toFixed(1)}
                <span className="text-slate-400">({review.count})</span>
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                {t.courts.new}
              </span>
            )}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            {court.name}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {format(t.courts.capacity, { count: court.capacity })}
          </p>
          <p className="mt-auto pt-3 text-sm font-medium text-slate-900">
            {format(t.courts.price_per_hour, {
              price: formatPriceKwd(court.price_per_slot),
            })}
          </p>
        </div>
      </Card>
    </Link>
  );
}

function CourtsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <div className="h-32 rounded-xl bg-slate-200" />
          <div className="mt-4 h-3 w-16 rounded bg-slate-200" />
          <div className="mt-2 h-5 w-32 rounded bg-slate-200" />
          <div className="mt-3 h-4 w-24 rounded bg-slate-200" />
        </Card>
      ))}
    </div>
  );
}

function CourtsFallback({ t }: { t: Dict }) {
  return (
    <Card className="text-center text-slate-600">
      <p className="text-base">{t.courts.loading}</p>
      <p className="mt-1 text-sm">{t.courts.loading_sub}</p>
    </Card>
  );
}

async function CourtsList() {
  const t = getDict();
  let courts: Court[] = [];
  try {
    courts = await fetchCourts();
  } catch {
    return <CourtsFallback t={t} />;
  }

  if (courts.length === 0) return <CourtsFallback t={t} />;

  // Fetch all review summaries in parallel; one failure leaves a court
  // with the "New" badge instead of breaking the whole list.
  const reviews = await Promise.all(
    courts.map((c) => fetchReviewSummary(c.id)),
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {courts.map((court, i) => (
        <CourtCard
          key={court.id}
          court={court}
          review={reviews[i]}
          t={t}
        />
      ))}
    </div>
  );
}

export function OurCourts() {
  const t = getDict();
  return (
    <section className="py-12 md:py-16">
      <Container>
        <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
          {t.courts.title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {t.courts.subtitle}
        </p>
        <div className="mt-6 md:mt-8">
          <Suspense fallback={<CourtsSkeleton />}>
            <CourtsList />
          </Suspense>
        </div>
      </Container>
    </section>
  );
}
