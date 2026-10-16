# Genauigkeit KontoKlar

Gemessen mit `pnpm --filter web accuracy` auf `data/k2/testset.json` (198 synthetische, von Hand gelabelte Buchungen, 20 Kategorien). Der Rohbericht liegt in `docs/genauigkeit.json` und enthält auch jeden Fehlfall mit Händlertext (Feld `errors`). Das Skript schreibt den Bericht nur mit `--write` neu (`pnpm --filter web accuracy --write`); ohne den Schalter gibt es die Kennzahlen nur aus. Die API-Stufe (Embedding-kNN und Sprachmodell-Fallback) wird auf einem eigenen Testset gemessen, siehe „API-Stufe: eigenes Testset“; diese Messung steht noch aus.

## Stand 2026-10-07, nur Regel-Engine

| Stufe | Anteil der Buchungen | Accuracy innerhalb der Stufe |
|---|---|---|
| Regel-Engine | 96,5 % (191 von 198) | 99,0 % (189 von 191) |
| Embedding-kNN | nicht gemessen (kein API-Key) | – |
| Sprachmodell-Fallback | nicht gemessen (kein API-Key) | – |
| offen (keine Regel) | 3,5 % (7 von 198) | – |
| Gesamt (offene zählen als falsch) | 100 % | 95,5 % (189 von 198) |

Einordnung: Das Testset ist synthetisch und wurde parallel zum Regelsatz erstellt. Die hohe Regelabdeckung (96,5 % statt der geplanten etwa 70 %) sagt deshalb vor allem, dass Regeln und Testset zueinander passen, nicht, wie gut die Regeln auf einer echten Kontohistorie greifen. Der belastbare Wert entsteht erst mit einer anonymisierten echten CSV; siehe „Offen“.

## Precision und Recall je Kategorie

| Kategorie | n | Precision | Recall |
|---|---|---|---|
| Lebensmittel | 20 | 100 % | 100 % |
| Mobilität | 17 | 100 % | 100 % |
| Restaurants & Cafés | 16 | 100 % | 100 % |
| Freizeit & Kultur | 16 | 100 % | 88 % |
| Abos & Medien | 15 | 100 % | 100 % |
| Drogerie & Haushalt | 11 | 92 % | 100 % |
| Kleidung | 11 | 100 % | 100 % |
| Gesundheit | 9 | 100 % | 89 % |
| Online-Handel | 9 | 100 % | 100 % |
| Wohnen | 8 | 100 % | 100 % |
| Versicherungen | 8 | 100 % | 100 % |
| Einkommen | 8 | 100 % | 100 % |
| Energie | 7 | 88 % | 100 % |
| Telekommunikation | 7 | 100 % | 100 % |
| Bildung | 7 | 100 % | 100 % |
| Reisen | 7 | 100 % | 100 % |
| Umbuchung | 6 | 100 % | 100 % |
| Sonstiges | 6 | – | 0 % |
| Bargeld | 5 | 100 % | 100 % |
| Gebühren & Zinsen | 5 | 100 % | 100 % |

## Fehlerliste

Alle 9 Fehlfälle aus `docs/genauigkeit.json` (Feld `errors`), gruppiert nach Wahrheit und Vorhersage:

| Anzahl | Wahrheit | Vorhersage | Händlertext | Ursache |
|---|---|---|---|---|
| 6 | Sonstiges | offen | Franz Huber Schreinerei; Erika Musterfrau; Deutsches Rotes Kreuz; Landeshauptstadt Muenchen; Stadt Muenchen KVR; Foto Meyer | erwartet: keine Regel, Fall für Embedding oder Fallback |
| 1 | Freizeit & Kultur | offen | TSV Musterstadt e.V. | Mitgliedsbeitrag steht nur im Verwendungszweck, die Freizeit-Regel prüft nur den Händler |
| 1 | Freizeit & Kultur | Energie | Stadtwerke Muenchen Baeder | Energie-Regel greift vor Freizeit (Muster STADTWERKE) |
| 1 | Gesundheit | Drogerie & Haushalt | Sanitaetshaus Mueller | Muster MUELLER der Drogerie-Regel greift vor der Gesundheitsregel |

## API-Stufe: eigenes Testset

Warum ein eigenes Set: Im Regel-Testset stehen 113 der 198 Händlerschlüssel wörtlich oder als Präfix in `data/k2/labeled-examples.json`. An die API gingen von dort nur die 4 Texte ohne Regeltreffer, die `isApiEligible` zulässt (TSV MUSTERSTADT, DEUTSCHES ROTES KREUZ, STADT MUENCHEN KVR, FOTO MEYER); davon steht 1 im Beispielset (DEUTSCHES ROTES KREUZ). Mit 4 Texten sagt eine Messung wenig über die Embedding-Stufe, und ein Text, der wörtlich im Beispielset steht, hat sich selbst als nächsten Nachbarn und schönt das Ergebnis. Entschieden am 08.10.2026: Die Sperre bleibt streng, die API-Stufe bekommt ein eigenes, zum Beispielset disjunktes Testset. `pnpm --filter web accuracy` gibt die Überschneidung des Regel-Testsets weiter aus.

Das Set: `data/k2/testset-api.json`, 95 synthetische Buchungen, je 5 in den 19 Kategorien, die an die API gehen können (alle außer Einkommen, denn Gutschriften gehen nie an die API). Es enthält nur Ausgaben, die keine Regel trifft und die `isApiEligible` zulässt, also genau die Buchungen, deren normalisierter Händlerteil an Embedding und Sprachmodell ginge: 42 Kartenzahlungen, 36 Lastschriften, 13 Überweisungen und 4 Daueraufträge, darunter 2 PayPal-Einkäufe (Händler aus „Ihr Einkauf bei …“). Alle Händler sind frei erfunden und tragen ein Firmenkennzeichen (GmbH, AG, KG, UG, e.V., OHG, Ltd, mbH, S.A.); bei den beiden PayPal-Einkäufen ist PayPal Europe der Empfänger, an die API geht nur der erfundene Händler aus „Ihr Einkauf bei …“. Die Verwendungszwecke sind plausibel, aber erfunden. Jeder Händlerschlüssel kommt genau einmal vor, aus 95 Buchungen werden also 95 Texte.

Wer es erstellt hat: Buchungen und Labels stammen von Claude (KI-Assistent von Anthropic), erstellt am 08.10.2026 im Auftrag des Autors. Gelabelt ist die ganze Buchung mit Verwendungszweck, nach den Kategoriedefinitionen im Feld `labelingGuide` der Datei; sie folgen den Mustern je Kategorie in `data/k2/rules.json` und den Beispielen in `data/k2/labeled-examples.json`. Eine stichprobenartige Prüfung der Labels durch den Autor steht aus (Feld `review`). Grenzfälle, die man auch anders labeln könnte: das Bergsportgeschäft (Freizeit & Kultur wie die Sportgeschäfte in den Regeln, nicht Kleidung), die Inselfähre (Reisen wie die Fähren in den Regeln, nach COICOP wäre es Verkehr), Kryptobörse, Depot- und Anlagekonten (Umbuchung wie die Broker in den Regeln), der Paketshop (Sonstiges wie die Paketdienste im Beispielset) und die Mahngebühr an einen Inkassodienst (FORDERUNGSMANAGEMENT RHEIN, Gebühren & Zinsen; der Name deutet das Inkasso nur an).

Prüfung: `pnpm --filter web accuracy` prüft das Set bei jedem Lauf ohne API-Aufruf und meldet jeden Befund: Regeltreffer, nicht von `isApiEligible` zugelassen, leerer oder doppelter Händlerschlüssel und jede Überschneidung mit dem Beispielset, wörtlich, als Präfix eines Beispieltexts oder mit einem Beispieltext als Präfix (`prefixOverlap`, `checkApiTestset` in `apps/web/lib/kontoklar/accuracy.ts`). Das ist strenger als die Zählung für das Regel-Testset, die nur die ersten beiden Fälle zählt. `--api` bricht bei einem Befund ab und prüft vor der Messung zusätzlich gegen die Texte in `data/k2/labeled-embeddings.json`. Dieselben Bedingungen, die Größe und die Verteilung prüfen die Unit-Tests in `accuracy.test.ts`.

Einordnung: An die API geht nur der Händlerschlüssel, nie der Verwendungszweck (Regel 1 in `CLAUDE.md`). Bis auf die 3 Buchungen unter „Obergrenze“ sind die Namen deshalb so gewählt, dass das Label aus dem Händlerschlüssel allein folgt. Viele enthalten ein Regelwort als Teil eines zusammengesetzten Worts, das die Regeln wegen der Wortgrenzen (`\b`) nicht erkennen: FEINBAECKEREI SOMMERFELD (BAECKEREI, Lebensmittel), INSELFAEHRE NORDRIFF (FAEHRE, Reisen), ALLERLEI VERSANDKONTOR (VERSAND, Online-Handel) und ROLLERVERLEIH STADTFLITZER (ROLLER, ein Muster der Regel für Drogerie & Haushalt; das Label ist Mobilität). Andere geben nur einen Hinweis auf die Branche (HEIMWERKERZENTRUM BRANDT, LICHTSPIELHAUS STERNENZELT, LINDWURM ASSEKURANZ, KAPITALHAFEN DEPOT). In Wohnen und Energie sind die Verwendungszwecke bewusst so formuliert, dass sie keine Regel treffen („Mietzahlung“ statt „Miete“), denn sonst erreichte die Buchung die API nie. Das Set misst also die Fälle, für die die API-Stufe da ist, nicht deren Anteil in echten Kontoauszügen. Weil dasselbe Modell die Namen erfunden hat, das auch das Beispielset kennt, kann das Set leichter oder schwerer sein als echte unbekannte Händler. Bei 95 Buchungen verschiebt ein Fehlfall die Accuracy um gut einen Prozentpunkt (1/95 ≈ 1,05 Prozentpunkte), in einer Kategorie mit 5 Buchungen den Recall um 20 Prozentpunkte; die Werte je Kategorie sind entsprechend grob.

Obergrenze: Bei 3 der 95 Buchungen folgt das Label nur aus dem Verwendungszweck; sie tragen `labelFromPurpose: true` und liegen alle in Gebühren & Zinsen. KARTENWERK PAYMENTS („Jahresentgelt Kreditkarte“) ist dem Namen nach ein Zahlungsdienst, RATENKAUF FINANZ („Zinsen Finanzierung …“) ein Ratenkaufanbieter wie KLARNA, das im Beispielset unter Online-Handel steht, und ABRECHNUNGSZENTRUM WESER („Rücklastschriftgebühr“) gibt im Namen keinen Hinweis. Solche Buchungen kommen vor: Entgelte und Zinsen von Banken erkennt meist schon die Regel-Engine, bei anderen Empfängern steht die Art der Zahlung oft nur im Verwendungszweck. Die API-Stufe kann sie nur durch Zufall oder eine Vermutung richtig einordnen. Trifft sie keine der drei, liegt die Gesamt-Accuracy höchstens bei 92 von 95 (96,8 %) und der Recall von Gebühren & Zinsen höchstens bei 2 von 5 (40 %). `--api` gibt Accuracy, Precision und Recall deshalb zusätzlich ohne diese Buchungen aus (`evaluateWithoutPurposeLabels`, im Bericht Feld `withoutLabelFromPurpose`); `accuracy.test.ts` rechnet die Obergrenze mit einem Fallback nach, der nur diese drei verfehlt. Im Set bleiben sie, weil sie zeigen, was die API-Stufe grundsätzlich nicht wissen kann.

Stand 08.10.2026: noch nicht gemessen. Es fehlen `OPENAI_API_KEY` und `data/k2/labeled-embeddings.json`. Ohne Schlüssel prüft `pnpm --filter web accuracy --api` das Set und endet danach mit Exit 1 und dem Hinweis, dass `--api` den Schlüssel braucht. Mit Schlüssel: zuerst `pnpm --filter web embeddings:build`, dann `pnpm --filter web accuracy --api --write`. Der Bericht landet in `docs/genauigkeit-api.json`, einer eigenen Datei, damit `docs/genauigkeit.json`, das README und die Statuszeile der Projektseite weiter die Regel-Engine beschreiben. Das Mindestmaß `KONTOKLAR_MIN_RULE_ACCURACY` gilt nur für den Lauf ohne `--api`. Kosten der Messung: 95 Texte × etwa 8 Token ≈ 760 Token, beim in `scripts/build-embeddings.ts` angenommenen Preis von 0,02 $ je Million Token für `text-embedding-3-small` unter 0,0001 $; das Sprachmodell (GPT-5 nano) bekommt in einem Aufruf nur die Texte unter Konfidenz 0,50.

## Änderungen

- 08.10.2026: Eigenes Testset für die API-Stufe (`data/k2/testset-api.json`, 95 Buchungen), Prüfung der Disjunktheit (`checkApiTestset`) bei jedem Lauf und in den Unit-Tests. `--api` misst nur noch auf diesem Set und schreibt mit `--write` nach `docs/genauigkeit-api.json`; vorher hätte es das Regel-Testset verwendet und wegen der Überschneidung mit dem Beispielset abgebrochen. Ohne `labeled-embeddings.json` bricht `--api` jetzt ab, statt nur den Fallback zu messen. Buchungen, deren Label nur aus dem Verwendungszweck folgt, tragen `labelFromPurpose`; `--api` gibt die Kennzahlen zusätzlich ohne sie aus. Die Messung der Regel-Engine ist unverändert (gleiche Zahlen; `docs/genauigkeit.json` wurde nicht neu geschrieben).
- 07.10.2026: Regeln mit dem Feld `merchant` (und `any`) prüfen zusätzlich den Empfängernamen mit Ziffern (`normalizeForRules`, bei PayPal-Einkäufen den Händler aus „Ihr Einkauf bei …“). Vorher entfernte die Händler-Normalisierung die Ziffern, sodass Muster wie BLUME 2000, HUK24, CHECK24, HOME24, OFFICE 365 oder TSV 1860 nie greifen konnten. Folge auf dem Testset: „Blume 2000“ ist jetzt richtig (Drogerie & Haushalt), sonst keine Änderung. Regelabdeckung 96,0 % → 96,5 %, Accuracy auf zugeordneten Buchungen 98,9 % → 99,0 %, gesamt 94,9 % → 95,5 %, Drogerie & Haushalt Precision 91 % → 92 % und Recall 91 % → 100 %. Die frühere Fehlerliste ordnete außerdem zwei Fälle falsch zu: Offen in Drogerie & Haushalt war „Blume 2000“, nicht „Waschsalon Schwabing“ (wird schon richtig erkannt), und offen in Freizeit & Kultur ist „TSV Musterstadt e.V.“, während „Stadtwerke Muenchen Baeder“ der Fall Freizeit → Energie ist.
- 04.09.2026: Die Gebührenregel auf dem Verwendungszweck greift nur noch, wenn der Händler leer ist oder wie eine Bank oder ein Kartenanbieter aussieht (`where: bank-or-empty`, Muster `BANK_PATTERN` in `rules.ts`). Damit entfielen die beiden Fehler „Stadtbibliothek Jahresgebuehr → Gebühren“ und „Personalausweis Gebuehr → Gebühren“; Precision der Gebührenkategorie stieg von 71 % auf 100 %, Gesamt-Accuracy von 94,4 % auf 94,9 %.

## Offen

- Messung mit `--api` auf `data/k2/testset-api.json` (Embedding-kNN und Fallback), sobald `OPENAI_API_KEY` und `data/k2/labeled-embeddings.json` vorliegen; Kennzahlen dann hier und im README nachtragen.
- Stichprobenartige Prüfung der Labels in `data/k2/testset-api.json` durch den Autor.
- Anonymisierte echte CSV (eigene Umsätze, Namen und IBANs entfernt) als zweites Testset, um die Regelabdeckung realistisch zu messen.
