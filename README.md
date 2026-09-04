# KontoKlar

Kategorisiert Bankumsätze aus CSV-Exporten und zeigt, wohin das Geld geht. Regel-Engine zuerst, Embeddings zweitens, Sprachmodell nur als Fallback. Keine Kontoanbindung, keine Speicherung von Umsätzen.

[![CI](https://github.com/mirkan-morgenfels-ai/AI-Project-2/actions/workflows/ci.yml/badge.svg)](https://github.com/mirkan-morgenfels-ai/AI-Project-2/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

Live-Demo: https://kontoklar-eight.vercel.app/projects/kontoklar

**English summary.** KontoKlar categorizes German bank account CSV exports (DKB, ING, comdirect, N26) and builds a household dashboard: monthly spending by category, recurring payments, and a personal inflation rate that weights official Destatis price indices with the user's own spending shares. Categorization is a three-stage hybrid: a client-side rule engine, then OpenAI embeddings with k-nearest-neighbour voting against a labelled example set, then a small LLM only for low-confidence cases. Results are cached per merchant, requests are rate-limited and bot-protected, so variable API cost stays near zero. No transactions are stored server-side; only a pseudonymized merchant string ever leaves the browser.

## Problem

Seit comdirect seinen Finanzmanager 2023 eingestellt hat, fehlt vielen Kunden deutscher Banken eine automatische Kategorisierung ihrer Umsätze. Multibanking-Apps verlangen Zugangsdaten und speichern Umsätze in der Cloud; Tabellenkalkulationen sind Handarbeit. KontoKlar arbeitet mit dem CSV-Export, den jede Bank anbietet, und behält so viel wie möglich im Browser.

## Was KontoKlar macht

- Liest die Umsatz-CSV von DKB, ING, comdirect und N26 ein; andere Banken über ein generisches Spalten-Mapping.
- Kategorisiert jede Buchung in drei Stufen: Regel-Engine, Embedding-Ähnlichkeit, Sprachmodell-Fallback.
- Zeigt jede automatische Zuordnung mit Konfidenz an; unsichere Fälle sind zur Prüfung markiert und lassen sich mit einem Klick korrigieren.
- Erkennt wiederkehrende Zahlungen (Abos, Miete, Versicherungen) über Rhythmus und Betrag.
- Berechnet eine persönliche Inflationsrate aus den eigenen Ausgabenanteilen und den Teilindizes des Verbraucherpreisindex (Destatis).
- Speichert keine Umsätze. Der Server kennt nur einen Cache von Händlername zu Kategorie.

## Screenshots

[Platzhalter: Screenshot Review-Tabelle mit Konfidenz-Markierung]

[Platzhalter: Screenshot Dashboard mit Monats- und Kategorieauswertung]

## So funktioniert es

```
Bank-CSV (Browser) -> Papa Parse -> Normalisierung
  -> Regel-Engine (clientseitig, ca. 70 % der Buchungen)
  -> Rest: Pseudonymisierung -> ein Batch-Aufruf /api/categorize
       -> Turnstile pruefen -> Rate-Limit pruefen
       -> Cache-Lookup (Upstash Redis)
       -> neue Texte: Embedding (text-embedding-3-small) + kNN gegen gelabeltes Beispielset
       -> Konfidenz < 0,5: Sprachmodell-Fallback (GPT-5 nano)
       -> Ergebnisse cachen (30 Tage)
  -> Review-Tabelle -> Dashboard
  -> persoenliche Inflation aus data/k2/cpi.json
```

Konfidenzschwellen: Regel trifft → 1,0. Embedding-kNN ≥ 0,80 → übernehmen. 0,50 bis 0,80 → übernehmen und zur Prüfung markieren. Unter 0,50 → Sprachmodell entscheidet, Ergebnis wird mit 0,50 gecacht. kNN-Konfidenz = mittlere Kosinus-Ähnlichkeit der Nachbarn der Mehrheitskategorie (k = 3); ohne Mehrheit zusätzlich mit dem Gewichtsanteil multipliziert. Beispiel aus dem Umsetzungsdokument (0,94; 0,88; 0,71) ergibt 0,91.

## Datenschutz: Was den Browser verlässt

Gesendet wird nur der normalisierte Händlerteil eines Buchungstexts, den die Regel-Engine nicht kennt, zum Beispiel `REWE SAGT DANKE`. Die Normalisierung entfernt IBANs, BICs, Daten, Uhrzeiten, Nummern, SEPA-Kürzel, Zahlungsart-Wörter und Rechtsformen und kürzt auf 60 Zeichen. Bei PayPal wird der Händler aus „Ihr Einkauf bei …“ genommen, nicht der PayPal-Text.

Nicht gesendet werden: Namen, IBANs, Verwendungszwecke, Beträge, Buchungsdaten, Kontonummern und vollständige Buchungszeilen. Gutschriften und Überweisungen an Empfänger ohne Firmenkennzeichen (also an Privatpersonen) gehen nie an die API; sie bleiben zur Prüfung markiert. Die Oberfläche zeigt nach jedem Upload die Liste der tatsächlich übertragenen Texte.

Serverseitig gespeichert wird ausschließlich ein Cache von normalisiertem Händlernamen zu Kategorie und Konfidenz (30 Tage) sowie der Zähler des Tageslimits je IP. Umsätze werden nicht gespeichert. Für die Embedding- und Fallback-Aufrufe gelten die Datenverarbeitungsvereinbarungen des API-Anbieters; die Datenschutzerklärung der Seite nennt sie. Wer keine Übertragung möchte, kann den API-Schritt abschalten; dann arbeitet nur die Regel-Engine.

## Kostenkontrolle

| Maßnahme | Wirkung |
|---|---|
| Regel-Engine clientseitig | etwa 70 % der Buchungen kosten nichts |
| Cache pro Händlername | jeder Händlertext kostet höchstens einmal |
| Ein Batch-Aufruf pro Upload, höchstens 500 Texte | wenige Function Invocations und Redis-Befehle |
| Embeddings statt Sprachmodell als Standard | 0,02 $ pro Mio. Token statt eines LLM-Aufrufs je Buchung |
| Sprachmodell nur unter Konfidenz 0,5 | Fallback für etwa 2 % der Buchungen |
| Tageslimit 30 Aufrufe pro IP, Cloudflare Turnstile | Schutz vor Skripten und Massenanfragen |
| Hartes Monatslimit an der Anbieter-Konsole | Kosten sind nach oben gedeckelt |

Geschätzte variable Kosten bei 300 Buchungen je Nutzer: etwa 0,02 $ bei 100 Nutzern im Monat, etwa 0,21 $ bei 1.000, etwa 2,10 $ bei 10.000. Bei Erreichen eines Limits bleibt die Regel-Engine aktiv.

## Genauigkeit

Gemessen mit `pnpm --filter web accuracy` auf einem von Hand gelabelten, synthetischen Testset mit 198 Buchungen (`data/k2/testset.json`), Stand 03.09.2026, nur Regel-Engine (noch ohne API-Key):

| Stufe | Anteil der Buchungen | Accuracy |
|---|---|---|
| Regel-Engine | 96,5 % | 97,9 % |
| Embedding-kNN | noch nicht gemessen | – |
| Sprachmodell-Fallback | noch nicht gemessen | – |
| offen (keine Regel) | 3,5 % | – |
| Gesamt (offene zählen als falsch) | 100 % | 94,4 % |

Das Testset wurde parallel zum Regelsatz erstellt; die hohe Regelabdeckung ist deshalb kein Beleg für echte Kontohistorien. Precision und Recall je Kategorie, Fehlerliste und offene Messungen stehen in `docs/genauigkeit.md`. Ziel für v1: mindestens 90 % Accuracy auf den häufigen Kategorien.

## Unterstützte Banken

| Bank | Status | Format |
|---|---|---|
| DKB | unterstützt | 12 Spalten, Semikolon, Felder in Anführungszeichen, Dezimalkomma, UTF-8 mit BOM, Kopfzeile ab Zeile 5 |
| ING | unterstützt | Semikolon, Dezimalkomma, Betrag mit „EUR"-Suffix, Metadaten vor der Kopfzeile |
| comdirect | unterstützt | Semikolon, Empfänger und Verwendungszweck gemeinsam in „Buchungstext", wird heuristisch getrennt |
| N26 | unterstützt | Komma, englische Spaltennamen, Fremdwährung mit Originalbetrag |
| Sparkasse und andere | generisch | Spalten werden beim Upload manuell zugeordnet |

Testdateien liegen unter `packages/csv/fixtures/` und sind synthetisch. Der DKB-Parser akzeptiert die Datumsformate TT.MM.JJJJ und TT.MM.JJ; welches der echte Export nutzt, ist noch zu verifizieren.

## Persönliche Inflation

Persönliche Rate = Σ (eigener Ausgabenanteil je Kategorie × Veränderung des zugehörigen Teilindex). Die eigenen Kategorien werden auf die COICOP-Abteilungen des Verbraucherpreisindex abgebildet. Beispiel: Anteile Lebensmittel 30 %, Wohnen 40 %, Mobilität 15 %, Freizeit 15 % bei Teilindex-Veränderungen +5 %, +2 %, +6 %, +3 % ergeben 3,65 %.

Datenquelle: Statistisches Bundesamt (Destatis), GENESIS-Online, Tabellen 61111-0001 und 61111-0002, Datenlizenz Deutschland – Namensnennung – Version 2.0. Die Teilindizes werden monatlich per GitHub Actions abgerufen und als `data/k2/cpi.json` im Repository abgelegt; zur Laufzeit gibt es keinen Destatis-Aufruf.

## Tech-Stack

Next.js 15 (App Router), TypeScript (strict), Tailwind CSS, Papa Parse, Recharts, OpenAI Node SDK (`text-embedding-3-small`, GPT-5 nano), Upstash Redis und `@upstash/ratelimit`, Cloudflare Turnstile, Vitest, Playwright, pnpm Workspaces, GitHub Actions, Vercel.

## Lokale Ausführung

Voraussetzungen: Node.js 20 oder neuer, pnpm 9 oder neuer.

```bash
git clone https://github.com/mirkan-morgenfels-ai/AI-Project-2.git
cd AI-Project-2
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter web dev
```

Umgebungsvariablen in `apps/web/.env.local`:

```
OPENAI_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

Ohne diese Variablen läuft die Anwendung mit der Regel-Engine allein; der API-Schritt ist dann deaktiviert. Für Cloudflare Turnstile gibt es dokumentierte Testschlüssel, die lokal jede Prüfung bestehen lassen.

Das CPI-JSON wird im Repository mitgeliefert. Aktuell enthält `data/k2/cpi.json` Beispielwerte (`"sample": true`), die Oberfläche weist darauf hin. Zum Aufbau mit echten Destatis-Daten ist ein GENESIS-Token als GitHub-Actions-Secret `DESTATIS_TOKEN` nötig; lokal:

```bash
DESTATIS_TOKEN=... pnpm --filter web cpi:build
```

## Tests

```bash
pnpm -r test
pnpm --filter web accuracy
pnpm --filter web test:e2e
```

Das gelabelte Beispielset für die Embedding-Stufe liegt in `data/k2/labeled-examples.json`; die Vektoren entstehen einmalig mit `pnpm --filter web embeddings:build` (OpenAI-Key nötig, etwa 300 Texte, unter 0,01 $).

Unit-Tests decken die Bank-Parser, die Regel-Engine, die Normalisierung der Händlernamen, Kosinus-Ähnlichkeit und kNN-Abstimmung, die Erkennung wiederkehrender Zahlungen und die persönliche Inflation ab. Die API-Route wird mit gemocktem OpenAI-Client und Redis-Mock getestet. Die CI berechnet zusätzlich die Accuracy auf dem Testset und führt bei jedem Pull Request `install → typecheck → lint → test → build` aus.

## Projektstruktur

```
apps/web/app/projects/kontoklar/      Seite, Upload, Review-Tabelle, Dashboard
apps/web/app/api/categorize/          API-Route: Turnstile, Rate-Limit, Cache, Embeddings, Fallback
apps/web/lib/kontoklar/               Regel-Engine, kNN, Pseudonymisierung, Abo-Erkennung, Inflation
apps/web/lib/kontoklar/__tests__/     Unit-Tests (inkl. API-Route mit Mocks)
apps/web/scripts/                     accuracy, build-embeddings, build-cpi
data/k2/cpi.json                      Destatis-Teilindizes (derzeit Beispielwerte)
data/k2/labeled-examples.json         gelabeltes Beispielset (Texte)
data/k2/labeled-embeddings.json       Beispielset mit Vektoren (wird erzeugt)
data/k2/rules.json                    Regelsatz der Regel-Engine
data/k2/testset.json                  gelabeltes Testset für die Accuracy-Messung
docs/genauigkeit.md                   Messergebnisse
packages/csv/                         Bank-Parser, Erkennung, Fixtures
packages/ratelimit/                   Rate-Limit und Turnstile-Verifikation
.github/workflows/ci.yml              install, typecheck, lint, test, accuracy, build
.github/workflows/cpi.yml             monatlicher Destatis-Abruf
```

## Grenzen

- Kein Kontozugriff und kein automatischer Abgleich; der Nutzer exportiert die CSV selbst.
- Die Kategorisierung ist nur so gut wie Regelsatz und Beispielset; ungewöhnliche Händler landen in der Prüfliste.
- Die persönliche Inflation ist eine Näherung auf Ebene der COICOP-Abteilungen, nicht auf Produktebene.
- Bankformate ändern sich; bei unbekannter Kopfzeile greift das manuelle Spalten-Mapping.
- Der API-Schritt überträgt pseudonymisierte Händlertexte an einen externen Anbieter.

## Roadmap

- v1: Vier Banken, dreistufige Kategorisierung, Dashboard, Abo-Erkennung, persönliche Inflation. Stand 03.09.2026: Code und Tests vorhanden; offen sind API-Keys, Embedding-Vektoren, echte Destatis-Daten, Turnstile-Keys, Deployment.
- v2: Budget-Prognose je Kategorie für den Folgemonat (saisonale Zeitreihenmethode) mit Unsicherheitsband.
- v3: Anomalie-Erkennung auf dem Zahlungsgraph (Händler, Kategorien, Geldflüsse) mit einem Graph Neural Network: neue ungewöhnliche Empfänger, Betragsausreißer.

## Disclaimer

KontoKlar ist ein Werkzeug zur Auswertung eigener Daten und stellt keine Finanz- oder Steuerberatung dar. Alle Angaben ohne Gewähr.

## Quellen

- comdirect-Community: Einstellung des Finanzmanagers zum 13.02.2023
- Statistisches Bundesamt, GENESIS-Online, Verbraucherpreisindex (61111-0001, 61111-0002), Datenlizenz Deutschland – Namensnennung – Version 2.0
- OpenAI: Preise für `text-embedding-3-small` und GPT-5 nano
- Upstash: Free-Tier-Limits für Redis
- Cloudflare Turnstile: Dokumentation und Testschlüssel

## Lizenz

MIT, siehe [LICENSE](./LICENSE). Die Destatis-Daten in `data/k2/cpi.json` stehen unter der Datenlizenz Deutschland – Namensnennung – Version 2.0; Quelle: Statistisches Bundesamt (Destatis), [Platzhalter: Jahr].
