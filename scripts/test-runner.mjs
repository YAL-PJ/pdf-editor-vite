#!/usr/bin/env node
import { spawn } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const filteredArgs = [];
let sawRunTestsByPath = false;

for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];
  if (arg === '--runTestsByPath') {
    sawRunTestsByPath = true;
    continue;
  }
  filteredArgs.push(arg);
}

if (sawRunTestsByPath) {
  console.warn(
    '⚠️  The --runTestsByPath flag is specific to Jest. Vitest runs files by path when you pass them directly; the flag has been ignored.'
  );
}

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', ...filteredArgs],
  { stdio: 'inherit' }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
