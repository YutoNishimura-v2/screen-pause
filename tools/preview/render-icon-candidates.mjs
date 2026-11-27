import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const candidatesDir = path.join(rootDir, 'docs', 'icon', 'candidates');
const outputPath = path.join(rootDir, 'docs', 'preview', 'icon-candidates.png');

const SHEET_WIDTH = 640;
const SHEET_HEIGHT = 320;
const CANDIDATES = [
  { file: 'a.svg', label: 'A' },
  { file: 'b.svg', label: 'B' },
  { file: 'c.svg', label: 'C' },
];

export function findChromium() {
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
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('Headless Chromium/Chrome executable not found. Set CHROME_PATH to override.');
}

function buildHtml() {
  const columns = CANDIDATES.map(({ file, label }) => {
    const svgBuffer = readFileSync(path.join(candidatesDir, file));
    const dataUri = `data:image/svg+xml;base64,${svgBuffer.toString('base64')}`;
    return `
      <div class="column">
        <img class="icon icon-lg" src="${dataUri}" width="144" height="144" alt="${label} 144px" />
        <img class="icon icon-sm" src="${dataUri}" width="60" height="60" alt="${label} 60px" />
        <div class="label">${label}</div>
      </div>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html, body {
    width: ${SHEET_WIDTH}px;
    height: ${SHEET_HEIGHT}px;
    background: #e9e8e5;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sheet {
    display: grid;
    grid-template-columns: repeat(3, 144px);
    column-gap: 48px;
    align-items: start;
  }
  .column {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .icon {
    display: block;
    outline: 1px solid rgba(48, 44, 33, 0.08);
    outline-offset: -1px;
  }
  .icon-lg {
    width: 144px;
    height: 144px;
    border-radius: 32px;
  }
  .icon-sm {
    width: 60px;
    height: 60px;
    margin-top: 20px;
    border-radius: 13px;
  }
  .label {
    margin-top: 14px;
    font-size: 16px;
    line-height: 20px;
    font-weight: 600;
    color: #302c21;
    letter-spacing: 0.04em;
  }
</style>
</head>
<body>
  <main class="sheet">
    ${columns}
  </main>
</body>
</html>
`;
}

function main() {
  const chromiumPath = findChromium();
  mkdirSync(path.dirname(outputPath), { recursive: true });

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'screen-pause-preview-'));
  const htmlPath = path.join(tempDir, 'sheet.html');
  const profileDir = path.join(tempDir, 'chrome-profile');
  mkdirSync(profileDir, { recursive: true });

  try {
    writeFileSync(htmlPath, buildHtml(), 'utf8');
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
        `--window-size=${SHEET_WIDTH},${SHEET_HEIGHT}`,
        `--user-data-dir=${profileDir}`,
        `--screenshot=${outputPath}`,
        pathToFileURL(htmlPath).href,
      ],
      { stdio: 'pipe', windowsHide: true }
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  const pngBytes = readFileSync(outputPath);
  const { size } = statSync(outputPath);
  const sha256 = createHash('sha256').update(pngBytes).digest('hex');
  console.log(`Rendered ${path.relative(rootDir, outputPath)} (${size} bytes, sha256: ${sha256})`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
