#!/usr/bin/env node
/**
 * Bidirectional route/service contract diff - Phase F1 / F3.
 *
 * Frontend calls with no backend route  => hard failure (dead API call).
 * Backend routes with no frontend caller => reported (orphan controller).
 *
 * Usage:
 *   php artisan route:list --json > tools/smoke/routes.json
 *   node tools/contract/route_contract_diff.mjs \
 *     --routes tools/smoke/routes.json \
 *     --services src/services \
 *     --out storage/contract/route-diff.md
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, all) => {
    if (arg.startsWith('--')) acc.push([arg.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1]]);
    return acc;
  }, [])
);

const routesFile = args.routes ?? 'tools/smoke/routes.json';
const servicesDir = args.services ?? 'src/services';
const outFile = args.out ?? 'storage/contract/route-diff.md';

const backend = new Map();
for (const row of JSON.parse(readFileSync(routesFile, 'utf8'))) {
  if (!row.name) continue;
  backend.set(row.name, { uri: row.uri, method: row.method });
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(full))) files.push(full);
  }
  return files;
}

// Frontend route names are declared as string literals. Anything that looks
// like a Laravel route name (snake_case, no spaces, no slashes) is checked.
const NAME_RE = /['"`]([a-z][a-z0-9]*(?:_[a-z0-9]+){1,})['"`]/g;
const frontend = new Map();

for (const file of walk(servicesDir)) {
  const source = readFileSync(file, 'utf8');
  for (const [, name] of source.matchAll(NAME_RE)) {
    if (!frontend.has(name)) frontend.set(name, new Set());
    frontend.get(name).add(file);
  }
}

// Only names that look like API route identifiers are asserted. A literal is
// treated as a route reference when it exists in the backend export OR uses a
// known surface prefix.
const SURFACE_PREFIXES = ['admin_', 'teacher_', 'student_', 'sponsor_', 'my_', 'auth_'];
const isRouteRef = (name) => backend.has(name) || SURFACE_PREFIXES.some((p) => name.startsWith(p));

const dead = [];
for (const [name, files] of frontend) {
  if (!isRouteRef(name)) continue;
  if (!backend.has(name)) dead.push({ name, files: [...files] });
}

const orphans = [];
for (const [name, meta] of backend) {
  if (!frontend.has(name)) orphans.push({ name, ...meta });
}

const lines = [];
lines.push('# Route contract diff', '');
lines.push(`Generated: ${new Date().toISOString()}`, '');
lines.push(`Backend named routes: ${backend.size}`);
lines.push(`Frontend route references: ${[...frontend.keys()].filter(isRouteRef).length}`, '');
lines.push(`| Check | Count | Blocking |`, `|---|---:|---|`);
lines.push(`| Frontend calls with no backend route | ${dead.length} | yes |`);
lines.push(`| Backend routes with no frontend caller | ${orphans.length} | no |`, '');

if (dead.length) {
  lines.push('## Dead frontend API calls (blocking)', '');
  for (const item of dead) lines.push(`- \`${item.name}\` referenced in ${item.files.join(', ')}`);
  lines.push('');
}

if (orphans.length) {
  lines.push('## Backend routes with no frontend caller', '');
  for (const item of orphans) lines.push(`- \`${item.name}\` (${item.method} ${item.uri})`);
  lines.push('');
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, lines.join('\n'));

console.log(`dead=${dead.length} orphans=${orphans.length} report=${outFile}`);

if (dead.length) {
  console.error('Frontend calls reference routes that do not exist. Failing.');
  process.exit(1);
}
