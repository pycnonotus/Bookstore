import { useEffect, useState } from 'react';
import { loadCatalog } from '../api/catalog';

export default function useCatalog() {
  const [attempt, setAttempt] = useState(0);
  const [catalog, setCatalog] = useState({ books: [], categories: [], status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setCatalog({ books: [], categories: [], status: 'loading' });
    loadCatalog(controller.signal).then(data => {
      if (!controller.signal.aborted) setCatalog({ ...data, status: 'ready' });
    }).catch(() => {
      if (!controller.signal.aborted) setCatalog({ books: [], categories: [], status: 'error' });
    });
    return () => controller.abort();
  }, [attempt]);
  return { ...catalog, retry: () => setAttempt(value => value + 1) };
}
