# Prüfung mit einem echten DKB-Export

Stand: 21.10.2026. Ziel: klären, welches Datumsformat und welchen Aufbau der echte CSV-Export der DKB heute hat (offener Punkt in `CLAUDE.md`), ohne dass Kontodaten den Rechner verlassen oder ins Repository gelangen.

## Was bisher bekannt ist

- Der DKB-Parser (`packages/csv/src/parsers/dkb.ts`) erkennt das Format des 2023 eingeführten Bankings an der Kopfzeile `"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";…` mit Semikolon, liest Datumswerte als TT.MM.JJJJ und als TT.MM.JJ und den Betrag aus `Betrag (€)`. Das ältere Format mit `Buchungstag` wird ebenfalls erkannt.
- Die Testdatei `packages/csv/fixtures/dkb.csv` ist synthetisch; welches Datumsformat der echte Export nutzt, ist unbestätigt.
- Hinweise aus quelloffenen Importern für DKB-Exporte (Sekundärquellen, keine Angaben der DKB): beancount-dkb liest im neuen Format `Buchungsdatum` als TT.MM.JJ, die Kopfzeilen über der Tabelle (`"Girokonto";"<IBAN>"`, `"Kontostand vom TT.MM.JJJJ:";…`) mit vierstelligem Jahr und die Datei als UTF-8 mit BOM. Laut Änderungsprotokoll stellte die DKB im Herbst 2024 das Trennzeichen kurz auf Komma um und kehrte im November 2024 zum Semikolon zurück; beancount-dkb akzeptiert seitdem beides. KontoKlar erkennt derzeit nur das Semikolon.
- Eine offizielle Anleitung der DKB zum CSV-Export fand die Recherche am 21.10.2026 nicht. Der Weg unten folgt der Oberfläche des Bankings seit 2023 (laut dkb2homebank „new web portal introduced in 2023“); die genauen Bezeichnungen können abweichen.

## Schritt 1: Export herunterladen

1. Im DKB-Banking im Browser anmelden (die Anmeldung nehmen Sie selbst vor).
2. Das Girokonto öffnen und die Umsatzliste anzeigen.
3. Einen Zeitraum wählen, der Buchungen aus mehreren Monaten und mindestens einen Tag mit ein- und zweistelligem Tag und Monat enthält (etwa 01.09. bis 15.10.).
4. Über das Symbol zum Herunterladen bzw. Exportieren das Format CSV wählen. Die Datei heißt erfahrungsgemäß ähnlich wie `TT-MM-JJJJ_Umsatzliste_Girokonto_<IBAN>.csv`; der Dateiname enthält also die IBAN.
5. Die Datei außerhalb des Repository-Ordners speichern, zum Beispiel unter `Downloads`, und nicht in OneDrive-synchronisierte Projektordner kopieren.

## Schritt 2: Lokal prüfen

Variante A, ohne Kommandozeile: https://kontoklar-eight.vercel.app/projects/kontoklar öffnen, den API-Schritt ausgeschaltet lassen (Standard) und die Datei hochladen. Die Datei bleibt im Browser; ohne API-Schritt geht keine Anfrage mit Inhalten an den Server (das prüft auch die E2E). Erwartung: „Ergebnis für <Dateiname>“, keine Meldung „Format nicht erkannt“, Buchungsdaten in der Prüftabelle plausibel (kein Datum im Jahr 1926 oder 0026).

Variante B, Prüfskript (gibt nur Aufbau und Zählwerte aus, keine Inhalte, keine IBAN, keine Namen, keinen Dateinamen):

```powershell
$env:PATH = "$env:LOCALAPPDATA\Programs\nodejs;$env:PATH"
pnpm --filter web dkb:check "$env:USERPROFILE\Downloads\<Dateiname>.csv"
```

Das Skript (`apps/web/scripts/check-dkb.ts`, Logik in `apps/web/lib/kontoklar/csv-check.ts`) meldet:

- Dateityp, Größe, Kodierung (UTF-8 mit oder ohne BOM, sonst Windows-1252) und Zeilenenden,
- die Zeilennummer der Kopfzeile und wie viele Zeilen davor stehen (deren Inhalt nicht),
- Trennzeichen und die Spaltennamen der Kopfzeile,
- je Datumsspalte (`Buchungsdatum`, `Wertstellung`, beim alten Format `Buchungstag`) die Anzahl der Werte als TT.MM.JJJJ, TT.MM.JJ, JJJJ-MM-TT, leer oder anderes und wie viele der Parser nicht lesen kann,
- die erkannte Bank und wie viele Buchungen der Parser liest bzw. überspringt,
- Befunde: anderes Trennzeichen als „;“, fehlende oder zusätzliche Spalten gegenüber dem bekannten Format, nicht lesbare oder abweichende Datumswerte, übersprungene Zeilen, Kodierung.

Exit-Code 0 heißt „keine Abweichung“, 1 heißt „Befunde“, 2 „kein Pfad angegeben“. Die Ausgabe darf in ein Issue oder einen Chat kopiert werden; sie enthält nur Spaltennamen und Zahlen.

## Worauf achten

- Datumsformat: Stehen in `Buchungsdatum` nur TT.MM.JJ-Werte, ist der offene Punkt geklärt (zweistelliges Jahr, der Parser ergänzt „20“). Gemischte Formate sind ebenfalls lesbar.
- Kopfzeilen: Die Spalten sollten genau den 12 bekannten entsprechen (`Buchungsdatum`, `Wertstellung`, `Status`, `Zahlungspflichtige*r`, `Zahlungsempfänger*in`, `Verwendungszweck`, `Umsatztyp`, `IBAN`, `Betrag (€)`, `Gläubiger-ID`, `Mandatsreferenz`, `Kundenreferenz`). Zusätzliche Spalten stören den Parser nicht, fehlende oder umbenannte schon, wenn sie Datum, Betrag, Empfänger oder Verwendungszweck betreffen.
- Trennzeichen: Meldet das Skript „,“, erkennt KontoKlar die Datei nicht als DKB-Export und bietet nur die Spaltenzuordnung an.
- Kodierung: Erwartet ist UTF-8 mit BOM. Windows-1252 liest KontoKlar auch; Umlaute im Empfänger sollten dann trotzdem richtig erscheinen (Variante A).
- Vorgemerkte Umsätze (`Status` „Vorgemerkt“) übernimmt der Parser wie gebuchte.

## Wenn etwas abweicht

1. Die Ausgabe des Prüfskripts sichern (ohne Datei).
2. Eine anonymisierte Testdatei anlegen, die den echten Aufbau exakt nachbildet: dieselben Zeilen vor der Kopfzeile (Inhalte ersetzt, etwa `"Girokonto";"DE00000000000000000000"`), dieselbe Kopfzeile, dasselbe Trennzeichen, dieselbe Kodierung und dieselben Datums- und Betragsformate, aber nur erfundene Buchungen (Namen wie „Max Mustermann“, IBANs aus Nullen, Beträge erfunden). Keine echten Zeilen kopieren und kürzen, sondern neu schreiben.
3. Die Datei als `packages/csv/fixtures/dkb-<monat>-<jahr>.csv` ablegen und das Prüfskript darauf laufen lassen: Es muss dieselben Befunde zeigen wie beim echten Export.
4. Den Parser anpassen (etwa Komma als Trennzeichen erkennen) und einen Test in `packages/csv/src/__tests__/parsers.test.ts` ergänzen, der die neue Datei liest; danach `pnpm test`, `pnpm accuracy`, `pnpm build` und `pnpm test:e2e`.
5. Den Befund in `CLAUDE.md` (offene Punkte) und im README-Abschnitt „Unterstützte Banken“ nachtragen.

Stimmt alles, genügt Schritt 5 mit dem Ergebnis (etwa „DKB-Export vom TT.MM.JJJJ: Buchungsdatum TT.MM.JJ, Semikolon, UTF-8 mit BOM, 12 Spalten“). Die echte Datei danach löschen oder sicher aufbewahren; sie gehört nie ins Repository.

## Quellen

- beancount-dkb, Extractor für das neue DKB-Format (`beancount_dkb/extractors/ec.py`, Datumsformat `%d.%m.%y`, Kodierung `utf-8-sig`, Trennzeichen „,“ und „;“) und Änderungsprotokoll (v1.1.0 und v1.3.0): https://github.com/siddhantgoel/beancount-dkb (abgerufen am 20.10.2026)
- beancount-dkb, Issue #195 „delimiter changed to semi-colon“ (03.11.2024): https://github.com/siddhantgoel/beancount-dkb/issues/195 (abgerufen am 20.10.2026)
- dkb2homebank, README (DKB Giro „as of the new web portal introduced in 2023“): https://github.com/hamvocke/dkb2homebank (abgerufen am 20.10.2026)
