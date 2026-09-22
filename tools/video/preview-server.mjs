import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const games = path.resolve(root, '../../games');
const port = Number(process.env.VIDEO_PORT || 8781);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid VIDEO_PORT');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let file;
  if (/^\/games\/(jelly|kitchen|bubble|magnet|hockey|racer)\.js$/.test(pathname)) {
    file = path.join(games, path.basename(pathname));
  } else if (['/', '/film.html', '/film.js'].includes(pathname)) {
    file = path.join(root, pathname === '/' ? 'film.html' : pathname.slice(1));
  } else { res.writeHead(404).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Video preview: http://127.0.0.1:${port}`));
