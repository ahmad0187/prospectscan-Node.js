import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/sites');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain' };

/** Serves each folder in fixtures/sites on its own localhost port, like separate websites. */
export async function startFixtureSites(names = ['oakridge-plumbing', 'harbor-yoga', 'bright-smile-dental', 'sunset-bistro']) {
  const servers: http.Server[] = [];
  const urls: Record<string, string> = {};
  for (const name of names) {
    const root = path.join(SITES_DIR, name);
    const cfgPath = path.join(root, 'site.json');
    const { delayMs = 0 } = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      const rel = urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath;
      const file = path.join(root, path.normalize(rel));
      const send = () => {
        if (!file.startsWith(root) || !existsSync(file) || file.endsWith('site.json')) {
          res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>Not found</h1>');
          return;
        }
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
        res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
      };
      // Only the home page is slow, like a heavy old homepage.
      if (delayMs && (urlPath === '/' || urlPath === '/index.html')) setTimeout(send, delayMs); else send();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    servers.push(server);
    urls[name] = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  }
  return { urls, close: () => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))) };
}
