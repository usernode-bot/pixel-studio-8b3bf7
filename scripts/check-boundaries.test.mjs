// Tests for scripts/check-boundaries.mjs: build throwaway src/ trees in
// os.tmpdir(), run the checker against them with --root, assert exit codes
// and messages. Run with: node --test scripts/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-boundaries.mjs');
const repoRoot = path.resolve(path.dirname(script), '..');

async function makeTree() {
  return mkdtemp(path.join(tmpdir(), 'boundaries-'));
}

async function put(root, rel, content) {
  const full = path.join(root, rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content);
}

function run(root) {
  return spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
}

test('no src/ means nothing to check', async () => {
  const root = await makeTree();
  try {
    const r = run(root);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /no src\/ yet, nothing to check/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the real repo today has no src/ and passes', async () => {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', cwd: repoRoot });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no src\/ yet, nothing to check/);
});

test('allowed imports: state -> engine, workspace -> @/tools', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/engine/b.ts', 'export const b = 1;\n');
    await put(root, 'src/state/a.ts', "import { b } from '../engine/b';\nexport const a = b;\n");
    await put(root, 'src/workspace/c.tsx', "import { x } from '@/tools/x';\nexport const c = x;\n");
    await put(root, 'src/tools/x.ts', "export const x = 1;\nimport './side';\n");
    await put(root, 'src/tools/side.ts', "export const side = 2;\n");
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /5 file\(s\) checked/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('engine importing state is a violation naming file and line', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/engine/a.ts', "import { store } from '../state/store';\n");
    await put(root, 'src/state/store.ts', 'export const store = 1;\n');
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /src\/engine\/a\.ts:1 engine may not import state \(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('engine importing react is a violation', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/engine/a.ts', "import { useState } from 'react';\n");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /engine may not import react \(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('formats importing @/state is a violation', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/formats/psd.ts', "import { store } from '@/state/store';\n");
    await put(root, 'src/state/store.ts', 'export const store = 1;\n');
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /formats may not import state \(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('canvas importing tools is a violation (tools may import canvas, not the reverse)', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/canvas/a.ts', "import { brush } from '../tools/brush';\n");
    await put(root, 'src/tools/brush.ts', 'export const brush = 1;\n');
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /canvas may not import tools \(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('tools importing canvas is allowed', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/tools/a.ts', "import { pointer } from '../canvas/pointer';\n");
    await put(root, 'src/canvas/pointer.ts', 'export const pointer = 1;\n');
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('workspace may not import workers', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/workspace/panel.ts', "import { job } from '../workers/job';\n");
    await put(root, 'src/workers/job.ts', 'export const job = 1;\n');
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /workspace may not import workers \(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('imports inside comments are ignored', async () => {
  const root = await makeTree();
  try {
    await put(
      root,
      'src/engine/a.ts',
      [
        '// import { store } from "../state/store";',
        "/* import react from 'react' */",
        "export const a = 1; // engine may not import state",
        '',
      ].join('\n'),
    );
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('import type still counts as an edge', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/engine/a.ts', "import type { Store } from '../state/store';\n");
    await put(root, 'src/state/store.ts', 'export type Store = unknown;\n');
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /engine may not import state \(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('package subpaths match their package ban', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/engine/a.ts', "import 'react/jsx-runtime';\n");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /engine may not import react \(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('specifier resolving outside src is reported', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/engine/deep/a.ts', "import { x } from '../../../public/x.js';\n");
    await put(root, 'public/x.js', 'export const x = 1;\n');
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /engine imports outside src .*\(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('file directly under src/ is an unknown module', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/a.ts', "export const a = 1;\n");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /unknown module \(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('unlisted folder is an unknown module', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/misc/a.ts', "export const a = 1;\n");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /unknown module misc \(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('unresolvable dynamic import is reported', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/engine/a.ts', "const name = 'react';\nconst m = await import(name);\n");
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /unresolvable import \(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('export ... from and require() are checked', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/engine/a.ts', "export { store } from '../state/store';\n");
    await put(root, 'src/engine/b.js', "const { store } = require('../state/store');\n");
    await put(root, 'src/state/store.ts', 'export const store = 1;\n');
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /src\/engine\/a\.ts:1 engine may not import state \(R1\)/);
    assert.match(r.stdout, /src\/engine\/b\.js:1 engine may not import state \(R1\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('node builtins are always allowed', async () => {
  const root = await makeTree();
  try {
    await put(root, 'src/engine/a.ts', "import { readFile } from 'node:fs/promises';\nexport const a = readFile;\n");
    const r = run(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});