import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildAppIconVariant, findChromium, renderHtmlToPng,
} from './preview/render-icon-candidates-v2.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const size = 1024;
const appearances = [
  { filename: 'AppIcon.png', label: 'ライト' },
  { filename: 'AppIcon-Dark.png', label: 'ダーク', value: 'dark' },
  { filename: 'AppIcon-Tinted.png', label: '色合い調整', value: 'tinted' },
];
const slots = appearances.map(({ filename, value }) => ({
  filename, idiom: 'universal', platform: 'ios', size: '1024x1024',
  ...(value && { appearances: [{ appearance: 'luminosity', value }] }),
}));

function buildPreview(pngs) {
  const columns = pngs.map((png, index) => {
    const src = `data:image/png;base64,${png.toString('base64')}`;
    return `<section><h2>${appearances[index].label}</h2>
      <img class="large" src="${src}" alt=""><p>120 px</p>
      <img class="small" src="${src}" alt=""><p>ひと呼吸 · 60 px</p>
    </section>`;
  });
  return `<!doctype html><html lang="ja"><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>
  body { margin: 0; padding: 16px; background: #f2f2f7; color: #1c1c1e; font: 14px system-ui, sans-serif; }
  h1 { margin: 0 0 12px; font-size: 18px; }
  main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  section { text-align: center; border-radius: 16px; padding: 12px 0 10px; background: #141824; color: #fff; }
  section:first-child { background: #d9e4f1; color: #1c1c1e; }
  h2, p { margin: 0; font-size: 13px; }
  img { display: block; margin: 10px auto 4px; box-shadow: 0 4px 12px #0003; }
  .large { width: 120px; height: 120px; border-radius: 27px; }
  .small { width: 60px; height: 60px; border-radius: 13.5px; }
</style>
<h1>ひと呼吸のホーム画面アイコン</h1>
<main>${columns.join('')}</main></html>`;
}

function renderVariants(svg, chosen, light, root) {
  const tempRoot = path.join(root, 'tmp');
  mkdirSync(tempRoot, { recursive: true });
  const work = mkdtempSync(path.join(tempRoot, 'app-icon-'));
  const page = path.join(work, 'render.html');
  const output = path.join(work, 'render.png');
  const profile = path.join(work, 'profile');

  try {
    const chromium = findChromium();
    function render(html, width, height) {
      writeFileSync(page, html);
      renderHtmlToPng(chromium, profile, page, output, width, height);
      return readFileSync(output);
    }

    const pngs = [light, ...appearances.slice(1).map(({ value }) =>
      render(buildAppIconVariant(svg, chosen, value), size, size))];
    return { pngs, preview: render(buildPreview(pngs), 520, 350) };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function validateIconPng(png, filename) {
  if (png.length < 33 || png.subarray(0, 16).toString('hex') !==
      '89504e470d0a1a0a0000000d49484452' ||
      png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size ||
      png[24] !== 8 || png[25] !== 2) {
    throw new Error(`${filename} は1024 × 1024の不透明なRGB PNGである必要があります。`);
  }
  let hasImageData = false;
  for (let offset = 33; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    offset += length + 12;
    if (offset > png.length || type === 'tRNS') break;
    if (type === 'IDAT') hasImageData = true;
    if (type === 'IEND' && length === 0 && hasImageData && offset === png.length) return;
  }
  throw new Error(`${filename} のPNGデータが不完全か、透過色を含んでいます。`);
}

export function appIcon({ root = repo, write = false } = {}) {
  const chosen = readFileSync(path.join(root, 'docs/icon/chosen.txt'), 'utf8').trim();
  if (chosen === '') return '未選択';
  if (!/^[a-d]$/.test(chosen)) throw new Error('採用案は a、b、c、d のいずれか1文字で指定してください。');

  const catalog = path.join(root, 'App/Assets.xcassets/AppIcon.appiconset');
  const contents = path.join(catalog, 'Contents.json');
  const manifest = JSON.parse(readFileSync(contents, 'utf8'));
  const source = path.join(root, 'docs/icon/v2', chosen);
  const light = readFileSync(`${source}.png`);
  if (write) {
    const svg = readFileSync(`${source}.svg`, 'utf8');
    const { pngs, preview } = renderVariants(svg, chosen, light, root);
    pngs.forEach((png, index) => validateIconPng(png, slots[index].filename));
    pngs.forEach((png, index) => writeFileSync(path.join(catalog, slots[index].filename), png));
    writeFileSync(path.join(root, 'docs/preview/app-icon.png'), preview);
    manifest.images = slots;
    writeFileSync(contents, `${JSON.stringify(manifest, null, 2)}\n`);
    return '採用案のAppIconを生成しました。';
  }
  const regenerate = 'node tools/app-icon.mjs --write で採用案の画像を生成してください。';
  if (manifest.images.length !== slots.length || !slots.every(slot => manifest.images.some(image =>
    image.filename === slot.filename && image.idiom === slot.idiom &&
    image.platform === slot.platform && image.size === slot.size &&
    JSON.stringify(image.appearances) === JSON.stringify(slot.appearances)))) {
    throw new Error(`AppIconが未登録です。${regenerate}`);
  }
  const pngs = slots.map(({ filename }) => {
    const png = readFileSync(path.join(catalog, filename));
    validateIconPng(png, filename);
    return png;
  });
  if (!pngs[0].equals(light)) {
    throw new Error(`AppIconが採用案の生成結果と一致しません。${regenerate}`);
  }
  return 'AppIconの3種類を確認しました。';
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
