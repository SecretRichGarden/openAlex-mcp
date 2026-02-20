#!/usr/bin/env node
/**
 * CLI entry for OpenAlex MCP server (stdio).
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = require(path.resolve(__dirname, '..', 'package.json'));

function printHelp() {
  const helpText = `
OpenAlex MCP Server (stdio)

Usage:
  openalex-mcp-server [--help] [--version]
  openalex-mcp [--help] [--version]
  npx -y openalex-mcp-server

Environment:
  OPENALEX_API_KEY   Optional. Higher rate limit when provided.
  CACHE_ENABLED      Optional. Defaults to true.
  ABSTRACT_MODE      Optional. Defaults to quick.
`;
  console.log(helpText.trim());
}

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  printHelp();
  process.exit(0);
}

if (args.includes('-v') || args.includes('--version')) {
  console.log(pkg.version);
  process.exit(0);
}

try {
  await import('./index.js');
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
