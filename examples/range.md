# Range: change a value with the keyboard

This scenario fits `pages/range.html`, a native `<input type="range">` with the label "Volume". The value goes from 0 to 10 and starts at 5.

URL: examples/pages/range.html
Focus: #volume

1. Press ArrowRight. Expect: 6.
2. Press PageUp. Expect: a larger value.
3. Press End. Expect: 10.
4. Press Home. Expect: 0.

## Results

| Step | VoiceOver, Safari | VoiceOver, Chrome |
| --- | --- | --- |
| Focus | "Leaving toolbar. Entering Native range web content. 5 Volume slider" | "5 Volume slider" |
| 1 | "6" | "6" |
| 2 | "7" | "7" |
| 3 | "10" | "10" |
| 4 | "0" | "0" |
