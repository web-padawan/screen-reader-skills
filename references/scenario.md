# Scenario files

A scenario comes as free text, as a markdown file or as a JSON file. The scripts run JSON only. Claude writes the JSON from the other two forms with [steps.md](steps.md).

## Markdown form

A markdown file is for people. Each line is optional except the steps.

```md
# Select: open and close

URL: examples/pages/select.html
Browser: safari
Focus: #size

1. Press Enter. Expect: the list opens and reads the selected item.
2. Press ArrowDown. Expect: the next item.
3. Press Escape. Expect: the list closes, and the value stays.
```

- **URL**: the page URL, or the path of a local HTML file. A path that starts with `examples/` is in the plugin root. A URL in the request wins.
- **Browser**: a browser of the reader. A browser in the request wins.
- **Focus**: the focus target, as a selector or a label. See [Focus target](steps.md#focus-target).
- **Steps**: a numbered list. The text after `Expect:` is the expectation of the step.
- **Results**: an optional last section. See [Results](#results).

## JSON form

The JSON form is the resolved scenario. Pass it with `--scenario <file.json>`. A command line option wins over a field.

```json
{
  "url": "http://localhost:8000/dev/select.html",
  "browser": "safari",
  "focus": "Size",
  "focusSelector": "#size",
  "steps": [
    { "key": "Enter", "say": "Press Enter", "expect": "the list opens and reads the selected item" },
    { "key": "ArrowDown", "say": "Press ArrowDown", "expect": "the next item" },
    { "key": "Escape", "say": "Press Escape", "expect": "the list closes, and the value stays" }
  ]
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `url` | string | The page. The path of a local file gets `file://`. Another URL without a scheme gets `http://`. |
| `browser` | string | `safari` or `chrome` for VoiceOver. `chrome` or `firefox` for NVDA. |
| `focus` | string | The regex for the focus target. It matches a phrase or the item text. |
| `focusSelector` | string | The selector of the focus target, CSS or XPath. Chrome and Safari only. |
| `steps` | array | A step is a token string, or an object with `key`, `say` and `expect`. |

The script copies `say` and `expect` into the log. It never checks an expectation. The skill compares the phrases with it.

A JSON file is the record of a run. Run it again for the same keys.

## Results

A markdown file can end with a `## Results` section. It holds the phrases of earlier runs, as a baseline for the next run. The skill reads no step from it.

```md
## Results

| Step | VoiceOver, Safari |
| --- | --- |
| Focus | "English unchecked checkbox Language group" |
| 1 | "checked English checkbox" |
| 3 | Skipped |
```

- Add one column per reader and browser. A new run of the pair replaces its column. The JSON log keeps the date.
- The Focus row is the <kbd>Tab</kbd> that reached the focus target. The other rows use the step numbers.
- Quote the logged phrases. Join two phrases of one step with ` | `.
- "Skipped" marks a step that the reader skips. "Not run" marks a step that the run did not have.
