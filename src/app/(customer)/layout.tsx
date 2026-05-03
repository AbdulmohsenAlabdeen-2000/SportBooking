import Link from "next/link";
import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import { Container } from "@/components/ui/Container";

const PHONE_RAW = "+96599998888";
const PHONE_PRETTY = "+965 9999 8888";

function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-semibold text-slate-900"
      aria-label="Smash Courts Kuwait — home"
    >
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white text-base font-bold shadow-sm"
      >
        S
      </span>
      <span className="text-lg leading-none">Smash Courts</span>
    </Link>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200/70 bg-white/95 backdrop-blur shadow-sm">
      <Container className="flex h-full items-center justify-between">
        <Logo />
        <a
          href={`tel:${PHONE_RAW}`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-3 text-brand hover:bg-brand/5 active:bg-brand/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={`Call us at ${PHONE_PRETTY}`}
        >
          <Phone className="h-5 w-5" aria-hidden />
          <span className="hidden text-sm font-medium md:inline">
            {PHONE_PRETTY}
          </span>
        </a>
      </Container>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-brand-dark py-8 text-white">
      <Container className="flex flex-col gap-4 text-sm md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-base font-semibold">Smash Courts Kuwait</p>
          <p className="text-white/80">Block 10, Salmiya, Kuwait</p>
        </div>
        <div className="space-y-1 md:text-right">
          <p>
            <a
              href={`tel:${PHONE_RAW}`}
              className="text-white hover:underline"
            >
              {PHONE_PRETTY}
            </a>
          </p>
          <p>
            <a
              href="https://instagram.com/smashcourtskw"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:underline"
            >
              @smashcourtskw
            </a>
          </p>
        </div>
        <p className="text-white/60 md:self-end">
          © {new Date().getFullYear()} Smash Courts Kuwait
        </p>
      </Container>
    </footer>
  );
}

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      <Footer />
    </>
  );
}
