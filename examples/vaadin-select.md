# Vaadin Select: open, move and close

This scenario fits `dev/select.html` of vaadin/web-components. The page has one select with the label "Size".

URL: localhost:8000/dev/select.html
Focus: vaadin-select

1. Press Enter. Expect: the list opens and reads an item.
2. Press ArrowDown. Expect: the next item.
3. Press Escape. Expect: the list closes, and the field reads its label again or stays silent.

## Results

| Step | VoiceOver, Safari | VoiceOver, Chrome |
| --- | --- | --- |
| Focus | "Size list box pop up button" | "Size list box pop up collapsed button" |
| 1 | "Show all (1 of 7)" | "Show all (1 of 7)" |
| 2 | "S (4 of 7)" | "S (4 of 7)" |
| 3 | "Size list box pop up button" | "Size list box pop up collapsed button" |
