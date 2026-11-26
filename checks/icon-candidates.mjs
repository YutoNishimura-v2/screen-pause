import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const svgNamespace = 'http://www.w3.org/2000/svg';
const hexColor = /^#[0-9a-f]{6}$/i;
const geometry = {
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  circle: ['cx', 'cy', 'r'],
  path: ['d'],
  text: ['x', 'y', 'font-size'],
};

function parseAttributes(source) {
  const attributes = new Map();
  const attribute = /[ \t\r\n]+([a-zA-Z][\w:-]*)[ \t\r\n]*=[ \t\r\n]*(?:"([^"<&]*)"|'([^'<&]*)')/y;
  let offset = 0;
  const end = source.replace(/[ \t\r\n]+$/, '').length;
  while (offset < end) {
    attribute.lastIndex = offset;
    const match = attribute.exec(source);
    assert.ok(match, 'malformed SVG attribute');
    assert.ok(!attributes.has(match[1]), `duplicate SVG attribute: ${match[1]}`);
    attributes.set(match[1], match[2] ?? match[3]);
    offset = attribute.lastIndex;
  }
  return attributes;
}

// Parse the flat XML subset used by these icons. The element and attribute
// allowlists exclude raster images, links, styles, and other resource loaders.
function parseIcon(source) {
  assert.doesNotMatch(source, /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u, 'invalid XML character');
  const document = /^<svg(?=[\s>])([^<>]*)>([\s\S]*)<\/svg>$/.exec(source.trim());
  assert.ok(document, 'expected a single SVG root');
  const root = parseAttributes(document[1]);
  assert.equal(root.size, 4);
  assert.equal(root.get('xmlns'), svgNamespace);
  assert.equal(root.get('width'), '1024');
  assert.equal(root.get('height'), '1024');
  assert.match(root.get('viewBox') ?? '', /^0[ \t\r\n]+0[ \t\r\n]+1024[ \t\r\n]+1024$/);

  const elements = [];
  const children = document[2].trim();
  const child = /\s*(?:<(rect|circle|path)(?=[\s/])([^<>]*?)\/>|<text(?=[\s>])([^<>]*)>([^<&]*)<\/text>)/y;
  let offset = 0;
  while (offset < children.length) {
    child.lastIndex = offset;
    const match = child.exec(children);
    assert.ok(match, 'expected only flat vector shapes or a one-character text element');
    const tag = match[1] ?? 'text';
    const attributes = parseAttributes(match[2] ?? match[3]);
    if (tag === 'text') assert.ok([...match[4]].length <= 1, 'SVG text exceeds one character');
    for (const [name, value] of attributes) {
      if (name === 'fill') {
        assert.match(value, hexColor);
      } else {
        assert.ok(geometry[tag].includes(name), `unsupported SVG attribute: ${name}`);
        const syntax = name === 'd' ? /^[Mm][MmZzLlHhVvCcSsQqTtAa\d.,+\-eE\s]+$/ : /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
        assert.match(value, syntax);
      }
    }
    assert.ok(attributes.has('fill'), 'each shape must have a flat, opaque fill');
    elements.push({ tag, attributes });
    offset = child.lastIndex;
  }
  return elements;
}

for (const candidate of ['a', 'b', 'c']) {
  test(`icon candidate ${candidate} is a self-contained 1024px vector`, () => {
    const url = new URL(`../docs/icon/candidates/${candidate}.svg`, import.meta.url);
    const elements = parseIcon(readFileSync(url, 'utf8'));
    const [background] = elements;
    assert.equal(background?.tag, 'rect', 'the first element must cover the square artboard');
    const { attributes } = background;
    for (const name of ['x', 'y', 'rx', 'ry']) {
      assert.equal(Number(attributes.get(name) ?? 0), 0, `background ${name}`);
    }
    for (const name of ['width', 'height']) {
      assert.equal(Number(attributes.get(name)), 1024, `background ${name}`);
    }
    const colors = new Set(elements.map(({ attributes }) => attributes.get('fill').toLowerCase()));
    assert.ok(colors.size >= 2 && colors.size <= 3, 'expected two or three flat colors');
  });
}
