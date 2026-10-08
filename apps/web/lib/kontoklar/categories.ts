export const CATEGORIES = [
  "Lebensmittel",
  "Drogerie & Haushalt",
  "Restaurants & Cafés",
  "Wohnen",
  "Energie",
  "Telekommunikation",
  "Mobilität",
  "Abos & Medien",
  "Freizeit & Kultur",
  "Kleidung",
  "Gesundheit",
  "Versicherungen",
  "Bildung",
  "Reisen",
  "Online-Handel",
  "Bargeld",
  "Gebühren & Zinsen",
  "Einkommen",
  "Umbuchung",
  "Sonstiges",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);

export function isCategory(value: string): value is Category {
  return CATEGORY_SET.has(value);
}

export const EXPENSE_CATEGORIES: readonly Category[] = CATEGORIES.filter(
  (c) => c !== "Einkommen" && c !== "Umbuchung",
);

export const COICOP_DIVISIONS: Record<string, string> = {
  "01": "Nahrungsmittel und alkoholfreie Getränke",
  "02": "Alkoholische Getränke und Tabakwaren",
  "03": "Bekleidung und Schuhe",
  "04": "Wohnung, Wasser, Strom, Gas und andere Brennstoffe",
  "05": "Möbel, Leuchten, Geräte und anderes Haushaltszubehör",
  "06": "Gesundheit",
  "07": "Verkehr",
  "08": "Post und Telekommunikation",
  "09": "Freizeit, Unterhaltung und Kultur",
  "10": "Bildungswesen",
  "11": "Gaststätten- und Beherbergungsdienstleistungen",
  "12": "Andere Waren und Dienstleistungen",
};

export const CATEGORY_TO_COICOP: Record<Category, string | null> = {
  Lebensmittel: "01",
  "Drogerie & Haushalt": "05",
  "Restaurants & Cafés": "11",
  Wohnen: "04",
  Energie: "04",
  Telekommunikation: "08",
  Mobilität: "07",
  "Abos & Medien": "09",
  "Freizeit & Kultur": "09",
  Kleidung: "03",
  Gesundheit: "06",
  Versicherungen: "12",
  Bildung: "10",
  Reisen: "11",
  "Online-Handel": null,
  Bargeld: null,
  "Gebühren & Zinsen": null,
  Einkommen: null,
  Umbuchung: null,
  Sonstiges: null,
};

export const COICOP_APPROXIMATIONS: ReadonlySet<Category> = new Set<Category>(["Drogerie & Haushalt", "Versicherungen", "Reisen"]);

export const UNCOVERED_EXPENSE_CATEGORIES: readonly Category[] = EXPENSE_CATEGORIES.filter((c) => CATEGORY_TO_COICOP[c] === null);

export const APPROXIMATED_EXPENSE_CATEGORIES: readonly Category[] = EXPENSE_CATEGORIES.filter((c) => COICOP_APPROXIMATIONS.has(c));

export function coicopDivisionLabel(category: Category): string | null {
  const division = CATEGORY_TO_COICOP[category];
  return division ? `${division} ${COICOP_DIVISIONS[division] ?? ""}`.trim() : null;
}

export function coicopLabel(category: Category): string {
  const label = coicopDivisionLabel(category);
  if (!label) return "nicht abgedeckt";
  return COICOP_APPROXIMATIONS.has(category) ? `${label} (Näherung)` : label;
}

export function joinGerman(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`;
}
