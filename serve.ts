// serve.ts — serves game/ on localhost for playing and playtesting.
// Run: node serve.ts (or PORT=8081 node serve.ts), then open the printed
// address in desktop Chrome. Static files only, no build step.

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const gameDir = join(dirname(fileURLToPath(import.meta.url)), "game");
const port = Number(process.env.PORT || 8080);

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = createServer((req, res) => {
  const rawPath = (req.url || "/").split("?")[0];
  const rel = rawPath === "/" ? "/index.html" : decodeURIComponent(rawPath);
  const file = join(gameDir, rel);
  if (!file.startsWith(gameDir) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found\n");
    return;
  }
  res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

server.listen(port, () => {
  console.log(`Solmara at http://localhost:${port}`);
});
