# Genauigkeit KontoKlar

Gemessen mit `pnpm --filter web accuracy` auf `data/k2/testset.json` (198 synthetische, von Hand gelabelte Buchungen, 20 Kategorien). Der Rohbericht liegt in `docs/genauigkeit.json` und enthält auch jeden Fehlfall mit Händlertext (Feld `errors`). Das Skript schreibt den Bericht nur mit `--write` neu (`pnpm --filter web accuracy --write`); ohne den Schalter gibt es die Kennzahlen nur aus.

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

## Änderungen

- 07.10.2026: Regeln mit dem Feld `merchant` (und `any`) prüfen zusätzlich den Empfängernamen mit Ziffern (`normalizeForRules`, bei PayPal-Einkäufen den Händler aus „Ihr Einkauf bei …“). Vorher entfernte die Händler-Normalisierung die Ziffern, sodass Muster wie BLUME 2000, HUK24, CHECK24, HOME24, OFFICE 365 oder TSV 1860 nie greifen konnten. Folge auf dem Testset: „Blume 2000“ ist jetzt richtig (Drogerie & Haushalt), sonst keine Änderung. Regelabdeckung 96,0 % → 96,5 %, Accuracy auf zugeordneten Buchungen 98,9 % → 99,0 %, gesamt 94,9 % → 95,5 %, Drogerie & Haushalt Precision 91 % → 92 % und Recall 91 % → 100 %. Die frühere Fehlerliste ordnete außerdem zwei Fälle falsch zu: Offen in Drogerie & Haushalt war „Blume 2000“, nicht „Waschsalon Schwabing“ (wird schon richtig erkannt), und offen in Freizeit & Kultur ist „TSV Musterstadt e.V.“, während „Stadtwerke Muenchen Baeder“ der Fall Freizeit → Energie ist.
- 04.09.2026: Die Gebührenregel auf dem Verwendungszweck greift nur noch, wenn der Händler leer ist oder wie eine Bank oder ein Kartenanbieter aussieht (`where: bank-or-empty`, Muster `BANK_PATTERN` in `rules.ts`). Damit entfielen die beiden Fehler „Stadtbibliothek Jahresgebuehr → Gebühren“ und „Personalausweis Gebuehr → Gebühren“; Precision der Gebührenkategorie stieg von 71 % auf 100 %, Gesamt-Accuracy von 94,4 % auf 94,9 %.

## Offen

- Überschneidung von Test- und Beispielset: 113 der 198 Händlerschlüssel des Testsets stehen wörtlich oder als Präfix in `data/k2/labeled-examples.json`. Mit `--api` eingebettet würden aber nur die 4 Texte ohne Regeltreffer, die `isApiEligible` zulässt (TSV MUSTERSTADT, DEUTSCHES ROTES KREUZ, STADT MUENCHEN KVR, FOTO MEYER); davon steht 1 im Beispielset (DEUTSCHES ROTES KREUZ). `pnpm --filter web accuracy` gibt beide Zahlen aus. Mit `--api` bricht das Skript bewusst schon bei einer Überschneidung im ganzen Testset ab; ob die Sperre nur für die eingebetteten Texte gelten soll, ist noch offen.
- Messung mit `--api` (Embedding-kNN und Fallback), sobald `OPENAI_API_KEY` und `data/k2/labeled-embeddings.json` vorliegen. Kosten der Messung: 4 Texte × etwa 8 Token ≈ 32 Token, für Embeddings unter 0,00001 $; Fallback nur für Texte unter Konfidenz 0,50.
- Anonymisierte echte CSV (eigene Umsätze, Namen und IBANs entfernt) als zweites Testset, um die Regelabdeckung realistisch zu messen.
