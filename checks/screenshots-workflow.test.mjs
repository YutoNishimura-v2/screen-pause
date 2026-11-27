import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relPath) => readFileSync(path.join(ROOT, relPath), 'utf8').replace(/\r\n/g, '\n');

function resolvePythonCommand() {
  for (const candidate of process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python']) {
    const res = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (res.status === 0) return candidate;
  }
  throw new Error('Python 3 executable not found');
}

function parseScreenshotsWorkflow(yamlText) {
  const lines = yamlText.split('\n');
  const contentsPerm = yamlText.match(/^permissions:\n(?:\s+[^\n]+\n)*?\s+contents:\s*(\S+)/m)?.[1];
  const defaultShell = yamlText.match(/^\s{4}defaults:\n\s{6}run:\n\s{8}shell:\s*(\S+)/m)?.[1];

  const stepsIdx = lines.findIndex((line) => /^\s{4}steps:\s*$/.test(line));
  assert.ok(stepsIdx >= 0, 'jobs.screenshots.steps must exist');

  const steps = [];
  let current = null;
  let i = stepsIdx + 1;

  while (i < lines.length) {
    const line = lines[i];
    if (/^\S/.test(line) || (/^\s{2}[a-zA-Z0-9_-]+:/.test(line) && !/^\s{6}/.test(line))) {
      break;
    }
    if (/^\s{6}-\s+/.test(line)) {
      if (current) steps.push(current);
      current = {};
      const rest = line.replace(/^\s{6}-\s+/, '');
      const kv = rest.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (kv) current[kv[1]] = kv[2];
      i += 1;
      continue;
    }
    if (current && /^\s{8}([a-zA-Z0-9_-]+):\s*(.*)$/.test(line)) {
      const [, key, rawVal] = line.match(/^\s{8}([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (rawVal === '|') {
        i += 1;
        const block = [];
        while (i < lines.length && (/^\s{10}/.test(lines[i]) || lines[i].trim() === '')) {
          block.push(lines[i].slice(10));
          i += 1;
        }
        current[key] = block.join('\n').replace(/\n+$/, '');
        continue;
      }
      if (rawVal === '') {
        i += 1;
        const map = {};
        while (i < lines.length && /^\s{10}/.test(lines[i])) {
          const entry = lines[i].match(/^\s{10}([a-zA-Z0-9_-]+):\s*(.*)$/);
          if (entry) map[entry[1]] = entry[2];
          i += 1;
        }
        current[key] = map;
        continue;
      }
      current[key] = rawVal;
    }
    i += 1;
  }
  if (current) steps.push(current);

  return { contentsPerm, defaultShell, steps };
}

test('screenshots.yml tees every run step to tmp/ci-logs/ with pipefail and publishes failure logs via if: failure()', () => {
  const workflowText = read('.github/workflows/screenshots.yml');
  const pushScript = read('.github/scripts/publish-ci-shots.sh');
  const builderScript = read('.github/scripts/build-failure-index.py');
  const { contentsPerm, defaultShell, steps } = parseScreenshotsWorkflow(workflowText);

  assert.equal(contentsPerm, 'write');
  assert.equal(defaultShell, 'bash');
  assert.ok(steps.length >= 6, `expected at least 6 steps, got ${steps.length}`);

  const failureStep = steps[steps.length - 1];
  assert.equal(failureStep.if, 'failure()', 'final step must have if: failure()');
  assert.match(failureStep.run, /build-failure-index\.py/);
  assert.match(failureStep.run, /tmp\/ci-shots\/index\.md/);
  assert.match(failureStep.run, /publish-ci-shots\.sh\s+tmp\/ci-shots\b/);
  assert.match(builderScript, /index_path = shots_dir \/ "index\.md"|output_path/);

  const preFailureRunSteps = steps.slice(0, -1).filter((step) => typeof step.run === 'string');
  assert.equal(preFailureRunSteps.length, 4);

  const logPaths = new Set();
  for (const step of preFailureRunSteps) {
    assert.match(step.run, /set -eu?o pipefail/, `step "${step.name}" must enable pipefail`);
    const teeMatch = step.run.match(/(?:\|\s*tee\s+|publish-ci-shots\.sh\s+\S+\s+"[^"]+"\s+)(tmp\/ci-logs\/[^\s]+\.log)/);
    assert.ok(teeMatch, `step "${step.name}" must tee output under tmp/ci-logs/`);
    assert.ok(!logPaths.has(teeMatch[1]), `duplicate log path: ${teeMatch[1]}`);
    logPaths.add(teeMatch[1]);
  }

  const indexStep = steps.find((step) => step.name === '14枚を確認して目次を生成');
  assert.ok(indexStep, '14枚を確認して目次を生成 step must exist');
  assert.match(indexStep.run, /publish = Path\("tmp\/ci-shots"\)/);
  assert.match(indexStep.run, /f"成功 \{os\.environ\['GITHUB_SHA'\]\}"/);
  assert.match(indexStep.run, /\(publish \/ "index\.md"\)\.write_text/);

  const publishStep = steps.find((step) => step.name === '撮影画像を公開');
  assert.ok(publishStep, '撮影画像を公開 step must exist');
  assert.match(publishStep.run, /publish-ci-shots\.sh\s+tmp\/ci-shots\b/);

  // Branch push and token auth logic must exist exactly once in the shared script, not duplicated in YAML.
  const pushMatchesInWorkflow = workflowText.match(/git\b[^\n]*\bpush\s+--force|AUTHORIZATION:\s*basic|x-access-token:/g) ?? [];
  assert.deepEqual(pushMatchesInWorkflow, [], 'screenshots.yml must not duplicate git push/token code');
  const pushMatchesInScript = pushScript.match(/git\b[^\n]*\bpush\s+--force/g) ?? [];
  assert.equal(pushMatchesInScript.length, 1);
  assert.match(pushScript, /set -euo pipefail/);
  assert.match(pushScript, /echo "::add-mask::\$auth"/);
  assert.doesNotMatch(workflowText + '\n' + pushScript, /echo\s+["']?\$GH_TOKEN/);
});

test('embedded Python snippets in screenshots.yml and build-failure-index.py have valid syntax', () => {
  const python = resolvePythonCommand();
  const workflowText = read('.github/workflows/screenshots.yml');
  const { steps } = parseScreenshotsWorkflow(workflowText);

  const captureStep = steps.find((step) => step.id === 'capture');
  const simPy = captureStep.run.match(/python3 -c '\n([\s\S]*?)\n'/)?.[1];
  assert.ok(simPy, 'capture step must contain simulator lookup python snippet');

  const manifestStep = steps.find((step) => step.id === 'manifest');
  const manifestPy = manifestStep.run.match(/python3 - <<'PY'\n([\s\S]*?)\nPY/)?.[1];
  assert.ok(manifestPy, 'manifest step must contain index builder python snippet');

  const builderPy = read('.github/scripts/build-failure-index.py');
  for (const [label, source] of [
    ['capture simctl lookup', simPy],
    ['manifest index builder', manifestPy],
    ['build-failure-index.py', builderPy],
  ]) {
    const check = spawnSync(python, ['-c', 'import ast, sys; ast.parse(sys.stdin.buffer.read().decode("utf-8"))'], {
      input: source,
      encoding: 'utf8',
    });
    assert.equal(check.status, 0, `${label} failed Python AST check: ${check.stderr}`);
  }
});

test('build-failure-index.py writes failure index.md, error lines, 150-line tails, and redacted .txt logs', () => {
  const python = resolvePythonCommand();
  const tempBase = path.join(ROOT, 'tmp');
  mkdirSync(tempBase, { recursive: true });
  const root = mkdtempSync(path.join(tempBase, 'ci-logs-test-'));

  try {
    const logsDir = path.join(root, 'ci-logs');
    const shotsDir = path.join(root, 'ci-shots');
    mkdirSync(logsDir, { recursive: true });
    mkdirSync(shotsDir, { recursive: true });
    writeFileSync(path.join(shotsDir, 'stale.png'), 'stale');

    const sample = 'FAKE';
    const encodedSample = Buffer.from(`x-access-token:${sample}`, 'utf8').toString('base64');

    writeFileSync(
      path.join(logsDir, '01-xcodegen.log'),
      [
        'Generating project...',
        '❌ Spec validation error: Missing target ScreenPause',
        'Generated project with warnings',
      ].join('\n'),
      'utf8',
    );

    const log2Lines = Array.from({ length: 200 }, (_, index) => {
      const n = index + 1;
      if (n === 10) return '/App/ScreenPauseApp.swift:12:5: error: cannot find type Foo in scope';
      if (n === 160) return '** BUILD FAILED **';
      if (n === 175) return 'Testing failed: ScreenPauseScreenshots';
      if (n === 180) return `line with backticks \`\`\` and ${sample} and ${encodedSample}`;
      return `build step log line ${n}`;
    });
    writeFileSync(path.join(logsDir, '02-screenshots.log'), log2Lines.join('\n'), 'utf8');

    const outputIndex = path.join(shotsDir, 'index.md');
    const res = spawnSync(
      python,
      [
        path.join(ROOT, '.github/scripts/build-failure-index.py'),
        '--logs-dir', logsDir,
        '--output', outputIndex,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_SHA: 'e69aaa2000000000000000000000000000000000',
          GITHUB_SERVER_URL: 'https://github.com',
          GITHUB_REPOSITORY: 'YutoNishimura-v2/screen-pause',
          GITHUB_RUN_ID: '987654321',
          GH_TOKEN: sample,
          CI_STEP_OUTCOMES: [
            'checkout=success',
            'プロジェクトを生成=success',
            'iPhone シミュレータで撮影=failure',
            '14枚を確認して目次を生成=skipped',
            '撮影画像を公開=skipped',
          ].join('\n'),
        },
      },
    );
    assert.equal(res.status, 0, res.stderr);

    const indexMd = readFileSync(outputIndex, 'utf8');
    const lines = indexMd.split('\n');
    assert.equal(lines[0], '失敗 e69aaa2000000000000000000000000000000000');
    assert.match(indexMd, /https:\/\/github\.com\/YutoNishimura-v2\/screen-pause\/actions\/runs\/987654321/);
    assert.match(indexMd, /失敗したステップ: iPhone シミュレータで撮影/);

    const errorSection = indexMd.split('## エラー行')[1].split('## ステップ別ログ')[0];
    assert.match(errorSection, /Spec validation error: Missing target ScreenPause/);
    assert.match(errorSection, /error: cannot find type Foo in scope/);
    assert.match(errorSection, /\*\* BUILD FAILED \*\*/);
    assert.match(errorSection, /Testing failed: ScreenPauseScreenshots/);
    assert.doesNotMatch(errorSection, /build step log line/);

    const log2Section = indexMd.split('### 02-screenshots')[1];
    assert.doesNotMatch(log2Section, /\bbuild step log line 50\b/);
    assert.match(log2Section, /\bbuild step log line 51\b/);
    assert.match(log2Section, /\bbuild step log line 200\b/);
    assert.match(log2Section, /````text/);
    assert.ok(!indexMd.includes(sample), 'index.md must redact the fixture credential');
    assert.ok(!indexMd.includes(encodedSample), 'index.md must redact the base64 authorization value');

    const txt1 = readFileSync(path.join(shotsDir, '01-xcodegen.txt'), 'utf8');
    const txt2 = readFileSync(path.join(shotsDir, '02-screenshots.txt'), 'utf8');
    assert.match(txt1, /Spec validation error/);
    assert.match(txt2, /\bbuild step log line 1\b/);
    assert.ok(!txt2.includes(sample), '02-screenshots.txt must redact the fixture credential');
    assert.ok(!txt2.includes(encodedSample), '02-screenshots.txt must redact the base64 authorization value');
    assert.throws(() => readFileSync(path.join(shotsDir, 'stale.png')));

    // Empty logs directory must still produce a valid index.md without crashing.
    const emptyLogs = path.join(root, 'empty-logs');
    const emptyOutput = path.join(root, 'empty-shots', 'index.md');
    mkdirSync(emptyLogs, { recursive: true });
    const emptyRes = spawnSync(
      python,
      [
        path.join(ROOT, '.github/scripts/build-failure-index.py'),
        '--logs-dir', emptyLogs,
        '--output', emptyOutput,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_SHA: 'abc1234',
          GITHUB_SERVER_URL: 'https://github.com',
          GITHUB_REPOSITORY: 'YutoNishimura-v2/screen-pause',
          GITHUB_RUN_ID: '1',
          CI_STEP_OUTCOMES: 'checkout=failure',
        },
      },
    );
    assert.equal(emptyRes.status, 0, emptyRes.stderr);
    const emptyMd = readFileSync(emptyOutput, 'utf8');
    assert.equal(emptyMd.split('\n')[0], '失敗 abc1234');
    assert.match(emptyMd, /失敗したステップ: checkout/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
