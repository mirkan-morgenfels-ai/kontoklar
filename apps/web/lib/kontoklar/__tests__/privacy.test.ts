import { describe, expect, test } from "vitest";
import { PRIVACY_FACTS } from "../privacy";

describe("Kennzahlen der Datenschutzerklärung", () => {
  test("Cache 2.592.000 s / 86.400 s = 30 Tage", () => {
    expect(PRIVACY_FACTS.cacheDays).toBe(30);
  });
  test("höchstens 500 Händlertexte je Upload und 30 API-Aufrufe je Tagesfenster", () => {
    expect(PRIVACY_FACTS.maxTextsPerUpload).toBe(500);
    expect(PRIVACY_FACTS.rateLimitRequests).toBe(30);
  });
  test("Rate-Limit-Zähler: 172.801.000 ms = 48 h (172.800.000 ms) + 1 s", () => {
    expect(PRIVACY_FACTS.rateLimitRetentionHours).toBe(48);
    expect(PRIVACY_FACTS.rateLimitRetentionExtraSeconds).toBe(1);
  });
  test("Schlüssel für die IP-Pseudonymisierung mindestens 32 Zeichen", () => {
    expect(PRIVACY_FACTS.ipHashSecretMinLength).toBe(32);
  });
  test("IPv6: Rate-Limit je Netzpräfix der ersten 64 Bit (4 Gruppen × 16 Bit)", () => {
    expect(PRIVACY_FACTS.ipv6PrefixBits).toBe(64);
    expect(PRIVACY_FACTS.ipv6PrefixBits / 16).toBe(4);
  });
});
