import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Smash Courts Kuwait — Book a Court in Salmiya",
  description:
    "Book padel, tennis, and football courts in Salmiya, Kuwait. Open daily 8 AM – 11 PM.",
  openGraph: {
    title: "Smash Courts Kuwait",
    description: "Pro-grade courts. Instant booking.",
    locale: "en_KW",
  },
  applicationName: "Smash Courts",
  appleWebApp: {
    title: "Smash Courts",
    statusBarStyle: "default",
    capable: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0F766E" },
    { media: "(prefers-color-scheme: dark)", color: "#0D5F58" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-bg font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
