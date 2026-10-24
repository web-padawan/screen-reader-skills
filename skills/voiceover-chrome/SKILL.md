---
name: voiceover-chrome
description: Run VoiceOver in Google Chrome on a dev page through Guidepup and report what VoiceOver says at each step of a scenario. Use when asked what VoiceOver says or announces in Chrome, or to check, verify or compare a VoiceOver announcement in Chrome, with free text or a scenario file such as "focus the Size select, press Enter, press Esc". macOS only. It takes the keyboard and the screen. Not for VoiceOver in Safari (voiceover-safari), NVDA (nvda-chrome, nvda-firefox), JAWS, axe checks or the accessibility tree.
argument-hint: "<page URL or HTML file> <scenario text | scenario file>"
---

# VoiceOver in Chrome

This skill runs one reader with one browser. Follow [workflow.md](../../references/workflow.md) with these values.

| Value | Setting |
| --- | --- |
| Root | `${CLAUDE_PLUGIN_ROOT}`. If it is empty, the folder two levels above the base directory of this skill. |
| Reader | VoiceOver, on macOS |
| Script | `voiceover` |
| Browser | `chrome` |
| Reader file | [voiceover.md](../../references/voiceover.md) |
| Run time | 30 seconds, plus 7 seconds per key |
| Sandbox | `dangerouslyDisableSandbox: true` for each script call. The start mounts a disk image and uses AppleScript. |

## Chrome gotchas

- **Chrome window**: the script starts the installed Google Chrome through Playwright, with a new profile.
- **No entry prefix**: the first Tab reads the item only, such as "Size list box pop up collapsed button". Safari can add "Leaving toolbar." before it.
- **Item text**: Chrome gives no item text on a text field or a password field. The select button and its options have item text. For a field, rely on the phrases.
