# ENTWURF: Datenschutzerklärung für den eingeschalteten API-Schritt

Stand: 21.10.2026. **Entwurf, nicht veröffentlicht und nicht in die Seite eingebaut. Keine Rechtsberatung.** Die geltende Datenschutzerklärung (`apps/web/app/datenschutz/page.tsx`) bleibt unverändert, bis der Autor diesen Entwurf geprüft und übernommen hat. Die Absätze sind fertig formuliert; Platzhalter in `[ECKIGEN KLAMMERN]` stehen nur dort, wo Angaben aus den Konten des Autors nötig sind. Vor der Übernahme die Prüfliste am Ende abarbeiten und bei Zweifeln eine fachkundige Stelle fragen.

## Warum ein Entwurf nötig ist

Die geltende Erklärung beschreibt den API-Schritt bereits (Abschnitte 4 und 5), es fehlen aber Angaben, die vor dem Einschalten feststehen müssen (offener Punkt in `CLAUDE.md`):

- Upstash: Rechtsträger, Sitz und Speicherregion der Datenbank,
- OpenAI: Vertragspartner, Auftragsverarbeitung und Grundlage der Übermittlung in die USA,
- Cloudflare: Grundlage der Übermittlung in die USA und die Rolle von Cloudflare als eigener Verantwortlicher für die Verbesserung von Turnstile,
- Speicherdauer bei OpenAI.

Nach Regel 5 in `CLAUDE.md` ziehen Änderungen an übertragenen oder gespeicherten Daten auch die Hinweisbox in `KontoKlarApp.tsx` und den README-Abschnitt „Was den Browser verlässt“ nach sich. Der Entwurf ändert am Datenfluss nichts; diese beiden Stellen müssen deshalb nur geprüft, nicht umgeschrieben werden.

## Vorgeschlagene Fassung

Die Absätze ersetzen die bisherigen Absätze 2 und 3 von Abschnitt 4 und ergänzen Abschnitt 5. Werte in `{…}` kommen in der Seite wie bisher aus `PRIVACY_FACTS` (`apps/web/lib/kontoklar/privacy.ts`): `{cacheDays}` = 30, `{fallbackBelowConfidence}` = 0,5, `{rateLimitRequests}` = 30.

### Abschnitt 4, neuer Absatz 2: Verarbeitung bei OpenAI

> Der Server berechnet für diese Händlernamen Text-Embeddings (Modell text-embedding-3-small) und lässt nur Händlernamen, die das Beispielset nicht sicher zuordnet (Konfidenz unter {fallbackBelowConfidence}), von einem Sprachmodell (GPT-5 nano) einer Kategorie zuordnen. Beides erbringt OpenAI als Auftragsverarbeiter nach Art. 28 DSGVO. Vertragspartner ist [VERTRAGSPARTNER LAUT OPENAI-KONTO, bei Rechnungsadresse im EWR: OpenAI Ireland Ltd., The Liffey Trust Centre, 117-126 Sheriff Street Upper, Dublin 1, Irland]; der Vertrag zur Auftragsverarbeitung (Data Processing Addendum) gilt seit [DATUM DES ABSCHLUSSES IM OPENAI-KONTO]. OpenAI kann die Daten auch durch verbundene Unternehmen in den USA verarbeiten lassen; diese Übermittlung stützt sich auf die Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO), die Teil des Auftragsverarbeitungsvertrags sind. OpenAI verwendet die übermittelten Texte nicht zum Training seiner Modelle und speichert sie zur Missbrauchserkennung höchstens 30 Tage. Übermittelt werden ausschließlich die normalisierten Händlernamen, keine Angaben über Sie.

### Abschnitt 4, neuer Absatz 3: Zwischenspeicher bei Upstash

> Das Ergebnis wird als Zuordnung von Händlername zu Kategorie und Konfidenz für {cacheDays} Tage in einer Redis-Datenbank der Upstash, Inc. (USA, Delaware) gespeichert, damit derselbe Händlername nicht erneut angefragt werden muss. Die Datenbank liegt in der Region [REGION LAUT UPSTASH-KONSOLE, empfohlen: AWS eu-central-1, Frankfurt am Main]. Dieser Eintrag enthält weder Ihre IP-Adresse noch andere Angaben über Sie. Upstash ist Auftragsverarbeiter nach Art. 28 DSGVO; der Auftragsverarbeitungsvertrag ist Bestandteil der Nutzungsbedingungen von Upstash. Soweit Upstash aus den USA auf die Datenbank zugreift, stützt sich das auf die Zertifizierung von Upstash unter dem EU-US Data Privacy Framework (Angemessenheitsbeschluss der EU-Kommission, Art. 45 DSGVO) und, soweit diese nicht greift, auf die im Auftragsverarbeitungsvertrag vereinbarten Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).

Der bisherige Absatz 4 (Rechtsgrundlage Einwilligung, Widerruf) bleibt unverändert.

### Abschnitt 5, Absatz „Bot-Prüfung“, ergänzt

> **Bot-Prüfung.** Wenn Sie den API-Schritt nutzen, lädt die Seite das Prüf-Widget Cloudflare Turnstile der Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA (challenges.cloudflare.com). Cloudflare verarbeitet dabei Verbindungs- und Browserdaten, insbesondere Ihre IP-Adresse, den TLS-Fingerabdruck, die Browserkennung (User-Agent) und den Websiteschlüssel dieser Seite, um automatisierte Zugriffe zu erkennen. Zur Prüfung des Ergebnisses sendet der Server das Token und Ihre IP-Adresse an Cloudflare. Für die Bot-Prüfung handelt Cloudflare als Auftragsverarbeiter; dieselben Daten verwendet Cloudflare nach eigenen Angaben außerdem als eigener Verantwortlicher, um die Bot-Erkennung von Turnstile zu verbessern. Die Übermittlung in die USA stützt sich auf die Zertifizierung von Cloudflare unter dem EU-US Data Privacy Framework (Art. 45 DSGVO) und, soweit diese nicht greift, auf Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO). Ohne eingeschalteten API-Schritt wird Turnstile nicht geladen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; das berechtigte Interesse liegt im Schutz des API-Schritts vor automatisierten Massenanfragen. Weitere Informationen: Turnstile Privacy Addendum von Cloudflare (https://www.cloudflare.com/turnstile-privacy-policy/).

Der Absatz „Aufruflimit“ bleibt unverändert; er nennt Upstash bereits als Speicherort des Zählers. Wenn der neue Absatz 3 von Abschnitt 4 übernommen ist, gelten Rechtsträger, Region und Übermittlungsgrundlage auch für den Zähler.

### Abschnitt 9 „Ihre Rechte“

Unverändert. Der letzte Satz („beschränkt sich eine Auskunft auf die oben genannten Verbindungsdaten und den pseudonymisierten Zähler des Aufruflimits“) passt weiter.

## Zu prüfen (Hinweise, keine Rechtsberatung)

- § 25 TDDDG: Turnstile liest Informationen aus dem Browser aus. Das ist ohne gesonderte Einwilligung zulässig, wenn es unbedingt erforderlich ist, um einen vom Nutzer ausdrücklich gewünschten Dienst bereitzustellen (§ 25 Abs. 2 Nr. 2 TDDDG). Hier lädt Turnstile erst, wenn Sie den API-Schritt anhaken; ob das als ausdrücklicher Wunsch genügt oder die Einwilligung zum API-Schritt (Art. 6 Abs. 1 lit. a DSGVO) Turnstile ausdrücklich mit umfassen sollte, ist zu bewerten. Eine vorsichtige Variante wäre, im Hinweistext beim Anhaken Cloudflare Turnstile ausdrücklich zu nennen.
- Rolle von Cloudflare als eigener Verantwortlicher (Verbesserung von Turnstile): Ob und wie das in der Erklärung als eigene Übermittlung mit eigener Rechtsgrundlage dargestellt werden muss, ist zu bewerten.
- Datenresidenz bei OpenAI: Eine Verarbeitung in Europa (Domain `eu.api.openai.com`) setzt laut OpenAI eine Freigabe für geänderte Missbrauchsüberwachung bzw. Zero Data Retention voraus; der Code ruft `api.openai.com` auf. Der Entwurf geht deshalb von einer möglichen Verarbeitung in den USA aus.

## Prüfliste vor der Übernahme

1. In der DPF-Liste (https://www.dataprivacyframework.gov/list) prüfen, ob Cloudflare, Inc. und Upstash, Inc. mit Status „Active“ für das EU-U.S. DPF eingetragen sind. Beide nennen die Zertifizierung in ihren eigenen Unterlagen; ein Drittanbieter-Blog bestritt sie für Upstash. Ist ein Anbieter nicht (mehr) eingetragen, den DPF-Halbsatz in seinem Absatz streichen; die Standardvertragsklauseln bleiben als Grundlage.
2. Ebenso nach „OpenAI“ suchen. Ist OpenAI OpCo, LLC aktiv eingetragen, kann im Absatz zu OpenAI ergänzt werden: „Zusätzlich ist OpenAI OpCo, LLC unter dem EU-US Data Privacy Framework zertifiziert (Art. 45 DSGVO).“ Nicht ergänzen, solange das nicht geprüft ist.
3. Im OpenAI-Konto den Vertragspartner (abhängig von der Rechnungsadresse) und Abschluss bzw. Datum des Data Processing Addendum ablesen und die beiden Platzhalter füllen. Die OpenAI-Seiten zum DPA ließen sich am 20.10.2026 nicht automatisiert abrufen (HTTP 403); Angaben dazu stammen aus Suchergebnissen und müssen im Konto bestätigt werden.
4. In der Upstash-Konsole die Region der Datenbank ablesen und den Platzhalter füllen. Keine Lese-Regionen außerhalb der EU anlegen, sonst stimmt der Absatz nicht mehr.
5. Den Text in `apps/web/app/datenschutz/page.tsx` übernehmen, `OPERATOR.lastUpdated` (`apps/web/lib/operator.ts`) und die E2E-Konstante `LEGAL_UPDATED` auf das neue Datum setzen, README-Abschnitt „Was den Browser verlässt“ und die Hinweisbox in `KontoKlarApp.tsx` gegenlesen, dann `pnpm test`, `pnpm build` und `pnpm test:e2e`.
6. Erst danach die sechs Umgebungsvariablen in Vercel setzen ([`einrichtung-api.md`](einrichtung-api.md), Schritt 7).

## Quellen

- OpenAI, Data Processing Addendum (Fassung ab 01.01.2026: Vertragspartner für Kunden im EWR und in der Schweiz OpenAI Ireland Ltd., Übermittlungen auf Grundlage von Standardvertragsklauseln): https://openai.com/policies/data-processing-addendum/ (Inhalt über Suchergebnisse geprüft am 20.10.2026; die Seite lehnt automatisierte Abrufe ab)
- OpenAI, Europe Privacy Policy, Fassung vom 04.11.2024 (OpenAI Ireland Limited, The Liffey Trust Centre, 117-126 Sheriff Street Upper, Dublin 1): https://openai.com/policies/eu-privacy-policy/revisions/2024-11-04/ (über Suchergebnisse geprüft am 20.10.2026; vor der Übernahme mit der aktuellen Fassung abgleichen)
- OpenAI, „Data controls in the OpenAI platform“ (kein Training mit API-Daten ohne Opt-in, Missbrauchsüberwachung bis 30 Tage für `/v1/embeddings` und `/v1/chat/completions`, Datenresidenz Europa nur mit Freigabe): https://developers.openai.com/api/docs/guides/your-data (abgerufen am 21.10.2026)
- Upstash, Data Processing Addendum, „Last Update Date: April, 2025“ (Upstash, Inc., Delaware; DPA Bestandteil des Vertrags; DPF und ersatzweise Standardvertragsklauseln Modul 2 bzw. 3): https://upstash.com/static/trust/dpa.pdf (abgerufen am 20.10.2026)
- Upstash, Privacy Policy, „Last Update Date: April, 2025“ (Erklärung zur Teilnahme am EU-US DPF): https://upstash.com/trust/privacy.pdf (abgerufen am 20.10.2026)
- Upstash, Terms of Service, „Last Update Date: April, 2025“ (Vertragspartner Upstash, Inc., a Delaware corporation): https://upstash.com/trust/terms.pdf (abgerufen am 20.10.2026)
- Upstash, Global Replication (Regionen, darunter AWS EU-Central-1 Frankfurt; Regionen lassen sich hinzufügen und entfernen): https://upstash.com/docs/common/concepts/global-replication (abgerufen am 21.10.2026)
- sota.io, „Upstash EU Alternative 2026“ (bestreitet den DPF-Eintrag von Upstash; Drittanbieter mit eigenem Interesse): https://sota.io/blog/upstash-eu-alternative-gdpr-cloud-act-serverless-redis-2026 (über Suchergebnisse geprüft am 21.10.2026)
- Cloudflare, Privacy Policy, gültig ab 04.11.2025 (Anschrift, DPF, Standardvertragsklauseln als Rückfall): https://www.cloudflare.com/privacypolicy/ (abgerufen am 21.10.2026)
- Cloudflare, Customer Data Processing Addendum, Version 6.4 vom 03.04.2026 (Bestandteil u. a. des Self-Serve Subscription Agreement; DPF; SCC Modul 2 bzw. 3): https://www.cloudflare.com/cloudflare-customer-dpa/ (abgerufen am 21.10.2026)
- Cloudflare, Turnstile Privacy Addendum, Stand 18.06.2025 (Signale; Cloudflare als Auftragsverarbeiter für die Bot-Prüfung und als Verantwortlicher für die Verbesserung von Turnstile): https://www.cloudflare.com/turnstile-privacy-policy/ (abgerufen am 21.10.2026)
- Data Privacy Framework, Teilnehmerliste: https://www.dataprivacyframework.gov/list (Einträge nicht automatisiert abrufbar; Prüfung durch den Autor, siehe Prüfliste)
