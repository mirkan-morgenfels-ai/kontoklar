import { writeFileSync } from "node:fs";
import path from "node:path";
import { CPI_DIVISIONS_TABLE, CPI_TOTAL_TABLE, fetchCpiData } from "../lib/kontoklar/destatis";

const root = path.resolve(__dirname, "..", "..", "..");
const output = path.join(root, "data", "k2", "cpi.json");

async function main() {
  const token = process.env.DESTATIS_TOKEN?.trim();
  if (!token) throw new Error("DESTATIS_TOKEN fehlt (persönlicher API-Token aus GENESIS-Online, siehe docs/destatis.md)");
  const data = await fetchCpiData(token);
  writeFileSync(output, JSON.stringify(data, null, 1) + "\n");
  const lastDivisions = Object.entries(data.divisions)
    .map(([code, d]) => `${code} ${d.series.at(-1)?.period ?? "–"}`)
    .join(", ");
  console.log(`cpi.json aktualisiert aus GENESIS-Online ${CPI_TOTAL_TABLE} und ${CPI_DIVISIONS_TABLE} (Basis ${data.baseYear}=100, abgerufen ${data.fetchedAt}).`);
  console.log(`Gesamtindex: ${data.total.series.length} Monate, ${data.total.series[0]?.period} bis ${data.total.series.at(-1)?.period}.`);
  console.log(`Letzter Monat je Abteilung: ${lastDivisions}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
