// Checks a page in headless Google Chrome before a screen reader run. Starts no screen reader.
// Usage: node scripts/probe.mjs --url examples/pages/select.html [--selector "#size"] [--max-tabs 30]
// - Loads the page and reports the HTTP status and the title.
// - Presses Tab from the page start and reports each Tab stop: the tag, the id, and the Chrome role and name
//   from the accessibility tree. It goes through open shadow roots.
// - With --selector, it marks the stop inside the first matching element, stops there, and suggests a
//   --focus regex from the name. The selector is CSS for `document.querySelector`, or XPath if it starts with
//   `/` or `(`. It does not reach into a shadow root, so select the host of a custom element.
// - Prints JSON. Exit codes: 0 done, 2 usage, 3 no answer from the URL, 4 no element or no Tab stop for the
//   selector.
// Safari Tabs through its toolbar first and skips links by default, so the Tab count is for Chrome only.
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { normalizeUrl, targetExpression } from './lib/util.mjs';

/** Returns the focused element, inside open shadow roots. Runs in the page. */
const DEEP_ACTIVE = `(() => {
  let node = document.activeElement;
  while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
  return node;
})()`;

/** Describes the focused element and marks it as seen. Runs in the page with the element as `this`. */
const DESCRIBE = `function () {
  window.srProbeSeen ??= new WeakSet();
  const seen = window.srProbeSeen.has(this);
  window.srProbeSeen.add(this);
  let target = false;
  for (let node = this; node && !target; node = node.parentNode ?? node.host) {
    target = node.nodeType === 1 && node.hasAttribute('data-sr-probe-target');
  }
  return { tag: this.localName, id: this.id || undefined, seen, target, body: this === document.body };
}`;

const usage = 'Usage: node scripts/probe.mjs --url <url or file> [--selector <css or xpath>] [--max-tabs <n>]';

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      url: { type: 'string' },
      selector: { type: 'string' },
      'max-tabs': { type: 'string', default: '30' },
    },
  }));
  if (!args.url) throw new Error('Pass --url');
  args.url = normalizeUrl(args.url);
  if (!(Number(args['max-tabs']) > 0)) throw new Error('--max-tabs must be a positive integer');
} catch (error) {
  console.error(`${error.message}\n${usage}`);
  process.exit(2);
}

const report = { url: args.url, ...(args.selector && { selector: args.selector }) };

/**
 * Fills the report and returns the exit code.
 * @param {import('playwright').Page} page
 */
async function probe(page) {
  const response = await page.goto(args.url).catch((error) => {
    report.error = error.message.split('\n')[0];
  });
  if (!response) return 3;
  report.status = response.status();
  report.title = await page.title();
  if (!response.ok()) return 3;

  if (args.selector) {
    const target = (await page.evaluateHandle(targetExpression(args.selector))).asElement();
    report.targetFound = Boolean(target);
    if (!target) return 4;
    await target.evaluate((element) => element.setAttribute('data-sr-probe-target', ''));
  }

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  report.stops = [];
  for (let tab = 1; tab <= Number(args['max-tabs']); tab++) {
    await page.keyboard.press('Tab');
    const { result } = await cdp.send('Runtime.evaluate', { expression: DEEP_ACTIVE });
    if (!result.objectId) break;
    const { result: info } = await cdp.send('Runtime.callFunctionOn', {
      objectId: result.objectId,
      functionDeclaration: DESCRIBE,
      returnByValue: true,
    });
    const { tag, id, seen, target, body } = info.value;
    if (seen || body) break;
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', {
      objectId: result.objectId,
      fetchRelatives: false,
    });
    const node = nodes.find((item) => !item.ignored) ?? nodes[0];
    const stop = { tab, tag, ...(id && { id }), role: node?.role?.value ?? '', name: node?.name?.value ?? '' };
    if (target) stop.target = true;
    report.stops.push(stop);
    if (target) break;
  }

  if (!args.selector) return 0;
  const stop = report.stops.find((item) => item.target);
  report.targetTab = stop?.tab ?? null;
  report.suggestedFocus = stop?.name ? stop.name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&') : null;
  return stop ? 0 : 4;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  process.exitCode = await probe(await browser.newPage());
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
