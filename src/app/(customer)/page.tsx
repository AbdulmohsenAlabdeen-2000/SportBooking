import { Hero } from "@/components/landing/Hero";
import { WhySmash } from "@/components/landing/WhySmash";
import { OurCourts } from "@/components/landing/OurCourts";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { RevealOnScroll } from "@/components/RevealOnScroll";

export default function HomePage() {
  return (
    <>
      <Hero />
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
