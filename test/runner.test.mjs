import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { chromium } from 'playwright';
import { delay, focusBefore, runSteps } from '../scripts/lib/runner.mjs';

const KEYS = { codes: { Tab: 1, Enter: 2, Escape: 3, ArrowDown: 4 }, modifiers: { Shift: 'shift' } };

/**
 * Returns a fake Guidepup reader on a page with Tab stops. Tab and Shift+Tab move between the stops, and a Tab to a
 * stop speaks its phrase. Another key speaks `phrases[key]`. Like Guidepup, every call throws after the stop.
 * @param {object} options
 * @param {{ phrase: string, item?: string }[]} options.stops
 * @param {Record<string, string>} [options.phrases]
 * @param {(key: string) => void | Promise<void>} [options.onPress] Runs at the start of each key press.
 * @param {number} [options.pressMs] The duration of each key press.
 */
function fakeReader({ stops, phrases = {}, onPress, pressMs = 0 }) {
  let index = -1;
  let spoken = [];
  let running = false;
  const calls = [];
  const check = () => {
    if (!running) throw new Error('Fake reader not running');
  };
  return {
    calls,
    version: 'fake 1',
    keyboardCommands: { describeFocus: 'describe-focus' },
    async start() {
      running = true;
    },
    async stop() {
      check();
      running = false;
      calls.push('stop');
    },
    async clearSpokenPhraseLog() {
      check();
      spoken = [];
    },
    async spokenPhraseLog() {
      check();
      return spoken;
    },
    async itemText() {
      check();
      return stops[index]?.item ?? '';
    },
    async press(key, { capture }) {
      check();
      calls.push(`${key}:${capture}`);
      await onPress?.(key);
      await delay(pressMs);
      check();
      if (key === 'Tab') index += 1;
      if (key === 'Shift+Tab') index -= 1;
      spoken = ['Tab', 'Shift+Tab'].includes(key) ? [stops[index]?.phrase ?? ''] : [phrases[key] ?? ''];
    },
    async perform(command, { capture }) {
      check();
      calls.push(`perform ${command}:${capture}`);
      spoken = [`performed ${command}`];
    },
  };
}

/** Returns the reader script values for a fake reader, and the list of browser and command events. */
function fakeProfile(reader, overrides = {}) {
  const events = [];
  const options = {
    reader,
    name: 'Fake',
    prefix: 'FK',
    platform: process.platform,
    browsers: ['web', 'other'],
    seekCapture: 'initial',
    script: 'fake.mjs',
    stepHelp: '',
    keys: KEYS,
    commands: {
      custom: async ({ capture }) => {
        events.push(`custom:${capture}`);
      },
    },
    async open(browser) {
      events.push(`open ${browser}`);
      return async () => {
        events.push('close');
      };
    },
    start: () => reader.start(),
    async activate() {
      events.push('activate');
    },
    focusPrefixes: [/^Entering [^.]*\.\s*/u],
    settleMs: 0,
    ...overrides,
  };
  return { options, events };
}

const STOPS = [
  { phrase: 'Before button' },
  { phrase: 'Middle link' },
  { phrase: 'Size combo box' },
  { phrase: 'After' },
];

let server;
let url;
let dir;
let errors;

before(async () => {
  server = http.createServer((request, response) => {
    response.statusCode = request.url === '/page.html' ? 200 : 404;
    response.end();
  });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  url = `http://127.0.0.1:${server.address().port}/page.html`;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-runner-test-'));
});

after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  errors = [];
  mock.restoreAll();
  mock.method(console, 'log', () => {});
  mock.method(console, 'table', () => {});
  mock.method(console, 'error', (...parts) => {
    errors.push(parts.join(' '));
  });
});

/**
 * Runs the steps with a fake process and returns the exit code, the exit calls, the log and the signal source.
 * @param {object} options The reader script values.
 * @param {string[]} argv The arguments without `--out`.
 * @param {object} [host] Host parts to replace.
 */
async function run(options, argv, host = {}) {
  const out = path.join(dir, `${Math.random().toString(36).slice(2)}.json`);
  const exits = [];
  const signals = host.signals ?? new EventEmitter();
  const code = await runSteps(options, {
    argv: [...argv, '--out', out],
    signals,
    exit: (exitCode) => exits.push(exitCode),
    ...host,
  });
  const log = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : undefined;
  return { code, exits, log, signals };
}

const keysOf = (entries) => entries.map(({ key }) => key);

describe('runSteps', () => {
  describe('before the reader starts', () => {
    it('returns 0 for --help and starts nothing', async () => {
      const reader = fakeReader({ stops: STOPS });
      const { options, events } = fakeProfile(reader);
      assert.equal(await runSteps(options, { argv: ['--help'] }), 0);
      assert.deepEqual(events, []);
    });

    it('returns 2 for a usage error and starts nothing', async () => {
      const reader = fakeReader({ stops: STOPS });
      const { options, events } = fakeProfile(reader);
      const { code } = await run(options, ['--url', url, '--steps', 'Esc']);
      assert.equal(code, 2);
      assert.match(errors[0], /Unknown keys: Esc/u);
      assert.deepEqual(events, []);
    });

    it('returns 3 on another platform and starts nothing', async () => {
      const reader = fakeReader({ stops: STOPS });
      const { options, events } = fakeProfile(reader, { platform: 'darwin' });
      const { code } = await run(options, ['--url', url], { platform: 'win32' });
      assert.equal(code, 3);
      assert.match(errors[0], /Fake runs on macOS only/u);
      assert.deepEqual(events, []);
    });

    it('returns 3 for a page that the server does not have and starts nothing', async () => {
      const reader = fakeReader({ stops: STOPS });
      const { options, events } = fakeProfile(reader);
      const { code, log } = await run(options, ['--url', url.replace('page.html', 'missing.html')]);
      assert.equal(code, 3);
      assert.match(errors[0], /answered HTTP 404/u);
      assert.deepEqual(events, []);
      assert.equal(log, undefined);
    });
  });

  describe('the Tab loop', () => {
    it('seeks with initial capture, then lands again on the target with full capture', async () => {
      const reader = fakeReader({ stops: STOPS, phrases: { Enter: 'Size expanded' } });
      const { options, events } = fakeProfile(reader);
      const { code, log } = await run(options, ['--url', url, '--focus', 'Size', '--steps', 'Enter']);
      assert.equal(code, 0);
      assert.deepEqual(reader.calls, [
        'Tab:true',
        'Tab:initial',
        'Tab:initial',
        'Shift+Tab:initial',
        'Tab:true',
        'Enter:true',
        'stop',
      ]);
      assert.deepEqual(keysOf(log.setup), ['Tab', 'Tab', 'Tab', 'Shift+Tab']);
      assert.deepEqual(
        log.steps.map(({ key, phrases }) => [key, phrases]),
        [
          ['Tab', ['Size combo box']],
          ['Enter', ['Size expanded']],
        ],
      );
      assert.deepEqual(events, ['open web', 'activate', 'close']);
    });

    it('does not land again on a target at the first stop', async () => {
      const reader = fakeReader({ stops: [{ phrase: 'Size combo box' }, { phrase: 'After' }] });
      const { options } = fakeProfile(reader);
      const { code, log } = await run(options, ['--url', url, '--focus', 'Size']);
      assert.equal(code, 0);
      assert.deepEqual(reader.calls, ['Tab:true', 'stop']);
      assert.deepEqual(log.setup, []);
    });

    it('keeps full capture with --seek-capture full and does not land again', async () => {
      const reader = fakeReader({ stops: STOPS });
      const { options } = fakeProfile(reader);
      const { log } = await run(options, ['--url', url, '--focus', 'Size', '--seek-capture', 'full']);
      assert.deepEqual(reader.calls, ['Tab:true', 'Tab:true', 'Tab:true', 'stop']);
      assert.equal(log.seekCapture, 'full');
    });

    it('matches the item text when the phrase misses the target', async () => {
      const reader = fakeReader({ stops: [{ phrase: '' }, { phrase: '', item: 'Size combo box' }] });
      const { options } = fakeProfile(reader);
      const { code, log } = await run(options, ['--url', url, '--focus', 'Size']);
      assert.equal(code, 0);
      assert.equal(log.steps[0].itemText, 'Size combo box');
    });

    it('ignores the page title in an announcement before the item', async () => {
      const stops = [{ phrase: 'Entering Size Demo web content. Before button' }, { phrase: 'Size combo box' }];
      const withPrefixes = fakeReader({ stops });
      const { log } = await run(fakeProfile(withPrefixes).options, [
        '--url',
        url,
        '--focus',
        'Size',
        '--seek-capture=full',
      ]);
      assert.deepEqual(log.steps[0].phrases, ['Size combo box']);

      const withoutPrefixes = fakeReader({ stops });
      const profile = fakeProfile(withoutPrefixes, { focusPrefixes: [] });
      const { log: early } = await run(profile.options, ['--url', url, '--focus', 'Size']);
      assert.deepEqual(early.steps[0].phrases, ['Entering Size Demo web content. Before button']);
    });

    it('returns 4 when no phrase matches, and writes the log and cleans up', async () => {
      const reader = fakeReader({ stops: STOPS });
      const { options, events } = fakeProfile(reader);
      const { code, log } = await run(options, ['--url', url, '--focus', 'Nothing', '--max-tabs', '2']);
      assert.equal(code, 4);
      assert.match(log.error, /No phrase matched .*Nothing.* after 2 Tab presses/u);
      assert.equal(log.setup.length, 2);
      assert.equal(reader.calls.at(-1), 'stop');
      assert.equal(events.at(-1), 'close');
    });

    it('starts the steps at the page start without --focus', async () => {
      const reader = fakeReader({ stops: STOPS, phrases: { ArrowDown: 'Down' } });
      const { options } = fakeProfile(reader);
      const { log } = await run(options, ['--url', url, '--steps', 'ArrowDown']);
      assert.deepEqual(reader.calls, ['ArrowDown:true', 'stop']);
      assert.deepEqual(log.setup, []);
      assert.equal(log.focus, undefined);
    });
  });

  describe('the steps', () => {
    it('runs the commands of the script and of Guidepup with full capture', async () => {
      const reader = fakeReader({ stops: STOPS });
      const { options, events } = fakeProfile(reader);
      const { code, log } = await run(options, ['--url', url, '--steps', 'FK+custom,FK+describeFocus']);
      assert.equal(code, 0);
      assert.ok(events.includes('custom:true'));
      assert.ok(reader.calls.includes('perform describe-focus:true'));
      assert.deepEqual(keysOf(log.steps), ['FK+custom', 'FK+describeFocus']);
    });

    it('returns 2 for an unknown reader command after the start, and cleans up', async () => {
      const reader = fakeReader({ stops: STOPS });
      const { options, events } = fakeProfile(reader);
      const { code, log } = await run(options, ['--url', url, '--steps', 'FK+nothing']);
      assert.equal(code, 2);
      assert.equal(log.error, 'Unknown Fake command FK+nothing');
      assert.deepEqual(reader.calls, ['stop']);
      assert.equal(events.at(-1), 'close');
    });

    it('copies say and expect of a scenario file into the log', async () => {
      const scenario = path.join(dir, 'scenario.json');
      fs.writeFileSync(
        scenario,
        JSON.stringify({ url, browser: 'other', steps: [{ key: 'Enter', say: 'Press Enter', expect: 'it opens' }] }),
      );
      const reader = fakeReader({ stops: STOPS, phrases: { Enter: 'Opened' } });
      const { options, events } = fakeProfile(reader);
      const { log } = await run(options, ['--scenario', scenario]);
      assert.deepEqual(log.steps[0], {
        say: 'Press Enter',
        expect: 'it opens',
        key: 'Enter',
        phrases: ['Opened'],
        itemText: '',
        ms: log.steps[0].ms,
      });
      assert.equal(log.browser, 'other');
      assert.equal(events[0], 'open other');
    });

    it('passes --focus-selector to open, and notes a browser that ignores it', async () => {
      const opened = [];
      const runWith = async (browser) => {
        const { options } = fakeProfile(fakeReader({ stops: STOPS }), {
          focusSelectorBrowsers: ['web'],
          async open(name, _url, selector) {
            opened.push([name, selector]);
            return async () => {};
          },
        });
        console.log.mock.resetCalls();
        await run(options, ['--url', url, '--browser', browser, '--focus-selector', '#size']);
        return console.log.mock.calls.some(({ arguments: [text] }) => /works in web only\. other ignores/u.test(text));
      };
      assert.equal(await runWith('web'), false);
      assert.equal(await runWith('other'), true);
      assert.deepEqual(opened, [
        ['web', '#size'],
        ['other', '#size'],
      ]);
    });

    it('writes the run fields into the log', async () => {
      const reader = fakeReader({ stops: STOPS });
      const { options } = fakeProfile(reader);
      const { log } = await run(options, ['--url', url, '--focus', 'Size']);
      assert.deepEqual(
        { reader: log.reader, readerVersion: log.readerVersion, browser: log.browser, url: log.url, focus: log.focus },
        { reader: 'Fake', readerVersion: 'fake 1', browser: 'web', url, focus: 'Size' },
      );
      for (const field of ['guidepup', 'os', 'date']) assert.equal(typeof log[field], 'string', field);
    });
  });

  describe('the abort', () => {
    it('stops on SIGINT during a step, writes the log, stops the reader and closes the browser', async () => {
      const signals = new EventEmitter();
      const reader = fakeReader({
        stops: STOPS,
        onPress: (key) => {
          if (key === 'Enter') signals.emit('SIGINT');
        },
      });
      const { options, events } = fakeProfile(reader);
      const { code, exits, log } = await run(options, ['--url', url, '--steps', 'ArrowDown,Enter,Escape'], {
        signals,
      });
      assert.equal(code, 130);
      assert.deepEqual(exits, [130]);
      assert.equal(log.error, 'aborted: SIGINT');
      assert.deepEqual(keysOf(log.steps), ['ArrowDown']);
      assert.equal(reader.calls.filter((call) => call === 'stop').length, 1);
      assert.equal(events.at(-1), 'close');
    });

    it('waits for a start in progress, then stops the reader', async () => {
      const signals = new EventEmitter();
      const reader = fakeReader({ stops: STOPS });
      const { options, events } = fakeProfile(reader, {
        async start() {
          signals.emit('SIGTERM');
          await delay(30);
          await reader.start();
        },
      });
      const { code, exits, log } = await run(options, ['--url', url, '--steps', 'Enter'], { signals });
      assert.equal(code, 143);
      assert.deepEqual(exits, [143]);
      assert.deepEqual(reader.calls, ['stop']);
      assert.deepEqual(events, ['open web', 'close']);
      assert.equal(log, undefined);
    });

    it('stops after the timeout', async () => {
      const reader = fakeReader({ stops: STOPS, pressMs: 200 });
      const { options } = fakeProfile(reader);
      const { code, exits, log } = await run(options, ['--url', url, '--steps', 'Enter,Enter', '--timeout', '0.1']);
      assert.equal(code, 1);
      assert.deepEqual(exits, [1]);
      assert.equal(log.error, 'aborted: timeout after 0.1 seconds');
      assert.equal(reader.calls.at(-1), 'stop');
    });

    it('drops the signal handlers that the start adds, and removes its own at the end', async () => {
      const signals = new EventEmitter();
      const reader = fakeReader({ stops: STOPS });
      const { options } = fakeProfile(reader, {
        async start() {
          signals.on('SIGINT', () => {});
          await reader.start();
        },
      });
      await run(options, ['--url', url], { signals });
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) assert.equal(signals.listenerCount(signal), 0, signal);
    });
  });
});

describe('focusBefore', () => {
  // A custom element whose focus method moves the focus to its input.
  const PAGE = `<!doctype html><title>Focus</title><button>Before</button>
<label for="size">Size</label><select id="size"><option>S</option></select>
<div id="plain">Plain</div><x-field><input id="inner" aria-label="Inner"></x-field>
<script>customElements.define('x-field', class extends HTMLElement {
  focus() { this.querySelector('input').focus(); }
});</script>`;
  const ACTIVE =
    'document.activeElement === document.body ? "body" : document.activeElement.id || document.activeElement.textContent';
  let browser;

  before(async () => {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  });

  after(async () => {
    await browser.close();
  });

  const openPage = async () => {
    const page = await browser.newPage();
    await page.goto(`data:text/html,${encodeURIComponent(PAGE)}`);
    return page;
  };

  it('focuses the element before a CSS target, so that Tab lands on the target', async () => {
    const page = await openPage();
    assert.equal(await focusBefore(page, '#size'), true);
    assert.equal(await page.evaluate(ACTIVE), 'Before');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(ACTIVE), 'size');
  });

  it('finds an XPath target', async () => {
    const page = await openPage();
    assert.equal(await focusBefore(page, '//select[@id="size"]'), true);
    assert.equal(await page.evaluate(ACTIVE), 'Before');
  });

  it('calls the focus method of a custom element', async () => {
    const page = await openPage();
    assert.equal(await focusBefore(page, 'x-field'), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(ACTIVE), 'inner');
  });

  it('reloads the page for a target that takes no focus', async () => {
    const page = await openPage();
    assert.equal(await focusBefore(page, '#plain'), false);
    assert.equal(await page.evaluate(ACTIVE), 'body');
  });

  it('rejects with exit code 4 when no element matches', async () => {
    const page = await openPage();
    await assert.rejects(focusBefore(page, '#missing'), { code: 4, message: 'No element matches #missing' });
  });
});
