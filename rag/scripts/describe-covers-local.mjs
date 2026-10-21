import { readFile, writeFile } from 'node:fs/promises';
const catalogPath = new URL('../../src/data/books.json', import.meta.url);
const books = JSON.parse(await readFile(catalogPath, 'utf8'));
for (const [index, book] of books.entries()) {
  if (book.coverDescription) continue;
  try {
    const bytes = await readFile(new URL(`../../public/images/${book.image}`, import.meta.url));
    const mime = book.image.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ model: 'qwen3.5-4b', temperature: 0, max_tokens: 140, chat_template_kwargs: { enable_thinking: false }, messages: [
        { role: 'system', content: 'Describe only the visible artwork on this book cover in one factual sentence, under 45 words. Include dominant colors, objects, and composition. Do not infer book content, subject, author, mood, or audience from its title. Do not transcribe text. No preamble.' },
        { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${mime};base64,${bytes.toString('base64')}` } }] },
      ] }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const caption = data.choices?.[0]?.message?.content?.trim();
    if (!caption || caption.length > 800) throw new Error('Invalid caption');
    // Merge into the latest catalog so unrelated edits are preserved.
    const current = JSON.parse(await readFile(catalogPath, 'utf8'));
    const target = current.find(row => row.id === book.id);
    if (target) { target.coverDescription = caption; target.coverDescriptionSource = 'local-qwen-vision'; }
    await writeFile(catalogPath, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`${index + 1}/${books.length}: ${book.name}: ${caption}`);
  } catch (error) { console.log(`Skipped ${book.name}: ${error.message}`); }
}
