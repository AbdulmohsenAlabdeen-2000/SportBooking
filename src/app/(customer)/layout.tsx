import Link from "next/link";
import type { ReactNode } from "react";
import { LogIn, Phone, User } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ToastProvider } from "@/components/ui/Toast";
import { DemoBanner } from "@/components/DemoBanner";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ChatWidget } from "@/components/customer/ChatWidget";
import { getCurrentCustomer } from "@/lib/customer";
import { format, getDict, getLocale } from "@/lib/i18n";

const PHONE_RAW = "+96594490924";
const PHONE_PRETTY = "+965 9449 0924";

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

async function Header() {
  const customer = await getCurrentCustomer();
  const locale = getLocale();
  const t = getDict(locale);
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200/70 bg-white/95 backdrop-blur shadow-sm">
      <Container className="flex h-full items-center justify-between gap-2">
        <Logo />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageToggle current={locale} />
          {customer ? (
            <Link
              href="/me"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand/10 px-3 text-sm font-medium text-brand hover:bg-brand/15"
              aria-label={`${t.header.account}: ${customer.name}`}
            >
              <User className="h-4 w-4" aria-hidden />
              <span className="hidden md:inline">
                {customer.name.split(" ")[0]}
              </span>
              <span className="hidden sm:inline md:hidden">
                {t.header.account}
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label={t.common.sign_in}
            >
              <LogIn className="h-5 w-5 sm:hidden" aria-hidden />
              <span className="hidden sm:inline">{t.common.sign_in}</span>
            </Link>
          )}
          <a
            href={`tel:${PHONE_RAW}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-3 text-brand hover:bg-brand/5 active:bg-brand/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label={`${t.header.call_us} ${PHONE_PRETTY}`}
          >
            <Phone className="h-5 w-5" aria-hidden />
            <span className="hidden text-sm font-medium md:inline" dir="ltr">
              {PHONE_PRETTY}
            </span>
          </a>
        </div>
      </Container>
    </header>
  );
}

function Footer() {
  const locale = getLocale();
  const t = getDict(locale);
  return (
    <footer className="bg-brand-dark py-8 text-white">
      <Container className="flex flex-col gap-4 text-sm md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-base font-semibold">Smash Courts Kuwait</p>
          <p className="text-white/80">{t.footer.address}</p>
        </div>
        <div className="space-y-1 md:text-end">
          <p>
            <a
              href={`tel:${PHONE_RAW}`}
              className="text-white hover:underline"
              dir="ltr"
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
          {format(t.footer.rights, { year: new Date().getFullYear() })}
        </p>
      </Container>
    </footer>
  );
}

export default function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <DemoBanner />
      <Header />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      <Footer />
      <ChatWidget />
    </ToastProvider>
  );
}
