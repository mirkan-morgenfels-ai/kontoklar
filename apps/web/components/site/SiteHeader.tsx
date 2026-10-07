import { NAV_LINKS } from "@/lib/site";
import { Brand } from "./Brand";
import { NavLinks } from "./NavLinks";
import { Shell } from "./Shell";

export function SiteHeader() {
  return (
    <header className="surface-navy relative z-40 border-b border-navy-700 sm:sticky sm:top-0">
      <Shell className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 py-3 md:flex-nowrap md:py-4">
        <Brand compact />
        <nav aria-label="Hauptnavigation" className="max-sm:w-full">
          <NavLinks links={NAV_LINKS} />
        </nav>
      </Shell>
    </header>
  );
}
