import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SWIFT_DIRS = ['Action', 'App', 'Monitor', 'Report', 'Shared', 'Shield', 'Widgets'];
const PREVIEW_SCREENS = ['home', 'report', 'paywall', 'shield'];
const JAPANESE_CHAR = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

function listSwiftFiles() {
  const files = [];
  for (const dir of SWIFT_DIRS) {
    const fullDir = path.join(ROOT, dir);
    for (const entry of readdirSync(fullDir)) {
      if (entry.endsWith('.swift')) files.push(path.join(fullDir, entry));
    }
  }
  return files;
}

function extractSwiftLiterals(source) {
  const literals = [];
  let i = 0;
  while (i < source.length) {
    if (source[i] === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i + 2);
      i = nl < 0 ? source.length : nl + 1;
      continue;
    }
    if (source[i] !== '"') {
      i += 1;
      continue;
    }
    i += 1;
    let value = '';
    while (i < source.length && source[i] !== '"') {
      if (source[i] === '\\') {
        if (source[i + 1] === '(') {
          let depth = 1;
          i += 2;
          while (i < source.length && depth > 0) {
            if (source[i] === '(') depth += 1;
            else if (source[i] === ')') depth -= 1;
            i += 1;
          }
          value += '\u0000';
          continue;
        }
        value += source[i + 1] ?? '';
        i += 2;
        continue;
      }
      value += source[i];
      i += 1;
    }
    i += 1;
    if (value) literals.push(value);
  }
  return literals;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function compileSwiftStringMatcher(swiftSources) {
  const allLiterals = swiftSources.flatMap(extractSwiftLiterals);
  const exactSet = new Set(allLiterals.filter((lit) => !lit.includes('\u0000')));
  const escapedExact = [...exactSet]
    .filter((lit) => JAPANESE_CHAR.test(lit) && lit.length >= 2)
    .map(escapeRegExp);
  const interpolationPattern = [
    '(?:翌日)?\\d{1,4}(?:[:.,]\\d{1,2})?(?:[％%])?',
    '¥[\\d,]+(?:／[月年])?',
    ...escapedExact,
  ].join('|');

  const templateRegexes = allLiterals
    .filter((lit) => lit.includes('\u0000') && /[\u301C\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(lit))
    .map((lit) => {
      const parts = lit.replace(/\u0000+/g, '\u0000').split('\u0000').map(escapeRegExp);
      return new RegExp(`^${parts.join(`(?:${interpolationPattern})`)}$`);
    });

  return (text) => exactSet.has(text) || templateRegexes.some((re) => re.test(text));
}

export function extractVisibleJapaneseStrings(html) {
  const body = html
    .replace(/<head\b[\s\S]*?<\/head>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ');

  const segments = body
    .split(/<[^>]+>/)
    .map((segment) => segment
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim())
    .filter((segment) => segment.length > 0 && JAPANESE_CHAR.test(segment));

  return segments;
}

export function findMissingPreviewStrings(html, swiftSources) {
  const matchesSwift = compileSwiftStringMatcher(swiftSources);
  return extractVisibleJapaneseStrings(html).filter((text) => !matchesSwift(text));
}

function loadSwiftSources() {
  return listSwiftFiles().map((file) => readFileSync(file, 'utf8'));
}

test('source check fails on a fixture preview containing a Japanese string missing from Swift', () => {
  const swiftSources = loadSwiftSources();
  const fixtureHtml = '<html><body><p>ひと呼吸</p><p>Swiftソースに存在しない仮の文言</p></body></html>';
  const missing = findMissingPreviewStrings(fixtureHtml, swiftSources);
  assert.deepEqual(missing, ['Swiftソースに存在しない仮の文言']);
});

test('every visible Japanese string in tools/preview HTML appears in the Swift source', () => {
  const swiftSources = loadSwiftSources();
  for (const screen of PREVIEW_SCREENS) {
    const htmlPath = path.join(ROOT, 'tools', 'preview', `${screen}.html`);
    const html = readFileSync(htmlPath, 'utf8');
    const strings = extractVisibleJapaneseStrings(html);
    assert.ok(strings.length > 0, `${screen}.html must contain visible Japanese strings`);
    const missing = findMissingPreviewStrings(html, swiftSources);
    assert.deepEqual(missing, [], `${screen}.html has strings missing from Swift source: ${missing.join(', ')}`);
  }
});

test('rendered 390x844 preview PNGs and README exist with valid dimensions', () => {
  const readme = readFileSync(path.join(ROOT, 'docs', 'preview', 'README.md'), 'utf8');
  assert.match(readme, /推測/);
  assert.match(readme, /node tools\/preview\/render\.mjs/);

  for (const screen of PREVIEW_SCREENS) {
    const pngPath = path.join(ROOT, 'docs', 'preview', `${screen}-390.png`);
    const buf = readFileSync(pngPath);
    assert.ok(statSync(pngPath).size > 1000, `${screen}-390.png should not be empty`);
    assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.equal(width, 390, `${screen}-390.png width`);
    assert.equal(height, 844, `${screen}-390.png height`);
  }
});
