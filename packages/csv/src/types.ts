export type Bank = "dkb" | "ing" | "comdirect" | "n26" | "generic";

export interface Transaction {
  id: string;
  bookingDate: string;
  valueDate: string | null;
  counterparty: string;
  purpose: string;
  amount: number;
  currency: string;
  type: string;
  bank: Bank;
}

export interface ParseWarning {
  line: number;
  message: string;
}

export interface ParseResult {
  bank: Bank;
  transactions: Transaction[];
  warnings: ParseWarning[];
  skipped: number;
}

export interface GenericMapping {
  bookingDate: string;
  counterparty: string;
  purpose: string;
  amount: string;
  valueDate?: string;
  type?: string;
  delimiter?: string;
  dateFormat?: "dmy" | "iso" | "auto";
}
