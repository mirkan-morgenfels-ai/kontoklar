# Projekt: KontoKlar (K2)

Arbeitsanweisungen für Claude Code (KI-gestützte Entwicklung).
Autor: Mirkan Deniz Günkaya.

## Zweck und Stand

KontoKlar kategorisiert Bankumsätze aus CSV-Exporten (DKB, ING, comdirect, N26, VR-Bank im neuen und alten Format, Sparkasse, andere Banken über eine Spaltenzuordnung) und zeigt ein Haushaltsdashboard mit Ausgaben je Monat und Kategorie, wiederkehrenden Zahlungen und einer persönlichen Inflationsrate. Die Auswertung läuft im Browser; ein optionaler API-Schritt (Embedding-kNN, Sprachmodell-Fallback) klärt unbekannte Händlernamen. Zweites Portfolio-Projekt neben K1 DepotDoktor und K3 NetzRadar. Die drei Projekte liegen in getrennten öffentlichen Repos (mirkan-morgenfels-ai/depotdoktor, kontoklar, netzradar) mit je einem eigenen Vercel-Projekt. Die Startseite verlinkt alle drei Projekte und ihre Repos.

Stand 07.10.2026: live auf https://kontoklar-eight.vercel.app/projects/kontoklar, derzeit nur mit der Regel-Engine. Der API-Schritt ist implementiert, mit Mocks getestet und fail-closed abgesichert, auf Vercel aber nicht eingerichtet. Nachkontrolle (`fix/nachkontrolle`): gemeinsamer Seitenrahmen und Projektblock mit K1 und K3, Nutzungsbedingungen, Metadaten mit Vorschaubild, Sitemap, synthetische Beispieldaten, Händlermuster mit Ziffern, engere Auswahl der API-Texte, Abo-Erkennung auch vierteljährlich und halbjährlich, Abhängigkeiten aktualisiert.

## Quellen

- Interne Planungsunterlagen sind nicht Teil des Repos. Maßgeblich sind dieses Dokument, `README.md` und `docs/genauigkeit.md`. Rechnerspezifisches steht in der nicht versionierten `CLAUDE.local.md`.
- Widerspricht eine Anfrage einem Dokument oder ein Dokument dem Code: hinweisen und vorschlagen, welches Dokument angepasst wird, statt still abzuweichen.
- Genauigkeitsangaben stammen nur aus `pnpm --filter web accuracy` (`docs/genauigkeit.json`), Inflationswerte nur aus `data/k2/cpi.json` (derzeit Beispielwerte, `"sample": true`).

## Stack

- Root: pnpm 10.34.5 (`packageManager`), Node `^20.19.0 || >=22.12.0` (`engines`, Untergrenze von Vite für Vitest 4); CI Node 22.
- Web, aufgelöst laut `pnpm-lock.yaml`: Next.js 15.5.27 (App Router), React 19.3.0, TypeScript 5.9.3 (strict), Tailwind CSS 4.3.3, Papa Parse 5.7.0, Recharts 3.10.1, OpenAI Node SDK 6.49.0, @upstash/redis 1.38.3, @upstash/ratelimit 2.0.8, Cloudflare Turnstile, Vitest 4.1.11, Playwright 1.63.0, axe-core 4.14.0 (nur E2E), ESLint 9.39.5, tsx 4.23.13. Vorschaubild und Apple-Icon entstehen beim Build mit `next/og`.
- `pnpm.overrides`: `postcss` ≥ 8.5.23, `sharp` ≥ 0.35.5, `source-map-js` ≥ 1.2.2, `brace-expansion` je Hauptversion gepatcht (1.1.21, 5.0.12). `pnpm.onlyBuiltDependencies`: esbuild, unrs-resolver.
- CI: `.github/workflows/ci.yml` auf `ubuntu-24.04` (fest, weil `ubuntu-latest` ab 19.10.2026 wechselt), `permissions: contents: read`, `concurrency` je Ref mit Abbruch älterer Läufe, `timeout-minutes: 15`; ruft die Root-Skripte auf. `.github/workflows/cpi.yml` monatlich, ebenfalls `ubuntu-24.04`. `.github/dependabot.yml`: monatlich gruppierte Updates für npm und GitHub Actions.
- Hosting: Vercel Hobby.

## Struktur

```
.github/workflows/ci.yml              install, typecheck, lint, test, accuracy, build, E2E
.github/workflows/cpi.yml             monatlicher Destatis-Abruf (ohne Secret: Hinweis, kein Fehler)
.github/dependabot.yml                npm und github-actions, monatlich, gruppiert
apps/web/                             Next.js-App (Paket web)
  app/                                Startseite, layout (Skip-Link, Kopf, main#main, Fußzeile), error, not-found,
                                      robots, sitemap, opengraph-image, apple-icon, icon.svg, impressum, datenschutz,
                                      nutzungsbedingungen
  app/projects/kontoklar/             Projektseite (Statuszeile mit Kennzahlen aus docs/genauigkeit.json), Upload,
                                      Review-Tabelle, Dashboard
  app/api/categorize/route.ts         API-Route (Konfiguration -> Beispielset -> Body-Limit -> JSON -> Turnstile ->
                                      Rate-Limit mit IP-HMAC -> Cache -> Embedding+kNN -> Fallback -> Cache)
  components/LegalPage.tsx            Rahmen der Rechtsseiten
  components/NavLinks.tsx             Hauptnavigation (Client, usePathname, aria-current auf dem aktiven Link)
  lib/site.ts                         Projekte K1 bis K3 (kicker, repo), Navigation, Rechtslinks, REPO_URL,
                                      DEFAULT_SITE_URL, siteUrl(); die Live-Adressen stehen nur hier
  lib/metadata.ts                     pageMetadata (Titel, Canonical, Open Graph, Twitter), Texte der Link-Vorschau
  lib/operator.ts                     Betreiberangaben wie in K1/K3 (Name, Ort, E-Mail, Stand der Rechtstexte)
  lib/kontoklar/                      Kategorien und COICOP-Zuordnung, Händler-Normalisierung und isApiEligible
                                      (merchant.ts), Regel-Engine (rules.ts), kNN, Server-Pipeline, config.ts
                                      (fail-closed-Bedingungen), body.ts (Body-Limit auf gelesene Bytes), privacy.ts
                                      (Kennzahlen der Datenschutzerklärung), Abo-Erkennung (recurring.ts), Inflation
                                      (inflation.ts), Diagrammfarben (chartTheme.ts), Auswertung des Testsets
                                      (accuracy.ts), Beispieldaten (sample.ts)
  lib/__tests__/, lib/kontoklar/__tests__/
                                      Vitest, inklusive API-Route mit Mocks
  e2e/                                Playwright: kontoklar.spec.ts (Upload, Beispieldaten, Dashboard), site.spec.ts
                                      (Seitenrahmen, Rechtsseiten, Metadaten, Anfragen, axe)
  scripts/                            accuracy, build-embeddings, build-cpi
packages/csv/                         Bank-Parser (DKB, ING, comdirect, N26, VR-Bank neu und alt, Sparkasse, generisch),
                                      Erkennung, Dateityp-Prüfung (PDF/ZIP werden abgewiesen), eindeutige Kopfzeilen,
                                      Fixtures inklusive demo-synthetic.csv
packages/ratelimit/                   Upstash-Rate-Limit (30 je Tagesfenster, Sliding Window, Timeout 5 s wird zu
                                      RateLimitUnavailableError), rateLimitSubject (IPv6 auf /64), pseudonymizeIp
                                      (HMAC-SHA256), clientIpFromHeaders, Turnstile-Verifikation, isTurnstileTestKey
data/k2/                              rules.json (Regelsatz), testset.json (gelabeltes Testset), labeled-examples.json
                                      (Beispielset), cpi.json (Teilindizes, derzeit Beispielwerte)
docs/genauigkeit.md, .json            Messergebnisse und Fehlerliste
docs/screenshots/                     README-Screenshots (Playwright gegen next start, synthetische Beispieldaten)
```

## Feste Regeln

1. An die API geht höchstens der normalisierte Händlerteil (`merchantKeyFor`), und nur für Buchungen, die `isApiEligible` zulässt: Ausgaben mit lesbarem Empfängernamen (`normalizeMerchant(counterparty)` nicht leer), die eine Kartenzahlung oder Lastschrift sind oder an einen Empfänger mit Firmenkennzeichen gehen. Firmenkennzeichen (`COMPANY_MARKERS`) werden nur im Empfängernamen geprüft, nie im übrigen Verwendungszweck; bei PayPal-Einkäufen gilt der Händler aus „Ihr Einkauf bei …“ als Empfänger und braucht immer ein Firmenkennzeichen, auch bei Lastschrift (Privatverkäufer bleiben im Browser). Nie gesendet werden Gutschriften, Empfänger ohne Firmenkennzeichen bei Überweisungen, PayPal-Verkäufer ohne Firmenkennzeichen, Verwendungszwecke (bei PayPal nur der Händler aus „Ihr Einkauf bei …“), IBANs, Beträge, Daten und ganze Zeilen. Der Verwendungszweck-Fallback in `merchantKeyFor` dient nur den lokalen Regeln und dem lokalen Schlüssel.
2. Reihenfolge: Regel -> Cache -> Embedding -> Sprachmodell. Kein Sprachmodell pro Buchung; ein Batch-Aufruf je Upload, höchstens 500 Texte.
3. Der API-Schritt ist in der Oberfläche standardmäßig aus (Einwilligung durch Anhaken, Art. 6 Abs. 1 lit. a DSGVO).
4. Keine Umsätze auf dem Server, auch nicht in Logs. Logs enthalten keine Buchungstexte und keine IP-Adressen.
5. Änderungen an dem, was übertragen oder gespeichert wird, ziehen Änderungen an `apps/web/app/datenschutz/page.tsx`, an der Hinweisbox in `KontoKlarApp.tsx` und am README-Abschnitt „Was den Browser verlässt“ nach sich.
6. Tests der API-Route mit gemocktem OpenAI-Client, Redis-Mock und gemocktem Turnstile-fetch; CI ruft keine echten APIs. `route.test.ts` muss vollständig grün sein.
7. Deutsch in der Oberfläche (Anrede „Sie“), Englisch in Code-Bezeichnern. Keine Kommentarzeilen im Code, auch nicht in YAML, CSS oder Configs. Seitentexte ohne interne Schrittnummern und ohne Verweise auf nicht öffentliche Unterlagen.
8. Genauigkeitsangaben nur aus `pnpm --filter web accuracy`, nie geschätzt. Jede Kennzahl mit handgerechnetem Test. README, `docs/genauigkeit.md` und die Statuszeile der Projektseite nennen dieselben Werte wie `docs/genauigkeit.json` (`accuracy.test.ts` prüft das).

## API-Stufe: fail-closed

- Aktiv nur, wenn alle sechs Variablen gesetzt sind: `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `IP_HASH_SECRET` (mindestens 32 Zeichen, nur serverseitig). Leere oder nur aus Leerzeichen bestehende Werte zählen als fehlend, in der Produktionsumgebung (`VERCEL_ENV=production`, ohne Vercel `NODE_ENV=production`) auch die dokumentierten Cloudflare-Testschlüssel (eigene Begründung im Status).
- Fehlt etwas: `GET /api/categorize` liefert `enabled: false`, eine deutsche Begründung und `missing` (nur Namen, nie Werte); `POST` antwortet 503 `disabled`, bevor der Body gelesen oder OpenAI, Turnstile oder Upstash angesprochen werden.
- Weitere 503: Beispielset `data/k2/labeled-embeddings.json` fehlt, keine gültige Client-IP in den Headern, Rate-Limit nicht erreichbar (Fehler oder keine Antwort binnen 5 s; `@upstash/ratelimit` meldet sonst `success: true` mit `reason: "timeout"`). 413 bei mehr als 200.000 Byte (Header oder tatsächlich gelesene Bytes). 403 bei fehlgeschlagener Bot-Prüfung, 429 bei erreichtem Tageslimit. Die Meldungen der Route enden ohne „Die Regel-Engine bleibt aktiv.“; diesen Satz ergänzt die Oberfläche (`apiErrorText`).
- An Upstash geht als Rate-Limit-Schlüssel nur `HMAC-SHA256(rateLimitSubject(IP), IP_HASH_SECRET)` (IPv4 unverändert, IPv6 als /64-Präfix); Upstash löscht jeden Zähler 172.801.000 ms (48 h + 1 s) nach dem ersten Aufruf im Tagesfenster (UTC-Kalendertag). Beides stammt aus dem Lua-Skript von `@upstash/ratelimit`; `ratelimit.test.ts` prüft das installierte Skript.
- Konfidenzschwellen: Regel 1,0. kNN ≥ 0,80 übernehmen. 0,50 bis 0,80 übernehmen und markieren. < 0,50 Fallback (Sprachmodell), Ergebnis mit 0,50 gecacht. Ohne Regeltreffer bleibt eine Buchung offen (Ausgabe „Sonstiges“, Eingang „Einkommen“, zur Prüfung markiert); die Oberfläche zeigt dann „–“ statt einer Konfidenz.

## Arbeitsweise

- Bei neuen Aufgaben zuerst ein kurzer Plan mit Dateien, Funktionen, Tests und Abnahmekriterium. Kleine Änderungen direkt umsetzen.
- Code-Reviews in dieser Reihenfolge: was den Browser verlässt (Regel 1), fail-closed der API-Route, Korrektheit der Kennzahlen, Zugänglichkeit, Struktur und Stil.
- Offene Entscheidungen mit Optionen und Empfehlung vorlegen; der Autor entscheidet.

## Befehle

Im Repo-Root:

- `pnpm install` (CI: `pnpm install --frozen-lockfile`)
- `pnpm dev` (Vorschau unter http://localhost:3000/projects/kontoklar)
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm accuracy`, `pnpm build`; `pnpm ci` führt alle fünf nacheinander aus
- `pnpm test:e2e`: ohne `CI` gegen `next dev`, mit `CI=true` gegen `next start` (vorher `pnpm build`). Der Port kommt aus `PORT` (Standard 3000). Einmalig `pnpm --filter web exec playwright install chromium`; alternativ zeigt `PLAYWRIGHT_CHROMIUM_PATH` auf ein installiertes Chromium.
- `pnpm --filter web accuracy` misst die Regel-Engine auf `data/k2/testset.json`, gibt Kennzahlen, Überschneidung von Test- und Beispielset und Fehlfälle aus und endet mit Exit 1 unter `KONTOKLAR_MIN_RULE_ACCURACY`. Es schreibt nichts; `pnpm --filter web accuracy --write` aktualisiert `docs/genauigkeit.json`. `--api` misst zusätzlich Embeddings und Fallback (braucht `OPENAI_API_KEY`) und bricht ab, solange sich Test- und Beispielset überschneiden.
- `pnpm --filter web embeddings:build` (data/k2/labeled-examples.json -> data/k2/labeled-embeddings.json, braucht `OPENAI_API_KEY`)
- `DESTATIS_TOKEN=... pnpm --filter web cpi:build`

## Git und Deployment

- Remote: https://github.com/mirkan-morgenfels-ai/kontoklar (öffentlich), Standardzweig `main`. Vercel-Projekt `kontoklar` (Team AI-Team, Root `apps/web`) deployt jeden Push auf `main`; Produktions-URL https://kontoklar-eight.vercel.app.
- Commit-Autor „Mirkan Deniz Günkaya“ mit der GitHub-noreply-Adresse `324466065+mirkan-morgenfels-ai@users.noreply.github.com` (repo-lokal gesetzt). Ohne die noreply-Adresse blockiert Vercel das Deployment („commit email could not be matched“).
- Commit-Stil: Conventional Commits auf Deutsch mit echten Umlauten, z. B. `feat(k2): …`, `fix(k2): …`, `test(e2e): …`, `docs: …`, `ci: …`. Keine Verweise auf private Repos oder lokale Pfade.
- Branches `feat/<thema>` und `fix/<thema>`; `main` ist immer deploybar. Commit und Push nur auf ausdrücklichen Wunsch.
- `.gitattributes` erzwingt LF. `next-env.d.ts` und `CLAUDE.local.md` sind gitignored; typecheck läuft ohne `next-env.d.ts`.
- `NEXT_PUBLIC_SITE_URL` ist optional (leer bedeutet `https://kontoklar-eight.vercel.app`) und bestimmt Canonical, Link-Vorschau, Sitemap und `robots.txt`.

## Betrieb lokal

- `next build` und `next dev` nie gleichzeitig im selben Verzeichnis laufen lassen; der Build überschreibt `.next` und der Dev-Server antwortet danach mit 500.
- ESLint löst die Plugins relativ zu `eslint-config-next` auf (`resolvePluginsRelativeTo` in `apps/web/eslint.config.mjs`), als Absicherung gegen Fehler bei der Plugin-Auflösung.
- `cpi.yml` endet ohne Secret `DESTATIS_TOKEN` mit `::notice::` und Exit 0; mit Secret holt er die Daten und committet `cpi.json`.
- Nach einem lokalen E2E-Lauf den Port wieder freigeben.

## Sicherheit und Zugänglichkeit

- Sicherheits-Header in `apps/web/next.config.ts` (`CONTENT_SECURITY_POLICY`, `SECURITY_HEADERS`): CSP mit `default-src 'self'`, `'unsafe-eval'` nur im Dev-Modus; HSTS `max-age=63072000; includeSubDomains; preload`, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy (`camera`, `microphone`, `geolocation`, `payment`, `usb`, `browsing-topics` aus) und COOP `same-origin`, wie in K1 und K3. Neue externe Quellen müssen in die CSP und in die Datenschutzerklärung.
- `'unsafe-inline'` in `script-src` und `style-src`: Next.js rendert die Seiten statisch vor und setzt Inline-Skripte für die Hydration; Nonces gingen nur mit Middleware und dynamischem Rendern. Die Seite fügt keine Nutzereingaben als HTML in das DOM ein (CSV-Inhalte landen nur als React-Text).
- Turnstile-Ausnahme (`challenges.cloudflare.com` in `script-src`, `frame-src`, `connect-src`): Die CSP ist statisch und deshalb immer aktiv. Eine CSP je Anfrage wäre nur mit Middleware möglich. Geladen wird Turnstile nur bei eingeschaltetem API-Schritt; die E2E prüft, dass ohne API-Schritt keine Anfrage an fremde Origins geht. COOP `same-origin` betrifft das Turnstile-iframe nicht.
- Externe Links (Schwesterprojekte, GitHub) mit `rel="noopener noreferrer"`, ohne `target`, mit sichtbarem oder sr-only „(externe Seite)“.
- E2E-Wächter: nur GET-Anfragen an den eigenen Origin, keine Konsolenfehler, keine `pageerror`, keine CSP-Verstöße; der ING-Upload erzeugt keine Konsolenwarnung.
- Skip-Link auf `#main`, `lang="de"`, `prefers-reduced-motion` wird respektiert, aktiver Navigationslink mit `aria-current="page"`. Gold nur für Flächen und Rahmen; Fokusring in gold-deep (#7d5f17), global in `globals.css` und in den Komponenten als `outline-gold-deep`. Goldtext nur als `text-gold-deep`.
- axe-core (WCAG 2.x A und AA, Best Practices) läuft bei 390, 768 und 1280 px auf Start-, Projekt- (vor und nach Upload, mit Beispieldaten), Rechts- und 404-Seite und erwartet 0 Verstöße; zusätzlich ein Lauf nur mit `label-content-name-mismatch`. Die Upload-Zone hat deshalb kein eigenes `aria-label`; jedes Kategorie-Select heißt „Kategorie für <Empfänger>, <Datum>, <Betrag>“. Kleine Textlinks in Navigation und Fußzeile brauchen mindestens 8 px Zeilenabstand (`gap-y-2` bzw. `gap-y-3`), sonst meldet axe `target-size`.
- Breite Tabellen (Review-Tabelle, Teilindizes, Zuordnung Kategorie → COICOP) liegen in `ScrollRegion` (`components/ScrollRegion.tsx`): Scroll-Container mit `role="region"`, `tabIndex={0}`, Namen (etwa „Buchungen zur Prüfung“) und `relative` (sonst ragen `sr-only`-Texte aus dem Container und verbreitern die Seite), Verlaufsschatten und unter `sm` der Hinweis „Tabelle seitlich wischen“, beides nur bei Überlauf.
- Diagramm: eigene Legende mit Text in ink, Farbe nur im Kästchen; Tooltip-Text in ink mit Trenner „: “, Cursor gold-soft; `accessibilityLayer={false}` (kein namenloser Tab-Stopp). Gestapelte Segmente mit 1-px-Trennlinie in surface (`CHART_THEME.segmentSeparator`), weil benachbarte Farben wie gold-deep und stone nur 1,11:1 haben; gold gegen die Trennlinie hat 2,95:1, jede andere Ausgabenfarbe mindestens 5,35:1 (`chartTheme.test.ts`).
- Reflow: bei 320 px kein waagrechter Überlauf (E2E), auf der Projektseite auch mit Beispieldaten und nach dem DKB-Upload bei 320 und 390 px; Rasterkinder und Karten mit `min-w-0`, auf schmalen Bildschirmen stehen Prozentwert und Rhythmus unter Betrag bzw. Händler; Überschriften der Rechtsseiten mit `hyphens-auto break-words` und `text-2xl sm:text-3xl`.

## Design

- Kein Blau, nirgends, auch nicht in Diagrammen, Vorschaubild oder Apple-Icon.
- Palette (Tokens in `apps/web/app/globals.css`, Diagrammfarben in `apps/web/lib/kontoklar/chartTheme.ts`): ink #111111, paper #fbfaf6, surface #ffffff, gold #b8912f, gold-deep #7d5f17 (Gold für Text), gold-soft #f3e9c9, moss #2f6b3a, moss-soft #dfeadf, wine #7a1f2b, wine-soft #f1dcdf, stone #6b6b66, line #e3e0d6. Dieselben Werte wie K3; K1 nutzt dieselben Hex-Werte mit anderen Token-Namen.
- Überschriften in Georgia (`font-serif`) ohne fetten Schnitt: h1 auf Start- und Projektseite `text-4xl`, Rechtsseiten `text-2xl sm:text-3xl`, Kartentitel `text-xl`.
- Diagramm: höchstens fünf Ausgabenkategorien einzeln plus „Übrige“ (line mit stone-Rand, nur wenn größer 0). Farben in fester Reihenfolge wine, gold, ink, gold-deep, stone nach der Reihenfolge von `EXPENSE_CATEGORIES`, nicht nach Rang, Segmente durch eine Linie in surface getrennt; moss nur für Einnahmen (Füllung moss-soft, Rand moss).
- Zahlen mit deutschem Dezimalkomma und `tabular-nums`.

## Test-Stand

Stand 07.10.2026:

- Vitest: 291 Tests (csv 45, ratelimit 24, web 222).
- Playwright: 31 Tests, davon 3 axe-Läufe über alle Seiten und ein Lauf `label-content-name-mismatch`; mit `CI=true` gegen `next start`.
- `pnpm --filter web accuracy`: Regel-Engine 96,5 % Abdeckung, 99,0 % richtig auf zugeordneten Buchungen, 95,5 % gesamt (198 Buchungen).
- `pnpm audit --prod`: keine Meldung; `pnpm audit` meldet nur braces ≤ 3.0.3 über `eslint-config-next` (nur Linting, ohne Patch).

## Definition of Done

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm accuracy`, `pnpm build` und `pnpm test:e2e` grün, E2E-Wächter ohne fremde Anfragen, axe ohne Verstöße
- jede neue Kennzahl mit Handtest, Accuracy gemessen und in `docs/genauigkeit.md` dokumentiert
- Netzwerk-Tab zeigt nur pseudonymisierte Händlertexte
- Feature in der Vorschau sichtbar, CI grün

## Offene Entscheidungen

1. **Nutzungsbedingungen**: Wortlaut von `/nutzungsbedingungen` (8 Abschnitte, nach K1) vor dem Merge freigeben.
2. **Kicker „Projekt K1/K2/K3“** auf Start- und Projektseite (`PROJECTS.kicker`) durch sprechende Bezeichnungen ersetzen; danach eine reine Datenänderung in allen drei Repos.
3. **Impressum**: ob nach § 5 DDG eine ladungsfähige Anschrift nötig ist; derzeit wie K1/K3 nur Name, Ort und E-Mail.
4. **COICOP-Zuordnung**: Online-Handel, Sonstiges, Gebühren & Zinsen und Versicherungen laufen über Abteilung 12, Reisen über 11. Die Zuordnung steht in `CATEGORY_TO_COICOP` und als Tabelle in Oberfläche und README.
5. **Test- und Beispielset entflechten**: 113 der 198 Händlerschlüssel des Testsets stehen wörtlich oder als Präfix im Beispielset. Mit `--api` eingebettet würden derzeit nur 4 Texte (ohne Regeltreffer und von `isApiEligible` zugelassen), davon steht 1 im Beispielset (DEUTSCHES ROTES KREUZ); `pnpm --filter web accuracy` gibt beide Zahlen aus. Optionen: (a) Sperre streng lassen (derzeit so) und die Sets entflechten, (b) Sperre nur auf die eingebetteten Texte beziehen, dann reicht es, diesen einen Eintrag zu entfernen; mit 4 Texten sagt die Messung aber wenig über die Embedding-Stufe. Empfehlung: (a), mit einem eigenen, disjunkten Testset für die API-Stufe.
6. **CLAUDE.md öffentlich lassen** (bereinigt, Standard) oder aus dem Repo nehmen und nur eine kurze Architekturbeschreibung veröffentlichen.

Weitere offene Punkte:

- Betreiber: OpenAI-Key mit hartem Monatslimit, Upstash Redis, Turnstile Site- und Secret-Key und `IP_HASH_SECRET` als Vercel-Umgebungsvariablen setzen; danach `pnpm --filter web embeddings:build`, `labeled-embeddings.json` committen, `pnpm --filter web accuracy --api` messen und in `docs/genauigkeit.md` dokumentieren. Region und Auftragsverarbeitung bei Upstash und OpenAI vorher prüfen und in der Datenschutzerklärung nennen.
- Betreiber: `DESTATIS_TOKEN` als GitHub-Secret anlegen und `cpi.yml` von Hand starten. Beim Einrichten des `DESTATIS_TOKEN` prüfen, welche GENESIS-Tabelle Monatswerte je COICOP-Abteilung liefert (vermutlich 61111-0004); Basis-URL genesis.destatis.de. Der Bot-Commit nutzt die Adresse von github-actions[bot]; ob Vercel ihn deployt, ist ungeprüft.
- Echtes DKB-Datumsformat (TT.MM.JJJJ oder TT.MM.JJ) mit einem echten Export klären; anonymisiertes echtes CSV als zweites Testset.
- Abhängigkeiten beobachten: braces ≤ 3.0.3 (GHSA-vfj7-8cjw-p6xm) nur über `eslint-config-next` › `@next/eslint-plugin-next` › `fast-glob` › `micromatch`; mit dem nächsten Update von `eslint-config-next` erneut prüfen.
- `OPERATOR.lastUpdated` steht in K1, K2 und K3 auf 07.10.2026 (gemeinsames Datum der Rechtstexte).
