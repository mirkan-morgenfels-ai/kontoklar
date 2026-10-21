# Prüfliste: Labels des API-Testsets

Stand: 21.10.2026. `data/k2/testset-api.json` enthält 95 synthetische Buchungen, je 5 in den 19 Kategorien außer Einkommen. Buchungen und Labels hat Claude (KI-Assistent von Anthropic) am 08.10.2026 erstellt; die stichprobenartige Prüfung durch den Autor steht aus (Feld `review`). Diese Liste macht die Prüfung ohne Blick in die JSON-Datei möglich. Hintergrund, Grenzfälle und Obergrenze stehen in [`genauigkeit.md`](genauigkeit.md#api-stufe-eigenes-testset).

## So prüfen

1. Je Zeile entscheiden, ob das Label zur ganzen Buchung (Empfänger und Verwendungszweck) passt. Maßstab sind die Kategoriedefinitionen im Feld `labelingGuide` der Datei; sie folgen den Mustern in `data/k2/rules.json`.
2. In der Spalte „OK?“ „ja“ eintragen oder die richtige Kategorie (genau wie in `labelingGuide` geschrieben, etwa „Drogerie & Haushalt“). Eine Stichprobe genügt; die mit „Grenzfall“ und „¹“ markierten Zeilen sollten dabei sein.
3. „¹“ heißt `labelFromPurpose: true`: Das Label folgt nur aus dem Verwendungszweck, den die API nie bekommt. Prüfen Sie hier zusätzlich, ob der Empfängername wirklich keinen Hinweis gibt.

Die Spalte „ID“ ist die Position im Array `cases` der Datei, ab 0 gezählt, wie in den Meldungen von `pnpm --filter web accuracy` („Buchung 12 …“). Der Verwendungszweck steht vollständig da (keiner ist länger als 44 Zeichen); „–“ heißt leer. Die Begründung ist die Überlegung beim Labeln, in Kurzform.

## Liste

| ID | Empfänger | Verwendungszweck | Label | Begründung | OK? |
|---|---|---|---|---|---|
| 0 | Feinbäckerei Sommerfeld GmbH | Filiale Ostviertel | Lebensmittel | Bäckerei | |
| 1 | Grünkern Naturkost GmbH | Einkauf Naturkost | Lebensmittel | Naturkostladen | |
| 2 | Fischhandel Möwe OHG | Fisch und Räucherwaren | Lebensmittel | Fischhandel | |
| 3 | Hofkäserei Almgrund KG | Hofverkauf | Lebensmittel | Hofkäserei | |
| 4 | Frischekiste Rheinland GmbH | Gemüsekiste KW 41 Kundennr. 20431 | Lebensmittel | Gemüsekiste (Lieferdienst für Lebensmittel) | |
| 5 | Wohnwerk Einrichtungshaus GmbH | Regal und Kissen | Drogerie & Haushalt | Einrichtungshaus | |
| 6 | Seifenhaus Klarbach GmbH | Seife und Waschmittel | Drogerie & Haushalt | Seife und Waschmittel (Drogerie) | |
| 7 | Heimwerkerzentrum Brandt KG | Werkzeug und Schrauben | Drogerie & Haushalt | Heimwerkermarkt | |
| 8 | Pfotenglück Heimtierbedarf GmbH | Bestellung 58812 Katzenfutter | Drogerie & Haushalt | Tierbedarf | |
| 9 | Gartenwelt Lindenhof GmbH | Pflanzen und Erde | Drogerie & Haushalt | Gartenmarkt | |
| 10 | Zum Goldenen Anker Gastwirtschaft GmbH | Tisch 12 | Restaurants & Cafés | Gastwirtschaft | |
| 11 | Nudelwerkstatt Mitte GmbH | Mittagstisch | Restaurants & Cafés | Restaurant, Mittagstisch | |
| 12 | Teestube Samowar UG | – | Restaurants & Cafés | Teestube | |
| 13 | Grillstation Hafenkante GmbH | – | Restaurants & Cafés | Imbiss | |
| 14 | Mittagsküche Lindner GmbH | Essensabrechnung Oktober | Restaurants & Cafés | Kantine, Essensabrechnung | |
| 15 | Quartiersverwaltung Nordstadt GmbH | Mietzahlung Oktober Whg. 3 OG links | Wohnen | Miete an Hausverwaltung | |
| 16 | Wohnstätten Eichenhof GmbH | Nutzungsgebühr Oktober | Wohnen | Nutzungsentgelt an Wohnungsunternehmen | |
| 17 | Grundbesitz Albrecht KG | Mietzahlung November | Wohnen | Miete an Vermieter | |
| 18 | Möbliert Wohnen Agentur GmbH | Monatsmiete Apartment 12 | Wohnen | möbliertes Wohnen | |
| 19 | Siedlungswerk Hohenacker GmbH | Mietzahlung Dezember | Wohnen | Miete an Wohnungsunternehmen | |
| 20 | Voltwerk Energie GmbH | Abschlag Vertragskonto 4711 | Energie | Strom | |
| 21 | Nordwind Gasversorgung GmbH | Abschlagszahlung Gas Oktober | Energie | Gas | |
| 22 | Wärmenetz Talstadt GmbH | Abschlag Wärme November | Energie | Fernwärme | |
| 23 | Brennstoffhandel Kessler KG | Rechnung 2026-118 Lieferung 1500 Liter | Energie | Heizöl (Brennstoff) | |
| 24 | Wasserversorgung Kaltenbach GmbH | Wassergeld 3. Quartal | Energie | Wasser | |
| 25 | Funkwelle Mobil GmbH | Rechnung Oktober Kundennr. 88231 | Telekommunikation | Mobilfunk | |
| 26 | Glasnetz Weserbergland GmbH | Glasfaser 300 Monatsentgelt | Telekommunikation | Glasfaser-Internet | |
| 27 | Kabelnetz Oberland GmbH | Kabelanschluss Monatsrechnung | Telekommunikation | Kabelanschluss | |
| 28 | Simtaler Prepaid UG | Guthabenaufladung | Telekommunikation | Prepaid-Guthaben | |
| 29 | Netzanker Kommunikation GmbH | Tarif Komfort 50 GB | Telekommunikation | Mobilfunktarif | |
| 30 | Autoservice Brenner GmbH | Inspektion und Ölwechsel | Mobilität | Kfz-Werkstatt | |
| 31 | Kraftstoff Weber OHG | Zapfsäule 4 | Mobilität | Tankstelle | |
| 32 | Talbus Linienverkehr GmbH | Abo Monatsticket Zone A | Mobilität | Nahverkehr | |
| 33 | Ladepunkt Mitte GmbH | Ladevorgang 32 kWh | Mobilität | Laden eines Elektroautos | |
| 34 | Rollerverleih Stadtflitzer UG | Fahrt 14 Minuten | Mobilität | Rollerverleih (Muster ROLLER gehört sonst zu Drogerie & Haushalt) | |
| 35 | Klangraum Musikstreaming GmbH | Monatsabo Premium | Abos & Medien | Musikstreaming | |
| 36 | Filmhafen Digital GmbH | Monatsabo | Abos & Medien | Filmstreaming | |
| 37 | Tagesbote Mediengruppe GmbH | Digitalabo E-Paper Oktober | Abos & Medien | Zeitung (E-Paper) | |
| 38 | Wolkenspeicher Software Ltd | Speicherplan 200 GB | Abos & Medien | Cloud-Speicher-Abo | |
| 39 | Hörbuchwerk Merlin GmbH | Abo Hörbuch Monat | Abos & Medien | Hörbuch-Abo | |
| 40 | Kletterwerk Nordwand GmbH | Tageseintritt | Freizeit & Kultur | Kletterhalle | |
| 41 | Lichtspielhaus Sternenzelt GmbH | 2 Eintrittskarten | Freizeit & Kultur | Kino | |
| 42 | Bergsport Gipfelglück GmbH | Kletterseil und Karabiner | Freizeit & Kultur | Grenzfall: Sportgeschäft wie in den Regeln, nicht Kleidung | |
| 43 | PayPal Europe S.a.r.l. et Cie S.C.A | Ihr Einkauf bei Brettspielkontor Meeple UG | Freizeit & Kultur | Spielwaren; PayPal-Einkauf, an die API geht nur der Händler | |
| 44 | Tanzwerkstatt Pirouette e.V. | Kursgebühr Oktober | Freizeit & Kultur | Kursbeitrag Hobby (Tanz) | |
| 45 | Strickmanufaktur Lindgren GmbH | Pullover | Kleidung | Strickwaren | |
| 46 | Schuhwerk Albers KG | – | Kleidung | Schuhe | |
| 47 | Denimhalle Wagner GmbH | – | Kleidung | Jeans | |
| 48 | Kinderkleiderkiste Gänseblümchen UG | – | Kleidung | Kinderkleidung | |
| 49 | Herrenausstatter Falk GmbH | Anzug inklusive Änderung | Kleidung | Herrenausstatter | |
| 50 | Zahnmedizin am Schlossberg GmbH | Rechnung 2026-0412 Zahnreinigung | Gesundheit | Zahnarztpraxis | |
| 51 | Hörwelt Akustik GmbH | Batterien Hörgerät | Gesundheit | Hörakustik | |
| 52 | Sehzentrum Kaiser GmbH | Gleitsichtgläser Anzahlung | Gesundheit | Optiker | |
| 53 | Medlabor Süd GmbH | Rechnung Laborleistungen | Gesundheit | Labor | |
| 54 | Rückenzentrum Bewegungsraum GmbH | Krankengymnastik 6 Termine | Gesundheit | Physiotherapie | |
| 55 | Hanseschild Sachschutz AG | Beitrag Hausrat Police 55-1234 | Versicherungen | Hausratversicherung | |
| 56 | Lindwurm Assekuranz AG | Kfz-Haftpflicht Beitrag Oktober | Versicherungen | Kfz-Versicherung | |
| 57 | Edelweiß Lebensvorsorge AG | Beitrag Risikoleben | Versicherungen | Risikolebensversicherung (laut Leitfaden Versicherungen, nicht im VPI) | |
| 58 | Justitia Schutzbrief AG | Jahresbeitrag Schutzbrief | Versicherungen | Schutzbrief | |
| 59 | Kompass Reiseschutz AG | Jahresbeitrag Auslandsreise | Versicherungen | Auslandsreiseversicherung | |
| 60 | Lernwerk Mathe-Hilfe UG | Unterricht Oktober | Bildung | Nachhilfe | |
| 61 | Sprachatelier Babel GmbH | Kursgebühr Italienisch A2 | Bildung | Sprachschule | |
| 62 | Lehrbuchverlag Kepler GmbH | Lehrbuch Analysis | Bildung | Lehrbuchverlag | |
| 63 | Kinderhaus Sonnenblume e.V. | Betreuungsbeitrag November | Bildung | Kinderhaus (Betreuung) | |
| 64 | Codeschmiede Lernplattform GmbH | Kurs Python Grundlagen | Bildung | Online-Kurs | |
| 65 | Ferienhof Birkenweg GmbH | Anzahlung Aufenthalt August | Reisen | Ferienhof | |
| 66 | Seeblick Unterkünfte GmbH | 2 Nächte | Reisen | Unterkunft | |
| 67 | Fernweh Reisen GmbH | Restzahlung Rundreise Schottland | Reisen | Rundreise | |
| 68 | Inselfähre Nordriff GmbH | Überfahrt mit Pkw | Reisen | Grenzfall: Fähre wie in den Regeln, nach COICOP Verkehr | |
| 69 | Dünenpark Ferienhäuser KG | Buchung 4471 Ferienhaus | Reisen | Ferienhaus | |
| 70 | Allerlei Versandkontor GmbH | Bestellung 300412 | Online-Handel | Versandhaus | |
| 71 | Kaufhafen Onlinehandel GmbH | Bestellung 88-1290 | Online-Handel | Onlineshop | |
| 72 | PayPal Europe S.a.r.l. et Cie S.C.A | Ihr Einkauf bei Bunterkram Webversand GmbH | Online-Handel | Webversand mit gemischtem Sortiment; PayPal-Einkauf | |
| 73 | Fernkauf Direkt AG | Bestellung 51177 | Online-Handel | Versandhandel | |
| 74 | Nordlicht Webkaufhaus GmbH | Rechnung 77812 | Online-Handel | Webkaufhaus | |
| 75 | Northgate Cashpoint Ltd | Abhebung GBP 50,00 Kurs 1,1990 | Bargeld | Geldautomat im Ausland | |
| 76 | Devisenkontor Hanse GmbH | Sortenkauf CHF | Bargeld | Sortenkauf | |
| 77 | Geldwerk Cash Services GmbH | Auszahlung Automat Hauptbahnhof | Bargeld | Geldautomat | |
| 78 | Wechselstube Alpenblick AG | Geldwechsel EUR in CHF | Bargeld | Geldwechsel | |
| 79 | Telecajero Sol S.A. | Abhebung Automat Málaga | Bargeld | Geldautomat im Ausland | |
| 80 | Kartenwerk Payments GmbH | Jahresentgelt Kreditkarte | Gebühren & Zinsen ¹ | Jahresentgelt Kreditkarte; Label nur aus dem Verwendungszweck | |
| 81 | Forderungsmanagement Rhein GmbH | Mahngebühr Vorgang 2026-5531 | Gebühren & Zinsen | Grenzfall: Mahngebühr an Inkassodienst | |
| 82 | Ratenkauf Finanz AG | Zinsen Finanzierung Vertrag 8812 | Gebühren & Zinsen ¹ | Finanzierungszinsen; Label nur aus dem Verwendungszweck | |
| 83 | Zahlwerk Kontoservice GmbH | Grundpreis Kontomodell Oktober | Gebühren & Zinsen | Kontoentgelt | |
| 84 | Abrechnungszentrum Weser GmbH | Rücklastschriftgebühr | Gebühren & Zinsen ¹ | Rücklastschriftgebühr; Label nur aus dem Verwendungszweck | |
| 85 | Kapitalhafen Depot AG | Sparrate ETF | Umbuchung | Grenzfall: Sparrate ins Depot | |
| 86 | Tresorwerk Invest GmbH | Aufladung Verrechnungskonto | Umbuchung | Grenzfall: Aufladung Verrechnungskonto | |
| 87 | Münzhort Krypto GmbH | Kauf Guthaben | Umbuchung | Grenzfall: Kryptobörse | |
| 88 | Sparwerk Anlageverwaltung GmbH | Monatliche Anlage Portfolio 3 | Umbuchung | Grenzfall: Anlagekonto | |
| 89 | Fondsdepot Weitblick KG | Zuzahlung Depot 44120 | Umbuchung | Grenzfall: Zuzahlung Depot | |
| 90 | Haarmanufaktur Lenz GmbH | Schneiden und Föhnen | Sonstiges | Friseur | |
| 91 | Kanzlei Brenner Steuerberatungsgesellschaft mbH | Rechnung Einkommensteuererklärung 2025 | Sonstiges | Steuerberatung | |
| 92 | Hilfswerk Brunnenbau e.V. | Spende Oktober | Sonstiges | Spende | |
| 93 | Paketpunkt Nordstern GmbH | Paketversand | Sonstiges | Grenzfall: Paketdienst wie im Beispielset | |
| 94 | Tischlerei Holzmann GmbH | Rechnung 2026-77 Reparatur Tür | Sonstiges | Handwerker | |

¹ `labelFromPurpose: true`

## Korrekturen eintragen

1. In `data/k2/testset-api.json` bei der Buchung mit der jeweiligen ID (Position in `cases`) den Wert `label` ändern. Folgt das Label danach nur noch oder nicht mehr nur aus dem Verwendungszweck, `"labelFromPurpose": true` ergänzen bzw. entfernen.
2. Das Feld `review` neu schreiben, zum Beispiel: „Stichprobe von 30 der 95 Buchungen am TT.MM.JJJJ durch den Autor geprüft, 1 Label geändert (ID 42: Freizeit & Kultur → Kleidung), übrige bestätigt.“ Ohne Änderung: „Stichprobe von 30 der 95 Buchungen am TT.MM.JJJJ durch den Autor geprüft, alle Labels bestätigt.“ Das Wort „Autor“ muss stehen bleiben (der Unit-Test prüft die Herkunftsangabe).
3. Die Zeile in dieser Liste anpassen oder „OK?“ ausgefüllt lassen, damit die Prüfung nachvollziehbar bleibt.

## Danach ausführen

```powershell
$env:PATH = "$env:LOCALAPPDATA\Programs\nodejs;$env:PATH"
pnpm --filter web accuracy
pnpm test
```

- `pnpm --filter web accuracy` prüft das Set ohne API-Aufruf (Regeltreffer, Zulässigkeit, doppelte Händlerschlüssel, Überschneidung mit dem Beispielset) und gibt die Zusammenfassung aus („95 Buchungen in 19 Kategorien (je 5) …“). Die Kennzahlen der Regel-Engine ändert eine Korrektur nicht.
- `pnpm test` enthält Tests, die die Verteilung und die Texte in `docs/genauigkeit.md` und im README nachrechnen. Wandert ein Label in eine andere Kategorie, sind die Kategorien nicht mehr gleich groß (etwa 4 und 6), und der Test „genauigkeit.md names its size, the per-category count …“ schlägt fehl; ändert sich die Zahl der Buchungen mit `labelFromPurpose`, schlagen die Tests zur Obergrenze (96,8 %) fehl. Dann `docs/genauigkeit.md` und den README-Abschnitt „Genauigkeit“ anpassen (Satz „je 5 in den 19 Kategorien“, Obergrenze) und bei Bedarf eine Buchung ergänzen oder tauschen, damit die Kategorien wieder ausgeglichen sind; das kann Claude übernehmen.
- Ist die API-Stufe schon gemessen (`docs/genauigkeit-api.json` vorhanden), danach `pnpm --filter web accuracy --api --write` erneut ausführen (braucht `OPENAI_API_KEY`, siehe [`einrichtung-api.md`](einrichtung-api.md)) und die Kennzahlen in `docs/genauigkeit.md` und im README nachziehen.
