#!/usr/bin/env node
/**
 * Discover and run Node.js test files via tsx.
 * Usage: node scripts/run-tests.mjs [unit|integration|all]
 */

import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function collectTests(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'e2e') continue
      collectTests(full, acc)
    } else if (entry.endsWith('.test.ts')) {
      acc.push(full)
    }
  }
  return acc
}

const mode = process.argv[2] || 'all'

const unitDirs = [
  join(ROOT, 'tests', 'unit'),
  join(ROOT, 'lib'),
]

const integrationDirs = [
  join(ROOT, 'tests', 'integration'),
  join(ROOT, 'server', 'tests'),
]

let files = []
if (mode === 'unit' || mode === 'all') {
  for (const dir of unitDirs) files.push(...collectTests(dir))
}
if (mode === 'integration' || mode === 'all') {
  for (const dir of integrationDirs) files.push(...collectTests(dir))
}

files = [...new Set(files)].sort()

if (files.length === 0) {
  console.error('No test files found')
  process.exit(1)
}

console.log(`Running ${files.length} test file(s) [${mode}]...\n`)

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', '--test', ...files.map((f) => relative(ROOT, f))],
  { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' },
)

process.exit(result.status ?? 1)
