import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const port = Number(process.env.PORT) || 4173;

createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  if (pathname === '/ltp') { response.writeHead(308, { Location: '/ltp/' }).end(); return; }
  if (pathname === '/ltp/') pathname = '/ltp/index.html';
  if (!pathname.startsWith('/ltp/')) { response.writeHead(404).end(); return; }
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some(segment => segment.startsWith('.'))) { response.writeHead(404).end(); return; }
  const absolute = path.resolve(root, `.${pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) { response.writeHead(404).end(); return; }
  let info;
  try { info = await stat(absolute); }
  catch { response.writeHead(404).end(); return; }
  if (!info.isFile()) { response.writeHead(404).end(); return; }
  const type = mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {
      response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return;
    }
    response.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 });
    if (request.method === 'HEAD') response.end(); else createReadStream(absolute, { start, end }).pipe(response);
  } else {
    response.writeHead(200, { ...headers, 'Content-Length': info.size });
    if (request.method === 'HEAD') response.end(); else createReadStream(absolute).pipe(response);
  }
}).listen(port, '127.0.0.1', () => console.log(`ltplayer: http://localhost:${port}/ltp/`));
