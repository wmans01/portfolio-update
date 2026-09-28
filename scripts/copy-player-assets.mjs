import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'ltp');
const destination = path.join(root, 'dist', 'ltp');

await mkdir(destination, { recursive: true });
await cp(path.join(source, 'library.json'), path.join(destination, 'library.json'));
await cp(path.join(source, 'music'), path.join(destination, 'music'), { recursive: true });
