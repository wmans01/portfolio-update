import { open, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nameFromFile, parseID3 } from '../src/metadata.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const musicRoot = path.join(root, 'music');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(absolute));
    else if (entry.isFile() && /\.(mp3|mp4)$/i.test(entry.name)) found.push(absolute);
  }
  return found;
}

const tracks = [];
for (const absolute of await walk(musicRoot)) {
  const relative = path.relative(musicRoot, absolute).split(path.sep);
  const album = relative.length > 1 ? relative.at(-2).replace(/_/g, ' ') : '';
  const fallback = nameFromFile(relative.at(-1), album);
  let tags = {};
  if (/\.mp3$/i.test(absolute)) {
    const handle = await open(absolute, 'r');
    try {
      const header = Buffer.alloc(1024 * 1024);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      tags = parseID3(header.buffer.slice(header.byteOffset, header.byteOffset + bytesRead));
    } finally { await handle.close(); }
  }
  const fileStat = await stat(absolute);
  tracks.push({
    id: `music:${relative.join('/')}`,
    src: `./music/${relative.map(encodeURIComponent).join('/')}`,
    title: tags.title || fallback.title,
    artist: tags.artist || fallback.artist,
    album: tags.album || fallback.album,
    kind: /\.mp4$/i.test(absolute) ? 'mp4' : 'mp3',
    addedAt: fileStat.mtimeMs
  });
}
tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
const manifestPath = path.join(root, 'library.json');
let previous;
try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); }
catch { previous = null; }
if (JSON.stringify(previous?.tracks) !== JSON.stringify(tracks)) {
  await writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), tracks }, null, 2)}\n`);
}
console.log(`Indexed ${tracks.length} track${tracks.length === 1 ? '' : 's'} from music/.`);
