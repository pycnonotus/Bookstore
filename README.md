# Bookstore

A small bookstore built with React, Vite and Tailwind. Browse the shelves, save books you like, check staff picks and upcoming events.

I also wanted to try searching in plain words. Things like `math 10$ to 20$`, `JS libs`, or `a book with flowers on the cover`. Search filters the shelves and shows all matching books. You can use the topic filters too.

## Run it

Use Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

For the full AI search, download the models once:

```sh
npm run models:prepare
```

## Build

```sh
npm run build
npm run preview
```

The build downloads any missing models automatically, so the first build needs internet and can take a bit. Model files stay out of Git.

## Where things live

- `src/` — the React app and browser search code.
- `mock-data/data.json` — the books, prices, topics and search metadata. Edit this to update the catalog.
- `public/images/` — book covers.
- `public/models/` — downloaded search models, ignored by Git.
- `rag/` — training examples, experiments, helper scripts and checks.

## The search bit

Search runs in your browser. It combines catalog keywords with text and cover embeddings. Prices come straight from the JSON, so a budget filters by the actual listed price.

The models load when needed and are cached on your device. Basic catalog matching still works if they cannot load. You can describe a cover in words to look for it.

I used local Qwen to help write cover descriptions and search examples. That work happens offline; you do not need Qwen running to use the site. The training experiments and more detail are in [rag/](rag/README.md) and the [training notes](rag/docs/search-training.md).

## Checks

```sh
npm run test:search:hybrid
npm run test:prices
npm run test:browser
```

Browser checks use Microsoft Edge. For the full search check with real models, run `npm run test:browser:embeddings`.
