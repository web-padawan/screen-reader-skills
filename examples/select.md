# Select: open the list and pick an option

This scenario fits `pages/select.html`, a native `<select>` with the label "Size". Medium is selected.

URL: examples/pages/select.html
Focus: #size

1. Open the list with Alt+ArrowDown. Expect: the list opens and reads Medium.
2. Press ArrowDown. Expect: Large.
3. Press Enter. Expect: the list closes, and the field reads Large.

## Results

| Step | VoiceOver, Safari | VoiceOver, Chrome |
| --- | --- | --- |
| Focus | "Leaving toolbar. Entering Native select web content. Medium Size pop up button" | "Medium Size menu pop up collapsed button" |
| 1 | "menu 3 items ✓ Medium" | "Medium menu item (2 of 3). Medium Size menu pop up expanded button" |
| 2 | "Large" | "Large" |
| 3 | "Closing menu Large Size pop up button" | "Large Size menu pop up collapsed button" |
