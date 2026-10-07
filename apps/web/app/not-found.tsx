import type { Metadata } from "next";
import Link from "next/link";
import { BUTTON_GOLD, BUTTON_OUTLINE_LIGHT } from "@/components/site/buttons";
import { StatusPage } from "@/components/site/StatusPage";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      eyebrow="Fehler 404"
      title="Seite nicht gefunden"
      text="Die aufgerufene Adresse existiert nicht oder wurde verschoben."
      actions={
        <>
          <Link href="/" className={BUTTON_GOLD}>
            Zur Startseite
          </Link>
          <Link href="/projects/kontoklar" className={BUTTON_OUTLINE_LIGHT}>
            Zu KontoKlar
          </Link>
        </>
      }
    />
  );
}
