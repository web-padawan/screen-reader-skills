// Helpers of the runner and the machine check: the URL, the steps, the scenario file, the log name and the
// program paths. They use Node built-ins only, so check.mjs runs before `npm ci`. Unit tested.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const SCENARIO_KEYS = ['url', 'browser', 'focus', 'focusSelector', 'steps'];

// The largest delay of setTimeout, in seconds. A larger one fires at once.
export const MAX_TIMEOUT = 2147483;

/**
 * Returns the absolute URL. A path of a local file gets `file://`. Another URL without a scheme gets `http://`.
 * @param {string} input Such as `localhost:8000/dev/select.html` or `examples/pages/select.html`.
 * @return {string}
 */
export function normalizeUrl(input) {
  const text = String(input ?? '').trim();
  if (!text) throw new Error('The URL is empty');
  if (/^[a-z][a-z\d+.-]*:\/\//iu.test(text)) return new URL(text).href;
  if (fs.existsSync(text) && fs.statSync(text).isFile()) return pathToFileURL(path.resolve(text)).href;
  return new URL(`http://${text}`).href;
}

/**
 * Fetches the URL to check that the dev server serves it.
 * @param {string} url
 * @return {Promise<{ ok: boolean, answered: boolean, text: string }>} `answered` is false if no server answered.
 */
export async function checkUrl(url) {
  if (url.startsWith('file:')) {
    const found = fs.existsSync(fileURLToPath(url));
    return { ok: found, answered: found, text: found ? `${url} exists` : `No file at ${url}` };
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { ok: response.ok, answered: true, text: `${url} answered HTTP ${response.status}` };
  } catch (error) {
    const cause = error.cause?.code ?? error.cause?.message ?? error.message;
    return { ok: false, answered: false, text: `No answer from ${url}: ${cause}` };
  }
}

/**
 * Returns a page expression that finds the first element for the selector. A selector that starts with `/` or `(`
 * is XPath, and any other selector goes to `document.querySelector`. Neither reaches into a shadow root.
 * @param {string} selector Such as `#size` or `//select[@id="size"]`.
 * @return {string}
 */
export function targetExpression(selector) {
  const value = JSON.stringify(selector);
  return /^[/(]/u.test(selector)
    ? `document.evaluate(${value}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`
    : `document.querySelector(${value})`;
}

/**
 * Returns true if the focus is in the element or in its shadow tree. Runs in the page.
 * @param {Element} target
 */
export function containsFocus(target) {
  let node = target.ownerDocument.activeElement;
  while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
  for (; node; node = node.parentNode ?? node.host) {
    if (node === target) return true;
  }
  return false;
}

/**
 * Returns a page expression that focuses the element of the selector, for the Safari `do JavaScript`.
 * The focus method of a custom element can delegate the focus to an inner element.
 * @param {string} selector A CSS selector, or XPath if it starts with `/` or `(`.
 * @return {string} An expression that gives `focused`, `unfocused` if the focus is not in the element or in its
 *   shadow tree, or `none` if no element matches.
 */
export function focusExpression(selector) {
  return (
    `(() => { const target = ${targetExpression(selector)}; if (!target) return 'none'; target.focus();` +
    ` return (${containsFocus})(target) ? 'focused' : 'unfocused'; })()`
  );
}

/**
 * Returns the paths of a Windows program in the folders for all users, then in the folder for the current user.
 * @param {string[]} parts Such as `['Mozilla Firefox', 'firefox.exe']`.
 * @param {Record<string, string | undefined>} [env] The environment.
 * @return {string[]}
 */
export function programPaths(parts, env = process.env) {
  return [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA]
    .filter(Boolean)
    .map((dir) => path.win32.join(dir, ...parts));
}

/**
 * Splits a comma-separated step list into tokens.
 * @param {string | undefined} text Such as `ArrowDown,ArrowDown,Enter`.
 * @return {string[]}
 */
export function parseSteps(text) {
  if (text === undefined || text.trim() === '') return [];
  const tokens = text.split(',').map((token) => token.trim());
  if (tokens.includes('')) throw new Error(`Empty step in "${text}"`);
  return tokens;
}

/**
 * Returns true if Guidepup can press the key. Guidepup skips an unknown name and presses nothing.
 * The check follows its `parseKey`: a digit is `Digit<n>`, and parts join with `+`.
 * @param {string} token Such as `Shift+Tab`, `ArrowDown` or `s`.
 * @param {Record<string, unknown>} keyCodes The Guidepup key codes of the OS, such as `MacOSKeyCodes`.
 * @param {Record<string, unknown>} modifiers The Guidepup modifiers of the OS, such as `MacOSModifiers`.
 */
export function isKnownKey(token, keyCodes, modifiers) {
  const parts = token.split('+').map((part) => (/^\d$/u.test(part) ? `Digit${part}` : part));
  const keys = parts.filter((part) => !Object.hasOwn(modifiers, part));
  return keys.length > 0 && keys.every((part) => Object.hasOwn(keyCodes, part));
}

/**
 * Compiles the focus regex. It matches case-insensitively.
 * @param {string} source
 * @return {RegExp}
 */
export function compileFocus(source) {
  if (!source) throw new Error('The focus regex is empty');
  return new RegExp(source, 'iu');
}

// VoiceOver announcements before the item when the focus moves between areas, as logged in Safari:
// "VoiceOver Settings activity.", "Leaving toolbar." and "Entering Side Nav web content.". The last one holds the
// page title, so a --focus regex can match it before the focus reaches the target.
export const VOICEOVER_PREFIXES = [
  /^VoiceOver Settings activity\.?\s*/u,
  /^Leaving [^.]*\.\s*/u,
  /^Entering [^.]*\.\s*/u,
];

/**
 * Removes leading announcements from a phrase, such as "Entering Side Nav web content.". Each pattern removes
 * one announcement. The patterns repeat until none matches.
 * @param {string} phrase
 * @param {RegExp[]} patterns Patterns anchored at the start, such as one for `Leaving toolbar.`.
 * @return {string}
 */
export function stripPrefixes(phrase, patterns) {
  let text = phrase;
  let previous;
  do {
    previous = text;
    for (const pattern of patterns) text = text.replace(pattern, '');
  } while (text !== previous);
  return text;
}

/**
 * Checks a resolved scenario object and turns each step into `{ key, say?, expect? }`.
 * @param {unknown} data The parsed JSON.
 * @return {{ url?: string, browser?: string, focus?: string, focusSelector?: string,
 *   steps: { key: string, say?: string, expect?: string }[] }}
 */
export function validateScenario(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The scenario must be a JSON object');
  }
  const unknown = Object.keys(data).filter((key) => !SCENARIO_KEYS.includes(key));
  if (unknown.length) throw new Error(`Unknown scenario fields: ${unknown.join(', ')}`);
  for (const key of SCENARIO_KEYS.filter((name) => name !== 'steps')) {
    if (data[key] !== undefined && typeof data[key] !== 'string') throw new Error(`"${key}" must be a string`);
  }
  if (data.steps !== undefined && !Array.isArray(data.steps)) throw new Error('"steps" must be an array');
  const steps = (data.steps ?? []).map((step, index) => {
    const value = typeof step === 'string' ? { key: step } : step;
    if (value === null || typeof value !== 'object' || typeof value.key !== 'string' || !value.key.trim()) {
      throw new Error(`Step ${index + 1} needs a "key" string`);
    }
    for (const field of ['say', 'expect']) {
      if (value[field] !== undefined && typeof value[field] !== 'string') {
        throw new Error(`Step ${index + 1}: "${field}" must be a string`);
      }
    }
    return {
      key: value.key.trim(),
      ...(value.say !== undefined && { say: value.say }),
      ...(value.expect !== undefined && { expect: value.expect }),
    };
  });
  return { ...data, steps };
}

/**
 * Reads and checks a resolved scenario file.
 * @param {string} file
 */
export function readScenario(file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read the scenario ${file}: ${error.message}`, { cause: error });
  }
  return validateScenario(data);
}

/**
 * Merges the command line options over the scenario. A command line value wins.
 * @param {Record<string, string | undefined>} args The parsed options.
 * @param {ReturnType<typeof validateScenario> | undefined} scenario
 * @param {{ browser: string }} defaults
 */
export function resolveRun(args, scenario, defaults) {
  const pick = (arg, field) => args[arg] ?? scenario?.[field];
  const url = pick('url', 'url');
  if (!url) throw new Error('Pass --url or a scenario with "url"');
  const steps = args.steps !== undefined ? parseSteps(args.steps).map((key) => ({ key })) : (scenario?.steps ?? []);
  return {
    url: normalizeUrl(url),
    browser: pick('browser', 'browser') ?? defaults.browser,
    focus: pick('focus', 'focus'),
    focusSelector: pick('focus-selector', 'focusSelector'),
    steps,
  };
}

/**
 * Parses and checks the command line options of a reader script. Throws an error with the reason for a usage error.
 * @param {string[]} argv The arguments after the script path.
 * @param {{ browsers: string[], seekCapture: 'full' | 'initial', prefix: string,
 *   keys: { codes: Record<string, unknown>, modifiers: Record<string, unknown> } }} profile The reader script values.
 *   The first browser is the default.
 */
export function parseRunOptions(argv, { browsers, seekCapture, prefix, keys }) {
  const { values: args } = parseArgs({
    args: argv,
    options: {
      url: { type: 'string' },
      browser: { type: 'string' },
      focus: { type: 'string' },
      'focus-selector': { type: 'string' },
      steps: { type: 'string' },
      scenario: { type: 'string' },
      'seek-capture': { type: 'string', default: seekCapture },
      'max-tabs': { type: 'string', default: '20' },
      timeout: { type: 'string', default: '540' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (args.help) return { help: true };
  if (args.steps !== undefined && args.scenario !== undefined) throw new Error('Pass --steps or --scenario');
  const run = resolveRun(args, args.scenario === undefined ? undefined : readScenario(args.scenario), {
    browser: browsers[0],
  });
  const maxTabs = Number(args['max-tabs']);
  const timeout = Number(args.timeout);
  if (!browsers.includes(run.browser)) throw new Error(`--browser must be ${browsers.join(' or ')}`);
  if (!['full', 'initial'].includes(args['seek-capture'])) throw new Error('--seek-capture must be full or initial');
  if (!(Number.isInteger(maxTabs) && maxTabs > 0)) throw new Error('--max-tabs must be a positive integer');
  if (!(timeout > 0 && timeout <= MAX_TIMEOUT)) throw new Error(`--timeout must be 1 to ${MAX_TIMEOUT} seconds`);
  const unknownKeys = run.steps
    .map(({ key }) => key)
    .filter((key) => !key.startsWith(`${prefix}+`) && !isKnownKey(key, keys.codes, keys.modifiers));
  if (unknownKeys.length) {
    throw new Error(`Unknown keys: ${unknownKeys.join(', ')}. Use Guidepup names, such as Escape or ArrowDown.`);
  }
  return {
    help: false,
    run,
    focus: run.focus === undefined ? undefined : compileFocus(run.focus),
    seekCapture: args['seek-capture'],
    maxTabs,
    timeout,
    out: args.out,
  };
}

/**
 * Returns the log file name without the extension: `<reader>-<browser>-<page stem>-<date>-<time>`.
 * @param {{ reader: string, browser: string, url: string, date: Date }} options
 * @return {string}
 */
export function logName({ reader, browser, url, date }) {
  const stem = path.posix.basename(new URL(url).pathname, path.posix.extname(new URL(url).pathname)) || 'index';
  const slug =
    stem
      .toLowerCase()
      .replace(/[^a-z\d]+/gu, '-')
      .replace(/^-|-$/gu, '') || 'page';
  const pad = (value) => String(value).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${reader.toLowerCase()}-${browser}-${slug}-${stamp}`;
}
