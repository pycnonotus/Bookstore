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
- `mock-data/data.json`: the single catalog array; images live in `public/images/` and are served at `/images/`.
- `src/index.css`: Tailwind import, theme colors, and base styles. The old `style.css` has been removed.

MainContent owns the multi-select topic filter using useState. Select one or more topic checkboxes to show their shelves, each with a heading and book count. Clearing the selection or choosing All topics shows the full catalog. Topic chips, shelves, and cards use CSS transitions and entrance animations that respect reduced-motion preferences. App owns saved-book state so the catalog and StaffPicks share the same selections. Staff recommendations are stored on books in the catalog data array. SaveToggle is controlled through its value and onChange props. Saved selections survive filter changes and reset on reload.

Every book in `mock-data/data.json` has a numeric `price` and a `currency` of `USD`. These stored prices are the single source for catalog cards, staff picks, chat replies, and price filters. Edit the JSON to change a price; no title-based price generation remains. The initial migration preserves the existing demo prices. Cards are 450px tall and no wider than 450px, with two-line titles, single-line authors, and three-line descriptions truncated with ellipses. Hover truncated text to see its full value; prices and Save controls stay visible.

The layout starts with one column and expands at sm, md, and lg breakpoints. Containers, wrapping navigation, and shrinkable grid children prevent horizontal overflow without hiding content.

The navbar stays at the top while scrolling. Its measured height keeps topic headings and anchor destinations below it, including when navigation wraps on smaller screens.

Topic shelves stack over the previous shelf as you scroll, with a subtle parallax depth effect. Each topic heading and book count stays visible above its books until the next topic takes over. Taller shelves scroll through all their books before pinning. Stack offsets respond to viewport and filter changes. Reduced-motion preferences and keyboard focus inside the shelves use normal document flow while keeping topic headings sticky and every book accessible.

## Client-side shelf search

The free-text **Search our shelves** field lives in the same filter panel as the topic chips. Enter a title, author, subject, cover description, or price rule and press Search/Enter. It filters the existing shelf grid and shows **all** matching books. Selected topics further narrow the results. Clear search restores the shelves while retaining the selected topics. There is no separate chat or three-book limit.

Search combines exact titles/topics, weighted title/subject/alias matching, limited spelling correction, and local semantic retrieval. MiniLM text embeddings and CLIP cover embeddings run in Web Workers. Common queries work immediately from catalog metadata; missing models leave that fallback available. Ranking combines lexical and semantic ranks rather than treating cosine scores as confidence percentages. The initial semantic candidate floors are 0.5 for text and 0.25 for image-text matches, with independent metadata matches still eligible.

The JSON stores subjects, aliases, editorial reading levels (`unspecified` where unclear), and locally generated cover descriptions. These descriptions are searchable and editable; they can contain AI mistakes. Indexed metadata changes invalidate the text-vector cache. Prices remain hard constraints taken directly from the JSON.

Try `math books`, `JS libs`, `flower`, `algebra for beginners`, `math cost 40$ ore more`, or `the book with white flowers on the cover`.

See [the training walkthrough](rag/docs/search-training.md) for indexing versus training, local fine-tuning steps, and the local-Qwen/assistant review process. `rag/training/retrieval-train.json` contains 33 accepted examples; `rag/training/retrieval-rejected.json` explains three rejections. The separate 26-case development regression set and reports are in `rag/training/retrieval-eval*.json`. Run `npm run test:search:hybrid` to regenerate the direct retrieval report. The real-model browser suite writes `rag/training/browser-retrieval-report.json`, including a comparison with the previous 0.9 policy on the same enriched catalog.

Prepare static models before building on a fresh checkout:

```sh
npm run models:prepare
npm run build
npm run test:search
npm run test:search:hybrid
npm run test:prices
npm run test:embeddings
npm run test:browser:embeddings
```

Model weights are ignored by Git and downloaded by `models:prepare`. `npm run build` runs this preparation automatically before Vite copies them from `public/models/` into the built site. Existing downloads are reused. Never force-add `public/models/` to Git. Source and model licenses remain with their original publishers.

Offline training with your local Qwen is optional authoring work. It generates supervised examples and trains the small browser intent classifier, not Qwen itself. Checkpoints and synthetic held-out metrics live in `rag/training/`; the generated intent artifact is retained in `rag/models/search-intent-model.json` for later experiments; the shelf search uses metadata and local embeddings; the topic classifier is retained only for experiments. To start a new 30-minute interval while retaining existing examples:

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
