"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEGAL_LINKS } from "@/lib/site";
import { cx } from "./cx";

export function LegalNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Rechtstexte">
      <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-0 lg:border-l lg:border-line">
        {LEGAL_LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative inline-flex rounded-full border px-4 py-2 text-sm transition-colors duration-150 lg:-ml-px lg:rounded-none lg:border-0 lg:border-l lg:py-2 lg:pl-5",
                  active
                    ? "border-navy-950 bg-navy-950 text-ivory lg:border-gold-deep lg:bg-transparent lg:font-medium lg:text-ink"
                    : "border-line text-slate hover:border-ink hover:text-ink lg:border-transparent",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
