# Bookstore

A small bookstore built with React, Vite and Tailwind. Browse the shelves, save books you like, check staff picks and upcoming events.

I also wanted to try searching in plain words. Things like `math 10$ to 20$`, `JS libs`, or `a book with flowers on the cover`. Search filters the shelves and shows all matching books. You can use the topic filters too.

## Run it

```sh
npm install
npm run dev
```

For the creating the search embeddings use

```sh
npm run models:prepare
```



## AI generated data in this project,

- `src/data/books.json` — the books.
- `public/images/` — book covers.
- `src/workers/` — search embeddings run in the browser, no backend 🥲
- `src/scripts/` — model setup.
- `tests/` — local checks and test data, ignored by Git. The npm test commands need these local files.
- `rag/` — local training and experiments, ignored by Git.

To run local training (if you have the local files), use `node rag/scripts/train-search-local.mjs`. Generated checkpoints stay in `rag/`; the search code uses the saved model in `src/data/`.
