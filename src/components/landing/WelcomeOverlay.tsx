"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { FloatingSportsBg } from "@/components/landing/FloatingSportsBg";

const COOKIE_KEY = "smash-welcome-seen";
const STORAGE_KEY = "smash-welcome-seen";

// Splash welcome that overlays the landing on the first visit. Click
// "Let's Smash" or "skip" to play the exit animation and reveal the
// page underneath. The dismissal is stored as a cookie so the server
// can omit this component entirely on subsequent renders — no flash on
// reload. localStorage is kept as a defence-in-depth fallback.

export function WelcomeOverlay() {
  // "preparing" — first paint, off-state classes (so the entrance
  //               animation has somewhere to come *from*).
  // "entering"  — useEffect bumps to this on next tick, transition fires.
  // "leaving"   — button clicked, runs exit animation.
  // "hidden"    — fully unmounted after exit animation completes.
  const [phase, setPhase] = useState<
    "preparing" | "entering" | "leaving" | "hidden"
  >("preparing");

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("entering"), 16);
    return () => window.clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      // Cookie is the source of truth; one-year max-age, root path so
      // every customer route sees the same value.
      document.cookie = `${COOKIE_KEY}=1; max-age=31536000; path=/; samesite=lax`;
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage / cookie blocked — overlay reappears next visit, fine.
    }
    setPhase("leaving");
    // Wait for the CSS transition (700ms) before unmounting so it's
    // not a hard cutoff. The underlying landing is already painted.
    window.setTimeout(() => setPhase("hidden"), 750);
  }

  if (phase === "hidden") return null;

  // Reduced-motion users get an instant fade with no scaling.
  const isLeaving = phase === "leaving";
  const isEntering = phase === "entering";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-heading"
      className={[
        "fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand to-brand-dark text-white transition-all duration-700 ease-out motion-reduce:transition-opacity",
        isLeaving
          ? "pointer-events-none scale-110 opacity-0 motion-reduce:scale-100"
          : "scale-100 opacity-100",
      ].join(" ")}
    >
      <FloatingSportsBg />

      {/* Decorative glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand/40 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {/* Logo */}
        <div
          className={[
            "flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl font-extrabold text-brand shadow-2xl shadow-black/20 transition-all duration-700 ease-out md:h-24 md:w-24 md:text-4xl motion-reduce:transition-none",
            isEntering
              ? "translate-y-0 rotate-0 opacity-100"
              : "-translate-y-4 -rotate-12 opacity-0 motion-reduce:translate-y-0 motion-reduce:rotate-0",
          ].join(" ")}
        >
          S
        </div>

        <p
          className={[
            "mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition-all duration-700 ease-out [transition-delay:120ms] motion-reduce:transition-none",
            isEntering
              ? "translate-y-0 opacity-100"
              : "translate-y-2 opacity-0 motion-reduce:translate-y-0",
          ].join(" ")}
        >
          Smash Courts · Salmiya
        </p>

        <h1
          id="welcome-heading"
          className={[
            "mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight transition-all duration-700 ease-out [transition-delay:200ms] sm:text-5xl md:text-6xl lg:text-7xl motion-reduce:transition-none",
            isEntering
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0 motion-reduce:translate-y-0",
          ].join(" ")}
        >
          Welcome to{" "}
          <span className="bg-gradient-to-r from-accent via-amber-300 to-accent bg-clip-text text-transparent">
            Smash Courts
          </span>
        </h1>

        <p
          className={[
            "mt-5 max-w-md text-base text-white/85 transition-all duration-700 ease-out [transition-delay:280ms] md:text-lg motion-reduce:transition-none",
            isEntering
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0 motion-reduce:translate-y-0",
          ].join(" ")}
        >
          Pick a court. Pick a time. You're playing in under a minute.
        </p>

        {/* Button */}
        <button
          type="button"
          onClick={dismiss}
          className={[
            "group relative mt-10 inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-accent px-10 py-5 text-lg font-bold text-white shadow-2xl shadow-accent/40 transition-all duration-700 ease-out [transition-delay:360ms] hover:-translate-y-0.5 hover:bg-accent-dark hover:shadow-accent/60 active:translate-y-0 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand motion-reduce:transition-none motion-reduce:transform-none",
            isEntering
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0 motion-reduce:translate-y-0",
          ].join(" ")}
        >
          <span className="relative z-10">Let&apos;s Smash!</span>
          <ArrowRight
            className="relative z-10 h-5 w-5 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none"
            aria-hidden
          />
          {/* Shine sweep */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-1000 group-hover:translate-x-full motion-reduce:hidden"
          />
        </button>

        <button
          type="button"
          onClick={dismiss}
          className={[
            "mt-4 text-xs text-white/60 underline-offset-4 transition-all duration-700 ease-out [transition-delay:440ms] hover:text-white/90 hover:underline motion-reduce:transition-none",
            isEntering ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          skip
        </button>
      </div>
    </div>
  );
}
