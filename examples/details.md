# Details: expand and collapse a disclosure

This scenario fits `pages/details.html`, two native `<details>` elements. The first one holds a link.

URL: examples/pages/details.html
Focus: summary

1. Press Enter. Expect: Shipping, expanded.
2. Press Tab. Expect: the link "Read the return policy".
3. Press Shift+Tab. Expect: Shipping, expanded.
4. Press Space. Expect: Shipping, collapsed.
5. Press Tab. Expect: Returns, collapsed.

## Results

| Step | VoiceOver, Safari | VoiceOver, Chrome |
| --- | --- | --- |
| Focus | "Entering Native details web content. Shipping collapsed summary" | "Shipping collapsed disclosure triangle, group" |
| 1 | "Entering Native details web content. Shipping collapsed summary" | "Shipping expanded disclosure triangle, group" |
| 2 | "link Read the return policy" | "link Read the return policy" |
| 3 | "Shipping expanded summary" | "Shipping expanded disclosure triangle, group" |
| 4 | "Shipping expanded summary" | "Shipping collapsed disclosure triangle, group" |
| 5 | "Returns collapsed summary" | "Returns collapsed disclosure triangle, group" |
