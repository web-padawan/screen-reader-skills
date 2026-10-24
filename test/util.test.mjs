import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  checkUrl,
  compileFocus,
  isKnownKey,
  logName,
  normalizeUrl,
  parseRunOptions,
  parseSteps,
  programPaths,
  readScenario,
  resolveRun,
  stripPrefixes,
  targetExpression,
  validateScenario,
  VOICEOVER_PREFIXES,
} from '../scripts/lib/util.mjs';

describe('normalizeUrl', () => {
  it('adds http to a URL without a scheme', () => {
    assert.equal(normalizeUrl('localhost:8000/dev/select.html'), 'http://localhost:8000/dev/select.html');
  });

  it('keeps the scheme, the query and the hash', () => {
    assert.equal(
      normalizeUrl('https://127.0.0.1:8000/dev/a.html?theme=lumo#x'),
      'https://127.0.0.1:8000/dev/a.html?theme=lumo#x',
    );
  });

  it('trims the input', () => {
    assert.equal(normalizeUrl('  localhost:8000/dev/a.html \n'), 'http://localhost:8000/dev/a.html');
  });

  it('turns the path of a local file into a file URL', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-test-'));
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, '<title>Page</title>');
    assert.equal(fileURLToPath(normalizeUrl(file)), file);
    assert.equal(normalizeUrl('no/such/page.html'), 'http://no/such/page.html');
    fs.rmSync(dir, { recursive: true });
  });

  it('rejects an empty URL', () => {
    assert.throws(() => normalizeUrl(' '), /empty/u);
  });
});

describe('parseSteps', () => {
  it('splits and trims the tokens', () => {
    assert.deepEqual(parseSteps('ArrowDown, Enter ,VO+describeItemWithKeyboardFocus'), [
      'ArrowDown',
      'Enter',
      'VO+describeItemWithKeyboardFocus',
    ]);
  });

  it('accepts single letters', () => {
    assert.deepEqual(parseSteps('s,l,m'), ['s', 'l', 'm']);
  });

  it('returns no steps for an empty list', () => {
    assert.deepEqual(parseSteps(undefined), []);
    assert.deepEqual(parseSteps(''), []);
  });

  it('rejects an empty token', () => {
    assert.throws(() => parseSteps('Tab,,Enter'), /Empty step/u);
  });
});

describe('isKnownKey', () => {
  const keyCodes = { Tab: 48, Escape: 53, ArrowDown: 125, s: 1, Digit1: 18 };
  const modifiers = { Shift: 'shift', Alt: 'option' };

  it('accepts a key, a letter, a digit and a key with modifiers', () => {
    for (const token of ['Escape', 's', '1', 'Shift+Tab', 'Alt+ArrowDown']) {
      assert.ok(isKnownKey(token, keyCodes, modifiers), token);
    }
  });

  it('rejects an unknown name and a modifier alone', () => {
    for (const token of ['Esc', 'Down', 'Shift', 'Shift+Esc', 'toString']) {
      assert.ok(!isKnownKey(token, keyCodes, modifiers), token);
    }
  });
});

describe('stripPrefixes', () => {
  // Phrases from Safari runs.
  const cases = [
    [
      'Leaving toolbar. Entering Side Nav web content. None selected radio button, 1 of 4 Icons radio group',
      'None selected radio button, 1 of 4 Icons radio group',
    ],
    [
      'VoiceOver Settings activity. Leaving toolbar. Entering Form Layout web content. First name edit text',
      'First name edit text',
    ],
    [
      'Leaving tab bar Tab bar, 3 tabs. Entering Select web content. Size list box pop up button',
      'Size list box pop up button',
    ],
    [
      'Leaving toolbar. Entering table. Select All unavailable table 5 columns, 101 rows',
      'Select All unavailable table 5 columns, 101 rows',
    ],
    ['Size list box pop up button', 'Size list box pop up button'],
    ['VoiceOver Settings activity', ''],
  ];

  it('removes the VoiceOver area announcements', () => {
    for (const [phrase, expected] of cases) assert.equal(stripPrefixes(phrase, VOICEOVER_PREFIXES), expected);
  });

  it('keeps the phrase without patterns', () => {
    assert.equal(stripPrefixes('Leaving toolbar. Size', []), 'Leaving toolbar. Size');
  });
});

describe('compileFocus', () => {
  it('matches case-insensitively', () => {
    assert.ok(compileFocus('combo box').test('Size, Combo Box, Medium'));
  });

  it('rejects an invalid regex', () => {
    assert.throws(() => compileFocus('('), SyntaxError);
  });
});

describe('validateScenario', () => {
  it('turns string steps into objects and keeps say and expect', () => {
    const scenario = validateScenario({
      url: 'localhost:8000/dev/select.html',
      steps: ['Enter', { key: 'Escape', say: 'press Esc', expect: 'the list closes' }],
    });
    assert.deepEqual(scenario.steps, [
      { key: 'Enter' },
      { key: 'Escape', say: 'press Esc', expect: 'the list closes' },
    ]);
  });

  it('rejects an unknown field', () => {
    assert.throws(() => validateScenario({ steps: [], page: 'a.html' }), /Unknown scenario fields: page/u);
    assert.throws(() => validateScenario({ steps: [], capture: 'full' }), /Unknown scenario fields: capture/u);
  });

  it('rejects a step without a key', () => {
    assert.throws(() => validateScenario({ steps: [{ say: 'press Enter' }] }), /Step 1 needs a "key"/u);
  });

  it('rejects a non-object', () => {
    assert.throws(() => validateScenario([]), /JSON object/u);
  });
});

describe('readScenario', () => {
  it('reads a JSON file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-test-'));
    const file = path.join(dir, 'scenario.json');
    fs.writeFileSync(file, JSON.stringify({ url: 'localhost:8000/dev/a.html', focus: 'Size', steps: ['Enter'] }));
    assert.deepEqual(readScenario(file).steps, [{ key: 'Enter' }]);
    fs.rmSync(dir, { recursive: true });
  });

  it('names the file when the JSON is invalid', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-test-'));
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, '{');
    assert.throws(() => readScenario(file), /Cannot read the scenario .*bad\.json/u);
    fs.rmSync(dir, { recursive: true });
  });
});

describe('resolveRun', () => {
  const scenario = validateScenario({
    url: 'localhost:8000/dev/a.html',
    browser: 'chrome',
    focus: 'Size',
    focusSelector: '#size',
    steps: ['Enter'],
  });

  it('takes the scenario values and the defaults', () => {
    assert.deepEqual(resolveRun({}, scenario, { browser: 'safari' }), {
      url: 'http://localhost:8000/dev/a.html',
      browser: 'chrome',
      focus: 'Size',
      focusSelector: '#size',
      steps: [{ key: 'Enter' }],
    });
  });

  it('lets the command line win', () => {
    const run = resolveRun({ url: 'localhost:9000/b.html', steps: 'Tab,Escape', browser: 'safari' }, scenario, {
      browser: 'chrome',
    });
    assert.equal(run.url, 'http://localhost:9000/b.html');
    assert.equal(run.browser, 'safari');
    assert.deepEqual(run.steps, [{ key: 'Tab' }, { key: 'Escape' }]);
  });

  it('needs a URL', () => {
    assert.throws(() => resolveRun({}, undefined, { browser: 'safari' }), /--url/u);
  });
});

describe('checkUrl', () => {
  it('reports the status of a served page and of a missing page', async () => {
    const server = http.createServer((request, response) => {
      response.statusCode = request.url === '/dev/a.html' ? 200 : 404;
      response.end();
    });
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    try {
      assert.deepEqual(await checkUrl(`${origin}/dev/a.html`), {
        ok: true,
        answered: true,
        text: `${origin}/dev/a.html answered HTTP 200`,
      });
      assert.deepEqual(await checkUrl(`${origin}/dev/b.html`), {
        ok: false,
        answered: true,
        text: `${origin}/dev/b.html answered HTTP 404`,
      });
    } finally {
      server.close();
    }
  });

  it('reports a port without a server', async () => {
    const result = await checkUrl('http://127.0.0.1:59999/x.html');
    assert.equal(result.ok, false);
    assert.equal(result.answered, false);
    assert.match(result.text, /^No answer from http:\/\/127\.0\.0\.1:59999\/x\.html: ECONNREFUSED$/u);
  });
});

describe('checkUrl for a file', () => {
  it('reports a file that exists and one that does not', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-test-'));
    fs.writeFileSync(path.join(dir, 'a.html'), '');
    const found = await checkUrl(pathToFileURL(path.join(dir, 'a.html')).href);
    const missing = await checkUrl(pathToFileURL(path.join(dir, 'b.html')).href);
    fs.rmSync(dir, { recursive: true });
    assert.deepEqual([found.ok, missing.ok, missing.answered], [true, false, false]);
    assert.match(missing.text, /^No file at file:.*b\.html$/u);
  });
});

describe('targetExpression', () => {
  it('uses querySelector for CSS', () => {
    assert.equal(targetExpression('select#size'), 'document.querySelector("select#size")');
  });

  it('uses XPath for a selector that starts with a slash or a parenthesis', () => {
    for (const selector of ['//select[@id="size"]', '(//button)[2]']) {
      assert.equal(
        targetExpression(selector),
        `document.evaluate(${JSON.stringify(selector)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`,
      );
    }
  });
});

describe('programPaths', () => {
  it('lists the folders for all users first, then the folder of the user', () => {
    const env = {
      ProgramFiles: 'C:\\Program Files',
      'ProgramFiles(x86)': 'C:\\Program Files (x86)',
      LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local',
    };
    assert.deepEqual(programPaths(['Mozilla Firefox', 'firefox.exe'], env), [
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
      'C:\\Users\\a\\AppData\\Local\\Mozilla Firefox\\firefox.exe',
    ]);
  });

  it('skips a folder that the environment does not set', () => {
    assert.deepEqual(programPaths(['a.exe'], { LOCALAPPDATA: 'C:\\L' }), ['C:\\L\\a.exe']);
  });
});

describe('parseRunOptions', () => {
  const profile = {
    browsers: ['safari', 'chrome'],
    seekCapture: 'initial',
    prefix: 'VO',
    keys: { codes: { Tab: 48, Enter: 36, Escape: 53 }, modifiers: { Shift: 'shift' } },
  };
  const parse = (...argv) => parseRunOptions(argv, profile);

  it('returns help', () => {
    assert.deepEqual(parse('--help'), { help: true });
  });

  it('applies the defaults', () => {
    const options = parse('--url', 'localhost:8000/a.html', '--focus', 'Size', '--steps', 'Enter,VO+anything');
    assert.equal(options.run.url, 'http://localhost:8000/a.html');
    assert.equal(options.run.browser, 'safari');
    assert.deepEqual(options.run.steps, [{ key: 'Enter' }, { key: 'VO+anything' }]);
    assert.ok(options.focus.test('size'));
    assert.deepEqual(
      { seekCapture: options.seekCapture, maxTabs: options.maxTabs, timeout: options.timeout, out: options.out },
      { seekCapture: 'initial', maxTabs: 20, timeout: 540, out: undefined },
    );
  });

  it('takes the options', () => {
    const options = parse(
      '--url=localhost:8000/a.html',
      '--browser=chrome',
      '--seek-capture=full',
      '--max-tabs=5',
      '--timeout=0.5',
      '--out=a.json',
    );
    assert.deepEqual(
      [options.run.browser, options.seekCapture, options.maxTabs, options.timeout, options.out, options.focus],
      ['chrome', 'full', 5, 0.5, 'a.json', undefined],
    );
  });

  it('rejects a usage error', () => {
    const url = '--url=localhost:8000/a.html';
    const cases = [
      [[url, '--bogus'], /Unknown option '--bogus'/u],
      [['--steps=Enter'], /Pass --url/u],
      [[url, '--steps=Enter', '--scenario=a.json'], /Pass --steps or --scenario/u],
      [[url, '--browser=firefox'], /--browser must be safari or chrome/u],
      [[url, '--seek-capture=none'], /--seek-capture must be full or initial/u],
      [[url, '--max-tabs=0'], /--max-tabs must be a positive integer/u],
      [[url, '--max-tabs=1.5'], /--max-tabs must be a positive integer/u],
      [[url, '--timeout=0'], /--timeout must be 1 to/u],
      [[url, '--timeout=3e9'], /--timeout must be 1 to/u],
      [[url, '--steps=Enter,Esc,NVDA+next'], /Unknown keys: Esc, NVDA\+next/u],
      [[url, '--focus=('], /Invalid regular expression/u],
    ];
    for (const [argv, message] of cases) assert.throws(() => parseRunOptions(argv, profile), message, argv.join(' '));
  });
});

describe('logName', () => {
  const date = new Date(2026, 9, 24, 9, 5, 7);

  it('joins the reader, the browser, the page stem and the time', () => {
    assert.equal(
      logName({ reader: 'VoiceOver', browser: 'safari', url: 'http://localhost:8000/dev/select.html?x=1', date }),
      'voiceover-safari-select-20261024-090507',
    );
  });

  it('uses index for a directory URL', () => {
    assert.equal(
      logName({ reader: 'NVDA', browser: 'chrome', url: 'http://localhost:8000/', date }),
      'nvda-chrome-index-20261024-090507',
    );
  });
});
