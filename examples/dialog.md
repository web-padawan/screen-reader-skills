# Dialog: open a modal dialog and close it

This scenario fits `pages/dialog.html`, a native modal `<dialog>` that a button opens with `showModal()`. A <kbd>Tab</kbd> from Close leaves the page for the browser toolbar in Safari and in Chrome, so the steps stay inside the dialog.

URL: examples/pages/dialog.html
Focus: #open

1. Press Enter. Expect: the dialog opens and reads Settings. The focus moves to the Name field.
2. Press Tab. Expect: Close, button.
3. Press Shift+Tab. Expect: Name, edit text.
4. Press Escape. Expect: the dialog closes, and the focus returns to Open settings.

## Results

| Step | VoiceOver, Safari | VoiceOver, Chrome |
| --- | --- | --- |
| Focus | "Leaving toolbar. Entering Native dialog web content. Open settings button" | "Open settings button" |
| 1 | "Name edit text" | "Settings dialog with 3 items Name edit text" |
| 2 | "Settings web dialog with 3 items Close button" | "Close button" |
| 3 | "Name edit text" | "Name edit text" |
| 4 | "Open settings button" | "Open settings button" |
