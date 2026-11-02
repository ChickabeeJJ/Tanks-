// Builds dist/crazygames/ (the static client to upload to CrazyGames) and, if the
// `zip` CLI exists, dist/tanks-crazygames.zip.
//   node scripts/build.mjs [--server wss://your-server/ws]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'public');
const out = path.join(root, 'dist', 'crazygames');
const i = process.argv.indexOf('--server');
const server = i > 0 ? process.argv[i + 1] : process.env.TANKS_SERVER || '';

fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
fs.writeFileSync(path.join(out, 'config.js'),
  `window.TANKS_CONFIG = { server: ${JSON.stringify(server)}, offline: ${server ? 'false' : 'true'} };\n`);

let bytes = 0;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else bytes += fs.statSync(p).size;
});
walk(out);
console.log(`Built ${out} (${(bytes / 1024).toFixed(0)} KB)`);
console.log(server ? `Multiplayer server: ${server}` : 'No server set: the build runs offline with bots (pass --server wss://.../ws for multiplayer).');
try {
  execSync('zip -qr ../tanks-crazygames.zip .', { cwd: out });
  console.log('Zip: dist/tanks-crazygames.zip');
} catch {
  console.log('(zip CLI not found - zip the dist/crazygames folder yourself)');
}
