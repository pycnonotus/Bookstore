import { pipeline, env } from '@huggingface/transformers';
import books from '../../mock-data/data.json' with { type: 'json' };
import { rankEmbeddings } from '../utils/embeddingSearch';
import { searchDocument } from '../utils/hybridSearch';

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';
env.backends.onnx.wasm.numThreads = 1;
let indexPromise;
const modelId = 'Xenova/all-MiniLM-L6-v2';
const texts = books.map(searchDocument);

async function cacheKey() {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(texts)));
  return new Request(`${self.location.origin}/embedding-index/${modelId}/${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')}`);
}

function getIndex() {
  if (!indexPromise) indexPromise = (async () => {
    self.postMessage({ type: 'progress', message: 'Downloading browser search model…' });
    const embed = await pipeline('feature-extraction', modelId, { device: 'wasm', dtype: 'q8' });
    let cache, key;
    try {
      cache = await caches.open('book-embeddings-v1');
      key = await cacheKey();
      const cached = await cache.match(key);
      if (cached) {
        const vectors = await cached.json();
        if (vectors.length === books.length && vectors.every(vector => vector.length === 384 && vector.every(Number.isFinite))) return { embed, vectors };
      }
    } catch { /* Private browsing/storage limits: compute an in-memory index. */ }
    const vectors = [];
    for (let i = 0; i < books.length; i += 8) {
      self.postMessage({ type: 'progress', message: `Indexing books ${i + 1}–${Math.min(i + 8, books.length)} of ${books.length}…` });
      const output = await embed(texts.slice(i, i + 8), { pooling: 'mean', normalize: true });
      vectors.push(...output.tolist());
    }
    if (cache && key) {
      try { await cache.put(key, new Response(JSON.stringify(vectors))); } catch { /* Search works without persistent storage. */ }
    }
    return { embed, vectors };
  })().catch(error => { indexPromise = null; throw error; });
  return indexPromise;
}

self.onmessage = async ({ data }) => {
  try {
    const { embed, vectors } = await getIndex();
    if (data.type === 'init') return self.postMessage({ type: 'ready' });
    const output = await embed(data.query, { pooling: 'mean', normalize: true });
    const ranked = rankEmbeddings(output.tolist()[0], vectors, books, 0);
    self.postMessage({ type: 'results', id: data.id, matches: ranked.map(({ book, score }) => ({ id: book.id, score })) });
  } catch (error) {
    self.postMessage({ type: 'error', id: data.id, message: error.message });
  }
};
