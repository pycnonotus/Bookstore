export function features(text) {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(word => word.length > 2);
  return [...new Set([...words, ...words.slice(1).map((word, i) => `${words[i]}_${word}`)])];
}

export function predictTopic(query, model) {
  const words = features(query);
  const scores = Object.entries(model.classes).map(([topic, cls]) => {
    const known = words.filter(word => Object.values(model.classes).some(item => item.counts[word]));
    const score = Math.log((cls.documents + 1) / (model.samples + Object.keys(model.classes).length))
      + known.reduce((sum, word) => sum + Math.log(((cls.counts[word] || 0) + 1) / (cls.total + model.vocabularySize)), 0);
    return { topic, score, support: known.filter(word => cls.counts[word]).length };
  }).sort((a, b) => b.score - a.score);
  if (!scores.length) return null;
  const total = scores.reduce((sum, row) => sum + Math.exp(row.score - scores[0].score), 0);
  return { topic: scores[0].topic, confidence: 1 / total, support: scores[0].support };
}
