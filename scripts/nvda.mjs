// Runs key steps on a page with NVDA through Guidepup and writes the spoken phrases. Windows only.
// `node scripts/nvda.mjs --help` lists the options and the step commands. lib/runner.mjs describes the run.
// - Chrome is the installed Google Chrome, and Firefox the installed Firefox, through Playwright with a new
//   profile.
// Requires the Windows setup of README.md.
import { nvda, WindowsKeyCodes, WindowsModifiers } from '@guidepup/guidepup';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { delay, log, openBrowser, runSteps } from './lib/runner.mjs';

// Skips the Firefox first-run pages and prompts, so the page has focus. Playwright sets more of them.
// The welcome, terms of use and upgrade dialogs follow the recommended prefs of geckodriver.
// The last three turn off the testing modes of Playwright and of the Firefox remote agent. They fake the focus
// and the window activity, and NVDA follows the real focus.
const FIREFOX_PREFS = {
  'app.normandy.enabled': false,
  'browser.aboutwelcome.enabled': false,
  'browser.preonboarding.enabled': false,
  'browser.shell.checkDefaultBrowser': false,
  'browser.startup.firstrunSkipsHomepage': true,
  'browser.startup.homepage_override.mstone': 'ignore',
  'browser.startup.upgradeDialog.enabled': false,
  'browser.uitour.enabled': false,
  'datareporting.policy.dataSubmissionEnabled': false,
  'datareporting.policy.dataSubmissionPolicyBypassNotification': true,
  'startup.homepage_welcome_url': '',
  'startup.homepage_welcome_url.additional': '',
  'termsofuse.bypassNotification': true,
  'toolkit.telemetry.reportingpolicy.firstRun': false,
  'trailhead.firstrun.didSeeAboutWelcome': true,
  'focusmanager.testmode': false,
  'layout.testing.top-level-always-active': false,
  'remote.prefs.recommended': false,
};

const MAX_ACTIVATE_ATTEMPTS = 3;

// Brings the first window of the process whose title starts with the title to the front, and prints the title of
// the window in front. Exits with 3 if no window matches. The process name is the --browser value. The process
// name and the title come in environment variables, so the title needs no escaping.
// Windows refuses SetForegroundWindow to a process that did not get the last input, for example when another
// browser window has the foreground. A synthetic Alt press and an input attach to the thread of the window in front
// lift that lock. The Alt press is skipped if the window is in front already, because in Firefox it shows the
// menu bar.
const FOREGROUND_SCRIPT = `
Add-Type -Name User32 -Namespace ScreenReaderSkills -MemberDefinition '
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr lpdwProcessId);
[DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
[DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
'
$user32 = [ScreenReaderSkills.User32]
$window = Get-Process -Name $env:SR_PROCESS -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.StartsWith($env:SR_TITLE) } | Select-Object -First 1
if (-not $window) { exit 3 }
$handle = $window.MainWindowHandle
$front = $user32::GetForegroundWindow()
if ($front -ne $handle) {
  $user32::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
  $user32::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
  $thread = $user32::GetCurrentThreadId()
  $frontThread = $user32::GetWindowThreadProcessId($front, [IntPtr]::Zero)
  [void]$user32::AttachThreadInput($thread, $frontThread, $true)
  [void]$user32::ShowWindow($handle, 9)
  [void]$user32::BringWindowToTop($handle)
  [void]$user32::SetForegroundWindow($handle)
  [void]$user32::AttachThreadInput($thread, $frontThread, $false)
}
$text = New-Object System.Text.StringBuilder 512
[void]$user32::GetWindowText($user32::GetForegroundWindow(), $text, 512)
$text.ToString()
`;

const run = promisify(execFile);

/** Letters and digits only, in lower case, for a loose comparison of spoken text. */
const normalize = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// The window title starts with the page title. bringToFront matches it.
let title;

/**
 * Brings the browser window with the page title to the front.
 * @param {string} browser
 * @return {Promise<string>} The title of the window in front, or the reason of a failure.
 */
function bringToFront(browser) {
  return run('powershell', ['-NoProfile', '-NonInteractive', '-Command', FOREGROUND_SCRIPT], {
    env: { ...process.env, SR_PROCESS: browser, SR_TITLE: title },
  }).then(
    ({ stdout }) => stdout.trim(),
    (error) => (error.code === 3 ? `no ${browser} window "${title}"` : error.message),
  );
}

/**
 * Toggles browse and focus mode until NVDA speaks the given mode. A run can start in either mode, so a
 * single toggle can land in the wrong one. The log keeps both phrases when it toggles twice.
 * @param {'browse' | 'focus'} mode
 */
async function switchMode(mode) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await nvda.perform(nvda.keyboardCommands.toggleBetweenBrowseAndFocusMode);
    const spoken = (await nvda.spokenPhraseLog()).join(' ').match(/\b(browse|focus) mode\b/giu);
    if (spoken?.at(-1).toLowerCase() === `${mode} mode`) return;
  }
  throw new Error(`NVDA did not switch to ${mode} mode`);
}

process.exitCode = await runSteps({
  reader: nvda,
  name: 'NVDA',
  prefix: 'NVDA',
  platform: 'win32',
  browsers: ['chrome', 'firefox'],
  // Full capture takes about 1.4 seconds per key.
  seekCapture: 'full',
  script: 'scripts/nvda.mjs',
  stepHelp:
    '  NVDA+browse, NVDA+focus (toggle until in that mode), NVDA+Space (toggle once),\n' +
    '  NVDA+Tab (focus report), NVDA+next, NVDA+previous, NVDA+act,\n' +
    '  NVDA+<keyboardCommands name>, such as NVDA+moveToNextHeading.',
  keys: { codes: WindowsKeyCodes, modifiers: WindowsModifiers },
  focusSelectorBrowsers: ['chrome', 'firefox'],
  // NVDA commands by the keys of the manual steps.
  commands: {
    Space: (options) => nvda.perform(nvda.keyboardCommands.toggleBetweenBrowseAndFocusMode, options),
    browse: () => switchMode('browse'),
    focus: () => switchMode('focus'),
    Tab: (options) => nvda.perform(nvda.keyboardCommands.reportCurrentFocus, options),
    next: (options) => nvda.next(options),
    previous: (options) => nvda.previous(options),
    act: (options) => nvda.act(options),
  },
  async open(browser, url, focusSelector) {
    const page = await openBrowser(browser, url, {
      ...(browser === 'firefox' && { prefs: FIREFOX_PREFS }),
      focusSelector,
    });
    title = page.title;
    return page.close;
  },
  // Guidepup starts NVDA with its own portable config, so an installed NVDA and its settings do not apply.
  // Speech Viewer off: its window takes the focus from the browser on start.
  // Audio indication off: NVDA then speaks "focus mode" and "browse mode" instead of a beep, so the mode
  // changes are in the phrase log.
  start: () =>
    nvda.start({
      capture: true,
      settings: {
        speechViewer: { showSpeechViewerAtStartup: false },
        virtualBuffers: { passThroughAudioIndication: false },
      },
    }),
  // Windows can refuse the focus change, so check the window title that NVDA reads, and retry.
  // NVDA splits the title for speech, such as "A 1" for "A1", so the check ignores spaces, case and punctuation.
  async activate(browser) {
    // An empty title matches any window, so the check below proves nothing.
    if (!normalize(title)) log('warning: the page has no title, so no check confirms the browser window');
    for (let attempt = 0; attempt < MAX_ACTIVATE_ATTEMPTS; attempt++) {
      const front = await bringToFront(browser);
      await delay(1000);
      await nvda.clearSpokenPhraseLog();
      await nvda.perform(nvda.keyboardCommands.reportTitle);
      const phrases = await nvda.spokenPhraseLog();
      if (normalize(phrases.join(' ')).includes(normalize(title))) return;
      log(`activate ${attempt + 1}: front ${JSON.stringify(front)}, NVDA ${JSON.stringify(phrases)}`);
    }
    throw new Error(`No window "${title}" in front after ${MAX_ACTIVATE_ATTEMPTS} attempts`);
  },
});
