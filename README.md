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

Every catalog and staff-pick card shows a demo price between $4.99 and $49.99. `src/utils/bookPrice.js` hashes the book title to keep prices consistent across filtering, saves, and reloads. Cards are 450px tall and no wider than 450px, with two-line titles, single-line authors, and three-line descriptions truncated with ellipses. Hover truncated text to see its full value; prices and Save controls stay visible.

The layout starts with one column and expands at sm, md, and lg breakpoints. Containers, wrapping navigation, and shrinkable grid children prevent horizontal overflow without hiding content.

The navbar stays at the top while scrolling. Its measured height keeps topic headings and anchor destinations below it, including when navigation wraps on smaller screens.

Topic shelves stack over the previous shelf as you scroll, with a subtle parallax depth effect. Each topic heading and book count stays visible above its books until the next topic takes over. Taller shelves scroll through all their books before pinning. Stack offsets respond to viewport and filter changes. Reduced-motion preferences and keyboard focus inside the shelves use normal document flow while keeping topic headings sticky and every book accessible.

## Browser checks

```sh
npm run test:browser
```

Uses installed Microsoft Edge in headless mode and starts its own Vite server on port 5174. Checks topic grouping, multi-select filtering and reset, keyboard interaction, saving and unsaving, state retention across filters, reduced-motion support, runtime errors, and horizontal overflow at ten widths from 240px to 1920px plus four filtered widths. Screenshots are written to the ignored `artifacts/` directory.
