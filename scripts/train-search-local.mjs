import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { trainIntentModel, predictTopic } from '../src/utils/intentModel.js';
const duration = Number(process.env.TRAIN_SECONDS || 1800) * 1000;
const deadline = Date.now() + duration;
const started = new Date().toISOString();
const endpoint = process.env.TRAIN_URL || 'http://127.0.0.1:1234/v1';
const model = process.env.TRAIN_MODEL || 'qwen3.5-4b';
const topics = ['art', 'programming', 'cooking', 'math'];
const catalog = JSON.parse(await readFile(new URL('../mock-data/data.json', import.meta.url), 'utf8'));
await mkdir(new URL('../training/', import.meta.url), { recursive: true });
const rows = [], seen = new Set();
let batches = 0, rejected = 0, errors = 0;
async function checkpoint() {
  const train = rows.filter((_, index) => index % 5 !== 0);
  const test = rows.filter((_, index) => index % 5 === 0);
  const trained = trainIntentModel(train);
  const hits = test.filter(row => predictTopic(row.query, trained)?.topic === row.topic).length;
  const report = { started, updated: new Date().toISOString(), elapsedSeconds: Math.round((Date.now() - Date.parse(started)) / 1000), model, batches, examples: rows.length, trainingExamples: train.length, heldOutExamples: test.length, heldOutAccuracy: test.length ? hits / test.length : null, rejected, errors, note: 'Local Qwen generated supervision; multinomial Naive Bayes topic classifier trained offline. Qwen weights unchanged. Price constraints enforced by deterministic parser.' };
  await writeFile(new URL('../src/data/search-intent-model.json', import.meta.url), JSON.stringify(trained));
  await writeFile(new URL('../training/search-queries.json', import.meta.url), JSON.stringify(rows, null, 2));
  await writeFile(new URL('../training/report.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
while (Date.now() < deadline) {
  const topic = topics[batches % topics.length];
  const examples = catalog.filter(book => book.topic === topic).map(book => `${book.name}: ${book.description}`).slice((batches % 3) * 3, (batches % 3) * 3 + 8);
  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(Math.min(90000, Math.max(1000, deadline - Date.now()))),
      body: JSON.stringify({ model, temperature: 0.85, max_tokens: 1700, chat_template_kwargs: { enable_thinking: false }, messages: [
        { role: 'system', content: 'You create labeled bookstore search training examples. Return ONLY a JSON array of 16 distinct short natural search strings. Every query must clearly concern the requested topic. Use casual phrasing, typos, abbreviations, specific subtopics, and varied price constraints: under, over, at least, no more than, ranges, 40$ or more, ore more. Do not answer the queries. Avoid referring to other topics. No markdown.' },
        { role: 'user', content: `Batch ${batches}. Topic: ${topic}. Vary language and subtopics substantially. Catalog sample:\n${examples.join('\n')}\nPrevious queries to avoid:\n${rows.filter(row => row.topic === topic).slice(-10).map(row => row.query).join('\n')}` },
      ] }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    const raw = body.choices?.[0]?.message?.content || '';
    const candidates = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
    if (!Array.isArray(candidates)) throw new Error('Invalid examples');
    for (const query of candidates) {
      if (typeof query !== 'string' || query.length < 8 || query.length > 250 || seen.has(query.toLowerCase())) { rejected++; continue; }
      seen.add(query.toLowerCase()); rows.push({ query, topic });
    }
  } catch (error) { errors++; console.log(`Batch issue: ${error.message}`); }
  batches++;
  if (rows.length >= 20) await checkpoint();
}
await checkpoint();
console.log('Completed the requested local training interval.');
