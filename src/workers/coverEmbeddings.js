import { AutoProcessor, AutoTokenizer, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers';
import books from '../../mock-data/data.json' with { type: 'json' };
import { cosine } from '../utils/embeddingSearch';
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';
env.backends.onnx.wasm.numThreads = 1;
const images = import.meta.glob('../../mock-data/photos/*', { eager: true, query: '?url', import: 'default' });
let indexPromise;
async function getIndex() {
  if (!indexPromise) indexPromise = (async () => {
    self.postMessage({ type: 'progress', message: 'Loading the local cover-search model…' });
    const id = 'Xenova/clip-vit-base-patch32';
    const processor = await AutoProcessor.from_pretrained(id);
    const model = await CLIPVisionModelWithProjection.from_pretrained(id, { device: 'wasm', dtype: 'q8' });
    const tokenizer = await AutoTokenizer.from_pretrained(id);
    const textModel = await CLIPTextModelWithProjection.from_pretrained(id, { device: 'wasm', dtype: 'q8' });
    async function embedText(text) {
      const inputs = await tokenizer(text, { padding: true, truncation: true });
      const { text_embeds } = await textModel(inputs);
      return text_embeds.tolist()[0];
    }
    async function embed(image) {
      const inputs = await processor(image);
      const { image_embeds } = await model(inputs);
      return image_embeds.tolist()[0];
    }
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(books.map(book => [book.id, images[`../../mock-data/photos/${book.image}`]]))));
    const key = new Request(`${self.location.origin}/cover-index/${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')}`);
    let cache;
    try {
      cache = await caches.open('book-cover-embeddings-v1');
      const cached = await cache.match(key);
      if (cached) {
        const vectors = await cached.json();
        if (vectors.length === books.length && vectors.every(row => row.length === 512 && row.every(Number.isFinite))) return { embedText, vectors };
      }
    } catch { /* Storage is optional. */ }
    const vectors = [];
    for (const [index, book] of books.entries()) {
      self.postMessage({ type: 'progress', message: `Learning catalog covers: ${index + 1}/${books.length}…` });
      vectors.push(await embed(await RawImage.read(new URL(images[`../../mock-data/photos/${book.image}`], self.location.origin).href)));
    }
    try { await cache?.put(key, new Response(JSON.stringify(vectors))); } catch { /* In-memory search remains available. */ }
    return { embedText, vectors };
  })().catch(error => { indexPromise = null; throw error; });
  return indexPromise;
}
self.onmessage = async ({ data }) => {
  try {
    const { embedText, vectors } = await getIndex();
    const query = await embedText(data.query);
    const matches = books.map((book, index) => ({ id: book.id, score: cosine(query, vectors[index]) })).filter(match => Number.isFinite(match.score)).sort((a, b) => b.score - a.score);
    self.postMessage({ type: 'results', id: data.id, matches });
  } catch { self.postMessage({ type: 'error', id: data.id, message: 'Cover search could not load. Please try again or search by title.' }); }
};
