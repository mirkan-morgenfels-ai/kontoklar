"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavLink } from "@/lib/site";

const BASE_CLASS = "hover:text-gold-deep";
const ACTIVE_CLASS = "underline decoration-gold-deep underline-offset-4";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ links }: { links: readonly NavLink[] }) {
  const pathname = usePathname() ?? "";
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {links.map((link) => {
        if (link.external) {
          return (
            <li key={link.href}>
              <a href={link.href} rel="noopener noreferrer" className={BASE_CLASS}>
                {link.label}
                <span className="sr-only"> (externe Seite)</span>
              </a>
            </li>
          );
        }
        const active = isActive(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={active ? `${BASE_CLASS} ${ACTIVE_CLASS}` : BASE_CLASS}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
