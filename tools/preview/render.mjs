import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCREENS = ['home', 'report', 'paywall', 'shield'];
const VIEWPORT = '390,844';

function findBrowser() {
  const candidates = [
    process.env.PREVIEW_BROWSER,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Headless Chromium (Chrome or Edge) was not found on this PC.');
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, '..', '..');
  const outDir = path.join(root, 'docs', 'preview');
  mkdirSync(outDir, { recursive: true });

  const browser = findBrowser();
  const profileDir = mkdtempSync(path.join(tmpdir(), 'screen-pause-preview-'));
  try {
    for (const screen of SCREENS) {
      const htmlPath = path.join(here, `${screen}.html`);
      const pngPath = path.join(outDir, `${screen}-390.png`);
      execFileSync(
        browser,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--hide-scrollbars',
          '--force-device-scale-factor=1',
          `--window-size=${VIEWPORT}`,
          `--user-data-dir=${profileDir}`,
          `--screenshot=${pngPath}`,
          pathToFileURL(htmlPath).href,
        ],
        { stdio: 'pipe', windowsHide: true }
      );
      const bytes = readFileSync(pngPath).length;
      console.log(`${screen}-390.png bytes=${bytes} sha256=${sha256(pngPath)}`);
    }
  } finally {
    rmSync(profileDir, { recursive: true, force: true });
  }
}

main();
