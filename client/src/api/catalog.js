export async function loadCatalog(signal) {
  async function get(path) {
    const response = await fetch(path, { signal });
    if (!response.ok) throw new Error('Unable to load the catalog. Please try again.');
    return response.json();
  }
  const [rows, categories] = await Promise.all([get('/api/books'), get('/api/categories')]);
  return {
    categories,
    books: rows.map(book => ({
      ...book,
      name: book.title,
      auth: book.author,
      description: book.description || '',
      price: book.priceCents === null ? null : book.priceCents / 100,
    })),
  };
}
