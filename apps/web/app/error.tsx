"use client";

import Link from "next/link";
import { BUTTON_GOLD, BUTTON_OUTLINE_LIGHT } from "@/components/site/buttons";
import { StatusPage } from "@/components/site/StatusPage";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage
      code="!"
      eyebrow="Fehler"
      title="Etwas ist schiefgelaufen"
      text="Die Seite konnte nicht dargestellt werden. Durch diesen Fehler wurden keine Daten übertragen. Bitte versuchen Sie es erneut oder kehren Sie zur Startseite zurück."
      actions={
        <>
          <button type="button" onClick={reset} className={BUTTON_GOLD}>
            Erneut versuchen
          </button>
          <Link href="/" className={BUTTON_OUTLINE_LIGHT}>
            Zur Startseite
          </Link>
        </>
      }
    />
  );
}
