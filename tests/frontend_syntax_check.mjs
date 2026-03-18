#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(new URL('..', import.meta.url).pathname);
const assetsDir = join(rootDir, 'assets');
const jsDir = join(assetsDir, 'js');

const files = [join(assetsDir, 'app.js')];

for (const entry of readdirSync(jsDir)) {
  const filePath = join(jsDir, entry);
  if (entry.endsWith('.js') && statSync(filePath).isFile()) {
    files.push(filePath);
  }
}

for (const file of files) {
  const check = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (check.status !== 0) {
    process.exit(check.status ?? 1);
  }
}

console.log('Frontend JavaScript syntax check passed for assets/app.js and assets/js/*.js');
