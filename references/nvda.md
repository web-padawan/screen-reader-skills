# NVDA

Verified for NVDA with Chrome and Firefox on Windows, through Guidepup 0.36.4 and its portable NVDA. The NVDA code of Guidepup 0.37.0 is the same. The `nvda-chrome` and `nvda-firefox` skills hold the facts of one browser.

## Before a run

- **Profile**: Guidepup starts its own portable NVDA. An installed NVDA and its settings do not apply. The script disables the Speech Viewer, because its window takes the focus from the browser and adds Tab stops.
- **Dev server**: `localhost` is the Windows machine. For a server on another machine, start it on `0.0.0.0` and pass its IP address.
- **Page title**: the script finds the browser window by the page title. Do not open the same page in another window of that browser.
- **One run per shell call**: in a loop, the runs after the first cannot focus the browser. NVDA then reads the terminal.
- **Seek capture**: the default is `full`, because a key takes about 1.4 seconds.

## Modes

- **Start mode**: NVDA starts a run in browse mode or in focus mode. The pair skills give the start mode of each browser.
- **Mode steps**: `NVDA+browse` and `NVDA+focus` toggle until NVDA speaks that mode. NVDA cannot report its mode, so the first toggle can leave the mode. The step then logs both mode phrases, and the last one is the result. In a Firefox run that started in focus mode, `NVDA+focus` logged "Browse mode", a re-read of the page and "Focus mode".
- **One toggle**: `NVDA+Space` toggles once, so its result depends on the start mode.
- **Toggle before the first Tab**: NVDA said nothing, and the phrases then came one step late.
- **Browse mode**: the arrow keys never reach the page. Quick navigation commands, such as `NVDA+moveToNextHeading`, work in browse mode only. In focus mode, they type a letter into the field.
- **Mode phrases**: the script disables the mode beep, so NVDA speaks "Focus mode" and "Browse mode". Such a phrase in the log marks a mode change.
- **Start mode signs**: at the start, a Tab to a link without "same page" means focus mode. After a toggle, links still say "same page", so that phrase alone proves no mode.

## Reading the log

- **Silent step**: a silent step logs one empty phrase.
- **Spoken form**: NVDA speaks some names in another form. "A1" becomes "A 1". A `focus` regex must match the spoken form, such as `A ?1`.

## Context menu

`Shift+F10` and `Application` act on the keyboard focus. A target that cannot take focus, such as a `div`, gets no context menu.

## Checked tokens

These phrases come from NVDA runs in Chrome and Firefox. The pages are not in `examples/`.

| Token | Phrase |
| --- | --- |
| `ArrowDown` that opens a select | "Size, list. Medium, 2 of 3" |
| `NVDA+Tab` | "Data, link, focused, collapsed, linked, sub Menu, same page" |
| `NVDA+focus` | "Focus mode" |
