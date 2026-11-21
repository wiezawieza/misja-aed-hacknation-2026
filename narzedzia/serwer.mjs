// Minimalny serwer statyczny bez zależności (Node.js ≥ 16): `npm start` → http://localhost:8080/prototyp/
// Nie wymaga `npm install`. Prototyp działa też bez serwera – wystarczy otworzyć prototyp/index.html.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const TYPY = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.csv': 'text/csv; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.md': 'text/markdown; charset=utf-8', '.ttf': 'font/ttf', '.geojson': 'application/geo+json' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') { res.writeHead(302, { Location: '/prototyp/' }); return res.end(); }
    let f = normalize(join(ROOT, p));
    if (f !== ROOT && !f.startsWith(ROOT + sep)) { res.writeHead(403); return res.end('403'); }
    if ((await stat(f)).isDirectory()) {
      if (!p.endsWith('/')) { res.writeHead(302, { Location: p + '/' }); return res.end(); }
      f = join(f, 'index.html');
    }
    const dane = await readFile(f);
    res.writeHead(200, { 'Content-Type': TYPY[extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(dane);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 – nie znaleziono');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Błąd: port ${PORT} jest już zajęty. Zamknij aplikację używającą portu ${PORT} lub uruchom na innym porcie (np. PORT=8081 npm start).`);
    process.exit(1);
  } else {
    console.error('Błąd serwera:', err);
    process.exit(1);
  }
});

server.listen(PORT, () => console.log(`Misja AED – prototyp: http://localhost:${PORT}/prototyp/  (Ctrl+C kończy)`));
