---
name: nvda-firefox
description: Run NVDA in Firefox on a dev page through Guidepup and report what NVDA says at each step of a scenario. Use when asked what NVDA says or announces in Firefox, or to check, verify or compare an NVDA announcement in Firefox, with free text or a scenario file such as "focus the Size select, press Enter, press Esc". Windows only. It takes the keyboard and the screen. Not for NVDA in Chrome (nvda-chrome), VoiceOver (voiceover-safari, voiceover-chrome), JAWS, axe checks or the accessibility tree.
argument-hint: "<page URL or HTML file> <scenario text | scenario file>"
---

# NVDA in Firefox

This skill runs one reader with one browser. Follow [workflow.md](../../references/workflow.md) with these values.

| Value | Setting |
| --- | --- |
| Root | `${CLAUDE_PLUGIN_ROOT}`. If it is empty, the folder two levels above the base directory of this skill. |
| Reader | NVDA, on Windows |
| Script | `nvda` |
| Browser | `firefox` |
| Reader file | [nvda.md](../../references/nvda.md) |
| Run time | 30 seconds, plus 2 seconds per key |
| Sandbox | Turn it off only if it blocks the run. |

## Firefox gotchas

- **Firefox window**: the script starts the installed Firefox with a new profile that skips the first-run pages. It finds Firefox in the program folders and in the folder of the user.
- **Start mode**: Firefox runs start in browse mode or in focus mode. Put a mode step after the focus Tab when the next keys need one mode.
- **One toggle on a combo box**: `NVDA+Space` on a focused combo box logs "Browse mode" and "Focus mode" in one step. NVDA returns to focus mode at once.
- **Object replacement character**: a phrase can hold `￼` (U+FFFC). Quote it as it is.
- **No focus selector**: `--focus-selector` works in Chrome only. The Tab loop starts at the page start.
