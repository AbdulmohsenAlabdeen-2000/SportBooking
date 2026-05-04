import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, ArrowRight, Activity, CircleDot, LandPlot } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { isUuid } from "@/lib/api";
import { formatKwd } from "@/lib/time";
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
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function fetchCourts(): Promise<Court[]> {
  const res = await fetch(`${getBaseUrl()}/api/courts`, { cache: "no-store" });
  if (!res.ok) throw new Error("courts_fetch_failed");
  const json = (await res.json()) as { courts: Court[] };
  return json.courts;
}

export const metadata = { title: "Pick a Court — Smash Courts Kuwait" };

export default async function CourtPickerPage({
  searchParams,
}: {
  searchParams: { court?: string };
}) {
  // Deep-link from the landing page: ?court=<uuid> jumps straight to step 2.
  const incoming = searchParams.court;
  if (incoming && isUuid(incoming)) {
    redirect(`/book/${incoming}`);
  }

  const t = getDict();
  let courts: Court[] = [];
  let error: string | null = null;
  try {
    courts = await fetchCourts();
  } catch {
    error = t.book.courts_load_error;
  }

  return (
    <Container className="py-6 md:py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        {t.common.back}
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-slate-900 md:text-3xl">
        {t.book.pick_court_title}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {t.book.pick_court_subtitle}
      </p>

      {error ? (
        <Card className="mt-6 text-center text-slate-600">
          <p>{error}</p>
        </Card>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {courts.map((court) => {
            const Icon = SPORT_ICON[court.sport];
            return (
              <li key={court.id}>
                <Link
                  href={`/book/${court.id}`}
                  className="block focus:outline-none"
                  aria-label={format(t.book.pick_label, { name: court.name })}
                >
                  <Card className="flex items-center gap-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand">
                    {court.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={court.image_url}
                        alt={court.name}
                        loading="lazy"
                        decoding="async"
                        className="h-16 w-16 flex-none rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand">
                        <Icon className="h-8 w-8" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                        {sportLabel(court.sport, t)}
                      </p>
                      <h2 className="mt-0.5 truncate text-base font-semibold text-slate-900">
                        {court.name}
                      </h2>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {format(t.book.capacity_short, {
                          capacity: court.capacity,
                          price: formatKwd(court.price_per_slot),
                        })}
                      </p>
                    </div>
                    <ArrowRight
                      className="h-5 w-5 flex-none text-slate-400 rtl:rotate-180"
                      aria-hidden
                    />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
