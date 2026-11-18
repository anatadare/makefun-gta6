// A tiny static server for game/ (Node 22, standard library only), so an entry can be played
// locally without a build step: `node serve.ts` serves game/ on http://localhost:8080, or on
// the port from --port N or the PORT environment variable. It sends the MIME types a browser
// game needs, answers HEAD with headers only, refuses any path outside game/, and otherwise
// does nothing clever: this is a development convenience, not a web server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));

function pickPort() {
  const args = process.argv.slice(2);
  const flag = args.indexOf('--port');
  const candidates = [flag === -1 ? undefined : args[flag + 1], process.env.PORT, '8080'];
  for (const raw of candidates) {
    if (raw === undefined) continue;
    const value = Number(raw);
    if (Number.isInteger(value) && value > 0 && value < 65536) return value;
  }
  return 8080;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveInside(requestPath: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(requestPath, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) return null;
  return file;
}

createServer((request, response) => {
  const file = resolveInside(request.url ?? '/');
  if (file === null) {
    response.writeHead(400).end('bad request');
    return;
  }
  let size: number;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  const headers = {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  };
  if (request.method === 'HEAD') {
    response.writeHead(200, headers).end();
    return;
  }
  response.writeHead(200, headers);
  createReadStream(file).pipe(response);
}).listen(pickPort(), '127.0.0.1', function (this: { address: () => { port: number } | null }) {
  const address = this.address();
  console.log(`game/ is on http://localhost:${address ? address.port : pickPort()}`);
});
