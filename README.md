# KontoKlar

Kategorisiert Bankumsätze aus CSV-Exporten und zeigt, wohin das Geld geht. Regel-Engine zuerst, Embeddings zweitens, Sprachmodell nur als Fallback. Keine Kontoanbindung, keine Speicherung von Umsätzen.

[![CI](https://github.com/mirkan-morgenfels-ai/kontoklar/actions/workflows/ci.yml/badge.svg)](https://github.com/mirkan-morgenfels-ai/kontoklar/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

Live-Demo: https://kontoklar-eight.vercel.app/projects/kontoklar

**English summary.** KontoKlar categorizes German bank account CSV exports (DKB, ING, comdirect, N26, VR-Bank in the new and old format, Sparkasse, plus a generic column mapping for other banks) and builds a household dashboard: monthly spending by category, recurring payments, and a personal inflation rate that weights official Destatis price indices with the user's own spending shares. Categorization is a three-stage hybrid: a client-side rule engine, then OpenAI embeddings with k-nearest-neighbour voting against a labelled example set, then a small LLM only for low-confidence cases. Results are cached per merchant, requests are rate-limited (keyed by an HMAC of the client IP or, for IPv6, of its /64 prefix, never the raw IP) and bot-protected, so variable API cost stays near zero. The API route is fail-closed: unless the OpenAI key, Upstash Redis, Cloudflare Turnstile and the IP hashing secret are all configured, it answers 503 and never calls OpenAI. No transactions are stored server-side; only a pseudonymized merchant string ever leaves the browser.

## Problem

Seit comdirect seinen Finanzmanager 2023 eingestellt hat, fehlt vielen Kunden deutscher Banken eine automatische Kategorisierung ihrer Umsätze. Multibanking-Apps verlangen Zugangsdaten und speichern Umsätze in der Cloud; Tabellenkalkulationen sind Handarbeit. KontoKlar arbeitet mit dem CSV-Export, den jede Bank anbietet, und behält so viel wie möglich im Browser.

## Was KontoKlar macht

- Liest die Umsatz-CSV von DKB, ING, comdirect, N26, VR-Bank und Sparkasse ein; andere Banken über ein generisches Spalten-Mapping. PDF-Kontoauszüge werden nicht gelesen; die Oberfläche erklärt dann den Weg zum CSV-Export.
- Kategorisiert jede Buchung in drei Stufen: Regel-Engine, Embedding-Ähnlichkeit, Sprachmodell-Fallback.
- Zeigt jede automatische Zuordnung mit Konfidenz an; unsichere Fälle sind zur Prüfung markiert und lassen sich mit einem Klick korrigieren.
- Erkennt wiederkehrende Zahlungen (Abos, Miete, Versicherungen) über Rhythmus und Betrag.
- Berechnet eine persönliche Inflationsrate aus den eigenen Ausgabenanteilen und den Teilindizes des Verbraucherpreisindex (Destatis).
- Speichert keine Umsätze. Der Server kennt nur einen Cache von Händlername zu Kategorie.

## Screenshots

Aufgenommen mit Playwright gegen `next start` (Produktions-Build) mit der synthetischen Testdatei `packages/csv/fixtures/dkb.csv` (5 Buchungen, eine ungültige Zeile wird übersprungen). Der API-Schritt ist dabei nicht eingerichtet, es wurde keine Anfrage an den Server gesendet. Die Inflationswerte sind Beispielwerte, die Oberfläche weist darauf hin.

![Upload mit erkannter Bank und Status des API-Schritts](docs/screenshots/upload.png)

![Ergebnis und Prüftabelle mit Quelle und Konfidenz je Buchung](docs/screenshots/ergebnis.png)

![Dashboard mit Monats- und Kategorieauswertung](docs/screenshots/dashboard.png)

![Persönliche Inflation mit Hinweis auf Beispielwerte](docs/screenshots/inflation.png)

## So funktioniert es

```
Bank-CSV (Browser) -> Papa Parse -> Normalisierung
  -> Regel-Engine (clientseitig; Ziel laut Plan etwa 70 % der Buchungen,
     auf dem synthetischen Testset 96,0 %)
  -> Rest: Pseudonymisierung -> ein Batch-Aufruf /api/categorize (nur wenn eingeschaltet)
       -> Konfiguration vollstaendig? sonst 503
       -> Beispielset vorhanden? sonst 503
       -> Body hoechstens 200.000 Byte (Header und tatsaechlich gelesene Bytes), sonst 413
       -> gueltige Client-IP? sonst 503
       -> Turnstile pruefen -> Rate-Limit pruefen (HMAC-SHA256 der IP, bei IPv6 des /64-Praefixes, als Schluessel;
          Upstash nicht erreichbar oder keine Antwort binnen 5 s: 503)
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

Der API-Schritt ist standardmäßig aus und muss vor dem Upload angehakt werden; ohne ihn verlässt nichts den Browser.

Serverseitig gespeichert werden ausschließlich ein Cache von normalisiertem Händlernamen zu Kategorie und Konfidenz (30 Tage) sowie der Zähler des Tageslimits. Den Zählerschlüssel bildet der Server als HMAC-SHA256 der IP-Adresse mit dem geheimen Server-Schlüssel `IP_HASH_SECRET`, bei IPv6 nur aus den ersten 64 Bit (alle Adressen eines /64-Netzes teilen sich ein Limit); die rohe IP geht nicht an Upstash. Upstash löscht jeden Zähler 48 Stunden und 1 Sekunde nach dem ersten Aufruf im jeweiligen Tagesfenster (Ablaufzeit der Bibliothek `@upstash/ratelimit`: zwei Fensterlängen plus 1 Sekunde). Für die Bot-Prüfung sendet der Server das Turnstile-Token und die IP-Adresse an Cloudflare. Umsätze werden nicht gespeichert. Für die Embedding- und Fallback-Aufrufe gelten die Datenverarbeitungsvereinbarungen des API-Anbieters; die Datenschutzerklärung der Seite nennt sie. Wer keine Übertragung möchte, kann den API-Schritt abschalten; dann arbeitet nur die Regel-Engine.

## Kostenkontrolle

| Maßnahme | Wirkung |
|---|---|
| Regel-Engine clientseitig | Buchungen mit Regeltreffer kosten nichts (Planannahme etwa 70 %, auf dem synthetischen Testset 96,0 %) |
| Cache pro Händlername | jeder Händlertext kostet höchstens einmal |
| Ein Batch-Aufruf pro Upload, höchstens 500 Texte | wenige Function Invocations und Redis-Befehle |
| Embeddings statt Sprachmodell als Standard | 0,02 $ pro Mio. Token statt eines LLM-Aufrufs je Buchung |
| Sprachmodell nur unter Konfidenz 0,5 | Fallback nur für unsichere Fälle (Planannahme etwa 2 % der Buchungen, noch nicht gemessen) |
| Tageslimit 30 Aufrufe je IP-Hash, Cloudflare Turnstile | Schutz vor Skripten und Massenanfragen |
| Hartes Monatslimit an der Anbieter-Konsole | Kosten sind nach oben gedeckelt |

Die API-Route ist fail-closed. Der API-Schritt ist nur aktiv, wenn alle sechs Variablen gesetzt sind: `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` und `IP_HASH_SECRET` (mindestens 32 Zeichen). Fehlt eine davon, meldet `GET /api/categorize` `enabled: false` mit einer deutschen Begründung und der Liste der fehlenden Variablen (nie mit Werten), und `POST` antwortet mit 503, ohne OpenAI aufzurufen. Ebenfalls 503 gibt es ohne Beispielset, ohne gültige Client-IP in `x-real-ip`, `x-forwarded-for` oder `cf-connecting-ip` und wenn das Rate-Limit nicht erreichbar ist; als nicht erreichbar gilt auch eine Antwort, die nicht binnen 5 Sekunden eintrifft. In der Produktionsumgebung (`VERCEL_ENV=production`, ohne Vercel `NODE_ENV=production`) zählen die dokumentierten Cloudflare-Testschlüssel als fehlend. Bodies über 200.000 Byte werden mit 413 abgelehnt; geprüft werden der `content-length`-Header und die tatsächlich gelesenen Bytes. Mehr als 500 unbekannte Händler je Upload bleiben unangefragt zur Prüfung markiert.

Variable Kosten sind noch nicht gemessen, weil der API-Schritt nicht eingerichtet ist. Planannahme, nicht gemessen: etwa 0,02 $ bei 100 und etwa 2,10 $ bei 10.000 Nutzern im Monat (300 Buchungen je Nutzer). Nach oben deckelt das harte Monatslimit an der Anbieter-Konsole die Kosten. Bei Erreichen eines Limits bleibt die Regel-Engine aktiv.

## Genauigkeit

Gemessen mit `pnpm --filter web accuracy` auf einem von Hand gelabelten, synthetischen Testset mit 198 Buchungen (`data/k2/testset.json`), Stand 04.09.2026, nur Regel-Engine (noch ohne API-Key):

| Stufe | Anteil der Buchungen | Accuracy |
|---|---|---|
| Regel-Engine | 96,0 % | 98,9 % |
| Embedding-kNN | noch nicht gemessen | – |
| Sprachmodell-Fallback | noch nicht gemessen | – |
| offen (keine Regel) | 4,0 % | – |
| Gesamt (offene zählen als falsch) | 100 % | 94,9 % |

Das Testset wurde parallel zum Regelsatz erstellt; die hohe Regelabdeckung ist deshalb kein Beleg für echte Kontohistorien. Precision und Recall je Kategorie, Fehlerliste und offene Messungen stehen in `docs/genauigkeit.md`. Ziel für v1: mindestens 90 % Accuracy auf den häufigen Kategorien.

## Unterstützte Banken

| Bank | Status | Format |
|---|---|---|
| DKB | unterstützt | 12 Spalten, Semikolon, Felder in Anführungszeichen, Dezimalkomma, UTF-8 mit BOM, Kopfzeile ab Zeile 5 |
| ING | unterstützt | Semikolon, Dezimalkomma, Betrag mit „EUR"-Suffix, Metadaten vor der Kopfzeile |
| comdirect | unterstützt | Semikolon, Empfänger und Verwendungszweck gemeinsam in „Buchungstext", wird heuristisch getrennt |
| N26 | unterstützt | Komma, englische Spaltennamen, Fremdwährung mit Originalbetrag |
| VR-Bank, Volksbank, Raiffeisenbank | unterstützt | neues Format (19 Spalten, „Name Zahlungsbeteiligter“, Windows-1252) und altes Format mit Soll/Haben-Kennzeichen |
| Sparkasse | unterstützt | CSV-CAMT und CSV-MT940, zweistellige Jahre, Windows-1252 |
| Andere | generisch | Spalten werden beim Upload manuell zugeordnet |

Testdateien liegen unter `packages/csv/fixtures/` und sind synthetisch. Der DKB-Parser akzeptiert die Datumsformate TT.MM.JJJJ und TT.MM.JJ; welches der echte Export nutzt, ist noch zu verifizieren.

## Persönliche Inflation

Persönliche Rate = Σ (eigener Ausgabenanteil je Kategorie × Veränderung des zugehörigen Teilindex). Die eigenen Kategorien werden auf die COICOP-Abteilungen des Verbraucherpreisindex abgebildet. Beispiel: Anteile Lebensmittel 30 %, Wohnen 40 %, Mobilität 15 %, Freizeit 15 % bei Teilindex-Veränderungen +5 %, +2 %, +6 %, +3 % ergeben 3,65 %.

Datenquelle: Statistisches Bundesamt (Destatis), GENESIS-Online, Tabellen 61111-0001 und 61111-0002, Datenlizenz Deutschland – Namensnennung – Version 2.0. Die Teilindizes werden monatlich per GitHub Actions abgerufen und als `data/k2/cpi.json` im Repository abgelegt; zur Laufzeit gibt es keinen Destatis-Aufruf.

## Tech-Stack

Next.js 15 (App Router), TypeScript (strict), Tailwind CSS, Papa Parse, Recharts, OpenAI Node SDK (`text-embedding-3-small`, GPT-5 nano), Upstash Redis und `@upstash/ratelimit`, Cloudflare Turnstile, Vitest, Playwright, pnpm Workspaces, GitHub Actions, Vercel.

## Lokale Ausführung

Voraussetzungen: Node.js 20 oder neuer, pnpm 10 (die Version 10.34.5 ist über `packageManager` in `package.json` festgelegt).

```bash
git clone https://github.com/mirkan-morgenfels-ai/kontoklar.git
cd kontoklar
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
IP_HASH_SECRET=
```

`IP_HASH_SECRET` ist ein zufälliger Server-Schlüssel mit mindestens 32 Zeichen, zum Beispiel aus `openssl rand -hex 32` oder `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Er wird nur auf dem Server gelesen und darf nicht mit `NEXT_PUBLIC_` beginnen. Wird er gewechselt, beginnen alle Tageszähler neu.

Fehlt eine dieser sechs Variablen, läuft die Anwendung mit der Regel-Engine allein; der API-Schritt ist dann deaktiviert, und `GET /api/categorize` nennt die fehlenden Variablen. Für Cloudflare Turnstile gibt es dokumentierte Testschlüssel, die lokal jede Prüfung bestehen lassen; auch damit muss `TURNSTILE_SECRET_KEY` gesetzt sein, denn ohne Secret lehnt die Bot-Prüfung jede Anfrage ab. In der Produktionsumgebung (`VERCEL_ENV=production`, ohne Vercel `NODE_ENV=production`, also auch bei `next start`) gelten diese Testschlüssel als fehlend; der API-Schritt bleibt dann aus, und `GET /api/categorize` nennt den Grund.

Das CPI-JSON wird im Repository mitgeliefert. Aktuell enthält `data/k2/cpi.json` Beispielwerte (`"sample": true`), die Oberfläche weist darauf hin. Zum Aufbau mit echten Destatis-Daten ist ein GENESIS-Token als GitHub-Actions-Secret `DESTATIS_TOKEN` nötig. Ohne das Secret endet der monatliche Workflow `cpi.yml` mit einem Hinweis und ohne Fehler, `cpi.json` bleibt dann unverändert. Lokal:

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

Unit-Tests decken die Bank-Parser, die Regel-Engine, die Normalisierung der Händlernamen, Kosinus-Ähnlichkeit und kNN-Abstimmung, die Erkennung wiederkehrender Zahlungen und die persönliche Inflation ab. Die API-Route wird mit gemocktem OpenAI-Client, Redis-Mock und gemockter Turnstile-Prüfung getestet: für jede der sechs fehlenden Variablen (503 ohne OpenAI-Aufruf), für die IP-Pseudonymisierung (nur der HMAC erreicht das Rate-Limit, IPv6 je /64-Präfix), für ein Rate-Limit, das nicht antwortet (503 nach dem Timeout, kein OpenAI-Aufruf), für Cloudflare-Testschlüssel in der Produktionsumgebung und für das Body-Limit mit falschem oder fehlendem `content-length`. Ein Test liest das Lua-Skript der installierten Version von `@upstash/ratelimit` und prüft Ablaufzeit und UTC-Tagesfenster, die in der Datenschutzerklärung stehen. Stand 06.10.2026: 165 Unit-Tests (csv 36, ratelimit 24, web 105) und 5 Playwright-Tests, alle grün.

Die CI führt bei jedem Push auf `main` und bei jedem Pull Request `install → typecheck → lint → test → accuracy (Mindestwert 0,9) → build → Playwright-E2E` aus.

## Projektstruktur

```
apps/web/app/projects/kontoklar/      Seite, Upload, Review-Tabelle, Dashboard
apps/web/app/api/categorize/          API-Route: Konfigurationsprüfung, Body-Limit, Turnstile, Rate-Limit, Cache, Embeddings, Fallback
apps/web/app/impressum/, datenschutz/ Rechtsseiten (Betreiberangaben in apps/web/lib/operator.ts)
apps/web/lib/kontoklar/               Regel-Engine, kNN, Pseudonymisierung, Konfiguration (config.ts), Body-Limit (body.ts), Abo-Erkennung, Inflation
apps/web/lib/kontoklar/__tests__/     Unit-Tests (inkl. API-Route mit Mocks)
apps/web/scripts/                     accuracy, build-embeddings, build-cpi
data/k2/cpi.json                      Destatis-Teilindizes (derzeit Beispielwerte)
data/k2/labeled-examples.json         gelabeltes Beispielset (Texte)
data/k2/labeled-embeddings.json       Beispielset mit Vektoren (wird erzeugt)
data/k2/rules.json                    Regelsatz der Regel-Engine
data/k2/testset.json                  gelabeltes Testset für die Accuracy-Messung
docs/genauigkeit.md                   Messergebnisse
docs/screenshots/                     Screenshots für dieses README
packages/csv/                         Bank-Parser, Erkennung, Fixtures
packages/ratelimit/                   Rate-Limit, IP-Pseudonymisierung (HMAC), Turnstile-Verifikation
.github/workflows/ci.yml              install, typecheck, lint, test, accuracy, build, E2E
.github/workflows/cpi.yml             monatlicher Destatis-Abruf (ohne Secret: Hinweis, kein Fehler)
```

## Grenzen

- Kein Kontozugriff und kein automatischer Abgleich; der Nutzer exportiert die CSV selbst.
- Die Kategorisierung ist nur so gut wie Regelsatz und Beispielset; ungewöhnliche Händler landen in der Prüfliste.
- Die persönliche Inflation ist eine Näherung auf Ebene der COICOP-Abteilungen, nicht auf Produktebene.
- Bankformate ändern sich; bei unbekannter Kopfzeile greift das manuelle Spalten-Mapping.
- Der API-Schritt überträgt pseudonymisierte Händlertexte an einen externen Anbieter.

## Roadmap

- v1: Sechs Banken (DKB, ING, comdirect, N26, VR-Bank in neuem und altem Format, Sparkasse) plus generisches Spalten-Mapping, dreistufige Kategorisierung, Dashboard, Abo-Erkennung, persönliche Inflation. Stand 06.10.2026: live auf Vercel mit der Regel-Engine; der API-Schritt ist fail-closed abgesichert, aber noch nicht eingerichtet. Offen sind OpenAI-Key, Upstash, Turnstile-Schlüssel, `IP_HASH_SECRET`, Embedding-Vektoren, echte Destatis-Daten und die Prüfung des echten DKB-Datumsformats.
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

MIT, siehe [LICENSE](./LICENSE). Die Destatis-Daten in `data/k2/cpi.json` stehen unter der Datenlizenz Deutschland – Namensnennung – Version 2.0; Quelle: Statistisches Bundesamt (Destatis), 2026. Solange `cpi.json` Beispielwerte enthält (`"sample": true`), stammen die angezeigten Teilindizes nicht von Destatis.
