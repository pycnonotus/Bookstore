import { readFile, writeFile } from 'node:fs/promises';
const books = JSON.parse(await readFile(new URL('../mock-data/data.json', import.meta.url), 'utf8'));
const names = ['Forms of Silence', 'Spectral Blooms', 'The Fleeting Beauty', 'Jquery', 'HTMX', 'React, Angular, or Vue, Pug!', 'Algebra Made Simple', 'Calculus Step by Step', 'Abstract Algebra', 'Pasta Forever', 'Plant Forward', "The Baker's Table"];
const output = [];
for (const name of names) {
  const book = books.find(row => row.name === name);
  const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ model: 'qwen3.5-4b', temperature: 0.4, max_tokens: 260, chat_template_kwargs: { enable_thinking: false }, messages: [
      { role: 'system', content: 'Return ONLY a JSON array of three short, distinct bookstore search queries that would be answered by this book. Do not mention its exact title. Use only facts in the supplied metadata. Avoid vague queries such as good books or something interesting. No explanation.' },
      { role: 'user', content: JSON.stringify({ title: book.name, description: book.description, subjects: book.subjects, level: book.readingLevel }) },
    ] }),
  });
  if (!response.ok) throw new Error(`Local model HTTP ${response.status}`);
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || '';
  let queries;
  try { queries = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); }
  catch { queries = raw.split('\n').flatMap(line => { try { return JSON.parse(line); } catch { return []; } }); }
  if (!Array.isArray(queries)) throw new Error('Invalid local training examples');
  for (const query of queries) if (typeof query === 'string' && query.length < 200) output.push({ query, relevantIds: [book.id], source: 'local-qwen', reviewed: false });
  await writeFile(new URL('../training/retrieval-training-candidates.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
  console.log(`${name}: ${queries.join(' | ')}`);
}
