import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isCategory } from "../lib/kontoklar/categories";
import { normalizeMerchant } from "../lib/kontoklar/merchant";
import { createOpenAiEmbed, openAiClient } from "../lib/kontoklar/providers";

const root = path.resolve(__dirname, "..", "..", "..");
const input = path.join(root, "data", "k2", "labeled-examples.json");
const output = path.join(root, "data", "k2", "labeled-embeddings.json");

async function main() {
  const client = openAiClient();
  if (!client) throw new Error("OPENAI_API_KEY fehlt");
  const raw = JSON.parse(readFileSync(input, "utf-8")) as { examples: { text: string; category: string }[] };
  const examples = raw.examples
    .map((e) => ({ text: normalizeMerchant(e.text), category: e.category }))
    .filter((e) => e.text !== "" && isCategory(e.category));
  const unique = new Map<string, string>();
  for (const e of examples) unique.set(e.text, e.category);
  const texts = [...unique.keys()];
  const model = process.env.KONTOKLAR_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const embed = createOpenAiEmbed(client, model);
  const items: { text: string; category: string; vector: number[] }[] = [];
  const batchSize = 200;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const vectors = await embed(batch);
    batch.forEach((text, j) => items.push({ text, category: unique.get(text)!, vector: vectors[j]!.map((x) => Math.round(x * 1e5) / 1e5) }));
    console.log(`eingebettet: ${Math.min(i + batchSize, texts.length)}/${texts.length}`);
  }
  const tokensEstimate = texts.reduce((s, t) => s + Math.ceil(t.length / 3), 0);
  writeFileSync(output, JSON.stringify({ model, createdAt: new Date().toISOString().slice(0, 10), count: items.length, items }) + "\n");
  console.log(`geschrieben: ${output} (${items.length} Beispiele, geschätzt ${tokensEstimate} Token, Kosten ≈ ${((tokensEstimate / 1e6) * 0.02).toFixed(4)} $)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
