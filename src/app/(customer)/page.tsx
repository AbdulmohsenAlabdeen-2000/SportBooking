import { headers } from "next/headers";
import { Hero } from "@/components/landing/Hero";
import { StatsStrip } from "@/components/landing/StatsStrip";
import { WhySmash } from "@/components/landing/WhySmash";
import { OurCourts } from "@/components/landing/OurCourts";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { WelcomeOverlay } from "@/components/landing/WelcomeOverlay";
import type { Court } from "@/lib/types";

export const dynamic = "force-dynamic";

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function fetchCourtCount(): Promise<number> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/courts`, {
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const json = (await res.json()) as { courts: Court[] };
    return json.courts.length;
  } catch {
    return 0;
  }
}

export default async function HomePage() {
  const courtCount = await fetchCourtCount();

  return (
    <>
      <WelcomeOverlay />
      <Hero />
      <StatsStrip courtCount={courtCount} />
      <RevealOnScroll>
        <WhySmash />
      </RevealOnScroll>
      <RevealOnScroll>
        <OurCourts />
      </RevealOnScroll>
      <RevealOnScroll>
        <HowItWorks />
      </RevealOnScroll>
      <RevealOnScroll>
        <FinalCTA />
      </RevealOnScroll>
    </>
  );
}
