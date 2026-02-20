import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const pkg = require(path.join(rootDir, 'package.json'));

function runCli(args) {
  const cliPath = path.join(rootDir, 'src', 'cli.js');
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf-8'
  });
}

test('cli --help exits 0', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /OpenAlex MCP Server/i);
});

test('cli --version prints package version', () => {
  const result = runCli(['--version']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), pkg.version);
});
