# Genauigkeit KontoKlar

Gemessen mit `pnpm --filter web accuracy` auf `data/k2/testset.json` (198 synthetische, von Hand gelabelte Buchungen, 20 Kategorien). Der Rohbericht liegt in `docs/genauigkeit.json`.

## Stand 2026-09-04, nur Regel-Engine

| Stufe | Anteil der Buchungen | Accuracy innerhalb der Stufe |
|---|---|---|
| Regel-Engine | 96,0 % | 98,9 % |
| Embedding-kNN | nicht gemessen (kein API-Key) | – |
| Sprachmodell-Fallback | nicht gemessen (kein API-Key) | – |
| offen (keine Regel) | 4,0 % | – |
| Gesamt (offene zählen als falsch) | 100 % | 94,9 % |

Einordnung: Das Testset ist synthetisch und wurde parallel zum Regelsatz erstellt. Die hohe Regelabdeckung (96,0 % statt der geplanten etwa 70 %) sagt deshalb vor allem, dass Regeln und Testset zueinander passen, nicht, wie gut die Regeln auf einer echten Kontohistorie greifen. Der belastbare Wert entsteht erst mit einer anonymisierten echten CSV; siehe „Offen“.

## Precision und Recall je Kategorie

| Kategorie | n | Precision | Recall |
|---|---|---|---|
| Lebensmittel | 20 | 100 % | 100 % |
| Mobilität | 17 | 100 % | 100 % |
| Restaurants & Cafés | 16 | 100 % | 100 % |
| Freizeit & Kultur | 16 | 100 % | 88 % |
| Abos & Medien | 15 | 100 % | 100 % |
| Drogerie & Haushalt | 11 | 91 % | 91 % |
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

| Anzahl | Wahrheit | Vorhersage | Ursache |
|---|---|---|---|
| 6 | Sonstiges | offen | erwartet: keine Regel, Fall für Embedding oder Fallback (darunter „Personalausweis Gebuehr“, seit 04.09. nicht mehr fälschlich Gebühren) |
| 1 | Drogerie & Haushalt | offen | „Waschsalon Schwabing“ trifft keine Regel |
| 1 | Freizeit & Kultur | offen | „Stadtwerke Muenchen Baeder“: Energie-Regel greift vor Freizeit |
| 1 | Freizeit & Kultur | Energie | siehe oben |
| 1 | Gesundheit | Drogerie & Haushalt | „Sanitaetshaus Mueller“: Muster MUELLER der Drogerie-Regel |

Änderung 04.09.2026: Die Gebührenregel auf dem Verwendungszweck greift nur noch, wenn der Händler leer ist oder wie eine Bank oder ein Kartenanbieter aussieht (`where: bank-or-empty`, Muster `BANK_PATTERN` in `rules.ts`). Damit entfielen die beiden Fehler „Stadtbibliothek Jahresgebuehr → Gebühren“ und „Personalausweis Gebuehr → Gebühren“; Precision der Gebührenkategorie stieg von 71 % auf 100 %, Gesamt-Accuracy von 94,4 % auf 94,9 %.

## Offen

- Messung mit `--api` (Embedding-kNN und Fallback) sobald `OPENAI_API_KEY` und `data/k2/labeled-embeddings.json` vorliegen. Kosten der Messung: 198 Texte × etwa 8 Token ≈ 1.600 Token ≈ 0,00003 $ für Embeddings; Fallback nur für die wenigen Texte unter 0,50.
- Anonymisierte echte CSV (eigene Umsätze, Namen und IBANs entfernt) als zweites Testset, um die Regelabdeckung realistisch zu messen.
