const textDecoder = (encoding) => new TextDecoder(encoding, { fatal: false });

function decodeFrame(bytes) {
  if (!bytes.length) return '';
  const encoding = bytes[0];
  let text;
  if (encoding === 0) text = textDecoder('latin1').decode(bytes.subarray(1));
  else if (encoding === 3) text = textDecoder('utf-8').decode(bytes.subarray(1));
  else if (encoding === 1) {
    const content = bytes.subarray(1);
    const bigEndian = content[0] === 0xfe && content[1] === 0xff;
    const offset = content[0] === 0xff && content[1] === 0xfe || bigEndian ? 2 : 0;
    text = textDecoder(bigEndian ? 'utf-16be' : 'utf-16le').decode(content.subarray(offset));
  } else if (encoding === 2) text = textDecoder('utf-16be').decode(bytes.subarray(1));
  else return '';
  return text.split('\0')[0].trim();
}

function syncSafe(bytes) {
  return ((bytes[0] & 0x7f) << 21) | ((bytes[1] & 0x7f) << 14) | ((bytes[2] & 0x7f) << 7) | (bytes[3] & 0x7f);
}

export function parseID3(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10 || String.fromCharCode(...bytes.subarray(0, 3)) !== 'ID3') return {};
  const version = bytes[3];
  if (version !== 3 && version !== 4) return {};
  const tagEnd = Math.min(bytes.length, 10 + syncSafe(bytes.subarray(6, 10)));
  let offset = 10;
  if (bytes[5] & 0x40 && offset + 4 < tagEnd) {
    const extra = version === 4 ? syncSafe(bytes.subarray(offset, offset + 4)) : new DataView(buffer, offset, 4).getUint32(0);
    offset += extra + (version === 3 ? 4 : 0);
  }
  const result = {};
  const keys = { TIT2: 'title', TPE1: 'artist', TALB: 'album' };
  while (offset + 10 <= tagEnd) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = version === 4 ? syncSafe(bytes.subarray(offset + 4, offset + 8)) : new DataView(buffer, offset + 4, 4).getUint32(0);
    if (size <= 0 || offset + 10 + size > tagEnd) break;
    if (keys[id]) result[keys[id]] = decodeFrame(bytes.subarray(offset + 10, offset + 10 + size)) || undefined;
    offset += 10 + size;
    if (result.title && result.artist && result.album) break;
  }
  return result;
}

export function nameFromFile(filename, album = '') {
  const base = filename.replace(/\.(mp3|mp4)$/i, '').replace(/_/g, ' ').trim();
  const separator = base.indexOf(' - ');
  return {
    title: separator > 0 ? base.slice(separator + 3).trim() : base || 'Untitled track',
    artist: separator > 0 ? base.slice(0, separator).trim() : 'Unknown artist',
    album: album || 'Local files'
  };
}

export async function metadataFromFile(file, album = '') {
  const fallback = nameFromFile(file.name, album);
  if (!/\.mp3$/i.test(file.name)) return fallback;
  try {
    const tag = parseID3(await file.slice(0, 1024 * 1024).arrayBuffer());
    return { ...fallback, ...Object.fromEntries(Object.entries(tag).filter(([, value]) => value)) };
  } catch {
    return fallback;
  }
}
