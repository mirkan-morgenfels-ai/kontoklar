"use client";

import Link from "next/link";
import { BUTTON_GOLD, BUTTON_OUTLINE_LIGHT } from "@/components/site/buttons";
import { StatusPage } from "@/components/site/StatusPage";
import { PROJECT_PATH } from "@/lib/site";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage
      code="!"
      eyebrow="Fehler"
      title="Etwas ist schiefgelaufen"
      text="Die Seite konnte nicht dargestellt werden. Durch diesen Fehler wurden keine Daten übertragen. Bitte versuchen Sie es erneut oder öffnen Sie KontoKlar neu."
      actions={
        <>
          <button type="button" onClick={reset} className={BUTTON_GOLD}>
            Erneut versuchen
          </button>
          <Link href={PROJECT_PATH} className={BUTTON_OUTLINE_LIGHT}>
            Zu KontoKlar
          </Link>
        </>
      }
    />
  );
}
