import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const v2Dir = path.join(rootDir, 'docs', 'icon', 'v2');
const previewPath = path.join(rootDir, 'docs', 'preview', 'icon-candidates-v2.png');
const refComparisonPath = path.join(rootDir, 'tmp', 'icon-ref-comparison-60px.png');

const CANDIDATES = [
  {
    id: 'a',
    label: 'A',
    title: 'ひと呼吸の柱',
    subtitle: 'インディゴ・ガラス二柱',
    darkGlyph: ['#ABA9FF', '#7470F2', '#4D49CE'],
    darkShadow: '#000000',
  },
  {
    id: 'b',
    label: 'B',
    title: '静かな切れ目',
    subtitle: '黒曜・開いた輪',
    darkGlyph: ['#F6F9FF', '#BDCAE0', '#8796B5'],
    darkBg: ['#1D2028', '#11131A', '#07080C'],
    darkShadow: '#000000',
  },
  {
    id: 'c',
    label: 'C',
    title: '呼吸の弧',
    subtitle: '海青・双弧の余白',
    darkGlyph: ['#8EC9FF', '#3F96FA', '#1863D6'],
    darkShadow: '#000000',
  },
  {
    id: 'd',
    label: 'D',
    title: '静寂のしずく',
    subtitle: '翡翠・受け弧と点',
    darkGlyph: ['#80F2DE', '#2EC9B3', '#128E7E'],
    darkShadow: '#000000',
  },
];

function findChromium() {
  const localAppData = process.env.LOCALAPPDATA ?? '';
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';

  const candidates = [
    process.env.CHROME_PATH,
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
    path.join(programFiles, 'Chromium', 'Application', 'chrome.exe'),
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Headless Chromium/Chrome executable not found.');
}

function makeVariantSvg(svgSource, mode, candidate) {
  let out = svgSource;
  if (mode === 'dark') {
    const bgStops = candidate.darkBg ?? ['#252730', '#171920', '#0D0E13'];
    out = out.replace(
      /<linearGradient id="bg"[\s\S]*?<\/linearGradient>/,
      `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bgStops[0]}"/>
      <stop offset="52%" stop-color="${bgStops[1]}"/>
      <stop offset="100%" stop-color="${bgStops[2]}"/>
    </linearGradient>`
    );
    out = out.replace(
      /<linearGradient id="ambient"[\s\S]*?<\/linearGradient>/,
      `<linearGradient id="ambient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${candidate.darkGlyph[1]}" stop-opacity="0.12"/>
      <stop offset="42%" stop-color="#0D0E13" stop-opacity="0"/>
    </linearGradient>`
    );
    out = out.replace(
      /<linearGradient id="glass"[\s\S]*?<\/linearGradient>/,
      `<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${candidate.darkGlyph[0]}"/>
      <stop offset="58%" stop-color="${candidate.darkGlyph[1]}"/>
      <stop offset="100%" stop-color="${candidate.darkGlyph[2]}"/>
    </linearGradient>`
    );
    out = out.replace(
      /flood-color="[^"]+" flood-opacity="[^"]+"/,
      `flood-color="#000000" flood-opacity="0.55"`
    );
  } else if (mode === 'tinted') {
    out = out.replace(
      /<linearGradient id="bg"[\s\S]*?<\/linearGradient>/,
      `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#222632"/>
      <stop offset="52%" stop-color="#151822"/>
      <stop offset="100%" stop-color="#0B0D14"/>
    </linearGradient>`
    );
    out = out.replace(
      /<linearGradient id="ambient"[\s\S]*?<\/linearGradient>/,
      `<linearGradient id="ambient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#80A7FF" stop-opacity="0.14"/>
      <stop offset="42%" stop-color="#0B0D14" stop-opacity="0"/>
    </linearGradient>`
    );
    out = out.replace(
      /<linearGradient id="glass"[\s\S]*?<\/linearGradient>/,
      `<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#CFE0FF"/>
      <stop offset="58%" stop-color="#8EB4FF"/>
      <stop offset="100%" stop-color="#5E87EC"/>
    </linearGradient>`
    );
    out = out.replace(
      /flood-color="[^"]+" flood-opacity="[^"]+"/,
      `flood-color="#000000" flood-opacity="0.50"`
    );
  }
  return out;
}

function toDataUri(svgText) {
  return `data:image/svg+xml;base64,${Buffer.from(svgText, 'utf8').toString('base64')}`;
}

function renderHtmlToPng(chromiumPath, profileDir, htmlPath, outPath, width, height) {
  execFileSync(
    chromiumPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${width},${height}`,
      `--user-data-dir=${profileDir}`,
      `--screenshot=${outPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'pipe', windowsHide: true }
  );
}

function measureGlyphBBox(chromiumPath, profileDir, htmlPath, svgText) {
  const measureHtml = `<!doctype html><html><body style="margin:0">${svgText}</body></html>`;
  writeFileSync(htmlPath, measureHtml, 'utf8');
  const dom = execFileSync(
    chromiumPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--dump-dom',
      `--user-data-dir=${profileDir}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'pipe', windowsHide: true, encoding: 'utf8' }
  );
  // Also evaluate getBBox via inline script? --dump-dom executes scripts!
  return dom;
}

function buildSingleIconHtml(svgText) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><style>
* { margin: 0; padding: 0; }
html, body { width: 1024px; height: 1024px; overflow: hidden; background: #000; }
img { display: block; width: 1024px; height: 1024px; }
</style></head>
<body><img src="${toDataUri(svgText)}" width="1024" height="1024"></body>
</html>`;
}

function buildPreviewSheetHtml(items, bboxStats) {
  const largeCols = items
    .map((item) => {
      const stats = bboxStats[item.id];
      return `
      <div class="lg-col">
        <div class="tile tile-156"><img src="${item.lightUri}" alt="${item.label}"></div>
        <div class="col-label">${item.label}　${item.title}</div>
        <div class="col-sub">${item.subtitle}</div>
        <div class="col-meta">図形占有 ${stats.wPct}% × ${stats.hPct}%</div>
      </div>`;
    })
    .join('');

  const sizeColumns = (theme) =>
    items
      .map(
        (item) => `
      <div class="wp-col">
        <div class="tile tile-120 ${theme === 'dark' ? 'tile-dark-wp' : 'tile-light-wp'}">
          <img src="${item.lightUri}" alt="${item.label} 120px">
        </div>
        <div class="size-tag">120px</div>
        <div class="tile tile-60 ${theme === 'dark' ? 'tile-dark-wp' : 'tile-light-wp'}">
          <img src="${item.lightUri}" alt="${item.label} 60px">
        </div>
        <div class="app-name ${theme === 'dark' ? 'name-dark' : 'name-light'}">ひと呼吸</div>
        <div class="size-tag">${item.label}（60px）</div>
      </div>`
      )
      .join('');

  const variantRow = (variantKey, caption) =>
    items
      .map(
        (item) => `
      <div class="var-col">
        <div class="tile tile-60 tile-dark-wp">
          <img src="${item[variantKey]}" alt="${item.label} ${caption}">
        </div>
        <div class="app-name name-dark">${item.label}</div>
      </div>`
      )
      .join('');

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 820px;
    height: 1180px;
    background: #F2F2F7;
    color: #1C1C1E;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Hiragino Sans", "Yu Gothic UI", sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }
  .wrap {
    padding: 28px 28px 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0 4px;
  }
  .header h1 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .header p {
    font-size: 13px;
    color: #636366;
  }
  .card {
    background: #FFFFFF;
    border-radius: 18px;
    padding: 18px 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  .sec-title {
    font-size: 14px;
    font-weight: 600;
    color: #3A3A3C;
    margin-bottom: 14px;
  }
  .lg-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    text-align: center;
  }
  .lg-col {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .tile {
    overflow: hidden;
    flex-shrink: 0;
    position: relative;
  }
  .tile img {
    display: block;
    width: 100%;
    height: 100%;
  }
  .tile-156 {
    width: 156px;
    height: 156px;
    border-radius: 35px;
    box-shadow: 0 10px 24px rgba(15, 20, 35, 0.14), inset 0 0 0 0.5px rgba(0,0,0,0.08);
  }
  .tile-120 {
    width: 120px;
    height: 120px;
    border-radius: 27px;
  }
  .tile-60 {
    width: 60px;
    height: 60px;
    border-radius: 13.5px;
  }
  .tile-light-wp {
    box-shadow: 0 4px 12px rgba(20, 30, 50, 0.14), 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  }
  .tile-dark-wp {
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45), 0 0 0 0.5px rgba(255, 255, 255, 0.10);
  }
  .col-label {
    margin-top: 10px;
    font-size: 14px;
    font-weight: 700;
    color: #1C1C1E;
  }
  .col-sub {
    margin-top: 2px;
    font-size: 12px;
    color: #636366;
  }
  .col-meta {
    margin-top: 3px;
    font-size: 11px;
    color: #8E8E93;
    font-variant-numeric: tabular-nums;
  }
  .wp-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .wp-box {
    border-radius: 16px;
    padding: 16px 14px 14px;
  }
  .wp-light {
    background: linear-gradient(180deg, #E8EEF7 0%, #D9E4F1 100%);
    border: 1px solid rgba(0, 0, 0, 0.06);
  }
  .wp-dark {
    background: linear-gradient(180deg, #1B2030 0%, #0D1018 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .wp-title {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
    text-align: center;
  }
  .wp-title-light { color: #3A3F4B; }
  .wp-title-dark { color: #D1D5E0; }
  .wp-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    align-items: start;
  }
  .wp-col {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .wp-col .tile-120 {
    width: 78px;
    height: 78px;
    border-radius: 17.5px;
  }
  /* Keep exact 120px in a dedicated full-width section below! Wait: we must show REAL 120px AND 60px! */
  .size-tag {
    margin-top: 4px;
    font-size: 10px;
    color: #8E8E93;
  }
  .app-name {
    margin-top: 4px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .name-light { color: #1C1C1E; }
  .name-dark { color: #F2F2F7; }
</style>
</head>
<body></body>
</html>`;
}

function buildRealSizePreviewHtml(items, bboxStats) {
  const largeCols = items
    .map((item) => {
      const stats = bboxStats[item.id];
      return `
      <div class="lg-col">
        <div class="tile tile-156"><img src="${item.lightUri}" alt="${item.label}"></div>
        <div class="col-label">${item.label}　${item.title}</div>
        <div class="col-sub">${item.subtitle}</div>
        <div class="col-meta">図形 ${stats.wPct}% × ${stats.hPct}%</div>
      </div>`;
    })
    .join('');

  const wpStrip = (theme, title) => `
    <div class="wp-box ${theme === 'dark' ? 'wp-dark' : 'wp-light'}">
      <div class="wp-title ${theme === 'dark' ? 'wp-title-dark' : 'wp-title-light'}">${title}</div>
      <div class="wp-grid-4">
        ${items
          .map(
            (item) => `
          <div class="wp-col">
            <div class="tile tile-120 ${theme === 'dark' ? 'tile-dark-wp' : 'tile-light-wp'}">
              <img src="${item.lightUri}" alt="${item.label} 120px">
            </div>
            <div class="meta-tag ${theme === 'dark' ? 'meta-dark' : 'meta-light'}">120px</div>
            <div class="tile tile-60 ${theme === 'dark' ? 'tile-dark-wp' : 'tile-light-wp'}" style="margin-top:12px;">
              <img src="${item.lightUri}" alt="${item.label} 60px">
            </div>
            <div class="app-name ${theme === 'dark' ? 'name-dark' : 'name-light'}">ひと呼吸</div>
            <div class="meta-tag ${theme === 'dark' ? 'meta-dark' : 'meta-light'}">${item.label} / 60px</div>
          </div>`
          )
          .join('')}
      </div>
    </div>`;

  const variantStrip = (variantKey, title) => `
    <div class="var-block">
      <div class="wp-title wp-title-dark">${title}</div>
      <div class="wp-grid-4">
        ${items
          .map(
            (item) => `
          <div class="wp-col">
            <div class="tile tile-60 tile-dark-wp">
              <img src="${item[variantKey]}" alt="${item.label} ${title}">
            </div>
            <div class="app-name name-dark">${item.label}・ひと呼吸</div>
          </div>`
          )
          .join('')}
      </div>
    </div>`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 820px;
    height: 1160px;
    background: #F2F2F7;
    color: #1C1C1E;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Hiragino Sans", "Yu Gothic UI", sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }
  .wrap {
    padding: 24px 26px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0 4px;
  }
  .header h1 {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .header p {
    font-size: 13px;
    color: #636366;
  }
  .card {
    background: #FFFFFF;
    border-radius: 18px;
    padding: 16px 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  .sec-title {
    font-size: 13px;
    font-weight: 600;
    color: #3A3A3C;
    margin-bottom: 12px;
  }
  .lg-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .lg-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .tile {
    overflow: hidden;
    flex-shrink: 0;
  }
  .tile img {
    display: block;
    width: 100%;
    height: 100%;
  }
  .tile-156 {
    width: 156px;
    height: 156px;
    border-radius: 35px;
    box-shadow: 0 10px 22px rgba(15, 20, 35, 0.14), 0 0 0 0.5px rgba(0,0,0,0.08);
  }
  .tile-120 {
    width: 120px;
    height: 120px;
    border-radius: 27px;
  }
  .tile-60 {
    width: 60px;
    height: 60px;
    border-radius: 13.5px;
  }
  .tile-light-wp {
    box-shadow: 0 4px 12px rgba(20, 30, 50, 0.14), 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  }
  .tile-dark-wp {
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45), 0 0 0 0.5px rgba(255, 255, 255, 0.10);
  }
  .col-label {
    margin-top: 9px;
    font-size: 14px;
    font-weight: 700;
  }
  .col-sub {
    margin-top: 2px;
    font-size: 11.5px;
    color: #636366;
  }
  .col-meta {
    margin-top: 2px;
    font-size: 11px;
    color: #8E8E93;
    font-variant-numeric: tabular-nums;
  }
  .wp-box {
    border-radius: 16px;
    padding: 14px 20px 14px;
  }
  .wp-light {
    background: linear-gradient(180deg, #EAF0F8 0%, #D8E3F0 100%);
    border: 1px solid rgba(0, 0, 0, 0.06);
  }
  .wp-dark {
    background: linear-gradient(180deg, #1B2030 0%, #0D1018 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .wp-title {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .wp-title-light { color: #3A3F4B; }
  .wp-title-dark { color: #D1D5E0; }
  .wp-grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .wp-col {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .meta-tag {
    margin-top: 4px;
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
  }
  .meta-light { color: #5E6573; }
  .meta-dark { color: #9098AB; }
  .app-name {
    margin-top: 4px;
    font-size: 11px;
    font-weight: 500;
  }
  .name-light { color: #1C1C1E; }
  .name-dark { color: #F2F2F7; }
  .var-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .var-block {
    background: linear-gradient(180deg, #1A1E2B 0%, #0E1017 100%);
    border-radius: 16px;
    padding: 14px 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
</style>
</head>
<body>
  <main class="wrap">
    <header class="header">
      <h1>ひと呼吸 — アプリアイコン候補 v2</h1>
      <p>4案（拡大・120px/60px ライト＆ダーク壁紙・ダーク／色合い調整）</p>
    </header>
    <section class="card">
      <div class="sec-title">拡大プレビュー（156px）</div>
      <div class="lg-grid">${largeCols}</div>
    </section>
    ${wpStrip('light', 'ライト壁紙での実寸（上段 120px ／ 下段 60px ホーム画面想定）')}
    ${wpStrip('dark', 'ダーク壁紙での実寸（上段 120px ／ 下段 60px ホーム画面想定）')}
    <section class="var-row">
      ${variantStrip('darkUri', 'ダークモード（60px）')}
      ${variantStrip('tintedUri', '色合い調整 Tinted（60px）')}
    </section>
  </main>
</body>
</html>`;
}

function buildRefComparisonHtml(items) {
  // Opal: black rounded square, single metallic white thick ring with soft pentagonal inner hole, subtle bevel
  const opalDescSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="obg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#191A1F"/><stop offset="100%" stop-color="#070709"/>
      </linearGradient>
      <linearGradient id="oring" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFFFF"/><stop offset="60%" stop-color="#DDE2EB"/><stop offset="100%" stop-color="#B0B8C7"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" fill="url(#obg)"/>
    <path fill="url(#oring)" fill-rule="evenodd" d="M256 96a160 160 0 1 0 0 320a160 160 0 1 0 0-320ZM256 174c18 0 64 31 70 48c6 17 -11 71 -26 82c-15 11 -73 11 -88 0c-15 -11 -32 -65 -26 -82c6 -17 52 -48 70 -48Z"/>
  </svg>`;

  // ScreenZen: deep navy background, three stacked periwinkle pebbles, flat organic shapes
  const screenzenDescSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#182347"/>
    <ellipse cx="256" cy="146" rx="64" ry="42" fill="#95A7F5"/>
    <ellipse cx="256" cy="248" rx="92" ry="48" fill="#8195F0"/>
    <ellipse cx="256" cy="360" rx="122" ry="54" fill="#6F83EA"/>
  </svg>`;

  const opalUri = toDataUri(opalDescSvg);
  const szUri = toDataUri(screenzenDescSvg);

  const rowCards = (theme) => `
    <div class="strip ${theme === 'dark' ? 'strip-dark' : 'strip-light'}">
      <div class="strip-label ${theme === 'dark' ? 'label-dark' : 'label-light'}">${theme === 'dark' ? 'ダーク壁紙（60px 比較）' : 'ライト壁紙（60px 比較）'}</div>
      <div class="icons-row">
        ${items
          .map(
            (item) => `
          <div class="cell">
            <div class="tile-60 ${theme === 'dark' ? 'shadow-dark' : 'shadow-light'}"><img src="${item.lightUri}" alt="${item.label}"></div>
            <div class="cname ${theme === 'dark' ? 'label-dark' : 'label-light'}">候補 ${item.label}</div>
            <div class="csub">${item.title}</div>
          </div>`
          )
          .join('')}
        <div class="divider"></div>
        <div class="cell">
          <div class="tile-60 ${theme === 'dark' ? 'shadow-dark' : 'shadow-light'}"><img src="${opalUri}" alt="Opal"></div>
          <div class="cname ${theme === 'dark' ? 'label-dark' : 'label-light'}">Opal</div>
          <div class="csub">記述再現</div>
        </div>
        <div class="cell">
          <div class="tile-60 ${theme === 'dark' ? 'shadow-dark' : 'shadow-light'}"><img src="${szUri}" alt="ScreenZen"></div>
          <div class="cname ${theme === 'dark' ? 'label-dark' : 'label-light'}">ScreenZen</div>
          <div class="csub">記述再現</div>
        </div>
        <div class="cell">
          <div class="tile-60 placeholder ${theme === 'dark' ? 'ph-dark' : 'ph-light'}">コピー<br>拒否</div>
          <div class="cname ${theme === 'dark' ? 'label-dark' : 'label-light'}">Blockin</div>
          <div class="csub">外観記述なし</div>
        </div>
      </div>
    </div>`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 900px;
    height: 470px;
    background: #F2F2F7;
    color: #1C1C1E;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Hiragino Sans", "Yu Gothic UI", sans-serif;
    overflow: hidden;
  }
  .wrap { padding: 22px 24px; display: flex; flex-direction: column; gap: 14px; }
  .head h1 { font-size: 18px; font-weight: 700; }
  .head p { font-size: 12px; color: #636366; margin-top: 4px; }
  .strip { border-radius: 16px; padding: 14px 18px; }
  .strip-light { background: #E9EFF7; border: 1px solid rgba(0,0,0,0.06); }
  .strip-dark { background: #141824; border: 1px solid rgba(255,255,255,0.08); }
  .strip-label { font-size: 12px; font-weight: 600; margin-bottom: 12px; }
  .label-light { color: #1C1C1E; }
  .label-dark { color: #F2F2F7; }
  .icons-row { display: flex; align-items: flex-start; gap: 22px; }
  .cell { display: flex; flex-direction: column; align-items: center; width: 88px; text-align: center; }
  .tile-60 { width: 60px; height: 60px; border-radius: 13.5px; overflow: hidden; }
  .tile-60 img { display: block; width: 100%; height: 100%; }
  .shadow-light { box-shadow: 0 4px 12px rgba(20,30,50,0.14), 0 0 0 0.5px rgba(0,0,0,0.08); }
  .shadow-dark { box-shadow: 0 6px 14px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.10); }
  .divider { width: 1px; height: 84px; background: rgba(142,142,147,0.35); margin: 0 4px; }
  .cname { margin-top: 6px; font-size: 11.5px; font-weight: 600; }
  .csub { margin-top: 2px; font-size: 10px; color: #8E8E93; }
  .placeholder {
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; line-height: 1.25; font-weight: 600;
  }
  .ph-light { background: #D8DEE8; color: #4A5260; border: 1px dashed #8E96A4; }
  .ph-dark { background: #222838; color: #9BA5B8; border: 1px dashed #5B6478; }
</style>
</head>
<body>
  <main class="wrap">
    <div class="head">
      <h1>60px 参照比較シート（未コミット・tmp 専用）</h1>
      <p>gate-hook により実参照画像のコピーが拒否されたため、Opal・ScreenZen はプロンプト記述からの SVG 再現、Blockin は未取得枠として並置。</p>
    </div>
    ${rowCards('light')}
    ${rowCards('dark')}
  </main>
</body>
</html>`;
}

function main() {
  const chromiumPath = findChromium();
  mkdirSync(v2Dir, { recursive: true });
  mkdirSync(path.dirname(previewPath), { recursive: true });
  mkdirSync(path.dirname(refComparisonPath), { recursive: true });

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'screen-pause-v2-'));
  const profileDir = path.join(tempDir, 'chrome-profile');
  mkdirSync(profileDir, { recursive: true });

  try {
    const items = [];
    const bboxStats = {};

    for (const cand of CANDIDATES) {
      const svgPath = path.join(v2Dir, `${cand.id}.svg`);
      const pngPath = path.join(v2Dir, `${cand.id}.png`);
      const svgSource = readFileSync(svgPath, 'utf8');

      // Measure #glyph getBBox() via Chromium DOM
      const measureHtmlPath = path.join(tempDir, `measure-${cand.id}.html`);
      const measureHtml = `<!doctype html><html><body style="margin:0">${svgSource}<script>
        const b = document.getElementById('glyph').getBBox();
        document.body.setAttribute('data-bbox', JSON.stringify({x:b.x,y:b.y,w:b.width,h:b.height}));
      </script></body></html>`;
      writeFileSync(measureHtmlPath, measureHtml, 'utf8');
      const domOut = execFileSync(
        chromiumPath,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--dump-dom',
          `--user-data-dir=${profileDir}`,
          pathToFileURL(measureHtmlPath).href,
        ],
        { stdio: 'pipe', windowsHide: true, encoding: 'utf8' }
      );
      const match = domOut.match(/data-bbox="([^"]+)"/);
      if (!match) throw new Error(`Failed to measure glyph bbox for ${cand.id}`);
      const bbox = JSON.parse(match[1].replace(/&quot;/g, '"'));
      bboxStats[cand.id] = {
        x: +bbox.x.toFixed(1),
        y: +bbox.y.toFixed(1),
        w: +bbox.w.toFixed(1),
        h: +bbox.h.toFixed(1),
        wPct: +((bbox.w / 1024) * 100).toFixed(1),
        hPct: +((bbox.h / 1024) * 100).toFixed(1),
      };

      // Render 1024x1024 PNG
      const singleHtmlPath = path.join(tempDir, `icon-${cand.id}.html`);
      writeFileSync(singleHtmlPath, buildSingleIconHtml(svgSource), 'utf8');
      renderHtmlToPng(chromiumPath, profileDir, singleHtmlPath, pngPath, 1024, 1024);

      const pngBytes = readFileSync(pngPath);
      const sha = createHash('sha256').update(pngBytes).digest('hex').slice(0, 12);
      console.log(
        `${cand.id}.png: ${statSync(pngPath).size} bytes, sha256=${sha}, bbox=${bboxStats[cand.id].w}x${bboxStats[cand.id].h} (${bboxStats[cand.id].wPct}% x ${bboxStats[cand.id].hPct}%)`
      );

      items.push({
        ...cand,
        lightUri: toDataUri(svgSource),
        darkUri: toDataUri(makeVariantSvg(svgSource, 'dark', cand)),
        tintedUri: toDataUri(makeVariantSvg(svgSource, 'tinted', cand)),
      });
    }

    // Render docs/preview/icon-candidates-v2.png
    const previewHtmlPath = path.join(tempDir, 'preview-v2.html');
    writeFileSync(previewHtmlPath, buildRealSizePreviewHtml(items, bboxStats), 'utf8');
    renderHtmlToPng(chromiumPath, profileDir, previewHtmlPath, previewPath, 820, 1160);
    console.log(`Rendered ${path.relative(rootDir, previewPath)} (${statSync(previewPath).size} bytes)`);

    // Render tmp/icon-ref-comparison-60px.png
    const refHtmlPath = path.join(tempDir, 'ref-comp.html');
    writeFileSync(refHtmlPath, buildRefComparisonHtml(items), 'utf8');
    renderHtmlToPng(chromiumPath, profileDir, refHtmlPath, refComparisonPath, 900, 470);
    console.log(`Rendered ${path.relative(rootDir, refComparisonPath)} (${statSync(refComparisonPath).size} bytes)`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
