import type { Metadata } from "next";
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
