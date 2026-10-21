// Catalog prices are the only source for display, replies, and hard filters.
export function getBookPrice(book) {
  if (!Number.isFinite(book?.price) || book.price < 0 || book.currency !== 'USD') {
    throw new Error(`Invalid catalog price for ${book?.id || 'unknown book'}`);
  }
  return book.price;
}
