import { readFileSync } from "node:fs";
import path from "node:path";
import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { COICOP_DIVISIONS } from "../categories";
import {
  buildCpiData,
  CPI_DIVISIONS_TABLE,
  CPI_TOTAL_TABLE,
  cpiRequests,
  DESTATIS_LICENSE,
  fetchCpiData,
  GENESIS_BASE_URL,
  genesisResponseText,
  parseFlatCsv,
  unzipCsv,
} from "../destatis";
import { computePersonalInflation } from "../inflation";

const FIXTURES = path.join(__dirname, "fixtures");
const TOTAL_CSV = readFileSync(path.join(FIXTURES, "genesis-61111-0002.csv"), "utf-8");
const DIVISIONS_CSV = readFileSync(path.join(FIXTURES, "genesis-61111-0006.csv"), "utf-8");
const TOKEN = "0123456789abcdef0123456789abcdef";

function zip(name: string, content: string, method: 0 | 8): Uint8Array {
  const data = Buffer.from(content, "utf-8");
  const stored = method === 8 ? deflateRawSync(data) : data;
  const nameBytes = Buffer.from(name, "utf-8");
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(stored.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(stored.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);
  const centralOffset = local.length + nameBytes.length + stored.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return new Uint8Array(Buffer.concat([local, nameBytes, stored, central, nameBytes, end]));
}

describe("GENESIS request", () => {
  test("posts to data/tablefile with the token in the username header, an empty password and ffcsv for both tables", () => {
    const { total, divisions } = cpiRequests(TOKEN, 2023);
    expect(total.url).toBe("https://genesis.destatis.de/genesisWS/rest/2020/data/tablefile");
    expect(divisions.url).toBe(`${GENESIS_BASE_URL}/data/tablefile`);
    for (const request of [total, divisions]) {
      expect(request.init.method).toBe("POST");
      expect(request.init.headers).toEqual({ "content-type": "application/x-www-form-urlencoded", username: TOKEN, password: "" });
      expect(request.init.body).not.toContain(TOKEN);
    }
    const totalBody = Object.fromEntries(new URLSearchParams(total.init.body));
    expect(totalBody).toEqual({ name: "61111-0002", area: "all", compress: "false", transpose: "false", format: "ffcsv", job: "false", language: "de", startyear: "2023" });
    const divisionsBody = Object.fromEntries(new URLSearchParams(divisions.init.body));
    expect(divisionsBody).toMatchObject({ name: "61111-0006", classifyingvariable1: "CC13A2", startyear: "2023", format: "ffcsv", job: "false" });
  });
});

describe("parseFlatCsv", () => {
  test("keeps only index values (unit 2020=100), skips change rates in % and missing values", () => {
    const rows = parseFlatCsv(TOTAL_CSV);
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.code === null && r.baseYear === 2020)).toBe(true);
    expect(rows.find((r) => r.period === "2026-03")?.value).toBe(113.1);
    expect(rows.some((r) => r.period === "2026-04")).toBe(false);
  });

  test("reads the COICOP code from the CC13A2 variable, wherever it stands", () => {
    const rows = parseFlatCsv(DIVISIONS_CSV);
    expect(rows).toHaveLength(24);
    expect(new Set(rows.map((r) => r.code))).toEqual(new Set(Object.keys(COICOP_DIVISIONS).map((c) => `CC13-${c}`)));
    expect(rows.find((r) => r.code === "CC13-04" && r.period === "2025-03")?.value).toBe(118);
  });

  test("tolerates a byte order mark and names a missing column", () => {
    expect(parseFlatCsv(`﻿${TOTAL_CSV}`)).toHaveLength(6);
    expect(() => parseFlatCsv("Zeit;Wert\n2026;1,0\n")).toThrow("Spalte time fehlt");
  });
});

describe("buildCpiData", () => {
  const data = buildCpiData(TOTAL_CSV, DIVISIONS_CSV, "2026-10-21");

  test("fills all twelve divisions and the total index, sorted by month, marked as real Destatis data", () => {
    expect(data.sample).toBe(false);
    expect(data.baseYear).toBe(2020);
    expect(data.fetchedAt).toBe("2026-10-21");
    expect(data.license).toBe(DESTATIS_LICENSE);
    expect(data.source).toContain(`Tabellen ${CPI_TOTAL_TABLE}`);
    expect(data.source).toContain(CPI_DIVISIONS_TABLE);
    expect(data.source).toContain("(2020=100)");
    expect(Object.keys(data.divisions)).toEqual(Object.keys(COICOP_DIVISIONS));
    for (const [code, division] of Object.entries(data.divisions)) {
      expect(division.name).toBe(COICOP_DIVISIONS[code]);
      expect(division.series.map((p) => p.period)).toEqual(["2025-03", "2026-03"]);
    }
    expect(data.total.series.map((p) => p.period)).toEqual(["2025-01", "2025-02", "2025-03", "2026-01", "2026-02", "2026-03"]);
  });

  test("works with the inflation calculation: food only gives 126,0 / 120,0 − 1 = 5 %, official 113,1 / 111,0 − 1", () => {
    const r = computePersonalInflation(data, { Lebensmittel: 300 })!;
    expect(r.toPeriod).toBe("2026-03");
    expect(r.fromPeriod).toBe("2025-03");
    expect(r.personalRate).toBeCloseTo(126 / 120 - 1, 10);
    expect(r.officialRate).toBeCloseTo(113.1 / 111 - 1, 10);
  });

  test("refuses incomplete answers, so cpi.json is never overwritten with gaps", () => {
    const without12 = DIVISIONS_CSV.split("\n")
      .filter((l) => !l.includes(";CC13-12;"))
      .join("\n");
    expect(() => buildCpiData(TOTAL_CSV, without12, "2026-10-21")).toThrow("fehlende Abteilungen: 12");
    const header = TOTAL_CSV.split("\n")[0]!;
    expect(() => buildCpiData(`${header}\n`, DIVISIONS_CSV, "2026-10-21")).toThrow("Gesamtindex: 0 Monate");
  });

  test("refuses mixed base years and contradictory duplicates", () => {
    expect(() => buildCpiData(TOTAL_CSV.replace(/2020=100/g, "2025=100"), DIVISIONS_CSV, "2026-10-21")).toThrow("Basisjahre");
    const duplicate = DIVISIONS_CSV.split("\n").find((l) => l.includes(";CC13-01;") && l.includes(";2026;"))!.replace("126,0", "126,5");
    expect(() => buildCpiData(TOTAL_CSV, `${DIVISIONS_CSV}${duplicate}\n`, "2026-10-21")).toThrow("Widersprüchliche Werte für Abteilung 01, 2026-03");
  });
});

describe("genesisResponseText", () => {
  test("unpacks the ZIP archive GENESIS-Online delivers, deflated or stored, and drops the byte order mark", () => {
    for (const method of [8, 0] as const) {
      const bytes = zip("61111-0002_de_flat.csv", `﻿${TOTAL_CSV}`, method);
      expect(genesisResponseText(bytes)).toBe(TOTAL_CSV);
      expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(unzipCsv(bytes))).toBe(`﻿${TOTAL_CSV}`);
    }
  });

  test("passes plain CSV through and turns a JSON status into a readable error", () => {
    expect(genesisResponseText(new TextEncoder().encode(TOTAL_CSV))).toBe(TOTAL_CSV);
    const tooBig = JSON.stringify({ Status: { Code: 98, Content: "Die Tabelle ist zu gross", Type: "Error" } });
    expect(() => genesisResponseText(new TextEncoder().encode(tooBig))).toThrow("Status 98: Die Tabelle ist zu gross");
    const login = JSON.stringify({ Status: { Code: 15, Content: "Fehler bei der Anmeldung", Type: "Error" } });
    expect(() => genesisResponseText(new TextEncoder().encode(login))).toThrow("Status 15: Fehler bei der Anmeldung");
    expect(() => unzipCsv(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toThrow("kein lesbares ZIP-Archiv");
  });
});

describe("fetchCpiData", () => {
  test("asks for both tables three years back and builds cpi.json data from the answers, without a real request", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const name = new URLSearchParams(String(init.body)).get("name");
      const csv = name === CPI_TOTAL_TABLE ? TOTAL_CSV : DIVISIONS_CSV;
      return new Response(Buffer.from(zip(`${name}_de_flat.csv`, csv, 8)), { status: 200, headers: { "content-type": "application/zip" } });
    }) as typeof fetch;
    const data = await fetchCpiData(TOKEN, { fetchImpl, now: new Date("2026-10-21T08:00:00Z") });
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => new URLSearchParams(String(c.init.body)).get("name"))).toEqual([CPI_TOTAL_TABLE, CPI_DIVISIONS_TABLE]);
    expect(calls.every((c) => new URLSearchParams(String(c.init.body)).get("startyear") === "2023")).toBe(true);
    expect(data.fetchedAt).toBe("2026-10-21");
    expect(data.total.series).toHaveLength(6);
  });

  test("stops at the first HTTP error and names the table", async () => {
    const fetchImpl = (async () => new Response("Unauthorized", { status: 401 })) as typeof fetch;
    await expect(fetchCpiData(TOKEN, { fetchImpl })).rejects.toThrow("Tabelle 61111-0002 mit HTTP 401");
  });
});
