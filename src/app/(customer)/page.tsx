import { Hero } from "@/components/landing/Hero";
import { WhySmash } from "@/components/landing/WhySmash";
import { OurCourts } from "@/components/landing/OurCourts";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <WhySmash />
      <OurCourts />
      <HowItWorks />
      <FinalCTA />
    </>
  );
}
