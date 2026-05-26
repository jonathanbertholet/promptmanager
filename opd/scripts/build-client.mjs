/**
 * Bundle page entry scripts for fewer network round-trips (Tier 2).
 */
import * as esbuild from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'public', 'assets');
const outdir = path.join(assets, 'dist');

/** Page-specific entry points (theme stays separate in <head>). */
const pages = [
  'home-search',
  'browse-all',
  'browse',
  'tag-browse',
  'prompt-page',
  'tags-page',
];

await mkdir(outdir, { recursive: true });
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await esbuild.build({
  entryPoints: pages.map((name) => path.join(assets, `${name}.js`)),
  bundle: true,
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  outdir,
  entryNames: '[name]',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
  logLevel: 'info',
});

console.log(`Built ${pages.length} page bundles → public/assets/dist/`);
