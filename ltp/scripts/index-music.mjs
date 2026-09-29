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
const folders = new Map();
for (const absolute of await walk(musicRoot)) {
  const relative = path.relative(musicRoot, absolute).split(path.sep);
  const folder = relative.length > 1 ? relative[0] : null;
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
  const track = {
    id: `music:${relative.join('/')}`,
    src: `./music/${relative.map(encodeURIComponent).join('/')}`,
    title: tags.title || fallback.title,
    artist: tags.artist || fallback.artist,
    album: tags.album || fallback.album,
    kind: /\.mp4$/i.test(absolute) ? 'mp4' : 'mp3',
    addedAt: fileStat.mtimeMs
  };
  tracks.push(track);
  if (folder) {
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push({ id: track.id, filename: relative.at(-1) });
  }
}
tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

const playlists = [];
for (const [folder, entries] of folders) {
  entries.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' }));
  const byArchiveId = new Map(entries.map(entry => [entry.filename.match(/\[([^\]]+)\]\.(?:mp3|mp4)$/i)?.[1], entry.id]));
  const ordered = [];
  const seen = new Set();
  try {
    const archive = await readFile(path.join(musicRoot, folder, 'downloaded.txt'), 'utf8');
    for (const line of archive.split(/\r?\n/)) {
      const id = byArchiveId.get(line.trim().split(/\s+/).at(-1));
      if (id && !seen.has(id)) { ordered.push(id); seen.add(id); }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const entry of entries) {
    if (!seen.has(entry.id)) ordered.push(entry.id);
  }
  playlists.push({ id: `folder:${folder}`, name: folder.replace(/_/g, ' '), trackIds: ordered });
}
playlists.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

const manifestPath = path.join(root, 'library.json');
let previous;
try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); }
catch { previous = null; }
if (JSON.stringify(previous?.tracks) !== JSON.stringify(tracks) || JSON.stringify(previous?.playlists) !== JSON.stringify(playlists)) {
  await writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), tracks, playlists }, null, 2)}\n`);
}
console.log(`Indexed ${tracks.length} track${tracks.length === 1 ? '' : 's'} and ${playlists.length} playlist${playlists.length === 1 ? '' : 's'} from music/.`);
