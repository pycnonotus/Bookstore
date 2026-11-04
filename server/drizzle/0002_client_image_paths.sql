-- Convert legacy filenames without rewriting existing paths or external URLs.
UPDATE "books"
SET "image" = '/images/' || "image"
WHERE "image" <> ''
  AND "image" NOT LIKE '%/%'
  AND "image" NOT LIKE '%:%';
