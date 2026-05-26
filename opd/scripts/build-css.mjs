/**
 * Build minified CSS: small critical (blocking) + full bundle (deferred).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { transform } from 'lightningcss';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNavShellHtml } from './opd-nav-shell.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'public', 'assets');
const publicDir = path.join(root, 'public');

/** Minify CSS string. */
function minifyCss(filename, code) {
  const result = transform({
    filename,
    code: Buffer.from(code),
    minify: true,
    targets: {
      chrome: 90 << 16,
    },
  });
  return result.code.toString();
}

/** Concatenate and minify base + site styles (deferred). */
function buildBundle() {
  const base = readFileSync(path.join(assets, 'opd-base.css'), 'utf8');
  const site = readFileSync(path.join(assets, 'opd.css'), 'utf8');
  const min = minifyCss('opd.bundle.css', `${base}\n${site}`);
  const out = path.join(assets, 'opd.bundle.css');
  writeFileSync(out, min);
  return Buffer.byteLength(min, 'utf8');
}

/** Minify above-the-fold critical CSS. */
function buildCritical() {
  const src = readFileSync(path.join(root, 'scripts', 'opd-critical.src.css'), 'utf8');
  const min = minifyCss('opd-critical.css', src);
  const out = path.join(assets, 'opd-critical.css');
  writeFileSync(out, min);
  return Buffer.byteLength(min, 'utf8');
}

/** Stable stylesheet order — avoids CLS from async bundle applying late. */
const CSS_LINKS = `  <link rel="stylesheet" href="/assets/opd-critical.css" />
  <link rel="stylesheet" href="/assets/opd.bundle.css" />`;

const NAV_SHELL = buildNavShellHtml();

/** Inject prerendered nav + sync CSS links in static HTML shells. */
function patchHtmlFiles() {
  const cssPatterns = [
    /  <link rel="preload" href="\/assets\/opd\.bundle\.css" as="style" \/>\n  <link rel="stylesheet" href="\/assets\/opd-critical\.css" \/>\n  <link rel="stylesheet" href="\/assets\/opd\.bundle\.css" media="print" onload="this\.media='all'" \/>\n  <noscript><link rel="stylesheet" href="\/assets\/opd\.bundle\.css" \/><\/noscript>\n/g,
    /  <link rel="preload" href="\/assets\/opd-base\.css" as="style" \/>\n  <link rel="stylesheet" href="\/assets\/opd-base\.css" \/>\n  <link rel="stylesheet" href="\/assets\/opd\.css" \/>\n/g,
    /  <link rel="stylesheet" href="\/assets\/opd-base\.css" \/>\n  <link rel="stylesheet" href="\/assets\/opd\.css" \/>\n/g,
    /  <link rel="stylesheet" href="\/assets\/opd-critical\.css" \/>\n  <link rel="stylesheet" href="\/assets\/opd\.bundle\.css" \/>\n/g,
  ];

  const emptyNav = /<div id="opd-nav-root"><\/div>/;
  const filledNav = /<div id="opd-nav-root" data-opd-nav-prerendered>[\s\S]*?<\/div>\n\n  <main/;
  const navReplacement = `<div id="opd-nav-root" data-opd-nav-prerendered>\n${NAV_SHELL}\n  </div>\n\n  <main`;

  for (const name of readdirSync(publicDir)) {
    if (!name.endsWith('.html')) continue;
    const filePath = path.join(publicDir, name);
    let html = readFileSync(filePath, 'utf8');
    let changed = false;

    for (const pattern of cssPatterns) {
      if (pattern.test(html)) {
        html = html.replace(pattern, `${CSS_LINKS}\n`);
        changed = true;
        break;
      }
    }

    if (emptyNav.test(html)) {
      html = html.replace(emptyNav, navReplacement);
      changed = true;
    } else if (filledNav.test(html)) {
      html = html.replace(filledNav, navReplacement);
      changed = true;
    }

    if (changed) {
      writeFileSync(filePath, html);
    }
  }
}

const bundleBytes = buildBundle();
const criticalBytes = buildCritical();
patchHtmlFiles();

console.log(
  `Built CSS → opd-critical.css (${criticalBytes} B), opd.bundle.css (${bundleBytes} B); HTML shells updated`
);
