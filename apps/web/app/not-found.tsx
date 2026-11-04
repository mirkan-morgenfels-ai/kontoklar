import type { Metadata } from "next";
import Link from "next/link";
import { BUTTON_GOLD, BUTTON_OUTLINE_LIGHT } from "@/components/site/buttons";
import { StatusPage } from "@/components/site/StatusPage";
import { PORTFOLIO_HOME_URL, PORTFOLIO_LABEL, PROJECT_PATH } from "@/lib/site";

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
          <Link href={PROJECT_PATH} className={BUTTON_GOLD}>
            Zu KontoKlar
          </Link>
          <a href={PORTFOLIO_HOME_URL} rel="noopener noreferrer" className={BUTTON_OUTLINE_LIGHT}>
            Zur Website {PORTFOLIO_LABEL}
            <span className="sr-only"> (externe Seite)</span>
          </a>
        </>
      }
    />
  );
}
