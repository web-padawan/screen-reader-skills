---
name: voiceover-safari
description: Run VoiceOver in Safari on a dev page through Guidepup and report what VoiceOver says at each step of a scenario. Use when asked what VoiceOver says or announces in Safari, or with no browser named, or to check, verify or compare a VoiceOver announcement in Safari, with free text or a scenario file such as "focus the Size select, press Enter, press Esc". macOS only. It takes the keyboard and the screen. Not for VoiceOver in Chrome (voiceover-chrome), NVDA (nvda-chrome, nvda-firefox), JAWS, axe checks or the accessibility tree.
argument-hint: "<page URL or HTML file> <scenario text | scenario file>"
---

# VoiceOver in Safari

This skill runs one reader with one browser. Follow [workflow.md](../../references/workflow.md) with these values.

| Value | Setting |
| --- | --- |
| Root | `${CLAUDE_PLUGIN_ROOT}`. If it is empty, the folder two levels above the base directory of this skill. |
| Reader | VoiceOver, on macOS |
| Script | `voiceover` |
| Browser | `safari` |
| Reader file | [voiceover.md](../../references/voiceover.md) |
| Run time | 30 seconds, plus 7 seconds per key |
| Sandbox | `dangerouslyDisableSandbox: true` for each script call. The start mounts a disk image and uses AppleScript. |

## Safari gotchas

- **Safari window**: the script opens the page in a new window of the real Safari and closes that window after the run. It quits a Safari that it started. The run then starts with one tab, so the tab bar adds no Tab stops.
- **Safari history**: the real Safari keeps its history. A link that an earlier run opened reads "visited".
- **Safari toolbar**: the first Tabs in Safari can reach the toolbar, such as "Share button". The Tab loop does not stop on them. The probe Tab count holds for Chrome only.
- **Entry prefix**: the first Tab into the page can start with "VoiceOver Settings activity." or "Leaving toolbar. Entering ... web content.". It depends on the Safari focus at the start. The script ignores these announcements when it matches `focus`, so the page title in them cannot match. Ignore them when you compare two runs.
- **No target**: without a focus target, the VoiceOver cursor can start in the Safari toolbar. A find command then reads "Heading not found", and `VO+openShortcutMenu` opens a Safari menu.
- **Disclosure toggle**: VoiceOver says nothing when Enter or Space toggles a `<summary>`. The step repeats the previous phrase. The next focus move reads the new state, as in the details example.
- **Dialog open**: when a modal dialog opens, the log reads the focused field only, such as "Name edit text". The dialog name comes with the next step, as in the dialog example.
- **Double read**: Safari reads a combo box twice on Enter, also without a change.
- **Required field**: Safari reads an empty required field as "invalid data" before any input. Chrome does not. Compare both browsers before you report it.
- **Safari AutoFill**: typing in a text field can open the Safari AutoFill menu. Escape then closes that menu, and the log reads "Closing menu". Check typing with `voiceover-chrome`.
- **Safari cache**: Safari keeps old modules after a branch switch on the same port. Use a new dev server port per branch.
- **Focus selector**: `--focus-selector` focuses the target through `do JavaScript`, then presses Shift+Tab before VoiceOver starts. It needs macOS setup step 7 of the README. Without it, the run stops with "Safari blocks JavaScript from Apple Events".
- **Page changes**: the script opens the page in a new window, so a `do JavaScript` change before the run does not reach it. To try a DOM change, write a temporary page and delete it after.
- **Playwright WebKit**: its accessibility tree differs from Safari. Do not use it for a VoiceOver question.
