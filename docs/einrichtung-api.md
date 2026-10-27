# Einrichtung des API-Schritts

Stand: 21.10.2026, überarbeitet am 27.10.2026 (Reihenfolge, Auftragsverarbeitungsvertrag und Datenfreigabe bei OpenAI, Abschaltung von `gpt-5-nano`, Lese-Regionen und Archivierung bei Upstash, Funktionsregion bei Vercel). Diese Anleitung schaltet den optionalen API-Schritt von KontoKlar auf https://kontoklar-eight.vercel.app ein: Embedding-kNN und Sprachmodell-Fallback bei OpenAI, Zwischenspeicher und Tageslimit bei Upstash Redis, Bot-Prüfung mit Cloudflare Turnstile. Konten anlegen, Zahlungsdaten hinterlegen, Verträge annehmen und Schlüssel erzeugen nimmt der Autor selbst vor; Schlüssel gehören nie ins Repository, in Issues oder in Chats.

Die API-Route ist fail-closed (`apps/web/lib/kontoklar/config.ts`, `apps/web/app/api/categorize/route.ts`): Solange auch nur eine der sechs Pflichtvariablen fehlt, leer ist oder in der Produktion ein Cloudflare-Testschlüssel ist, meldet `GET /api/categorize` `enabled: false` mit den fehlenden Namen, und `POST` antwortet mit 503, ohne OpenAI, Upstash oder Cloudflare anzusprechen. Ohne `data/k2/labeled-embeddings.json` im Deployment bleibt der Schritt ebenfalls aus. Man kann die Variablen also nacheinander anlegen; aktiv wird der Schritt erst mit der letzten und dem nächsten Deployment.

## Reihenfolge

Die Schritte behalten ihre Nummern, weil andere Dokumente auf sie verweisen. Abgearbeitet werden sie in dieser Reihenfolge, damit die Angaben für die Datenschutzerklärung feststehen, bevor sie veröffentlicht wird, und die Erklärung veröffentlicht ist, bevor der Schritt in der Produktion eingeschaltet wird:

1. Schritt 2: OpenAI: Konto, Guthaben, Ausgabenlimit, API-Schlüssel, Auftragsverarbeitungsvertrag, Datenfreigabe, Sprachmodell
2. Schritt 3: Beispielset einbetten und API-Stufe messen (lokal)
3. Schritt 4: Upstash Redis in Frankfurt
4. Schritt 5: Cloudflare Turnstile
5. Schritt 6: `IP_HASH_SECRET` erzeugen
6. Schritt 7, Punkt 1: Funktionsregion bei Vercel
7. Schritt 1: Datenschutzerklärung ergänzen und auf `main` veröffentlichen (Pflicht vor den Variablen)
8. Schritt 7, Punkte 2 und 3: Variablen in Vercel eintragen und neu deployen
9. Schritt 8: Prüfen
10. Schritt 9: Kosten im Blick behalten, im Notfall abschalten

## Die Variablen

Die Namen stehen in `API_REQUIREMENTS` (`apps/web/lib/kontoklar/config.ts`), in `apps/web/.env.example` und in der README-Tabelle; sie müssen exakt so heißen.

| Variable | Pflicht | Woher | Typ in Vercel | Umgebung |
|---|---|---|---|---|
| `OPENAI_API_KEY` | ja | OpenAI, Schritt 2 | Secret | Production |
| `UPSTASH_REDIS_REST_URL` | ja | Upstash, Schritt 4 | Secret | Production |
| `UPSTASH_REDIS_REST_TOKEN` | ja | Upstash, Schritt 4 | Secret | Production |
| `TURNSTILE_SECRET_KEY` | ja | Cloudflare, Schritt 5 (Secret Key) | Secret | Production |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ja | Cloudflare, Schritt 5 (Sitekey, öffentlich) | Config | Production |
| `IP_HASH_SECRET` | ja, mindestens 32 Zeichen | Schritt 6 | Secret | Production |
| `KONTOKLAR_EMBEDDING_MODEL` | nein, Standard `text-embedding-3-small` | – | Config | – |
| `KONTOKLAR_FALLBACK_MODEL` | nein, Standard `gpt-5-nano` (wird am 11.12.2026 abgeschaltet, siehe Schritt 2) | – | Config | – |
| `NEXT_PUBLIC_SITE_URL` | nein, leer bedeutet `https://kontoklar-eight.vercel.app` | – | Config | – |

Die optionalen Variablen nicht setzen, solange die Standardwerte passen. Wird `KONTOKLAR_EMBEDDING_MODEL` gesetzt, muss `labeled-embeddings.json` mit demselben Modell erzeugt sein. `KONTOKLAR_FALLBACK_MODEL` nur setzen, wenn der Wert zu dem Modell passt, das die Datenschutzerklärung nennt. `OPENAI_BASE_URL` nicht setzen: Das OpenAI-SDK liest die Variable selbst und würde den Endpunkt unbemerkt umstellen.

## Schritt 1: Datenschutzerklärung (nach Schritt 7, Punkt 1, vor den Variablen)

Der Entwurf [`entwurf-datenschutz-api.md`](entwurf-datenschutz-api.md) ergänzt die Angaben zu OpenAI (Vertragspartner, Auftragsverarbeitungsvertrag, Empfänger, Übermittlungsgrundlage, Speicherdauer), Upstash (Rechtsträger, Sitz, Region, Empfänger, eigene Zwecke), Cloudflare (Daten, Rolle, Übermittlung, Speicherdauer) und Vercel (Funktionsregion, Protokolle) sowie die Fundstellen der Garantien. Seine Platzhalter füllen sich aus den Schritten 2 bis 5 und Schritt 7, Punkt 1; dazu kommen einige Entscheidungen des Autors. Die Prüfliste des Entwurfs abarbeiten, den Text in `apps/web/app/datenschutz/page.tsx` übernehmen, auf `main` veröffentlichen und live gegenlesen. Erst danach die Variablen in der Produktion setzen (Schritt 7, Punkte 2 und 3). Der Entwurf ist keine Rechtsberatung.

## Schritt 2: OpenAI

1. Unter https://platform.openai.com ein Konto anlegen bzw. anmelden und eine Organisation sowie ein Projekt „kontoklar“ anlegen.
2. Guthaben: Die API wird im Voraus bezahlt (Prepaid). Beim ersten Kauf ist die automatische Aufladung („auto recharge“) voreingestellt; sie vor dem Bestätigen ausschalten. Einen kleinen Betrag kaufen, etwa 5 $. Ohne automatische Aufladung ist das Guthaben die äußerste Grenze; gekaufte Guthaben verfallen nach einem Jahr.
3. Ausgabenlimit (Monatslimit 5 $ laut `CLAUDE.md`): In den Organisationseinstellungen unter „Limits“ (https://platform.openai.com/settings/organization/limits) bei „Spend“ auf „Edit spend limit“, als „Monthly spend limit“ 5 eintragen, „Enforce a hard limit“ einschalten, „Save“. Dasselbe im Projekt unter „Project settings“ > „Limits“. Wird das Limit erreicht, antwortet OpenAI mit HTTP 429 (`organization_spend_limit_exceeded` bzw. `project_spend_limit_exceeded`); die Route meldet dann für Händlertexte, die noch nicht im Zwischenspeicher stehen, 502 „Kategorisierung derzeit nicht verfügbar.“, und die Oberfläche bleibt bei der Regel-Engine. OpenAI weist darauf hin, dass die Sperre nicht sofort greift und der Verbrauch das Limit leicht überschreiten kann. Zusätzlich eine Benachrichtigung („alert“) bei etwa 2 $ setzen.
4. API-Schlüssel: im Projekt unter „API keys“ „Create new secret key“, Name „kontoklar-vercel“, Berechtigung „Restricted“ mit „Model capabilities“ auf „Write“ und allen übrigen Bereichen auf „None“ (KontoKlar ruft nur `/v1/embeddings` und `/v1/chat/completions` auf). Der Schlüssel wird nur einmal angezeigt; in einem Passwortmanager ablegen. Falls ein Aufruf mit dieser Einschränkung scheitert (Schritt 3 meldet dann einen Fehler 401 oder 403), die Berechtigung auf „All“ setzen.
5. Datenresidenz: Eine Verarbeitung in Europa (`eu.api.openai.com`) setzt laut OpenAI eine Freigabe (Zero Data Retention, Modified Abuse Monitoring, Private Retention mit PSP oder Safety Retention) und ein unterzeichnetes Modified Retention Amendment voraus; technisch ginge sie ohne Codeänderung über `OPENAI_BASE_URL`. Vorerst nicht nötig, der Entwurf der Datenschutzerklärung berücksichtigt die Verarbeitung in den USA; `OPENAI_BASE_URL` deshalb nicht setzen.
6. Auftragsverarbeitungsvertrag: auf https://openai.com/policies/data-processing-addendum/ den Link „Execute Data Processing Agreement“ öffnen (Formular bei Ironclad). Es fragt den vollständigen Namen bzw. Firmennamen, die Anschrift, die Organization ID (Seite „Organization settings“), ob der Kunde im EWR oder in der Schweiz ansässig ist (bei Wohnsitz in Deutschland: ja, dann ist OpenAI Ireland Ltd. Vertragspartner) sowie Name und E-Mail der unterzeichnenden Person. Nach dem Absenden geht eine Prüfanfrage an diese E-Mail; verbindlich wird die Vereinbarung laut Formular erst, wenn Sie die Bedingungen annehmen. Vertragspartner und Datum der Annahme für die Datenschutzerklärung notieren.
7. Datenfreigabe: In den Organisationseinstellungen unter „Data controls“ (Bereich „Sharing“) prüfen, dass alle Freigaben an OpenAI aus sind (Feedback, Evaluations- und Fine-Tuning-Daten, Ein- und Ausgaben), auch für keine einzelnen Projekte eingeschaltet. Laut OpenAI ist das Teilen von Ein- und Ausgaben standardmäßig aus, und nur der Organization Owner kann es ändern.
8. Sprachmodell: OpenAI schaltet `gpt-5-nano`, den bisherigen Standard für den Fallback, am 11.12.2026 ab und nennt `gpt-5.6-luna` als Nachfolger. Das Modell vor Schritt 3 festlegen (Abwägung im Entwurf der Datenschutzerklärung, „Vorab zu entscheiden“) und in Schritt 3 mit einem echten Aufruf prüfen, ob es den JSON-Modus des Codes annimmt; danach den Standard in `apps/web/lib/kontoklar/providers.ts`, `apps/web/.env.example`, README und dieser Anleitung anpassen.

## Schritt 3: Beispielset einbetten und API-Stufe messen (lokal)

Der API-Schritt braucht `data/k2/labeled-embeddings.json` im Deployment. Die Datei entsteht einmalig lokal aus `data/k2/labeled-examples.json` (Skript `apps/web/scripts/build-embeddings.ts`, Logik in `apps/web/lib/kontoklar/embeddings.ts`). Das Skript läuft nur mit `OPENAI_API_KEY` und bricht ab, wenn `CI` gesetzt ist. Es prüft das Beispielset vorher auf IBANs, E-Mail-Adressen und lange Ziffernfolgen und schreibt nur Modell, Datum, Anzahl und je Text Kategorie und Vektor; die Konsole zeigt nur Zählwerte.

```powershell
$env:PATH = "$env:LOCALAPPDATA\Programs\nodejs;$env:PATH"
pnpm --filter web embeddings:build --dry-run
$env:OPENAI_API_KEY = Read-Host -MaskInput "OpenAI-Schlüssel"
pnpm --filter web embeddings:build
pnpm --filter web accuracy --api
pnpm --filter web accuracy --api --write
Remove-Item Env:OPENAI_API_KEY
```

- Der Probelauf `--dry-run` braucht keinen Schlüssel. Stand 21.10.2026 meldet er 278 Einträge, 277 verschiedene normalisierte Texte (`CASH26` wird zu einem leeren Text und übersprungen), geschätzt 1.197 Token und Kosten von etwa 0,000024 $ (0,02 $ je Million Token für `text-embedding-3-small`; die Schätzung rechnet ein Token je drei Zeichen).
- `embeddings:build` schreibt `data/k2/labeled-embeddings.json` (277 Vektoren mit je 1.536 Werten, auf 5 Nachkommastellen gerundet; die Datei wird einige Megabyte groß).
- `accuracy --api` prüft das API-Testset (95 Buchungen), bettet die 95 Händlertexte ein (etwa 760 Token) und schickt die unsicheren in einem Aufruf an das Fallback-Modell (bisher GPT-5 nano, 0,05 $ je Million Eingabe-Token, 0,40 $ je Million Ausgabe-Token; `gpt-5.6-luna` laut Modellseite am 27.10.2026 0,20 $ bzw. 1,20 $). Ein anderes Modell als den Standard probeweise mit `$env:KONTOKLAR_FALLBACK_MODEL = "gpt-5.6-luna"` vor dem Aufruf; scheitert es mit Fehler 400, nimmt es den JSON-Modus (`response_format: json_object`) nicht an, und der Code muss auf Structured Outputs umgestellt werden. Zusammen liegt die Messung nach dieser Rechnung deutlich unter 0,01 $. Erst mit `--write` entsteht `docs/genauigkeit-api.json`.
- Danach `labeled-embeddings.json` und `docs/genauigkeit-api.json` committen und pushen (Commit nimmt der Autor vor) und die Kennzahlen in `docs/genauigkeit.md` und im README nachtragen (kann Claude übernehmen). Der Build nimmt die Datei in die API-Funktion auf (am 20.10.2026 mit einer Probedatei geprüft: `.next/server/app/api/categorize/route.js.nft.json` enthält `data/k2/labeled-embeddings.json`).

## Schritt 4: Upstash Redis in Frankfurt

1. Unter https://console.upstash.com anmelden bzw. registrieren.
2. Im Reiter „Redis“ auf „+ Create Database“. Name „kontoklar“, „Primary Region“ AWS „eu-central-1“ (Frankfurt). Keine Lese-Regionen auswählen (der Entwurf der Datenschutzerklärung sagt „keine weiteren Lese-Regionen“). „Next“, den kostenlosen Tarif wählen, anlegen. Im Reiter „Backups“ „Daily Backup“ aus lassen. Laut FAQ archiviert Upstash kostenlose Datenbanken nach mindestens 30 Tagen ohne Nutzung (Sicherung der Daten, Entfernen der Datenbank); ob das die Datenschutzerklärung betrifft, klärt der Entwurf (Prüfliste, Punkt 4).
3. In der Datenbank im Bereich „Connect“ den Reiter „REST“ öffnen. Dort stehen die Werte für `UPSTASH_REDIS_REST_URL` (beginnt mit `https://` und endet auf `.upstash.io`) und `UPSTASH_REDIS_REST_TOKEN`. Den normalen Token nehmen, nicht den „Readonly Token“: Tageslimit und Zwischenspeicher schreiben.
4. Die Variablennamen müssen genau so lauten; eine Integration, die andere Namen anlegt, reicht nicht.
5. Region für den Entwurf der Datenschutzerklärung notieren.

## Schritt 5: Cloudflare Turnstile

1. Unter https://dash.cloudflare.com anmelden bzw. registrieren und die Seite „Turnstile“ öffnen (https://dash.cloudflare.com/?to=/:account/turnstile).
2. „Add widget“: Widget name „KontoKlar“; bei der Hostname-Verwaltung `kontoklar-eight.vercel.app` eintragen; Widget mode „Managed“; Pre-clearance nicht aktivieren; „Create“.
3. Den angezeigten Sitekey als `NEXT_PUBLIC_TURNSTILE_SITE_KEY` und den Secret Key als `TURNSTILE_SECRET_KEY` übernehmen. Der Secret Key bleibt geheim, der Sitekey landet ohnehin im ausgelieferten JavaScript.
4. Die dokumentierten Testschlüssel von Cloudflare (Sitekey `1x00000000000000000000AA`, Secret `1x0000000000000000000000000000000AA` und weitere) nur lokal verwenden. In der Produktion zählt KontoKlar sie als fehlend (`isTurnstileTestKey`); `GET /api/categorize` nennt dann den Grund.

## Schritt 6: `IP_HASH_SECRET`

Ein zufälliger Schlüssel mit 64 Hexadezimalzeichen (32 Byte), nur für diesen Zweck, nie mit `NEXT_PUBLIC_` und nie im Repository:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Alternativ `openssl rand -hex 32`. Der Server bildet damit HMAC-SHA256 der IP-Adresse (IPv6: /64-Präfix) als Schlüssel des Tageslimits. Ein neuer Wert setzt alle Tageszähler zurück.

## Schritt 7: Funktionsregion, Variablen in Vercel eintragen und neu deployen

1. Funktionsregion (vor Schritt 1, weil die Datenschutzerklärung sie nennt): https://vercel.com öffnen, Team „AI-Team“, Projekt „kontoklar“, Settings → Functions → „Function Regions“. Für neue Projekte ist Washington, D.C. (`iad1`) voreingestellt; im Repository ist keine Region gesetzt. Empfehlung: Frankfurt (`fra1`), nahe an Upstash eu-central-1; im Hobby-Tarif ist genau eine Region möglich. Die Einstellung gilt ab dem nächsten Deployment.
2. Nach der Veröffentlichung der Datenschutzerklärung (Schritt 1) im Projekt in der Seitenleiste „Environment Variables“ (Project Settings) öffnen. Je Variable: Name aus der Tabelle oben, Wert einfügen, Typ „Secret“ (für `NEXT_PUBLIC_TURNSTILE_SITE_KEY` „Config“), als Umgebung nur „Production“ anhaken, „Save“. Preview und Development frei lassen: Preview-Adressen stehen nicht in der Turnstile-Hostname-Liste, und jede Vorschau würde das OpenAI-Guthaben mitnutzen.
   `OPENAI_BASE_URL` nicht anlegen; `KONTOKLAR_FALLBACK_MODEL` nur passend zur Datenschutzerklärung.
3. Änderungen gelten nur für neue Deployments. Deshalb danach in der Seitenleiste „Deployments“ das aktuelle Production-Deployment wählen, „…“ > „Redeploy“, im Fenster „Redeploy to Production“ den Build-Cache abwählen (der Sitekey wird beim Build in das JavaScript geschrieben) und „Redeploy“. Ein Push auf `main`, etwa mit `labeled-embeddings.json`, erzeugt ebenfalls ein neues Deployment.

## Schritt 8: Prüfen

In PowerShell 7 (`-SkipHttpErrorCheck` zeigt auch Antworten mit 4xx/5xx):

```powershell
$api = "https://kontoklar-eight.vercel.app/api/categorize"
Invoke-RestMethod $api | ConvertTo-Json
Invoke-WebRequest $api -Method Post -ContentType "application/json" -Body '{"texts":["TEST"]}' -SkipHttpErrorCheck | Select-Object StatusCode, Content
Invoke-WebRequest $api -Method Post -ContentType "application/json" -Body ("x" * 250000) -SkipHttpErrorCheck | Select-Object StatusCode, Content
```

1. Fail-closed vorher: Solange etwas fehlt, liefert der erste Befehl `enabled: false`, eine Begründung und `missing` mit den fehlenden Namen (nie Werte); der zweite Status 503 mit `"disabled": true`. Das lässt sich nach jeder einzelnen Variable prüfen.
2. Nach dem Redeploy: Der erste Befehl liefert `{"enabled": true, "turnstile": true}`. Der zweite liefert 403 „Bot-Prüfung fehlgeschlagen“, weil kein Turnstile-Token mitgeht; OpenAI wird dabei nicht aufgerufen. Der dritte liefert 413 „Anfrage zu groß“.
3. Oberfläche: https://kontoklar-eight.vercel.app/projects/kontoklar öffnen, den API-Schritt anhaken (das Turnstile-Widget erscheint) und eine synthetische Datei hochladen, etwa diese, lokal als `api-probe.csv` gespeichert:

   ```
   "Girokonto";"DE00000000000000000000"
   ""
   "Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"
   "01.10.26";"01.10.26";"Gebucht";"Max Mustermann";"Feinbäckerei Sommerfeld GmbH";"Filiale Ostviertel";"Kartenzahlung";"";"-6,40";"";"";""
   "02.10.26";"02.10.26";"Gebucht";"Max Mustermann";"Kletterwerk Nordwand GmbH";"Tageseintritt";"Kartenzahlung";"";"-14,50";"";"";""
   "03.10.26";"03.10.26";"Gebucht";"Max Mustermann";"Erika Beispiel";"Geschenk";"Überweisung";"DE00000000000000000000";"-20,00";"";"";""
   ```

   Erwartung: „2 Händlertexte übertragen“; „Was genau wurde gesendet?“ listet `FEINBAECKEREI SOMMERFELD` und `KLETTERWERK NORDWAND`. Die private Überweisung bleibt im Browser. In den Entwicklerwerkzeugen (Netzwerk) enthält der Body des `POST /api/categorize` nur `texts` und `turnstileToken`, keine Beträge, Daten, IBANs oder Verwendungszwecke. Ein zweiter Upload derselben Datei meldet die Texte „aus dem Cache“.
4. Rate-Limit und Speicher: In der Upstash-Konsole im „Data Browser“ stehen nur Schlüssel der Form `rl:categorize:…` mit einem 64-stelligen Hexwert (keine IP-Adresse) und `kk:cat:v1:…` mit Kategorie und Konfidenz. Nach 30 API-Aufrufen am selben Tag (UTC) aus demselben Netz meldet die Seite „Tageslimit erreicht.“ (HTTP 429); das kostet jeweils nur Bruchteile eines Cents, ist aber optional, weil die Unit-Tests das Verhalten prüfen.
5. Logs: In Vercel unter „Logs“ dürfen keine Händlertexte und keine IP-Adressen aus der Route stehen; die Route schreibt bei Fehlern nur Fehlerart und Statuscode.
6. Kosten: Im OpenAI-Dashboard unter „Usage“ erscheinen die Aufrufe; nach den Prüfungen sollten es weniger als 0,01 $ sein.

## Schritt 9: Kosten und Notabschaltung

| Posten | Preis bzw. Grenze |
|---|---|
| `text-embedding-3-small` | 0,02 $ je Million Token |
| GPT-5 nano (Fallback, bis 11.12.2026) | 0,05 $ je Million Eingabe-Token, 0,40 $ je Million Ausgabe-Token |
| `gpt-5.6-luna` (Nachfolger laut OpenAI) | 0,20 $ je Million Eingabe-Token, 1,20 $ je Million Ausgabe-Token (Modellseite, 27.10.2026) |
| OpenAI-Ausgabenlimit | 5 $ im Monat, harte Grenze (Schritt 2) |
| Upstash Redis, Cloudflare Turnstile | kostenlose Tarife |
| Tageslimit je IP-Hash | 30 Aufrufe, höchstens 500 Texte je Aufruf |

Notabschaltung, je nach Dringlichkeit:

1. Sofort: Bei OpenAI unter „API keys“ den Schlüssel widerrufen („Revoke“). Die Route meldet danach für Händlertexte, die nicht im Zwischenspeicher stehen, 502; die Oberfläche arbeitet mit der Regel-Engine weiter.
2. Dauerhaft fail-closed: In Vercel unter „Environment Variables“ bei `OPENAI_API_KEY` „…“ > „Delete“ und danach neu deployen (Schritt 7, Punkt 3). Dann liefert `GET /api/categorize` `enabled: false`, und `POST` antwortet mit 503, ohne OpenAI anzusprechen. Prüfen mit dem ersten Befehl aus Schritt 8.
3. Wieder einschalten: neuen Schlüssel erzeugen, Variable neu anlegen, neu deployen, Schritt 8 wiederholen.

## Quellen

- OpenAI, API-Preise (`text-embedding-3-small` 0,02 $ je Million Token; GPT-5 nano 0,05 $ Eingabe und 0,40 $ Ausgabe je Million Token): https://developers.openai.com/api/docs/pricing (abgerufen am 21.10.2026)
- OpenAI, Spend limits (Organisations- und Projektlimit, „Enforce a hard limit“, Fehler 429, keine sofortige Durchsetzung): https://developers.openai.com/api/docs/guides/spend-limits (abgerufen am 21.10.2026)
- OpenAI, Data controls (Training, Speicherdauer, Datenresidenz): https://developers.openai.com/api/docs/guides/your-data (abgerufen am 21.10.2026)
- OpenAI Help Center, „Setting up and managing prepaid API billing“ (automatische Aufladung voreingestellt, vor dem Kauf abschaltbar, Verfall nach einem Jahr): https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing (über Suchergebnisse geprüft am 20.10.2026; die Seite lehnt automatisierte Abrufe ab)
- OpenAI Help Center, „Assign API key permissions“ (All, Restricted, Read Only; „Model capabilities“): https://help.openai.com/en/articles/8867743-assign-api-key-permissions (über Suchergebnisse geprüft am 20.10.2026)
- Upstash, Getting Started („+ Create Database“, Primary Region, Read Regions): https://upstash.com/docs/redis/overall/getstarted (abgerufen am 20.10.2026)
- Upstash, REST API (Bereich „Connect“, Reiter „REST“, `UPSTASH_REDIS_REST_URL` und `UPSTASH_REDIS_REST_TOKEN`, Readonly Token): https://upstash.com/docs/redis/features/restapi (abgerufen am 21.10.2026)
- Upstash, Global Replication (Region AWS EU-Central-1 Frankfurt): https://upstash.com/docs/common/concepts/global-replication (abgerufen am 21.10.2026)
- Cloudflare, Turnstile: Widget im Dashboard anlegen (Stand 16.04.2026): https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/ (abgerufen am 21.10.2026)
- Cloudflare, Turnstile: Testschlüssel (Stand 20.10.2026; Produktionsschlüssel lehnen Test-Token ab): https://developers.cloudflare.com/turnstile/troubleshooting/testing/ (abgerufen am 21.10.2026)
- OpenAI, Abkündigungen (`gpt-5-nano` bis 11.12.2026, Nachfolger `gpt-5.6-luna`): https://developers.openai.com/api/docs/deprecations (abgerufen am 27.10.2026); Modellseite `gpt-5.6-luna`: https://developers.openai.com/api/docs/models/gpt-5.6-luna (abgerufen am 27.10.2026)
- OpenAI, Data Processing Addendum und Formular „Execute Data Processing Agreement“: https://openai.com/policies/data-processing-addendum/ und https://ironcladapp.com/public-launch/63ffefa2bed6885f4536d0fe (im Browser gelesen am 27.10.2026); Help Center zu Datenfreigaben: https://help.openai.com/en/articles/10306912 (im Browser gelesen am 27.10.2026)
- Upstash, FAQ (Archivierung kostenloser Datenbanken): https://upstash.com/docs/redis/help/faq; Backups: https://upstash.com/docs/redis/features/backup (abgerufen am 27.10.2026)
- Vercel, Configuring regions for Vercel Functions (Vorgabe `iad1`, Hobby eine Region; Stand 11.08.2026): https://vercel.com/docs/functions/configuring-functions/region (abgerufen am 27.10.2026)
- Vercel, Managing environment variables (Seitenleiste „Environment Variables“, „Save“, nur neue Deployments, Löschen über „…“; Stand 11.09.2026): https://vercel.com/docs/environment-variables/managing-environment-variables (abgerufen am 21.10.2026)
- Vercel, Config and Secret environment variables (Stand 28.08.2026): https://vercel.com/docs/environment-variables/sensitive-environment-variables (abgerufen am 20.10.2026)
- Vercel, Managing Deployments, „Redeploy a project“ (Stand 15.09.2026): https://vercel.com/docs/deployments/managing-deployments (abgerufen am 20.10.2026)
