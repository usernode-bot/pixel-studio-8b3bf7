#!/usr/bin/env node
// Import-direction checker for the Section 2 architecture rules (issue #4, R1).
// Dependency-free: runs with the Node the app already uses. From Phase 0 on it
// is part of the lint gate (`bun run lint` must include this script), so an
// upward import fails G2 before anyone votes on the change.

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// The rule table (Section 2, R1).
//
// Key: a module folder under src/. Value:
//   allow: src/ modules this one may import from ('*' = every module, used
//          for workspace).
//   block: src/ modules excluded even under '*', for workspace (workers are
//          spawned by URL, never imported).
//   deny:  bare packages this one may never import (subpaths match too).
// Files directly under src/, or in a folder not listed here, are reported as
// "unknown module" — new modules must be added to this table on purpose.
// ---------------------------------------------------------------------------
const RULES = {
  engine: {
    allow: ['engine'],
    deny: ['react', 'react-dom', 'zustand', 'next'],
  },
  state: {
    allow: ['state', 'engine', 'documents', 'formats', 'storage'],
    deny: ['react-dom', 'next'],
  },
  canvas: {
    allow: ['canvas', 'state', 'engine', 'i18n', 'shortcuts'],
    deny: [],
  },
  tools: {
    allow: ['tools', 'canvas', 'state', 'engine', 'i18n', 'shortcuts'],
    deny: [],
  },
  workspace: {
    allow: '*',
    block: ['workers'],
    deny: [],
  },
  documents: {
    allow: ['documents', 'engine'],
    deny: ['react', 'react-dom', 'zustand', 'next'],
  },
  formats: {
    allow: ['formats', 'engine'],
    deny: ['react', 'react-dom', 'zustand', 'next'],
  },
  storage: {
    allow: ['storage', 'engine'],
    deny: ['react', 'react-dom', 'zustand', 'next'],
  },
  workers: {
    allow: ['workers', 'engine'],
    deny: ['react', 'react-dom', 'zustand', 'next'],
  },
  i18n: {
    allow: ['i18n'],
    deny: ['zustand'],
  },
  shortcuts: {
    allow: ['shortcuts', 'i18n'],
    deny: ['react-dom'],
  },
};

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

// --root <dir> overrides the repo root, for tests.
function parseArgs(argv) {
  const args = { root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') args.root = path.resolve(argv[++i]);
  }
  return args;
}

async function walk(dir, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
}

// Strip comments but keep every character position and newline intact, so
// match indices still map to real line numbers. Also records the character
// ranges of string literal contents, so a match that starts inside a string
// (the word `import` in an error message, say) can be ignored as not code.
function stripComments(code) {
  const strings = [];
  let out = '';
  let i = 0;
  let mode = null; // "'", '"', '`' while inside that string
  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (mode) {
      if (c === '\\' && next) {
        out += c + next;
        i += 2;
        continue;
      }
      if (c === '\n') {
        // A newline always ends a ' or " string; inside ` it is content.
        if (mode !== '`') mode = null;
        out += '\n';
        i++;
        continue;
      }
      if (c === mode) {
        mode = null;
        out += c;
        i++;
        continue;
      }
      strings[strings.length - 1].end = out.length;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
        out += code[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < code.length) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      mode = c;
      strings.push({ start: out.length + 1, end: out.length + 1 });
      out += c;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return { text: out, strings };
}

function inString(strings, index) {
  return strings.some((s) => index >= s.start && index < s.end);
}

// Collect {specifier, line} pairs for every import/export/require form.
// specifier === null marks a dynamic `import(...)` whose argument is not a
// plain string literal, so nothing can slip through unresolvable.
function extractSpecifiers(code) {
  const pairs = [];
  const push = (regex) => {
    for (const m of code.text.matchAll(regex)) {
      if (inString(code.strings, m.index)) continue;
      pairs.push({ specifier: m[1], line: lineOf(code.text, m.index) });
    }
  };
  // import ... from 'x'   (covers `import type { X } from 'x'` too)
  push(/\bimport\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g);
  // side-effect import 'x'  (not `import(`, which the dynamic pass handles)
  push(/\bimport\s*['"]([^'"]+)['"]/g);
  // export ... from 'x' / export * from 'x'
  push(/\bexport\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g);
  // dynamic import('x') with a plain string; anything else is unresolvable
  for (const m of code.text.matchAll(/\bimport\s*\(/g)) {
    if (inString(code.strings, m.index)) continue;
    const rest = code.text.slice(m.index + m[0].length);
    const quoted = rest.match(/^\s*['"]([^'"]+)['"]/);
    const line = lineOf(code.text, m.index);
    pairs.push({ specifier: quoted ? quoted[1] : null, line });
  }
  // require('x')
  push(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  return pairs;
}

function lineOf(code, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (code[i] === '\n') line++;
  }
  return line;
}

// The bare package a specifier names: 'react' -> react,
// 'react/jsx-runtime' -> react, '@reduxjs/toolkit/x' -> '@reduxjs/toolkit'.
// Relative and '@/'-alias specifiers never name a package.
function barePackage(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@')) {
    return null;
  }
  const slash = specifier.indexOf('/');
  return slash === -1 ? specifier : specifier.slice(0, slash);
}

async function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const srcDir = path.join(root, 'src');

  let srcStat = null;
  try {
    srcStat = await stat(srcDir);
  } catch {
    // fall through
  }
  if (!srcStat || !srcStat.isDirectory()) {
    console.log('no src/ yet, nothing to check');
    process.exit(0);
  }

  const files = [];
  await walk(srcDir, files);

  const violations = [];
  let checked = 0;

  for (const file of files) {
    const rel = path.relative(srcDir, file);
    const segments = rel.split(path.sep);
    const from = segments.length === 1 ? null : segments[0];
    const label = path.relative(root, file);

    if (!from || !RULES[from]) {
      violations.push(`${label}: unknown module${from ? ` ${from}` : ''} (R1)`);
      continue;
    }
    checked++;

    const rule = RULES[from];
    const code = stripComments(await readFile(file, 'utf8'));

    for (const { specifier, line } of extractSpecifiers(code)) {
      if (specifier === null) {
        violations.push(`${label}:${line} ${from} unresolvable import (R1)`);
        continue;
      }
      if (specifier.startsWith('node:')) continue;

      if (specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../')) {
        // Resolve to a module folder under src/.
        let target;
        if (specifier.startsWith('@/')) {
          target = path.resolve(srcDir, specifier.slice(2));
        } else {
          target = path.resolve(path.dirname(file), specifier);
        }
        const relTarget = path.relative(srcDir, target);
        if (relTarget.startsWith('..') || path.isAbsolute(relTarget)) {
          violations.push(`${label}:${line} ${from} imports outside src (${specifier}) (R1)`);
          continue;
        }
        const to = relTarget.split(path.sep)[0] || null;
        if (!to || !RULES[to]) {
          violations.push(`${label}:${line} ${from} imports unknown module${to ? ` ${to}` : ''} (${specifier}) (R1)`);
          continue;
        }
        const allowed =
          !rule.block?.includes(to) &&
          (rule.allow === '*' || rule.allow.includes(to));
        if (!allowed) {
          violations.push(`${label}:${line} ${from} may not import ${to} (R1)`);
        }
        continue;
      }

      const pkg = barePackage(specifier);
      if (pkg && rule.deny.includes(pkg)) {
        violations.push(`${label}:${line} ${from} may not import ${pkg} (R1)`);
      }
    }
  }

  if (violations.length > 0) {
    for (const v of violations.sort()) console.log(v);
    console.log(`${violations.length} boundary violation(s) in ${checked} file(s)`);
    process.exit(1);
  }
  console.log(`OK: ${checked} file(s) checked, no boundary violations`);
}

main();