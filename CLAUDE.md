# Projekt: K2 KontoKlar (Repo AI-Project-2)

Aktueller Stand (06.10.2026): K2 KontoKlar ist implementiert (apps/web/app/projects/kontoklar) und live auf https://kontoklar-eight.vercel.app, derzeit nur mit der Regel-Engine; der API-Schritt ist fail-closed abgesichert, aber auf Vercel noch nicht eingerichtet.

K1 DepotDoktor, K2 KontoKlar und K3 NetzRadar sind drei getrennte Repos (mirkan-morgenfels-ai/AI-Project-1, AI-Project-2, AI-Project-3); K1 und K2 haben je ein eigenes Vercel-Projekt, K3 ist noch ohne Deployment. Dieses Repo enthält nur K2; die Startseite verlinkt DepotDoktor extern und nennt NetzRadar ohne Link.

## Stack
Next.js 15 App Router, TypeScript strict, Tailwind 4, Papa Parse, Recharts, OpenAI Node SDK, @upstash/redis, @upstash/ratelimit, Cloudflare Turnstile, Vitest, Playwright, pnpm Workspaces, GitHub Actions, Vercel Hobby.

## Befehle
- `pnpm install`
- `pnpm --filter web dev` (Vorschau unter http://localhost:3000/projects/kontoklar)
- `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`
- `pnpm --filter web test:e2e` (mit `CI=true` gegen `next start` nach `pnpm --filter web build`; lokal kann `PLAYWRIGHT_CHROMIUM_PATH` auf ein installiertes Chromium zeigen)
- `pnpm --filter web accuracy` (Regel-Engine auf data/k2/testset.json; überschreibt docs/genauigkeit.json; `--api` zusätzlich Embeddings und Fallback, braucht OPENAI_API_KEY)
- `pnpm --filter web embeddings:build` (data/k2/labeled-examples.json -> data/k2/labeled-embeddings.json, braucht OPENAI_API_KEY)
- `DESTATIS_TOKEN=... pnpm --filter web cpi:build`

## Git und Deployment
- Remote: https://github.com/mirkan-morgenfels-ai/AI-Project-2 (privat). Vercel-Projekt `kontoklar` (Team AI-Team, Root `apps/web`) deployt jeden Push auf `main`; Produktions-URL https://kontoklar-eight.vercel.app.
- Commits müssen mit der GitHub-noreply-Adresse des Kontos mirkan-morgenfels-ai signiert sein (repo-lokal per `git config user.email` gesetzt), sonst blockiert Vercel das Deployment („commit email could not be matched“).
- Planungsdokumente (Umsetzungsdokument-PDF, `Projektanweisungen_K2_KontoKlar.md`, `README_K2_KontoKlar.md`) liegen lokal im Projektordner, sind aber nicht eingecheckt (`.gitignore`). In älteren Commits sind sie noch enthalten.

## Struktur K2
- `packages/csv/` Bank-Parser (DKB, ING, comdirect, N26, VR-Bank neu und alt, Sparkasse, generisch), Erkennung, Dateityp-Prüfung (PDF/ZIP werden abgewiesen), Fixtures
- `packages/ratelimit/` Upstash-Rate-Limit (30 je Tagesfenster, Sliding Window, Timeout 5 s wird zu `RateLimitUnavailableError`), `rateLimitSubject` (IPv6 auf /64 gekürzt), `pseudonymizeIp` (HMAC-SHA256), `clientIpFromHeaders` (nur gültige IPs, sonst `undefined`), Turnstile-Verifikation (ohne Secret `TurnstileConfigError`, nie stilles Durchlassen), `isTurnstileTestKey` (dokumentierte Cloudflare-Testschlüssel)
- `apps/web/lib/kontoklar/` Kategorien, Händler-Normalisierung, Regel-Engine, kNN, Server-Pipeline, `config.ts` (fail-closed-Bedingungen), `body.ts` (Body-Limit auf gelesene Bytes), `privacy.ts` (Kennzahlen der Datenschutzerklärung), Abo-Erkennung, Inflation
- `apps/web/app/api/categorize/route.ts` API-Route (Konfiguration -> Beispielset -> Body-Limit -> JSON -> Turnstile -> Rate-Limit mit IP-HMAC -> Cache -> Embedding+kNN -> Fallback -> Cache)
- `apps/web/lib/operator.ts` Betreiberangaben wie in K1/K3 (Name, Ort, E-Mail, Stand); `apps/web/components/LegalPage.tsx` Rahmen für Impressum und Datenschutz
- `data/k2/rules.json` Regelsatz, `data/k2/testset.json` gelabeltes Testset, `data/k2/cpi.json` Destatis-Teilindizes (aktuell Beispielwerte, `sample: true`)
- `docs/screenshots/` README-Screenshots (Playwright gegen `next start`, Fixture dkb.csv)

## Feste Regeln (aus dem Umsetzungsdokument)
- An die API geht nur der normalisierte Händlerteil (`merchantKeyFor`). Nie Namen, IBANs, Verwendungszwecke, Beträge, Daten, ganze Zeilen. Überweisungen an Privatpersonen und Gutschriften gehen nie an die API (`isApiEligible`).
- Reihenfolge: Regel -> Cache -> Embedding -> Sprachmodell. Kein Sprachmodell pro Buchung; ein Batch-Aufruf je Upload, höchstens 500 Texte.
- Der API-Schritt ist in der Oberfläche standardmäßig aus (Einwilligung durch Anhaken, Art. 6 Abs. 1 lit. a DSGVO).
- Keine Umsätze auf dem Server, auch nicht in Logs. Logs enthalten keine Buchungstexte und keine IP-Adressen.
- Änderungen an dem, was übertragen oder gespeichert wird, ziehen Änderungen an `apps/web/app/datenschutz/page.tsx` und README-Abschnitt „Was den Browser verlässt“ nach sich.
- Tests der API-Route mit gemocktem OpenAI-Client, Redis-Mock und gemocktem Turnstile-fetch; CI ruft keine echten APIs.
- Deutsch in der Oberfläche (Anrede „Sie“), Englisch in Code-Bezeichnern. Keine Kommentarzeilen im Code, auch nicht in YAML, CSS oder Configs.
- Genauigkeitsangaben nur aus `pnpm --filter web accuracy`, nie geschätzt. Jede Kennzahl mit handgerechnetem Test.

## API-Stufe: fail-closed
- Aktiv nur, wenn alle sechs Variablen gesetzt sind: `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `IP_HASH_SECRET` (mindestens 32 Zeichen, nur serverseitig). Leere oder nur aus Leerzeichen bestehende Werte zählen als fehlend, in der Produktionsumgebung (`VERCEL_ENV=production`, ohne Vercel `NODE_ENV=production`) auch die dokumentierten Cloudflare-Testschlüssel (eigene Begründung im Status).
- Fehlt etwas: `GET /api/categorize` liefert `enabled: false`, eine deutsche Begründung und `missing` (nur Namen, nie Werte); `POST` antwortet 503 `disabled`, bevor der Body gelesen oder OpenAI, Turnstile oder Upstash angesprochen werden.
- Weitere 503: Beispielset `data/k2/labeled-embeddings.json` fehlt, keine gültige Client-IP in den Headern, Rate-Limit nicht erreichbar (Fehler oder keine Antwort binnen 5 s; `@upstash/ratelimit` meldet sonst `success: true` mit `reason: "timeout"`). 413 bei mehr als 200.000 Byte (Header oder tatsächlich gelesene Bytes). 403 bei fehlgeschlagener Bot-Prüfung, 429 bei erreichtem Tageslimit.
- An Upstash geht als Rate-Limit-Schlüssel nur `HMAC-SHA256(rateLimitSubject(IP), IP_HASH_SECRET)` (IPv4 unverändert, IPv6 als /64-Präfix); Upstash löscht jeden Zähler 172.801.000 ms (48 h + 1 s) nach dem ersten Aufruf im Tagesfenster (UTC-Kalendertag). Beides stammt aus dem Lua-Skript von `@upstash/ratelimit`; `ratelimit.test.ts` prüft das installierte Skript.

## Betrieb lokal
- `next build` und `next dev` nie gleichzeitig im selben Verzeichnis laufen lassen; der Build überschreibt `.next` und der Dev-Server antwortet danach mit 500.
- ESLint löst die Plugins relativ zu `eslint-config-next` auf (`resolvePluginsRelativeTo` in `apps/web/eslint.config.mjs`). Das ist eine Absicherung, falls die Plugin-Auflösung fehlschlägt; ein Fehler ohne die Option ließ sich am 06.10.2026 nicht reproduzieren (`pnpm exec eslint -c <Konfiguration ohne die Option> .` in `apps/web`: Exit 0, `eslint-plugin-react-hooks@5.2.0` geladen).
- `cpi.yml` endet ohne Secret `DESTATIS_TOKEN` mit `::notice::` und Exit 0; mit Secret holt er die Daten und committet `cpi.json`.

## Sicherheit und Zugänglichkeit
- Sicherheits-Header (CSP mit Turnstile-Ausnahmen, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) stehen in `apps/web/next.config.ts`; neue externe Quellen müssen dort in der CSP eingetragen werden.
- Goldton für Text ist `text-gold-deep` (#7d5f17, AA-Kontrast); `gold` (#b8912f) nur für Flächen, Rahmen, Fokusringe. Fokus-Ringe global in `globals.css`.

## Konfidenzschwellen
Regel 1,0. kNN >= 0,80 übernehmen. 0,50 bis 0,80 übernehmen und markieren. < 0,50 Fallback (Sprachmodell), Ergebnis mit 0,50 gecacht.

## Design
Kein Blau. Palette: Schwarz (#111111), Papier (#fbfaf6), Gold (#b8912f), Gold-tief (#7d5f17), Gold-hell (#f3e9c9), Moosgrün (#2f6b3a), Moos-hell (#dfeadf), Bordeaux (#7a1f2b), Bordeaux-hell (#f1dcdf), Stein (#6b6b66), Linie (#e3e0d6). Tokens in `apps/web/app/globals.css`.

## Test-Stand (06.10.2026)
165 Unit-Tests (csv 36, ratelimit 24, web 105) und 5 Playwright-Tests, alle grün; typecheck, lint und build grün.

## Offene Punkte
- Dennis: OpenAI-Key mit hartem Monatslimit, Upstash Redis, Turnstile Site- und Secret-Key und `IP_HASH_SECRET` als Vercel-Umgebungsvariablen setzen; danach `pnpm --filter web embeddings:build`, `labeled-embeddings.json` committen, `pnpm --filter web accuracy --api` messen und in `docs/genauigkeit.md` dokumentieren.
- Dennis: `DESTATIS_TOKEN` als GitHub-Secret anlegen und `cpi.yml` von Hand starten. Der Bot-Commit nutzt die Adresse von github-actions[bot]; ob Vercel ihn deployt, ist ungeprüft.
- Echtes DKB-Datumsformat (TT.MM.JJJJ oder TT.MM.JJ) mit einem echten Export klären; anonymisiertes echtes CSV als zweites Testset.
- Rechtliches: Ob das Impressum nach § 5 DDG eine ladungsfähige Anschrift braucht, entscheidet Dennis; derzeit wie K1/K3 nur Name, Ort und E-Mail. Region und Auftragsverarbeitung bei Upstash und OpenAI vor dem Einschalten prüfen und in der Datenschutzerklärung nennen.

## Definition of Done pro Schritt
Tests grün, Typecheck und Lint grün, Feature in der Vorschau sichtbar, Accuracy gemessen und in `docs/genauigkeit.md` dokumentiert, Netzwerk-Tab zeigt nur pseudonymisierte Händlertexte.
