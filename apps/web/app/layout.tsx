import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { SITE_DESCRIPTION, SITE_NAME, SOCIAL_DESCRIPTION } from "@/lib/metadata";
import { LEGAL_LINKS, NAV_LINKS, REPO_URL, siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: SOCIAL_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "de_DE",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SOCIAL_DESCRIPTION },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-paper text-ink antialiased">
        <a href="#main" className="skip-link">
          Zum Inhalt springen
        </a>
        <header className="border-b border-line bg-surface">
          <nav
            aria-label="Hauptnavigation"
            className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4"
          >
            <Link href="/" className="font-serif text-lg whitespace-nowrap hover:text-gold-deep">
              Mirkan Deniz Günkaya
            </Link>
            <NavLinks links={NAV_LINKS} />
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-6 py-10">
          {children}
        </main>
        <footer className="mx-auto flex max-w-6xl flex-wrap gap-x-4 gap-y-3 px-6 py-8 text-xs text-stone">
          <span>
            © 2026 Mirkan Deniz Günkaya · Privates, nicht-kommerzielles Projekt ·{" "}
            <a href={REPO_URL} rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gold-deep" data-testid="footer-repo-link">
              Quellcode auf GitHub<span className="sr-only"> (externe Seite)</span>
            </a>{" "}
            (MIT-Lizenz)
          </span>
          <nav aria-label="Rechtliches" className="flex flex-wrap gap-x-4 gap-y-3">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-gold-deep">
                {link.label}
              </Link>
            ))}
          </nav>
        </footer>
      </body>
    </html>
  );
}
