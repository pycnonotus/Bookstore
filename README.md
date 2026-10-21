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
- `rag/` — embeddings for free text search offline , no backend as we can't use backend at this part 🥲 
