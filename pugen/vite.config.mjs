import path from "node:path";
import { createRequire } from "node:module";
import { defineConfig } from "vite";

// Loaded at runtime (not bundled by Vite) so build.js's own require("pug") resolves normally.
const build = createRequire(import.meta.url)("./build.js");

// Renders index.pug (via build.js) in place of index.html, for both dev and build.
function pugPlugin() {
  return {
    name: "pug-render",
    transformIndexHtml: {
      order: "pre",
      handler: () => build.render().html
    },
    configureServer(server) {
      server.watcher.add(build.booksDir);
      const seedDir = path.resolve(build.booksDir);
      const reload = file => {
        if (file.endsWith(".pug") || path.resolve(file).startsWith(seedDir)) {
          server.ws.send({ type: "full-reload" });
        }
      };
      server.watcher.on("change", reload);
      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
    }
  };
}

export default defineConfig({
  plugins: [pugPlugin()]
});
