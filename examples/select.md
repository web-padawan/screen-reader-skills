# Select: open the list and pick an option

This scenario fits `pages/select.html`, a native `<select>` with the label "Size". Medium is selected.

URL: examples/pages/select.html
Focus: #size

1. Open the list with Alt+ArrowDown. Expect: the list opens and reads Medium.
2. Press ArrowDown. Expect: Large.
3. Press Enter. Expect: the list closes, and the field reads Large.

## Results

| Step | VoiceOver, Safari | VoiceOver, Chrome | NVDA, Chrome | NVDA, Firefox |
| --- | --- | --- | --- | --- |
| Focus | "Leaving toolbar. Entering Native select web content. Medium Size pop up button" | "Medium Size menu pop up collapsed button" | "Native select, document. Native select, document. Size, combo box, Medium, collapsed. Focus mode" | "Native select, document. Size, combo box, collapsed, Medium. Native select, document. clickable, Size, , combo box, collapsed, Medium" |
| 1 | "menu 3 items ✓ Medium" | "Medium menu item (2 of 3). Medium Size menu pop up expanded button" | "expanded. list. Medium, 2 of 3" | "Focus mode. combo box, expanded. Medium, list. Medium, 2 of 3" |
| 2 | "Large" | "Large" | "Large, not selected, 3 of 3" | "Large, 3 of 3" |
| 3 | "Closing menu Large Size pop up button" | "Large Size menu pop up collapsed button" | "Size, combo box, Large, collapsed" | "Browse mode. Size, combo box, Large, collapsed" |

The NVDA runs used `--focus-selector "#size"`. The select is the first element that can take focus, so the Focus row reads the document first. See [nvda.md](../references/nvda.md). Without the selector, the focus Tab read "Native select, document. heading, level 1, Native select. Size, combo box, Medium, collapsed. Focus mode" in Chrome and "Size, combo box, Medium, collapsed" in Firefox. The other steps read the same.
