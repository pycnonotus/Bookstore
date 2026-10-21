# Book Library

A Vite + React bookstore catalog styled with Tailwind CSS v4.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

```sh
npm run build
npm run preview
```

## Structure

- `src/components/`: Header, Hero, MainContent, Footer, BookCard, and SaveToggle.
- `mock-data/data.json`: the single catalog array; images live alongside it in `photos/`.
- `src/index.css`: Tailwind import, theme colors, and base styles. The old `style.css` has been removed.

MainContent owns the multi-select topic filter using useState. Select one or more topic checkboxes to show their shelves, each with a heading and book count. Clearing the selection or choosing All topics shows the full catalog. Topic chips, shelves, and cards use CSS transitions and entrance animations that respect reduced-motion preferences. App owns saved-book state so the catalog and StaffPicks share the same selections. Staff recommendations are stored on books in the catalog data array. SaveToggle is controlled through its value and onChange props. Saved selections survive filter changes and reset on reload.

Every book in `mock-data/data.json` has a numeric `price` and a `currency` of `USD`. These stored prices are the single source for catalog cards, staff picks, chat replies, and price filters. Edit the JSON to change a price; no title-based price generation remains. The initial migration preserves the existing demo prices. Cards are 450px tall and no wider than 450px, with two-line titles, single-line authors, and three-line descriptions truncated with ellipses. Hover truncated text to see its full value; prices and Save controls stay visible.

The layout starts with one column and expands at sm, md, and lg breakpoints. Containers, wrapping navigation, and shrinkable grid children prevent horizontal overflow without hiding content.

The navbar stays at the top while scrolling. Its measured height keeps topic headings and anchor destinations below it, including when navigation wraps on smaller screens.

Topic shelves stack over the previous shelf as you scroll, with a subtle parallax depth effect. Each topic heading and book count stays visible above its books until the next topic takes over. Taller shelves scroll through all their books before pinning. Stack offsets respond to viewport and filter changes. Reduced-motion preferences and keyboard focus inside the shelves use normal document flow while keeping topic headings sticky and every book accessible.

## Client-side book search

Use **Find a book** in the navbar. Enter a free-text description and press Search or Enter. Each submission is an independent query; there is no chat history or inherited budget. All matching books are shown, with their raw cosine similarity, only when the score is **at least 0.9**. This strict cutoff can produce no results for broad queries. Keyword scores and the trained topic classifier cannot bypass it.

MiniLM text embeddings load automatically on first search in a Web Worker. Models are static assets served with the website; no AI server or API key is used at runtime. The model and catalog vectors are cached in the browser. Changing catalog descriptions invalidates the text index. Failed model loading shows an error rather than unscored recommendations.

For visual search, type a description such as `the book with a marble sculpture on its cover`. A separate CLIP worker compares the text with embeddings of all catalog covers. The same raw 0.9 cutoff applies, so visual queries may return no results. No photo upload is needed. The larger vision and text encoders (about 147 MB) load only on first visual search.

Topic and price constraints use the current query and the JSON catalog prices. Queries can include `math cost 40$ ore more`, `no more than $30`, or `between $20 and $40`. Save controls stay synchronized with the catalog and staff picks.

Prepare static models before building on a fresh checkout:

```sh
npm run models:prepare
npm run build
npm run test:search
npm run test:search:strict
npm run test:prices
npm run test:embeddings
npm run test:browser:embeddings
```

Model weights are ignored by Git and downloaded by `models:prepare`. Vite copies them from `public/models/` into the built site. Source and model licenses remain with their original publishers.

Offline training with your local Qwen is optional authoring work. It generates supervised examples and trains the small browser intent classifier, not Qwen itself. Checkpoints and synthetic held-out metrics live in `training/`; the generated intent artifact is retained in `src/data/search-intent-model.json` for later experiments; the strict search UI uses raw embedding similarity. To start a new 30-minute interval while retaining existing examples:

```powershell
$env:TRAIN_NEW_RUN = '1'
$env:TRAIN_SECONDS = '1800'
npm run train:search
```

The default local endpoint is `http://127.0.0.1:1234/v1` with model `qwen3.5-4b`; override `TRAIN_URL` and `TRAIN_MODEL` if needed. Review generated examples and report metrics before accepting a checkpoint. Synthetic accuracy is not an estimate of real-user accuracy. Restart the dev server after training to load the final checkpoint.

## Browser checks

```sh
npm run test:browser
```

Uses installed Microsoft Edge in headless mode and starts its own Vite server on port 5174. Checks topic grouping, multi-select filtering and reset, keyboard interaction, saving and unsaving, state retention across filters, reduced-motion support, runtime errors, and horizontal overflow at ten widths from 240px to 1920px plus four filtered widths. Screenshots are written to the ignored `artifacts/` directory.
