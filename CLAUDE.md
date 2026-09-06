# Projekt: Portfolio-Monorepo (K1 DepotDoktor, K2 KontoKlar, K3 NetzRadar)

Aktueller Stand: K2 KontoKlar ist implementiert (apps/web/app/projects/kontoklar). K1 und K3 folgen als weitere Routen.

## Stack
Next.js 15 App Router, TypeScript strict, Tailwind 4, Papa Parse, Recharts, OpenAI Node SDK, @upstash/redis, @upstash/ratelimit, Cloudflare Turnstile, Vitest, Playwright, pnpm Workspaces, GitHub Actions, Vercel Hobby.

## Befehle
- `pnpm install`
- `pnpm --filter web dev` (Vorschau unter http://localhost:3000/projects/kontoklar)
- `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`
- `pnpm --filter web accuracy` (Regel-Engine auf data/k2/testset.json; `--api` zusätzlich Embeddings und Fallback, braucht OPENAI_API_KEY)
- `pnpm --filter web embeddings:build` (data/k2/labeled-examples.json -> data/k2/labeled-embeddings.json, braucht OPENAI_API_KEY)
- `DESTATIS_TOKEN=... pnpm --filter web cpi:build`

## Git und Deployment
- Remote: https://github.com/mirkan-morgenfels-ai/AI-Project-2 (privat). Vercel-Projekt `kontoklar` (Team AI-Team, Root `apps/web`) deployt jeden Push auf `main`; Produktions-URL https://kontoklar-eight.vercel.app.
- Commits müssen mit der GitHub-noreply-Adresse des Kontos mirkan-morgenfels-ai signiert sein (repo-lokal per `git config user.email` gesetzt), sonst blockiert Vercel das Deployment („commit email could not be matched“).

## Struktur K2
- `packages/csv/` Bank-Parser (DKB, ING, comdirect, N26, generisch), Erkennung, Fixtures
- `packages/ratelimit/` Upstash-Rate-Limit, Turnstile-Verifikation
- `apps/web/lib/kontoklar/` Kategorien, Händler-Normalisierung, Regel-Engine, kNN, Server-Pipeline, Abo-Erkennung, Inflation
- `apps/web/app/api/categorize/route.ts` API-Route (Turnstile -> Rate-Limit -> Cache -> Embedding+kNN -> Fallback -> Cache)
- `data/k2/rules.json` Regelsatz, `data/k2/testset.json` gelabeltes Testset, `data/k2/cpi.json` Destatis-Teilindizes (aktuell Beispielwerte, `sample: true`)

## Feste Regeln (aus dem Umsetzungsdokument)
- An die API geht nur der normalisierte Händlerteil (`merchantKeyFor`). Nie Namen, IBANs, Verwendungszwecke, Beträge, Daten, ganze Zeilen. Überweisungen an Privatpersonen und Gutschriften gehen nie an die API (`isApiEligible`).
- Reihenfolge: Regel -> Cache -> Embedding -> Sprachmodell. Kein Sprachmodell pro Buchung; ein Batch-Aufruf je Upload, höchstens 500 Texte.
- Ohne API-Keys läuft die Anwendung mit der Regel-Engine allein; die Route antwortet dann 503 `disabled`.
- Keine Umsätze auf dem Server, auch nicht in Logs. Logs enthalten keine Buchungstexte.
- Änderungen an dem, was übertragen oder gespeichert wird, ziehen Änderungen an `apps/web/app/datenschutz/page.tsx` und README-Abschnitt „Was den Browser verlässt“ nach sich.
- Tests der API-Route mit gemocktem OpenAI-Client und Redis-Mock; CI ruft keine echten APIs.
- Deutsch in der Oberfläche, Englisch in Code-Bezeichnern. Keine Kommentarzeilen im Code.
- Genauigkeitsangaben nur aus `pnpm --filter web accuracy`, nie geschätzt.

## Betrieb lokal
- `next build` und `next dev` nie gleichzeitig im selben Verzeichnis laufen lassen; der Build überschreibt `.next` und der Dev-Server antwortet danach mit 500.
- Die API-Route ist fail-closed: ohne OPENAI_API_KEY, ohne Beispielset oder bei nicht erreichbarem Rate-Limit antwortet sie 503, nie mit ungebremsten Aufrufen.

## Sicherheit und Zugänglichkeit
- Sicherheits-Header (CSP mit Turnstile-Ausnahmen, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) stehen in `apps/web/next.config.ts`; neue externe Quellen müssen dort in der CSP eingetragen werden.
- Goldton für Text ist `text-gold-deep` (#7d5f17, AA-Kontrast); `gold` (#b8912f) nur für Flächen, Rahmen, Fokusringe. Fokus-Ringe global in `globals.css`.

## Konfidenzschwellen
Regel 1,0. kNN >= 0,80 übernehmen. 0,50 bis 0,80 übernehmen und markieren. < 0,50 Fallback (Sprachmodell), Ergebnis mit 0,50 gecacht.

## Design
Kein Blau. Palette: Schwarz (#111111), Papier (#fbfaf6), Gold (#b8912f), Moosgrün (#2f6b3a), Bordeaux (#7a1f2b). Tokens in `apps/web/app/globals.css`.

## Definition of Done pro Schritt
Tests grün, Typecheck und Lint grün, Feature in der Vorschau sichtbar, Accuracy gemessen und in `docs/genauigkeit.md` dokumentiert, Netzwerk-Tab zeigt nur pseudonymisierte Händlertexte.
