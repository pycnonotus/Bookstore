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

MainContent owns the topic filter using useState. App owns saved-book state so the catalog and StaffPicks share the same selections. Staff recommendations are stored on books in the catalog data array. SaveToggle is controlled through its value and onChange props. Saved selections survive filter changes and reset on reload.

The layout starts with one column and expands at sm, md, and lg breakpoints. Containers, wrapping navigation, and shrinkable grid children prevent horizontal overflow without hiding content.

## Browser checks

```sh
npm run test:browser
```

Uses installed Microsoft Edge in headless mode and starts its own Vite server on port 5174. Checks catalog rendering, filtering, saving and unsaving, state retention across filters, runtime errors, and horizontal overflow at ten widths from 240px to 1920px. Screenshots are written to the ignored `artifacts/` directory.
