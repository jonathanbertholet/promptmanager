import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv[2] || 'all';
if (!['all', 'chrome', 'firefox'].includes(target)) throw new Error('Usage: node scripts/build.mjs [all|chrome|firefox]');
const base = JSON.parse(await readFile(path.join(root, 'src/manifest.json'), 'utf8'));
const targets = target === 'all' ? ['chrome', 'firefox'] : [target];
const artifacts = path.join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });

for (const browser of targets) {
  const manifest = structuredClone(base);
  if (browser === 'firefox') {
    Object.assign(manifest, JSON.parse(await readFile(path.join(root, 'manifests/firefox.json'), 'utf8')));
    delete manifest.side_panel;
    delete manifest.externally_connectable;
    manifest.permissions = manifest.permissions.filter(permission => permission !== 'sidePanel');
    manifest.permissions.push('clipboardWrite');
    const storeUrl = process.env.FIREFOX_STORE_URL;
    if (storeUrl && !storeUrl.startsWith('https://addons.mozilla.org/')) throw new Error('FIREFOX_STORE_URL must be an addons.mozilla.org URL');
    manifest.homepage_url = storeUrl || 'https://github.com/jonathanbertholet/promptmanager/releases';
  }

  const destination = path.join(root, 'dist', browser);
  await rm(destination, { recursive: true, force: true });
  await cp(path.join(root, 'src'), destination, { recursive: true });
  await writeFile(path.join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const archive = path.join(artifacts, `open-prompt-manager-${manifest.version}-${browser}.zip`);
  await rm(archive, { force: true });
  // Store packages contain only the shared application and target manifest.
  execFileSync('zip', ['-q', '-r', archive, '.', '-x', '*.DS_Store'], { cwd: destination });
  console.log(`${browser}: ${destination}\nPackage: ${archive}`);
}
