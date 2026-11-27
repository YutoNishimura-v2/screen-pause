import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findChromium } from './preview/render-icon-candidates.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const size = 1024;
const filename = 'AppIcon.png';

function renderIcon(svg, root) {
  const tempRoot = path.join(root, 'tmp');
  mkdirSync(tempRoot, { recursive: true });
  const work = mkdtempSync(path.join(tempRoot, 'app-icon-'));
  const page = path.join(work, 'icon.html');
  const output = path.join(work, filename);
  try {
    writeFileSync(page, `<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>body { margin: 0; overflow: hidden; } img { display: block; }</style>
<img width="${size}" height="${size}" src="data:image/svg+xml;base64,${svg.toString('base64')}">`);
    execFileSync(findChromium(), [
      '--headless=new', '--disable-gpu', '--disable-background-networking',
      '--disable-component-update', '--disable-sync', '--disable-extensions',
      '--no-first-run', '--no-default-browser-check', '--no-proxy-server',
      '--host-resolver-rules=MAP * ~NOTFOUND', '--force-color-profile=srgb',
      '--force-device-scale-factor=1', '--hide-scrollbars',
      `--window-size=${size},${size}`, `--user-data-dir=${path.join(work, 'profile')}`,
      `--screenshot=${output}`, pathToFileURL(page).href,
    ], { windowsHide: true, stdio: 'pipe', timeout: 30_000 });
    return readFileSync(output);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export function appIcon({ root = repo, write = false, render = renderIcon } = {}) {
  const chosen = readFileSync(path.join(root, 'docs/icon/chosen.txt'), 'utf8').trim();
  if (chosen === '') return '未選択';
  if (!/^[abc]$/.test(chosen)) throw new Error('採用案は a、b、c のいずれか1文字で指定してください。');

  const catalog = path.join(root, 'App/Assets.xcassets/AppIcon.appiconset');
  const contents = path.join(catalog, 'Contents.json');
  const manifest = JSON.parse(readFileSync(contents, 'utf8'));
  const [slot] = manifest.images;
  if (manifest.images.length !== 1 || slot.idiom !== 'universal' ||
      slot.platform !== 'ios' || slot.size !== '1024x1024') {
    throw new Error('AppIconにiOS共通の1024px枠が1つ必要です。');
  }
  const asset = path.join(catalog, filename);
  const svg = readFileSync(path.join(root, 'docs/icon/candidates', `${chosen}.svg`));
  const expected = render(svg, root);
  if (expected.length < 33 || expected.subarray(0, 16).toString('hex') !==
      '89504e470d0a1a0a0000000d49484452' ||
      expected.readUInt32BE(16) !== size || expected.readUInt32BE(20) !== size ||
      expected[24] !== 8 || expected[25] !== 2) {
    throw new Error('生成結果は1024 × 1024の不透明なRGB PNGである必要があります。');
  }
  if (write) {
    writeFileSync(asset, expected);
    slot.filename = filename;
    writeFileSync(contents, `${JSON.stringify(manifest, null, 2)}\n`);
    return '採用案のAppIconを生成しました。';
  }
  const regenerate = 'node tools/app-icon.mjs --write で採用案の画像を生成してください。';
  if (slot.filename !== filename || !existsSync(asset)) {
    throw new Error(`AppIconが未登録です。${regenerate}`);
  }
  if (!readFileSync(asset).equals(expected)) {
    throw new Error(`AppIconが採用案の生成結果と一致しません。${regenerate}`);
  }
  return 'AppIconは採用案と一致しています。';
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const [option, ...extra] = process.argv.slice(2);
    if (extra.length || (option !== undefined && option !== '--write')) {
      throw new Error('使い方は node tools/app-icon.mjs [--write] です。');
    }
    console.log(appIcon({ write: option === '--write' }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
