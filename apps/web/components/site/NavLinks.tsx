"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavLink } from "@/lib/site";
import { ExternalMark } from "./ExternalMark";
import { cx } from "./cx";

const BASE_CLASS =
  "relative -mx-2 inline-flex items-center rounded-full px-2 py-1.5 text-xs transition-colors duration-150 min-[380px]:text-[0.78rem] sm:text-[0.8125rem] lg:text-sm lg:tracking-[0.02em]";
const IDLE_CLASS = "text-navy-300 hover:text-ivory";
const ACTIVE_CLASS = "text-ivory after:absolute after:inset-x-2 after:-bottom-px after:h-px after:bg-gold after:content-['']";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ links }: { links: readonly NavLink[] }) {
  const pathname = usePathname() ?? "";
  return (
    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 min-[360px]:gap-x-1.5 min-[360px]:max-sm:justify-between sm:gap-x-5 md:gap-x-4 lg:gap-x-7">
      {links.map((link) => {
        if (link.external) {
          return (
            <li key={link.href}>
              <a href={link.href} rel="noopener noreferrer" className={cx(BASE_CLASS, IDLE_CLASS)}>
                {link.label}
                <span className="sr-only"> (externe Seite)</span>
                <ExternalMark className="ml-1 inline-block h-2 w-2 text-gold/80 sm:h-2.5 sm:w-2.5" />
              </a>
            </li>
          );
        }
        const active = isActive(pathname, link.href);
        return (
          <li key={link.href}>
            <Link href={link.href} aria-current={active ? "page" : undefined} className={cx(BASE_CLASS, active ? ACTIVE_CLASS : IDLE_CLASS)}>
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
