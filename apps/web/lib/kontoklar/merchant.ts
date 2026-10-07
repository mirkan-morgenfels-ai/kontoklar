import type { Transaction } from "@portfolio/csv";

const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g;
const BIC = /\b[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g;
const BIC_LIKE = (token: string): boolean => /\d/.test(token) || token.endsWith("XXX");
const DATE = /\b\d{1,2}\.\d{1,2}\.(?:\d{2}|\d{4})\b|\b\d{4}-\d{2}-\d{2}(?:T[\d:]+)?\b/g;
const TIME = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;
const SEPA_TAGS = /\b(?:EREF|MREF|CRED|SVWZ|KREF|DEBT|ABWA|ABWE|IBAN|BIC|PP\.\d+\.PP)\b\+?:?/g;
const NOISE_WORDS =
  /\b(?:LASTSCHRIFT|KARTENZAHLUNG|DAUERAUFTRAG|GUTSCHRIFT|UEBERWEISUNG|ÜBERWEISUNG|DEBITK\.?|DEBITKARTE|KREDITKARTE|GIROCARD|VISA|MASTERCARD|MAESTRO|CONTACTLESS|KONTAKTLOS|ONLINE|ELV|SEPA|EC|POS|GA\s?NR|FOLGENR|VERFALLD|TERMINAL|APPLE\s?PAY|GOOGLE\s?PAY|IHR\s?EINKAUF\s?BEI|DANKE\s?SAGT)\b/g;
const CODES = /\b(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{4,}\b/g;
const SHORT_NUMBERS = /(?<![&\w])\d+(?![&\w])/g;
const LEGAL_FORMS = /\b(?:GMBH\s?&\s?CO\.?\s?KG|GMBH|AG|SE|KG|OHG|E\.?V\.?|LTD\.?|LIMITED|INC\.?|LLC|B\.?V\.?|S\.?A\.?R\.?L\.?|S\.?A\.?|S\.?R\.?L\.?|N\.?V\.?|PLC|CO\.?|CORP\.?|MBH|UG)\b\.?/g;

const CARD_OR_DEBIT_TYPES = /kartenzahlung|lastschrift|presentment|direct\s?debit|card|karte|abbuchung|folgelastschrift|basislastschrift/i;
const COMPANY_MARKERS =
  /\b(?:GMBH|AG|SE|KG|OHG|E\.?V\.?|LTD|LIMITED|INC|LLC|B\.?V\.?|S\.?A\.?R\.?L|S\.?A\.?|N\.?V\.?|PLC|CORP|MBH|UG|BANK|SPARKASSE|VERSICHERUNG|STADTWERKE|HAUSVERWALTUNG|IMMOBILIEN|VERLAG|SHOP|STORE|MARKT|APOTHEKE|PRAXIS|KLINIK|UNIVERSITÄT|UNIVERSITAET|HOCHSCHULE|FINANZAMT|KRANKENKASSE|BKK|AOK|TK|DAK|BARMER|SAGT\s?DANKE|DANKE\s?SAGT)\b/i;
const PAYPAL_PURCHASE = /(?:IHR\s+EINKAUF\s+BEI|YOUR\s+PURCHASE\s+AT)\s+([A-Z0-9][A-Z0-9 .&'-]{1,40})/i;
const PAYPAL = /paypal/i;

export function normalizeMerchant(raw: string): string {
  let s = raw.toUpperCase().replace(/[ÄÖÜ]/g, (c) => ({ Ä: "AE", Ö: "OE", Ü: "UE" })[c] ?? c).replace(/ß/g, "SS");
  s = s.replace(IBAN, " ").replace(BIC, (m) => (BIC_LIKE(m) ? " " : m)).replace(DATE, " ").replace(TIME, " ");
  s = s.replace(SEPA_TAGS, " ");
  s = s.replace(NOISE_WORDS, " ");
  s = s.replace(CODES, " ").replace(SHORT_NUMBERS, " ");
  s = s.replace(LEGAL_FORMS, " ");
  s = s.replace(/[^A-Z0-9&' .-]/g, " ");
  s = s.replace(/\s*[.\-/,]+\s*/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.slice(0, 60).trim();
}

function paypalPurchaseMerchant(tx: Pick<Transaction, "counterparty" | "purpose">): string | null {
  const counterparty = tx.counterparty.trim();
  const purpose = tx.purpose.trim();
  if (!PAYPAL.test(counterparty) && !PAYPAL.test(purpose)) return null;
  const m = PAYPAL_PURCHASE.exec(purpose) ?? PAYPAL_PURCHASE.exec(counterparty);
  if (!m?.[1] || normalizeMerchant(m[1]) === "") return null;
  return m[1].trim();
}

export function merchantKeyFor(tx: Pick<Transaction, "counterparty" | "purpose">): string {
  const paypal = paypalPurchaseMerchant(tx);
  if (paypal !== null) return normalizeMerchant(paypal);
  const primary = normalizeMerchant(tx.counterparty.trim());
  if (primary !== "") return primary;
  const secondary = normalizeMerchant(tx.purpose.trim());
  return secondary.split(" ").slice(0, 4).join(" ");
}

export function merchantRuleSource(tx: Pick<Transaction, "counterparty" | "purpose">): string {
  return paypalPurchaseMerchant(tx) ?? tx.counterparty.trim();
}

export function isApiEligible(tx: Pick<Transaction, "counterparty" | "purpose" | "type" | "amount">): boolean {
  if (tx.amount > 0) return false;
  const paypal = paypalPurchaseMerchant(tx);
  if (paypal !== null) return COMPANY_MARKERS.test(paypal);
  if (normalizeMerchant(tx.counterparty) === "") return false;
  const type = tx.type ?? "";
  if (CARD_OR_DEBIT_TYPES.test(type)) return true;
  return COMPANY_MARKERS.test(tx.counterparty);
}
