# Phrase log

Rules that apply to both VoiceOver and NVDA with Guidepup 0.36.4 to 0.40.0. The reader files hold the rules of one reader.

## How Guidepup logs

- **VoiceOver**: Guidepup reads the VoiceOver "last phrase" after each key, every 50 ms. It stops when the phrase stays the same for about 1 second.
- **NVDA**: the Guidepup add-on sends each speech sequence to the script. The script collects them until NVDA is silent for 1 second.
- **Entries**: one key gives one entry. NVDA puts a period between the sequences and a comma between the fields. The VoiceOver log has no commas.
- **Item text**: the script records the reader item text next to each entry. In NVDA, the item text is the last phrase, so it adds nothing.
- **Raw phrase**: Guidepup folds runs of whitespace into one space. For VoiceOver, the `raw` field keeps the last phrase with its line breaks. A line break shows in the caption panel, not in the speech. So quote `phrases` for the speech.

## Gaps

- The log has no timing of the speech. It cannot show a cut-off. Listen for timing and cut-off checks.
- A fast second announcement can make the log miss a phrase.
- A run can log a short phrase or an empty one. The next step then has the late phrase. Repeat such a run.
- A notification also appears in the log. Enable Do Not Disturb before a run.

## Capture

- **Full capture** keeps every phrase of each key. Every step uses it.
- **Initial capture** keeps the first phrase of each key. It loses later phrases, such as the second phrase of a close step. Only the Tab loop before step 1 can use it.

| Reader | Initial capture | Full capture |
| --- | --- | --- |
| VoiceOver | About 0.4 seconds per key | About 7 seconds per key, about 23 seconds for an open step |
| NVDA | About 0.3 seconds per key | About 1.4 seconds per key |

A VoiceOver run with 4 steps takes about 60 to 70 seconds. An NVDA run takes 20 to 35 seconds. Most of it is the NVDA start: about 7 seconds with Chrome and 11 to 14 seconds with Firefox. A key takes about 1.35 seconds.

`--seek-capture` sets the capture of the Tab loop before step 1. The first <kbd>Tab</kbd> always uses full capture. With `initial`, a match after the first <kbd>Tab</kbd> makes the script press <kbd>Shift</kbd>+<kbd>Tab</kbd> and <kbd>Tab</kbd> again, so step 1 keeps full capture.

A match on the first <kbd>Tab</kbd> gets no second landing, because a <kbd>Shift</kbd>+<kbd>Tab</kbd> from the first stop leaves the page. Each reader file gives the default seek capture of its reader and the evidence.

## Log shape

A log has these fields:

- `reader`, `readerVersion`, `guidepup`, `browser`, `url` and `os`.
- `focus` and `focusSelector`, if the run has them.
- `seekCapture` and `date`.
- `setup`: the Tab entries before step 1.
- `steps`: one entry per step.
- `error`: only in a failed run.

Each step has `key`, `phrases`, `itemText` and `ms`. A VoiceOver step also has `raw`. A step from a scenario file also has `say` and `expect`. The `ms` field is the time of the key press and the capture.
