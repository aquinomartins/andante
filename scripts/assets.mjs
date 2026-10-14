import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const modelPath = path.join(root, 'public/models/hand_landmarker.task');
const manifestPath = path.join(root, 'public/models/manifest.json');
const source = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const expectedModelHash = 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
const hash = b => createHash('sha256').update(b).digest('hex');
const exists = async p => { try { await access(p, constants.R_OK); return true; } catch { return false; } };
const check = process.argv.includes('--check');
await mkdir(path.join(root, 'public/wasm'), { recursive: true });
const wasmFiles = ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm', 'vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'];
for (const file of wasmFiles) {
  const installed = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm', file);
  const target = path.join(root, 'public/wasm', file);
  if (check) {
    if (!await exists(target) || hash(await readFile(target)) !== hash(await readFile(installed))) throw new Error(`Asset WASM ausente ou incompatível: ${file}. Execute npm run assets.`);
  } else await copyFile(installed, target);
}
if (!await exists(modelPath)) {
  if (check) throw new Error('Modelo local ausente. Execute npm run assets com acesso a storage.googleapis.com. Não publique um build sem o modelo.');
  console.log('Baixando modelo oficial hand_landmarker float16, versão 1…');
  // Node fetch does not always honor a managed HTTPS proxy; curl does. Keep TLS verification enabled.
  const { spawnSync } = await import('node:child_process');
  const temporary = `${modelPath}.download`;
  const result = spawnSync('curl', ['--fail', '--location', '--connect-timeout', '20', '--max-time', '120', source, '-o', temporary], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Download bloqueado ou indisponível. Libere storage.googleapis.com no ambiente e execute npm run assets novamente.');
  const downloaded = await readFile(temporary);
  if (downloaded.length < 1_000_000 || !([0, 2].some(offset => downloaded[offset] === 0x50 && downloaded[offset + 1] === 0x4b))) throw new Error('O servidor não retornou um bundle de modelo válido.');
  if (hash(downloaded) !== expectedModelHash) throw new Error('O checksum do modelo oficial não corresponde à versão fixada. Não use este arquivo.');
  const { rename } = await import('node:fs/promises');
  await rename(temporary, modelPath);
  await writeFile(manifestPath, JSON.stringify({ source, version: 'float16/1', sha256: hash(downloaded), bytes: downloaded.length }, null, 2) + '\n');
}
const model = await readFile(modelPath);
if (!await exists(manifestPath)) throw new Error('Modelo sem manifesto de integridade. Não substitua checksums para aceitar arquivos desconhecidos.');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.source !== source || manifest.sha256 !== expectedModelHash || hash(model) !== expectedModelHash) throw new Error('Modelo alterado ou fonte incompatível. Restaure o asset oficial.');
console.log(`Assets locais verificados: MediaPipe 1.1.0; modelo ${manifest.version}, SHA-256 ${manifest.sha256}.`);
