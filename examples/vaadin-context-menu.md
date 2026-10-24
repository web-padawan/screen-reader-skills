# Vaadin Context Menu: open the menu on a target without focus

This scenario fits `dev/context-menu.html` of vaadin/web-components. The menu target is a `div` with a heading. The `div` cannot take focus.

URL: localhost:8000/dev/context-menu.html
Focus: mouse pointer

1. Switch to browse mode. Expect: NVDA is in browse mode.
2. Next heading. Expect: Right click this component, heading level 2.
3. Open the context menu. Expect: VoiceOver opens the menu and reads Menu Item 1. NVDA sends `Shift+F10` to the focused radio button, so no menu opens.
4. Press ArrowDown. Expect: the next menu item.
5. Press Escape. Expect: the menu closes.

## Results

| Step | VoiceOver, Safari |
| --- | --- |
| Focus | "None (mouse pointer) selected radio button, 1 of 13 Menu Position radio group" |
| 1 | Skipped |
| 2 | "Context Menu web content group" |
| 3 | "Menu Item 1 menu item" |
| 4 | "Menu Item 1 menu item" |
| 5 | "Menu Item 1 menu item" |
