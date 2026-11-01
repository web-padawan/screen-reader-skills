// Checks the machine before a screen reader run. Uses Node built-ins only, so it runs before `npm ci`.
// Usage: node scripts/check.mjs voiceover|nvda [--url <url>]
// - Prints one line per check: "ok", "warn" or "FAIL", then the fix and the README section for a failure.
// - Exit codes: 0 no failure, 2 usage, 3 at least one failure.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkUrl, normalizeUrl, programPaths } from './lib/util.mjs';

const root = path.resolve(import.meta.dirname, '..');
const README = path.join(root, 'README.md');
const READERS = { voiceover: { platform: 'darwin', os: 'macOS' }, nvda: { platform: 'win32', os: 'Windows' } };
const MIN_NODE = [20, 19];

const usage = 'Usage: node scripts/check.mjs voiceover|nvda [--url <url>]';
let args;
let positionals;
try {
  ({ values: args, positionals } = parseArgs({ allowPositionals: true, options: { url: { type: 'string' } } }));
} catch (error) {
  console.error(`${error.message}\n${usage}`);
  process.exit(2);
}
const readerName = positionals[0];
if (!READERS[readerName] || positionals.length !== 1) {
  console.error(usage);
  process.exit(2);
}
const reader = READERS[readerName];

const results = [];
const ok = (text) => results.push({ level: 'ok', text });
const warn = (text, fix) => results.push({ level: 'warn', text, fix });
const fail = (text, fix) => results.push({ level: 'FAIL', text, fix });

/** Runs a command and returns its output, or undefined if it fails. */
const output = (command, commandArgs) => {
  try {
    return execFileSync(command, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
};

const cachePath =
  process.env.GUIDEPUP_SCREEN_READERS_PATH ??
  (reader.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'guidepup')
    : path.join(os.homedir(), 'Library', 'Caches', 'guidepup'));

const [major, minor] = process.versions.node.split('.').map(Number);
if (major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1])) ok(`Node ${process.versions.node}`);
else fail(`Node ${process.versions.node} is too old`, `Install Node ${MIN_NODE.join('.')} or later.`);

if (process.platform === reader.platform) ok(`platform ${reader.os}`);
else fail(`${readerName} runs on ${reader.os} only. This is ${process.platform}.`, 'Use a machine with that OS.');

// Resolves like the reader scripts do, so a package that npm hoisted to a parent node_modules counts.
const missing = ['@guidepup/guidepup', 'playwright'].filter((name) => {
  try {
    import.meta.resolve(name);
    return false;
  } catch {
    return true;
  }
});
if (missing.length) {
  fail(`${missing.join(' and ')} missing in ${root}`, `Run: npm ci --prefix "${root}". README: Install.`);
} else {
  ok('Node modules installed');
}
// The folder of the Guidepup package that the reader scripts import.
const guidepupDir = missing.includes('@guidepup/guidepup')
  ? undefined
  : path.dirname(fileURLToPath(import.meta.resolve('@guidepup/guidepup/package.json')));

if (process.platform === 'darwin' && readerName === 'voiceover') {
  if (output('defaults', ['read', 'com.apple.VoiceOver4/default', 'SCREnableAppleScript']) === '1') {
    ok('VoiceOver AppleScript control on');
  } else {
    fail('VoiceOver AppleScript control off', 'README: macOS Setup, steps 2 and 4.');
  }

  if (fs.existsSync(path.join(cachePath, 'voiceover'))) ok(`Guidepup VoiceOver profile in ${cachePath}`);
  else fail(`No Guidepup VoiceOver profile in ${cachePath}`, 'README: macOS Setup, step 5.');

  // Guidepup links its profile into this folder. Without Full Disk Access the start fails with EPERM.
  const container = path.join(os.homedir(), 'Library', 'Group Containers', 'group.com.apple.VoiceOver');
  try {
    fs.readdirSync(container);
    ok('VoiceOver group container readable');
  } catch (error) {
    if (error.code === 'ENOENT') warn(`No ${container}`, 'Start VoiceOver once by hand, then turn it off.');
    else fail(`Cannot read ${container}: ${error.code}`, 'README: macOS Setup, step 3 (Full Disk Access).');
  }

  if (output('pgrep', ['-x', 'VoiceOver'])) warn('VoiceOver is on', 'The run stops it. Turn it off to keep it.');
  else ok('VoiceOver off');

  // The Safari Developer setting. Only --focus-selector in Safari needs it.
  if (output('defaults', ['read', 'com.apple.Safari', 'AllowJavaScriptFromAppleEvents']) === '1') {
    ok('Safari JavaScript from Apple Events on');
  } else {
    warn(
      'Safari JavaScript from Apple Events off',
      'Needed for --focus-selector in Safari. README: macOS setup, step 7.',
    );
  }

  if (fs.existsSync('/Applications/Google Chrome.app')) ok('Google Chrome installed');
  else warn('No Google Chrome', 'Install it for --browser chrome and for probe.mjs.');
}

if (process.platform === 'win32' && readerName === 'nvda') {
  // Guidepup runs only the NVDA build of its manifest, so a Guidepup update can need a new install. The install
  // reads the manifest of the Guidepup in its working folder, so the fix names the folder above node_modules.
  if (guidepupDir) {
    const manifest = JSON.parse(fs.readFileSync(path.join(guidepupDir, 'manifest.json'), 'utf8'));
    const { version } = manifest.screenReaders.find(({ id }) => id === 'nvda').assets[0];
    if (fs.existsSync(path.join(cachePath, 'nvda', 'all', version, 'extracted', 'nvda.exe'))) {
      ok(`Guidepup NVDA ${version} in ${cachePath}`);
    } else {
      const project = path.resolve(guidepupDir, '..', '..', '..');
      fail(`No Guidepup NVDA ${version} in ${cachePath}`, `README: Windows Setup, step 1. Run it in ${project}.`);
    }
  }

  const find = (...parts) => programPaths(parts).find((file) => fs.existsSync(file));
  if (find('Google', 'Chrome', 'Application', 'chrome.exe')) ok('Google Chrome installed');
  else warn('No Google Chrome', 'Install it for --browser chrome and for probe.mjs.');
  if (find('Mozilla Firefox', 'firefox.exe')) ok('Firefox installed');
  else warn('No Firefox', 'Install it for --browser firefox.');
}

if (args.url) {
  const { ok: served, answered, text } = await checkUrl(normalizeUrl(args.url));
  if (served) ok(text);
  else if (answered) fail(text, 'Check the path. The dev server serves other pages.');
  else fail(text, 'Start the dev server, or fix the host and the port.');
}

for (const { level, text, fix } of results) {
  console.log(`${level.padEnd(4)} ${text}${fix ? `\n     Fix: ${fix}` : ''}`);
}
if (results.some(({ level }) => level === 'FAIL')) {
  console.log(`\nSetup steps: ${README}`);
  process.exitCode = 3;
}
