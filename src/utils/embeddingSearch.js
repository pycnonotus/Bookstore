export const MIN_SIMILARITY = 0.9;

export function cosine(left, right) {
  if (!left?.length || left.length !== right?.length) throw new Error('Invalid embedding dimensions');
  let dot = 0, leftNorm = 0, rightNorm = 0;
  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i];
    leftNorm += left[i] ** 2;
    rightNorm += right[i] ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

export function rankEmbeddings(query, vectors, books, minimum = MIN_SIMILARITY) {
  if (vectors.length !== books.length) throw new Error('Catalog index is incomplete');
  return books.map((book, index) => ({ book, score: cosine(query, vectors[index]) }))
    .filter(row => Number.isFinite(row.score) && row.score >= minimum).sort((a, b) => b.score - a.score);
}
