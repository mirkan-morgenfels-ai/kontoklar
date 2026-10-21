import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_PRICE_USD_PER_MILLION_TOKENS,
  embedExamples,
  estimateCostUsd,
  estimateTokens,
  labeledEmbeddingsFile,
  prepareExamples,
} from "../lib/kontoklar/embeddings";
import { createOpenAiEmbed, openAiClient } from "../lib/kontoklar/providers";

const root = path.resolve(__dirname, "..", "..", "..");
const input = path.join(root, "data", "k2", "labeled-examples.json");
const output = path.join(root, "data", "k2", "labeled-embeddings.json");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const raw = JSON.parse(readFileSync(input, "utf-8")) as { examples: { text: string; category: string }[] };
  const { items, skipped, conflicts } = prepareExamples(raw.examples);
  const model = process.env.KONTOKLAR_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
  const tokens = estimateTokens(items.map((item) => item.text));
  console.log(`Beispielset: ${raw.examples.length} Einträge, ${items.length} verschiedene normalisierte Texte, ${skipped} übersprungen, ${conflicts.length} mit widersprüchlicher Kategorie (letzte gilt).`);
  console.log(`Modell ${model}: geschätzt ${tokens} Token, Kosten ≈ ${estimateCostUsd(tokens).toFixed(6)} $ (${EMBEDDING_PRICE_USD_PER_MILLION_TOKENS} $ je Million Token für ${DEFAULT_EMBEDDING_MODEL}).`);
  if (dryRun) {
    console.log("Probelauf (--dry-run): keine Anfrage an OpenAI, keine Datei geschrieben.");
    return;
  }
  if (process.env.CI) throw new Error("Abbruch: embeddings:build läuft nur lokal, nicht in der CI (CI ist gesetzt).");
  const client = openAiClient(process.env.OPENAI_API_KEY?.trim() || undefined);
  if (!client) throw new Error("Abbruch: OPENAI_API_KEY fehlt. Ohne Schlüssel zeigt --dry-run Umfang und Kosten.");
  const vectors = await embedExamples(items, createOpenAiEmbed(client, model), {
    onBatch: (done, total) => console.log(`eingebettet: ${done}/${total}`),
  });
  const file = labeledEmbeddingsFile(model, new Date().toISOString().slice(0, 10), vectors);
  writeFileSync(output, JSON.stringify(file) + "\n");
  console.log(`geschrieben: data/k2/labeled-embeddings.json (${file.count} Texte, ${vectors[0]?.vector.length ?? 0} Dimensionen).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
