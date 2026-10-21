# RAG workspace

Offline AI authoring, training experiments, evaluation data, and documentation live here.

- `training/`: examples, reviewed labels, evaluation cases, reports, and local diagnostics.
- `models/`: the generated experimental intent classifier (not used by shelf search).
- `scripts/`: local Qwen authoring, classifier training, vision diagnostics, and retrieval evaluation.
- `docs/search-training.md`: the training walkthrough and model limitations.

Run commands from the repository root:

```sh
npm run train:search
npm run test:search:hybrid
node rag/scripts/generate-retrieval-examples.mjs
node rag/scripts/describe-covers-local.mjs
node rag/scripts/check-local-vision.mjs
```

Local authoring scripts use the local Qwen server. Training is optional and is never started by the app or build.

Production browser search remains in `src/`, and the enriched catalog remains in `mock-data/data.json`. Application checks and model-download build tooling remain in `scripts/`. Downloaded browser weights remain ignored under `public/models/`, where Vite serves them; `npm run models:prepare` restores them.
