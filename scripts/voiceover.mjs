// Runs key steps on a page with VoiceOver through Guidepup and writes the spoken phrases. macOS only.
// `node scripts/voiceover.mjs --help` lists the options and the step commands. lib/runner.mjs describes the run.
// - Guidepup folds runs of whitespace into one space, so each step also has `raw`: the last VoiceOver phrase
//   with its line breaks.
// - Safari is the real Safari (`open -a Safari`). Chrome is the installed Google Chrome through Playwright.
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
import { delay, openChrome, runSteps } from './lib/runner.mjs';
import { VOICEOVER_PREFIXES } from './lib/util.mjs';

const run = promisify(execFile);

const isRunning = async (app) => {
  const { stdout } = await run('pgrep', ['-x', app]).catch(() => ({ stdout: '' }));
  return stdout.trim() !== '';
};

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
    const { stdout } = await run('osascript', ['-e', script]);
    const windowId = Number(stdout.trim());
    await delay(3000);
    if (!safariWasRunning) return () => macOSQuit(MacOSApplications.Safari);
    return async () => {
      await run('osascript', ['-e', `tell application "Safari" to close (every window whose id is ${windowId})`]);
    };
  },
  // Guidepup starts VoiceOver with its own portable profile, so VoiceOver Utility settings do not apply.
  // Instructions off: the "You are currently on..." hints hide short phrases and slow every step.
  start: () => voiceOver.start({ capture: true, settings: { SCRShouldOutputVOInstructions: 0 } }),
  // VoiceOver starts on the front window, so the runner calls this after the start.
  activate: (browser) => macOSActivate(browser === 'safari' ? MacOSApplications.Safari : 'Google Chrome'),
  async rawPhrase() {
    const script = 'tell application "VoiceOver" to return content of last phrase';
    const { stdout } = await run('osascript', ['-e', script]).catch(() => ({ stdout: '' }));
    return stdout.replace(/\n$/u, '');
  },
});
