// Hash the title into whole cents, then return a stable $4.99–$49.99 demo price.
export function getBookPrice(title) {
  let hash = 2166136261;
  for (let index = 0; index < title.length; index += 1) {
    hash = Math.imul(hash ^ title.charCodeAt(index), 16777619);
  }
  return (499 + ((hash >>> 0) % 4501)) / 100;
}
