import type { MetadataRoute } from "next";

// Web App Manifest — drives the PWA install prompt and the iOS
// "Add to Home Screen" appearance. Lighthouse's PWA / Best Practices
// audits both want this present.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smash Courts Kuwait",
    short_name: "Smash Courts",
    description:
      "Book padel, tennis, and football courts in Salmiya, Kuwait.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0F766E",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
