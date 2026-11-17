'use strict';
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

const IMAGE = process.env.RUNNER_IMAGE || 'contest-here-runner';
const MAX_PARALLEL = Number(process.env.JUDGE_CONCURRENCY || 4);
const LANGUAGES = ['c', 'cpp', 'java', 'python'];

// Only MAX_PARALLEL containers run at one time. The rest wait in this queue.
let running = 0;
const waiting = [];
function acquire() {
  if (running < MAX_PARALLEL) {
    running++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
}
function release() {
  const next = waiting.shift();
  if (next) next();
  else running--;
}

function docker(args, timeoutMs) {
  return new Promise((resolve) => {
    execFile('docker', args, { timeout: timeoutMs }, (err, stdout, stderr) => resolve({ err, stdout, stderr }));
  });
}

// Runs one container. Sends `job` as JSON on its stdin. Resolves with its stdout and stderr.
function runContainer(name, job, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn('docker', [
      'run', '--rm', '-i', '--name', name,
      '--network', 'none',
      '--memory', '512m', '--memory-swap', '512m',
      '--cpus', '1',
      '--pids-limit', '256',
      '--read-only',
      '--tmpfs', '/box:rw,exec,size=128m,mode=1777',
      '--tmpfs', '/in:rw,size=64m,mode=700',
      '--tmpfs', '/tmp:rw,size=16m,mode=1777',
      '--cap-drop', 'ALL', '--cap-add', 'SETUID', '--cap-add', 'SETGID',
      '--security-opt', 'no-new-privileges',
      IMAGE,
    ]);
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      docker(['kill', name], 10000);
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { if (stderr.length < 4000) stderr += d; });
    child.on('error', (err) => { stderr += err.message; });
    child.on('close', () => { clearTimeout(timer); resolve({ stdout, stderr, timedOut }); });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(job));
  });
}

/**
 * Compiles `code` once and runs it once per input.
 * Returns { compile: { ok, output }, tests: [{ status, time_ms, stdout, stderr }] }.
 * status is 'ok', 'rte' (non-zero exit) or 'tle' (over the time limit).
 */
async function run({ language, code, inputs, timeLimitMs }) {
  if (!LANGUAGES.includes(language)) throw new Error('Unknown language');
  await acquire();
  const name = 'arena-' + crypto.randomBytes(8).toString('hex');
  try {
    const timeoutMs = 45000 + inputs.length * (timeLimitMs + 1000);
    const job = { language, code, inputs, time_limit_ms: timeLimitMs };
    const { stdout, stderr, timedOut } = await runContainer(name, job, timeoutMs);
    try {
      return JSON.parse(stdout.trim().split('\n').pop());
    } catch {
      if (timedOut) throw new Error('The run took too long and was stopped.');
      throw new Error('The sandbox failed: ' + (stderr.trim().slice(0, 500) || 'no output'));
    }
  } finally {
    release();
  }
}

// Output matches when the lines are equal after removing trailing spaces
// on each line and blank lines at the end.
function normalize(text) {
  const lines = String(text).replace(/\r/g, '').split('\n').map((l) => l.trimEnd());
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
function sameOutput(actual, expected) {
  return normalize(actual) === normalize(expected);
}

async function imageExists() {
  const { err } = await docker(['image', 'inspect', IMAGE], 15000);
  return !err;
}

module.exports = { run, sameOutput, imageExists, LANGUAGES, IMAGE };
