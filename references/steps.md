# Steps

The scripts take a list of step tokens. This file gives the tokens and the readings of free text. The pair skills translate a scenario with it. The Results tables in `examples/` hold the phrases of checked tokens.

## Tokens

- **Key**: a Guidepup key name, such as `Tab`, `Enter`, `Escape`, `Space`, `ArrowDown`, `Home`, `End`, `PageUp`, `PageDown`, `Backspace`, `Delete` or `F2`.
- **Modifier**: join it with `+`, such as `Shift+Tab`. Both systems have `Shift`, `Control` and `Alt`. macOS also has `Option` and `Command`.
- **Letter or digit**: one character per token, such as `s` or `1`. A capital letter adds <kbd>Shift</kbd>.
- **VoiceOver command**: `VO+<name>`, such as `VO+findNextHeading`.
- **NVDA command**: `NVDA+<name>`, such as `NVDA+moveToNextHeading`.

Run a script with `--help` for the short reader commands. Any Guidepup `keyboardCommands` name also works after the prefix.

The scripts reject an unknown key before the browser opens. Guidepup itself presses nothing for an unknown name, such as `Esc`. Use `Alt`, not `Option`, so that one token works on both systems.

## Keys for the page

The page receives these keys. Both readers use the same token.

| Free text | Token | Use it for |
| --- | --- | --- |
| "press Esc", "close it" | `Escape` | Overlays, menus, a field with a clear button |
| "press Enter" | `Enter` | Buttons, links, disclosure buttons |
| "press Space", "check it", "toggle it" | `Space` | Checkboxes, buttons, grid rows |
| "arrow down", "move down" | `ArrowDown` | Lists, menus, grids, radio groups, calendars |
| "select an item with arrow keys" | `ArrowDown` | Lists and menus |
| "go to the first item", "go to the last item" | `Home`, `End` | Lists, a grid row, calendars, sliders |
| "go to the first row", "go to the last row" | `Control+Home`, `Control+End` | Grids |
| "page down", "page up" | `PageDown`, `PageUp` | Calendar months, grid pages, slider steps |
| "open the list", "open the calendar" | `Alt+ArrowDown` | Combo boxes, date pickers |
| "type ap" | `a`, `p` | Text fields, type-ahead |
| "delete a character" | `Backspace` | Text fields, chips of a multi-select field |
| "delete forward" | `Delete` | Text fields |
| "edit the cell" | `Enter` or `F2` | Grids with editable cells |
| "select all text" | `Command+a` on macOS, `Control+a` on Windows | Text fields |
| "open the context menu" | `Shift+F10`, or `Application` on Windows | NVDA only. VoiceOver uses `VO+openShortcutMenu`. |

## Reader commands

The reader receives these commands.

| Free text | VoiceOver | NVDA |
| --- | --- | --- |
| "what has focus", "report the focus" | `VO+describeItemWithKeyboardFocus` | `NVDA+Tab` |
| "next item with the reader cursor" | `VO+ArrowRight` | `NVDA+next` |
| "previous item with the reader cursor" | `VO+ArrowLeft` | `NVDA+previous` |
| "activate with the reader" | `VO+Space` | `NVDA+act` |
| "interact with the group" | `VO+Shift+ArrowDown` | Not used |
| "switch to browse mode" | Not used | `NVDA+browse` |
| "switch to focus mode" | Not used | `NVDA+focus` |
| "next heading", "previous heading" | `VO+findNextHeading`, `VO+findPreviousHeading` | `NVDA+moveToNextHeading`, `NVDA+moveToPreviousHeading` |
| "next heading of the same level" | `VO+findNextHeadingOfSameLevel` | Not used |
| "next heading of level 2" | Not used | `NVDA+moveToNextHeadingLevel2` |
| "next link", "previous link" | `VO+findNextLink`, `VO+findPreviousLink` | `NVDA+moveToNextLink`, `NVDA+moveToPreviousLink` |
| "next visited link" | `VO+findNextVisitedLink` | `NVDA+moveToNextVisitedLink` |
| "next unvisited link" | Not used | `NVDA+moveToNextUnvisitedLink` |
| "next form field", "next control" | `VO+findNextControl` | `NVDA+moveToNextFormField` |
| "next edit field" | Not used | `NVDA+moveToNextEditField` |
| "next button" | Not used | `NVDA+moveToNextButton` |
| "next checkbox" | Not used | `NVDA+moveToNextCheckbox` |
| "next radio button" | Not used | `NVDA+moveToNextRadioButton` |
| "next combo box" | Not used | `NVDA+moveToNextComboBox` |
| "next list" | `VO+findNextList` | `NVDA+moveToNextList` |
| "next list item" | Not used | `NVDA+moveToNextListItem` |
| "next table" | `VO+findNextTable` | `NVDA+moveToNextTable` |
| "next landmark" | Not used | `NVDA+moveToNextLandmark` |
| "next graphic" | `VO+findNextGraphic` | `NVDA+moveToNextGraphic` |
| "start of the container", "past the container" | Not used | `NVDA+moveToStartOfContainer`, `NVDA+movePastEndOfContainer` |
| "next row", "next column" with the reader | Not used | `NVDA+moveToNextRow`, `NVDA+moveToNextColumn` |
| "read the row" | `VO+readTableRow` | Not used |
| "read the row and column numbers" | `VO+readTableRowAndColumnNumbers` | Not used |
| "read the column header" | `VO+readTableColumnHeader` | Not used |
| "open the context menu" | `VO+openShortcutMenu` | `Shift+F10` |
| "read the current line" | `VO+readLine` | `NVDA+readLine` |
| "describe the item under the reader cursor" | `VO+describeItem` | `NVDA+reportCurrentObject` |
| "move the reader cursor to the focus" | `VO+moveCursorToKeyboardFocus` | `NVDA+moveToFocusObject` |

## Rules

1. Add no key that the text does not name. "select an item with arrow keys" names the arrow keys only, so it gives no `Enter`.
2. If the text gives no count, press once.
3. Put a focus report last. In VoiceOver, a <kbd>Shift</kbd>+<kbd>Tab</kbd> after it repeats the report.
4. For NVDA, use `NVDA+browse` or `NVDA+focus` for a mode, not `NVDA+Space`. Put the mode step after the focus Tab. [nvda.md](nvda.md#modes) gives the reasons.
5. Put `NVDA+browse` before an NVDA quick navigation command, such as `NVDA+moveToNextHeading`.
6. If the reader column says "Not used", skip the step. Show the skipped step in the resolved table.
7. If a step has no token in this file, ask the user. Do not guess a key.

## Focus target

"focus the Size select" is not a step. It names the focus target. The script presses <kbd>Tab</kbd> until a phrase matches `--focus`, and that <kbd>Tab</kbd> is step 1.

1. If the target is a selector, such as `#size` or `//select[@id="size"]`, run `probe.mjs --selector <selector>`.
2. Use `suggestedFocus` of the probe as `--focus`.
3. If the name is empty, use a role word that the reader speaks, such as `combo box` or `button`.
4. In Chrome and Safari, also pass `--focus-selector <selector>`. The first <kbd>Tab</kbd> then moves the focus to the target.
5. If the target is a label, such as "the Size field", use the label as `--focus`.

A selector goes to `document.querySelector`. A selector that starts with `/` or `(` is XPath. Neither reaches into a shadow root, so select the host of a custom element.

The reader files and the pair skills tell how a reader speaks a name, and what the script ignores in a phrase.

If the scenario names no focus target, pass no `--focus`. The steps then start where the reader cursor is.
