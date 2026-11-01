// Runs key steps on a page with VoiceOver through Guidepup and writes the spoken phrases. macOS only.
// `node scripts/voiceover.mjs --help` lists the options and the step commands. lib/runner.mjs describes the run.
// - Guidepup folds runs of whitespace into one space, so each step also has `raw`: the last VoiceOver phrase
//   with its line breaks.
// - Safari is the real Safari, through AppleScript. Chrome is the installed Google Chrome through Playwright.
// - --focus-selector in Safari runs `do JavaScript`, so it needs "Allow JavaScript from Apple Events".
// Requires the macOS setup of README.md.
import {
  macOSActivate,
  MacOSApplications,
  MacOSKeyCodes,
  MacOSModifiers,
  macOSQuit,
  voiceOver,
} from '@guidepup/guidepup';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { delay, EXIT, ExitError, log, openChrome, runSteps } from './lib/runner.mjs';
import { focusExpression, VOICEOVER_PREFIXES } from './lib/util.mjs';

const run = promisify(execFile);

const isRunning = async (app) => {
  const { stdout } = await run('pgrep', ['-x', app]).catch(() => ({ stdout: '' }));
  return stdout.trim() !== '';
};

// The Safari wait for the page load.
const LOAD_MS = 3000;

/** Runs AppleScript. The script gets the arguments as `argv`, so they need no escapes. */
const appleScript = (script, ...args) => run('osascript', ['-e', script, ...args]);

/**
 * Focuses the element of the selector in the Safari window, then presses Shift+Tab, so that the next Tab lands on
 * the element. If the element takes no focus, the page reloads, so the Tab loop starts at the page start.
 * @param {number} windowId
 * @param {string} selector A CSS selector, or XPath if it starts with `/` or `(`.
 */
async function focusBeforeSafari(windowId, selector) {
  const tab = `current tab of window id ${windowId}`;
  let stdout;
  try {
    ({ stdout } = await appleScript(
      `on run argv\ntell application "Safari" to do JavaScript (item 1 of argv) in ${tab}\nend run`,
      focusExpression(selector),
    ));
  } catch (error) {
    if (/JavaScript from Apple Events/iu.test(error.stderr ?? '')) {
      throw new ExitError(
        'Safari blocks JavaScript from Apple Events, so --focus-selector cannot run. README: macOS setup, step 7.',
        EXIT.error,
      );
    }
    throw error;
  }
  const state = stdout.trim();
  if (state === 'none') throw new ExitError(`No element matches ${selector}`, EXIT.noFocus);
  if (state === 'focused') {
    // A real key, so that Safari moves the focus as on a Tab press. Safari must be in front for it.
    await appleScript(
      `tell application "Safari" to activate\ntell application "System Events" to key code 48 using {shift down}`,
    );
    log(`pre-focus: Shift+Tab from ${selector}`);
    return;
  }
  await appleScript(`tell application "Safari" to do JavaScript "location.reload()" in ${tab}`);
  await delay(LOAD_MS);
  log(`pre-focus: ${selector} took no focus, the Tab loop starts at the page start`);
}

process.exitCode = await runSteps({
  reader: voiceOver,
  name: 'VoiceOver',
  prefix: 'VO',
  platform: 'darwin',
  browsers: ['safari', 'chrome'],
  // Full capture takes about 7 seconds per Tab. Initial capture takes about 0.5 seconds and gives the same step 1.
  seekCapture: 'initial',
  script: 'scripts/voiceover.mjs',
  stepHelp:
    '  VO+ArrowRight, VO+ArrowLeft (next and previous item), VO+Space (activate),\n' +
    '  VO+Shift+ArrowDown, VO+Shift+ArrowUp (interact, stop interacting),\n' +
    '  VO+<keyboardCommands name>, such as VO+describeItemWithKeyboardFocus (focus report).',
  keys: { codes: MacOSKeyCodes, modifiers: MacOSModifiers },
  focusPrefixes: VOICEOVER_PREFIXES,
  focusSelectorBrowsers: ['safari', 'chrome'],
  // VoiceOver commands by the keys of the manual steps.
  commands: {
    ArrowRight: (options) => voiceOver.next(options),
    ArrowLeft: (options) => voiceOver.previous(options),
    Space: (options) => voiceOver.act(options),
    'Shift+ArrowDown': (options) => voiceOver.interact(options),
    'Shift+ArrowUp': (options) => voiceOver.stopInteracting(options),
  },
  async open(browser, url, focusSelector) {
    if (browser === 'chrome') {
      const { close } = await openChrome(url, { args: ['--force-renderer-accessibility'], focusSelector });
      return close;
    }
    // Leave a Safari that the user had open. Quit the Safari that this script opened.
    const safariWasRunning = await isRunning('Safari');
    // A new window has one tab. A new tab in a window of the user adds Tab stops to the tab bar on each run.
    const script = `tell application "Safari"
      make new document with properties {URL:${JSON.stringify(url)}}
      return id of front window
    end tell`;
    const { stdout } = await appleScript(script);
    const windowId = Number(stdout.trim());
    const close = safariWasRunning
      ? async () => {
          await appleScript(`tell application "Safari" to close (every window whose id is ${windowId})`);
        }
      : () => macOSQuit(MacOSApplications.Safari);
    await delay(LOAD_MS);
    if (focusSelector) {
      try {
        await focusBeforeSafari(windowId, focusSelector);
      } catch (error) {
        await close().catch(() => undefined);
        throw error;
      }
    }
    return close;
  },
  // Guidepup starts VoiceOver with its own portable profile, so VoiceOver Utility settings do not apply.
  // Instructions off: the "You are currently on..." hints hide short phrases and slow every step.
  start: () => voiceOver.start({ capture: true, settings: { SCRShouldOutputVOInstructions: 0 } }),
  // VoiceOver starts on the front window, so the runner calls this after the start.
  activate: (browser) => macOSActivate(browser === 'safari' ? MacOSApplications.Safari : 'Google Chrome'),
  async rawPhrase() {
    const script = 'tell application "VoiceOver" to return content of last phrase';
    const { stdout } = await appleScript(script).catch(() => ({ stdout: '' }));
    return stdout.replace(/\n$/u, '');
  },
});
