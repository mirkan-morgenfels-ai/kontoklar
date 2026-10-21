# Echte Verbraucherpreisdaten von Destatis

Stand: 21.10.2026. Diese Anleitung ersetzt die Beispielwerte in `data/k2/cpi.json` durch echte Teilindizes des Verbraucherpreisindex (VPI). Danach reicht es, das Token zu setzen und einen Befehl auszuführen; alles Weitere erledigt `pnpm --filter web cpi:build` bzw. der monatliche Workflow `.github/workflows/cpi.yml`.

## Welche Tabellen

Die persönliche Inflationsrate braucht Monatswerte für die 12 COICOP-Abteilungen und den Gesamtindex. Bis zum 20.10.2026 fragte `build-cpi.ts` nur Tabelle 61111-0002 ab; die enthält aber ausschließlich den Gesamtindex, das Skript wäre an „fehlende Abteilungen“ gescheitert. Die in `CLAUDE.md` vermutete Tabelle 61111-0004 enthält zwar Monatswerte je Verwendungszweck, aber als 2- bis 5-Steller-Hierarchie (Merkmal `CC13A5`, 275 Ausprägungen). Am besten passt Tabelle 61111-0006, deren Merkmal `CC13A2` genau die 12 Abteilungen enthält.

| Tabelle | Titel in GENESIS-Online | Merkmale | Verwendung |
|---|---|---|---|
| 61111-0002 | Verbraucherpreisindex: Deutschland, Monate | Jahr, `MONAT`, `DINSG`; Wert `PREIS1` (Index 2020=100, dazu Veränderungsraten in %) | Gesamtindex (`total`) |
| 61111-0004 | Verbraucherpreisindex: Deutschland, Monate, Klassifikation der Verwendungszwecke des Individualkonsums (COICOP 2-5-Steller Hierarchie) | Jahr, `MONAT`, `DINSG`, `CC13A5` | nicht verwendet |
| 61111-0006 | Verbraucherpreisindex: Deutschland, Monate, Klassifikation der Verwendungszwecke des Individualkonsums (COICOP 2-/3-/4-/5-/10-Steller/Sonderpositionen) | Jahr, `MONAT`, `DINSG`, `CC13A2` (12 Ausprägungen `CC13-01` bis `CC13-12`) | Teilindizes (`divisions`) |

Belege: die Metadaten der drei Tabellen (Abruf über `metadata/table` vom 28.09.2026, veröffentlicht im Repository Bildad123/genesis-pipeline, Zeitraum laut Metadaten Januar 1991 bis August 2026) und das Beispiel-Notebook des Statistischen Bundesamts, das 61111-0004 mit `CC13A5` und 61111-0006 mit `CC13Z1` abfragt (Quellen unten).

## Die GENESIS-REST-API

- Basisadresse: `https://genesis.destatis.de/genesisWS/rest/2020/` (die alte Adresse `www-genesis.destatis.de` leitet weiter; `build-cpi.ts` nutzt jetzt die neue).
- Methode `data/tablefile`, nur per `POST` mit `Content-Type: application/x-www-form-urlencoded`. Zugangsdaten stehen im HTTP-Header: `username` = persönlicher Token (32 Zeichen), `password` leer. Seit dem 15.07.2025 gibt es keine `GET`-Abrufe mit Zugangsdaten mehr.
- Parameter im Body: `name` (Tabelle), `area=all`, `startyear`, `format=ffcsv`, `language=de`, `job=false`, für 61111-0006 zusätzlich `classifyingvariable1=CC13A2`. Ein Token reicht für direkte Abrufe; Aufträge mit `job=true` bräuchten Benutzername und Passwort.
- Antwort: CSV-Dateien liefert GENESIS-Online als ZIP-Archiv mit genau einer Datei; Fehler kommen als JSON mit `Status.Code` und `Status.Content` (etwa 98, wenn eine Tabelle mehr als 40.000 Werte hat). Das Skript entpackt das ZIP mit `node:zlib`, nimmt auch unverpacktes CSV an und meldet JSON-Fehler mit Code und Text.
- Format `ffcsv` (überarbeitet, Spaltennamen einheitlich englisch): `statistics_code;statistics_label;time_code;time_label;time;1_variable_code;…;value;value_unit;value_variable_code;value_variable_label`, Semikolon, Dezimalkomma, UTF-8 mit BOM, Zeilen ungeordnet. Fehlende Werte erscheinen als `...`, `-`, `.`, `/` oder `x`. In 61111-0002 hat jeder Monat drei Zeilen: den Index (`value_unit` „2020=100“) und zwei Veränderungsraten (`value_unit` „%“); das Skript übernimmt nur die Indexzeilen.

Umsetzung: `apps/web/lib/kontoklar/destatis.ts` (Anfrage, ZIP, Parser, Prüfung), `apps/web/scripts/build-cpi.ts` (Abruf und Schreiben). Abgerufen werden die letzten drei Kalenderjahre und das laufende (`CPI_YEARS_BACK`), also etwa 12 × 12 × 4 = 576 Werte, weit unter der Grenze von 40.000. Die Unit-Tests in `apps/web/lib/kontoklar/__tests__/destatis.test.ts` prüfen Anfrage, ZIP, Parser und Fehlerfälle mit erfundenen Antworten (`__tests__/fixtures/genesis-61111-0002.csv` und `genesis-61111-0006.csv`, Werte frei erfunden, Aufbau wie die echte Ausgabe); es gibt keinen echten Abruf in Tests oder CI. Das Skript schreibt `cpi.json` nur, wenn alle 12 Abteilungen und der Gesamtindex Werte haben und beide Tabellen dasselbe Basisjahr nennen; sonst bleibt die alte Datei unverändert.

## Schritt 1: Konto und Token

1. Unter https://genesis.destatis.de/datenbank/online#modal=register kostenlos registrieren (Benutzername, E-Mail, Passwort; die Registrierung nehmen Sie selbst vor).
2. Anmelden und das Menü „Webservice-Schnittstelle (API)“ öffnen (https://genesis.destatis.de/datenbank/online#modal=web-service-api). Dort steht der persönliche API-Token. Ein neu erzeugter Token macht den alten sofort ungültig.
3. Den Token nirgends ins Repository schreiben, auch nicht in `.env`-Dateien, die eingecheckt werden könnten.

## Schritt 2: Lokal abrufen (PowerShell)

```powershell
$env:PATH = "$env:LOCALAPPDATA\Programs\nodejs;$env:PATH"
$env:DESTATIS_TOKEN = Read-Host -MaskInput "GENESIS-Token"
pnpm --filter web cpi:build
Remove-Item Env:DESTATIS_TOKEN
```

In Git Bash oder unter Linux/macOS entsprechend `DESTATIS_TOKEN=... pnpm --filter web cpi:build`. Die Ausgabe nennt Basisjahr, Abrufdatum, Zeitraum des Gesamtindex und den letzten Monat je Abteilung, zum Beispiel:

```
cpi.json aktualisiert aus GENESIS-Online 61111-0002 und 61111-0006 (Basis 2020=100, abgerufen 2026-10-21).
Gesamtindex: 45 Monate, 2023-01 bis 2026-09.
Letzter Monat je Abteilung: 01 2026-09, 02 2026-09, …
```

(Beispielausgabe zur Form; die echten Zahlen hängen vom Abruftag ab.)

## Schritt 3: Ausgabe prüfen

1. `git diff --stat data/k2/cpi.json` zeigt die Änderung; in der Datei müssen `"sample": false`, `"fetchedAt"` mit dem heutigen Datum, `"source"` mit beiden Tabellen und `"license"` mit „dl-de/by-2-0“ stehen.
2. Stichprobe gegen GENESIS-Online: den Gesamtindex des letzten Monats mit Tabelle 61111-0002 im Browser vergleichen (https://genesis.destatis.de/datenbank/online/statistic/61111/table/61111-0002) und einen Teilindex, etwa Abteilung 01, mit Tabelle 61111-0006.
3. `pnpm --filter web test` (prüft unter anderem, dass `cpi.json` alle 12 Abteilungen und den Gesamtindex mit geordneten Monatswerten enthält und als Destatis-Daten mit Lizenz gekennzeichnet ist), danach `pnpm build` und `pnpm test:e2e` (mit `CI=true`). Die Oberfläche zeigt dann „Amtliche Gesamtrate“ und „Persönliche Rate“ statt der Beispielhinweise und als Quelle beide Tabellen mit einem Link auf den Lizenztext.
4. Bricht das Skript ab, meldet es den Grund: fehlendes Token, HTTP-Fehler je Tabelle, GENESIS-Status (Code und Text), fehlende Abteilungen, uneinheitliches Basisjahr oder widersprüchliche Werte. `cpi.json` bleibt dann unverändert.

## Schritt 4: Monatlich per GitHub Actions

1. Im Repository unter Settings > Secrets and variables > Actions > New repository secret den Namen `DESTATIS_TOKEN` und als Wert den Token eintragen.
2. Unter Actions den Workflow „Destatis CPI aktualisieren“ wählen und „Run workflow“ starten. Er läuft danach am 15. jedes Monats um 06:00 UTC, ruft `pnpm --filter web cpi:build` auf, führt die Unit-Tests aus und committet `data/k2/cpi.json` als github-actions[bot].
3. Offen ist, ob Vercel den Bot-Commit deployt (ungeprüft, siehe `CLAUDE.md`). Falls nicht, im Vercel-Projekt unter Deployments den letzten Production-Deploy neu starten (Redeploy).

## Nach dem ersten echten Abruf

Diese Stellen beschreiben derzeit die Beispielwerte und müssen danach angepasst werden (kann Claude übernehmen): README (Abschnitte „Persönliche Inflation“ und „Lokale Ausführung“, Lizenzhinweis), `CLAUDE.md` („Quellen“, „Struktur“), der Screenshot `docs/screenshots/inflation.png` (zeigt die Beispielrechnung) und die Hinweise auf die Beispielwerte in `docs/genauigkeit.md`, falls vorhanden. Die handgerechneten Unit-Tests zur Inflation nutzen eine Kopie der Beispielwerte (`apps/web/lib/kontoklar/__tests__/fixtures/cpi-sample.json`) und bleiben deshalb gültig.

## Lizenz

Die Daten stehen unter der Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2-0). Der Quellenvermerk muss den Bereitsteller nennen, auf die Lizenz mit Link auf den Lizenztext verweisen und einen Verweis auf den Datensatz enthalten; veränderte Daten sind als verändert zu kennzeichnen. KontoKlar nennt in `cpi.json` und in der Oberfläche „Statistisches Bundesamt (Destatis), GENESIS-Online 61111-0002 und 61111-0006“ mit Link auf https://www.govdata.de/dl-de/by-2-0, das README zusätzlich die Tabellenadressen. Die Werte werden nicht verändert, nur umgerechnet (Vorjahresveränderung, Gewichtung); das README sagt das.

## Quellen

- Statistisches Bundesamt: GENESIS-Webservices Einführung, Version 5.1, Stand 01.06.2026 (Abschnitte 2.1.3 Authentifizierung, 2.2.2 logincheck, 2.5.12 tablefile): https://genesis.destatis.de/datenbank/online/docs/GENESIS-Webservices_Einfuehrung.pdf (abgerufen am 20.10.2026)
- Statistisches Bundesamt, GitHub: Beispiel-Notebook „python_tablefile.ipynb“ (POST mit Token im Header, Basisadresse, ZIP-Antwort, Grenze 40.000 Werte, Tabellen 61111-0004 und 61111-0006): https://github.com/StatistischesBundesamt/GENESIS-Online/blob/main/python_tablefile.ipynb (abgerufen am 20.10.2026)
- Metadaten der Tabellen 61111-0002, 61111-0004 und 61111-0006 (Abruf über die GENESIS-API vom 28.09.2026, Sekundärquelle): https://github.com/Bildad123/genesis-pipeline (abgerufen am 20.10.2026)
- GENESIS-Online, Tabelle 61111-0006: https://genesis.destatis.de/datenbank/online/statistic/61111/table/61111-0006 (Titel laut Suchindex geprüft am 20.10.2026; die Seite selbst lädt ihren Inhalt per JavaScript)
- Datenlizenz Deutschland – Namensnennung – Version 2.0: https://www.govdata.de/dl-de/by-2-0 (abgerufen am 21.10.2026)
