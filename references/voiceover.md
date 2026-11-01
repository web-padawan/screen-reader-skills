# VoiceOver

Verified for VoiceOver with Safari and Chrome on macOS 15, through Guidepup 0.37.0. Guidepup 0.39.0 adds only the navigate-until methods to the VoiceOver code. Guidepup 0.40.0 starts the user's VoiceOver again after a run, and unmounts the profile faster. The `voiceover-safari` and `voiceover-chrome` skills hold the facts of one browser.

## Before a run

- **Profile**: Guidepup starts VoiceOver with its own profile, so VoiceOver Utility settings do not apply. The script disables the hints. The hint "You are currently on..." hides short phrases and adds about 5 seconds per step.
- **User's VoiceOver**: only one VoiceOver can run. If a VoiceOver that Guidepup did not start runs, the start quits it, and the stop starts it again. With `DEBUG=guidepup:VoiceOver`, the run prints "Quitting a VoiceOver that Guidepup did not start" and "Starting the user's VoiceOver again".

## Seek capture

- **Default**: `initial`. In a Safari run to the fourth Tab stop, step 1 and step 2 read the same in both modes. Step 1 came after 24 seconds with `initial` and after 45 seconds with `full`.
- **Second landing**: the initial capture of the matching Tab held "Password secure edit text with autofill menu" only. The full capture of the second Tab added the autofill hint.
- **First stop**: a <kbd>Shift</kbd>+<kbd>Tab</kbd> from the first stop of the page left the page for the Safari tab bar. Step 1 then read "Leaving tab bar Tab bar, 3 tabs. Entering Select web content. Size list box pop up button".

## Reading the log

- **Silent step**: a silent step repeats the previous phrase. The item text shows if the cursor moved.
- **Open announcement**: the log misses the option announcement on open. The item text has it.

## Find commands

- **Focus**: a find command also moves the keyboard focus to an item that can take it. The next key acts there. After `VO+findNextControl` in a checkbox group, the focus report read "German unchecked checkbox has keyboard focus".
- **Groups**: from a control inside a group, the first press can only leave the group. The phrase is then "<page title> web content group". Press the command again. An accordion and the Vaadin context menu example showed this. In the accordion, the second press, `VO+findNextHeadingOfSameLevel`, read "heading Panel 1 expanded button".
- **Not found**: a find command with no match reads "<kind> not found". After the collapse of the last group of a side navigation, `VO+findNextList` read "List not found", which is correct there.
- **Context menu**: `VO+openShortcutMenu` clicks with the right button at the VoiceOver cursor. It opens a component context menu on a target that cannot take focus.
- **Landmarks**: no VoiceOver key moves to the next landmark. The rotor is manual. Guidepup `nextLandmark` moves to the next auto web spot instead.
- **Tables**: the table commands gave wrong or empty results on vaadin-grid in Safari. `VO+readTableRowAndColumnNumbers` read "column 1, row 17" in a grid of 101 rows. `VO+readTableRow` read nothing, and `VO+readTableColumnHeader` read no header. Use the arrow keys and the cell phrases instead.
