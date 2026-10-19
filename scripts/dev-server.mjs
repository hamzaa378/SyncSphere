/** Tiny static web server so this demo requires no frontend framework. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve, sep } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/plain', '.svg': 'image/svg+xml' };
createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end('Forbidden'); return; }
    if (!['.html', '.css', '.js', '.json', '.md', '.svg'].includes(extname(file))) {
      response.writeHead(404).end('Not found'); return;
    }
    const info = await stat(file);
    if (!info.isFile()) { response.writeHead(404).end('Not found'); return; }
    const bytes = await readFile(file);
    response.writeHead(200, {
      'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    response.end(bytes);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`\nSyncSphere running at http://localhost:${port}\n`));
