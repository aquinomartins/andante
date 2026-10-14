import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const html = await readFile(path.join(root, 'index.html'), 'utf8');
if (html.includes('/src/main.ts')) throw new Error('Código-fonte encontrado no build. Não publique este index.html.');
const files = [];
for (const folder of ['assets', 'wasm', 'models']) {
 for (const name of (await readdir(path.join(root, folder))).sort()) {
  const relative = `${folder}/${name}`; const info = await stat(path.join(root, relative));
  if (!info.isFile()) continue;
  const buffer = await readFile(path.join(root, relative));
  files.push({ path: relative, bytes: info.size, sha256: createHash('sha256').update(buffer).digest('hex'), kind: name.endsWith('.js') ? 'js' : name.endsWith('.css') ? 'css' : name.endsWith('.wasm') ? 'wasm' : 'binary' });
 }
}
await writeFile(path.join(root, 'deployment.json'), JSON.stringify({ version: '1.0.1', files }, null, 2) + '\n');
console.log('Manifesto de publicação gerado; inclui .htaccess, boot e verificação da instalação.');
