// Shared run of key steps on a page with a Guidepup screen reader. Used by voiceover.mjs and nvda.mjs.
// - Expects a running dev server. Fetches the URL first and starts nothing if it does not answer.
// - Opens the browser, starts the reader, brings the browser to the front, and presses Tab until a phrase or the
//   item text matches --focus (a case-insensitive regex). That Tab is the first recorded step. Without --focus,
//   the steps start at the page start.
// - --focus-selector <css> focuses the target and presses Shift+Tab before the reader starts, so the first Tab
//   lands on the target. The reader script gives the browsers that support it.
// - Each step uses full capture. --seek-capture initial runs the Tab loop after the first Tab with initial capture.
//   On a match after the first Tab, it presses Shift+Tab and Tab again with full capture, so step 1 has every
//   phrase.
// - Then runs the steps of --steps or --scenario. A step is a key for the reader (`Tab`, `ArrowDown`, `s`, ...)
//   or `<prefix>+<command>`. The command is a name in `commands`, or any Guidepup `keyboardCommands` name.
// - Writes the log to --out, or to <tmpdir>/screen-reader-skills/<reader>-<browser>-<page>-<time>.json.
//   A run that fails after the reader starts writes the log with an `error` field.
// - Stops the reader and closes the browser on SIGINT, SIGTERM, SIGHUP and after --timeout seconds.
// - Returns the exit code: 0 done, 1 run error or timeout, 2 usage, 3 wrong platform or no answer from the URL,
//   4 no focus match.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { chromium, firefox } from 'playwright';
import { checkUrl, containsFocus, logName, parseRunOptions, stripPrefixes, targetExpression } from './util.mjs';

export const EXIT = { ok: 0, error: 1, usage: 2, unavailable: 3, noFocus: 4 };

const PLATFORMS = { darwin: 'macOS', win32: 'Windows' };
const SIGNALS = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };

export const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const t0 = Date.now();
export const log = (text) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${text}`);

/** An error that ends the run with a given exit code and no stack trace. */
export class ExitError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/** Maps a capture mode to the Guidepup value. */
const toCapture = (mode) => (mode === 'initial' ? 'initial' : true);

/**
 * Focuses the element of the selector, then presses Shift+Tab, so that the next Tab lands on the element.
 * @param {import('playwright').Page} page
 * @param {string} selector A CSS selector, or XPath if it starts with `/` or `(`.
 * @return {Promise<boolean>} False if the element took no focus. The page then reloads, so the Tab loop starts at
 *   the page start.
 */
export async function focusBefore(page, selector) {
  const target = (await page.evaluateHandle(targetExpression(selector))).asElement();
  if (!target) throw new ExitError(`No element matches ${selector}`, EXIT.noFocus);
  // The focus method of a custom element can delegate the focus to an inner element.
  await target.evaluate((element) => element.focus());
  if (await target.evaluate(containsFocus)) {
    await page.keyboard.press('Shift+Tab');
    log(`pre-focus: Shift+Tab from ${selector}`);
    return true;
  }
  await page.reload();
  log(`pre-focus: ${selector} took no focus, the Tab loop starts at the page start`);
  return false;
}

// The installed browsers that Playwright launches. `moz-firefox` is the installed Firefox through WebDriver BiDi,
// not the Playwright build of Firefox.
const BROWSERS = {
  chrome: { type: chromium, channel: 'chrome' },
  firefox: { type: firefox, channel: 'moz-firefox' },
};

/**
 * Opens the page in the installed Google Chrome or Firefox through Playwright, with a new profile.
 * @param {'chrome' | 'firefox'} name
 * @param {string} url
 * @param {{ args?: string[], prefs?: Record<string, unknown>, focusSelector?: string }} [options] `prefs` are
 *   Firefox preferences. With `focusSelector`, the first Tab of the run lands on that element.
 * @return {Promise<{ title: string, close: () => Promise<void> }>}
 */
export async function openBrowser(name, url, { args = [], prefs, focusSelector } = {}) {
  const { type, channel } = BROWSERS[name];
  const browser = await type.launch({ channel, headless: false, args, ...(prefs && { firefoxUserPrefs: prefs }) });
  try {
    const page = await browser.newPage();
    await page.goto(url);
    if (focusSelector) await focusBefore(page, focusSelector);
    await page.bringToFront();
    return { title: await page.title(), close: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

/**
 * Runs the steps with one screen reader and writes the log.
 * @param {object} options
 * @param {object} options.reader The Guidepup reader, such as `voiceOver` or `nvda`.
 * @param {string} options.name The reader name, such as `VoiceOver`. Its lower case starts the log name.
 * @param {string} options.prefix The step prefix of reader commands, such as `VO`.
 * @param {NodeJS.Platform} options.platform The only platform that runs the reader.
 * @param {string[]} options.browsers The supported `--browser` values. The first is the default.
 * @param {'full' | 'initial'} options.seekCapture The default capture of the Tab loop.
 * @param {string} options.script The script path for the usage line.
 * @param {string} options.stepHelp The reader commands for the usage text.
 * @param {Record<string, (options?: object) => Promise<void>>} options.commands Reader commands by step name.
 * @param {{ codes: object, modifiers: object }} options.keys The Guidepup key codes and modifiers of the OS.
 * @param {(browser: string, url: string, focusSelector?: string) => Promise<() => Promise<void>>} options.open
 *   Opens the page and returns the close function.
 * @param {() => Promise<void>} options.start Starts the reader with full capture.
 * @param {(browser: string) => Promise<void>} options.activate Brings the browser to the front.
 * @param {() => Promise<string>} [options.rawPhrase] Returns the last phrase as the reader has it.
 * @param {RegExp[]} [options.focusPrefixes] Announcements before the item that --focus must not match.
 * @param {string[]} [options.focusSelectorBrowsers] The browsers whose `open` supports --focus-selector.
 *   Default: `['chrome']`.
 * @param {number} [options.settleMs] The wait for the window announcements after the activation. Default 2000.
 * @param {object} [hostOptions] The process parts that a test replaces.
 * @param {string[]} [hostOptions.argv] The arguments. Default: the arguments after the script path.
 * @param {NodeJS.Platform} [hostOptions.platform] Default: `process.platform`.
 * @param {import('node:events').EventEmitter} [hostOptions.signals] The source of SIGINT, SIGTERM and SIGHUP.
 *   Default: `process`.
 * @param {(code: number) => void} [hostOptions.exit] Ends the process after an abort. Default: `process.exit`.
 * @return {Promise<number>} The exit code.
 */
export async function runSteps(options, hostOptions = {}) {
  const host = {
    argv: process.argv.slice(2),
    platform: process.platform,
    signals: process,
    exit: (code) => process.exit(code),
    ...hostOptions,
  };
  const { reader, name, prefix, platform, browsers, seekCapture, script, stepHelp, commands } = options;
  const usage =
    `Usage: node ${script} --url <url> [--browser ${browsers.join('|')}] [--focus <regex>]` +
    ' [--focus-selector <css>]\n  [--steps <key,key,...> | --scenario <file.json>] [--seek-capture full|initial]' +
    ' [--max-tabs <n>]\n  [--timeout <seconds>] [--out <file.json>]\n' +
    `Defaults: --browser ${browsers[0]}, --seek-capture ${seekCapture}, --max-tabs 20,` +
    ' --timeout 540.\nPass a value that starts with "-" as --option=value.\n' +
    `Steps: a key such as Tab, Shift+Tab, ArrowDown, End, Enter, Escape, Space or a letter, or a ${name} command:\n` +
    `${stepHelp}\nExit codes: 0 done, 1 run error, 2 usage, 3 platform or URL, 4 no focus match.`;

  let parsed;
  try {
    parsed = parseRunOptions(host.argv, options);
  } catch (error) {
    console.error(`${error.message}\n\n${usage}`);
    return EXIT.usage;
  }
  if (parsed.help) {
    console.log(usage);
    return EXIT.ok;
  }
  if (host.platform !== platform) {
    console.error(`${name} runs on ${PLATFORMS[platform]} only. This is ${host.platform}.`);
    return EXIT.unavailable;
  }

  const { run, focus, maxTabs, timeout } = parsed;
  const { url, browser, focusSelector, steps } = run;
  const outFile = path.resolve(
    parsed.out ??
      path.join(
        os.tmpdir(),
        'screen-reader-skills',
        `${logName({ reader: name, browser, url, date: new Date() })}.json`,
      ),
  );
  const result = {
    reader: name,
    readerVersion: undefined,
    guidepup: createRequire(import.meta.url)('@guidepup/guidepup/package.json').version,
    browser,
    url,
    ...(run.focus !== undefined && { focus: run.focus }),
    ...(focusSelector !== undefined && { focusSelector }),
    seekCapture: parsed.seekCapture,
    os: `${os.type()} ${os.release()}`,
    date: new Date().toISOString(),
    setup: [],
    steps: [],
  };

  let exitCode = EXIT.ok;
  let opening;
  let starting;
  let started = false;
  let logWritten = false;
  let aborting = false;
  let cleaning;
  let timer;
  let handlers = [];

  /** Writes the log and returns false if it cannot. */
  const writeLog = (extra) => {
    try {
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, `${JSON.stringify({ ...result, ...extra }, null, 2)}\n`);
      log(`wrote ${outFile}`);
      return true;
    } catch (error) {
      console.error(`Cannot write the log ${outFile}: ${error.message}`);
      return false;
    }
  };

  // Runs once, from the end of the run, a signal or the timeout. A signal can come while the browser opens or
  // while the reader starts, so wait for both before the stop and the close.
  const cleanup = () => {
    cleaning ??= (async () => {
      clearTimeout(timer);
      const close = await opening?.catch(() => undefined);
      const readerStarted = await starting?.then(() => true).catch(() => false);
      if (readerStarted) {
        await reader.stop().catch((error) => console.error('stop failed', error.message));
        log(`${name} stopped`);
      }
      if (close) {
        await close().catch((error) => console.error('close failed', error.message));
        log('browser closed');
      }
      for (const [signal, handler] of handlers) host.signals.off(signal, handler);
    })();
    return cleaning;
  };

  // The run loop goes on until the reader stops. Its error then is a result of the abort, so it stays silent.
  const abort = async (reason, code) => {
    if (aborting) return;
    aborting = true;
    exitCode = code;
    log(`abort: ${reason}`);
    if (started && !logWritten) writeLog({ error: `aborted: ${reason}` });
    await cleanup();
    host.exit(code);
  };
  handlers = Object.entries(SIGNALS).map(([signal, code]) => {
    const handler = () => abort(signal, code);
    host.signals.on(signal, handler);
    return [signal, handler];
  });
  // Guidepup adds its own signal handler on the start. It kills the reader while the stop of the abort waits for
  // the last capture, and that capture then polls a dead VoiceOver for about 30 seconds. So keep only the abort.
  const dropReaderSignalHandlers = () => {
    for (const [signal, handler] of handlers) {
      for (const listener of host.signals.listeners(signal)) {
        if (listener !== handler) host.signals.off(signal, listener);
      }
    }
  };
  timer = setTimeout(() => abort(`timeout after ${timeout} seconds`, EXIT.error), timeout * 1000);

  /** Runs one step and returns the phrases the reader spoke for it. */
  const step = async (token, mode = 'full') => {
    await reader.clearSpokenPhraseLog();
    const commandOptions = { capture: toCapture(mode) };
    const begin = Date.now();
    if (token.startsWith(`${prefix}+`)) {
      const command = token.slice(prefix.length + 1);
      if (commands[command]) await commands[command](commandOptions);
      else await reader.perform(reader.keyboardCommands[command], commandOptions);
    } else {
      await reader.press(token, commandOptions);
    }
    const ms = Date.now() - begin;
    const phrases = await reader.spokenPhraseLog();
    const itemText = await reader.itemText().catch(() => '');
    const raw = options.rawPhrase ? await options.rawPhrase() : undefined;
    log(`${token}: ${JSON.stringify(phrases)}`);
    return { key: token, phrases, ...(raw !== undefined && { raw }), itemText, ms };
  };

  // The phrase log can drop a phrase, so the item text is the fallback.
  const isFocusTarget = ({ phrases, itemText }) =>
    [...phrases.map((phrase) => stripPrefixes(phrase, options.focusPrefixes ?? [])), itemText].some((text) =>
      focus.test(text),
    );

  const runAll = async () => {
    const served = await checkUrl(url);
    if (!served.ok) throw new ExitError(served.text, EXIT.unavailable);
    const selectorBrowsers = options.focusSelectorBrowsers ?? ['chrome'];
    if (focusSelector && !selectorBrowsers.includes(browser)) {
      log(`--focus-selector works in ${selectorBrowsers.join(' and ')} only. ${browser} ignores it.`);
    }

    log(`page ${url}`);
    opening = options.open(browser, url, focusSelector);
    await opening;
    if (aborting) return;
    starting = options.start();
    await starting;
    started = true;
    dropReaderSignalHandlers();
    if (aborting) return;
    result.readerVersion = reader.version;
    log(`${name} ${reader.version} started, seek capture ${parsed.seekCapture}`);

    // Guidepup has the reader commands only after the start.
    for (const { key } of steps) {
      const command = key.startsWith(`${prefix}+`) ? key.slice(prefix.length + 1) : undefined;
      if (command !== undefined && !commands[command] && !reader.keyboardCommands[command]) {
        throw new ExitError(`Unknown ${name} command ${key}`, EXIT.usage);
      }
    }

    await options.activate(browser);
    // Let the window announcements finish, then drop them.
    await delay(options.settleMs ?? 2000);
    log(`front: ${JSON.stringify(await reader.spokenPhraseLog())}`);
    await reader.clearSpokenPhraseLog();

    if (focus) {
      const seek = parsed.seekCapture;
      let first;
      let tabs = 0;
      // The first Tab uses full capture. A target at the first stop then needs no second landing, because a
      // Shift+Tab from it leaves the page, for example to the Safari tab bar.
      while (tabs < maxTabs && !first) {
        const entry = await step('Tab', tabs === 0 ? 'full' : seek);
        tabs += 1;
        if (isFocusTarget(entry)) first = entry;
        else result.setup.push(entry);
      }
      if (!first) throw new ExitError(`No phrase matched ${focus} after ${maxTabs} Tab presses`, EXIT.noFocus);
      if (tabs > 1 && seek === 'initial') {
        // Land on the target again with full capture, so step 1 has every phrase.
        result.setup.push(first, await step('Shift+Tab', 'initial'));
        first = await step('Tab');
        if (!isFocusTarget(first)) log(`warning: the second Tab did not match ${focus}`);
      }
      result.steps.push(first);
    }

    for (const { key, say, expect } of steps) {
      result.steps.push({
        ...(say !== undefined && { say }),
        ...(expect !== undefined && { expect }),
        ...(await step(key)),
      });
    }
    if (aborting) return;

    logWritten = writeLog();
    if (!logWritten) exitCode = EXIT.error;
    console.table(
      result.steps.map(({ key, phrases, raw, itemText, ms }) => ({
        key,
        phrases: phrases.map((phrase) => JSON.stringify(phrase)).join(' | '),
        ...(raw !== undefined && { raw: JSON.stringify(raw) }),
        itemText: JSON.stringify(itemText),
        ms,
      })),
    );
    console.log(`log: ${outFile}`);
  };

  try {
    await runAll();
  } catch (error) {
    if (!aborting) {
      if (error instanceof ExitError) console.error(error.message);
      else console.error(error);
      exitCode = error instanceof ExitError ? error.code : EXIT.error;
      if (started) writeLog({ error: error.message });
    }
  } finally {
    await cleanup();
  }
  return exitCode;
}
