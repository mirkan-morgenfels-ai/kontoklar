import { readFileSync } from "node:fs";
import path from "node:path";
import { checkBankCsv, formatCsvCheck } from "../lib/kontoklar/csv-check";

function main() {
  const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!file) {
    console.error("Aufruf: pnpm --filter web dkb:check <Pfad zur CSV-Datei>");
    process.exit(2);
  }
  const absolute = path.resolve(process.env.INIT_CWD ?? process.cwd(), file);
  const bytes = readFileSync(absolute);
  const report = checkBankCsv(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  console.log("Prüfung der Bank-CSV (nur Aufbau, keine Inhalte):");
  for (const line of formatCsvCheck(report)) console.log(line);
  process.exit(report.findings.length === 0 ? 0 : 1);
}

main();
