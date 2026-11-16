// Copies the three.js browser build into public/vendor so the client needs no bundler.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'three', 'build');
const dest = join(root, 'public', 'vendor');

if (!existsSync(src)) {
  console.warn('vendor: three is not installed yet, skipping');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const file of ['three.module.min.js', 'three.core.min.js']) {
  if (existsSync(join(src, file))) copyFileSync(join(src, file), join(dest, file));
}
console.log('vendor: three.js copied to public/vendor');
