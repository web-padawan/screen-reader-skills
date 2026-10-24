# Workflow

Each pair skill runs this workflow for one reader and one browser. The skill gives the values in angle brackets: `<root>`, `<reader>`, `<script>` and `<browser>`. It also gives the reader file, the run time and the sandbox rule.

## Gotchas

- **Platform**: Claude Code and the plugin must run on the platform of the reader. On another platform, say so, and stop.
- **Free machine**: a run takes the keyboard and the screen.
- **Baseline**: a reader can read a step in an odd way without any change. Compare with a baseline run, or with the Results table of the scenario file, before you blame a change.

## Steps

### 1. Check

Run `node "<root>/scripts/check.mjs" <script> --url <url>`, with the sandbox rule of the skill.

If a line says `FAIL`, quote it and stop. The fix is in the plugin README. Do not install anything.

### 2. Resolve

1. Before the first run of a session, read the reader file.
2. Read the scenario. A file can be markdown or JSON. [scenario.md](scenario.md) gives both forms. A path that starts with `examples/` is in `<root>`.
3. If the focus target is a selector, run `node "<root>/scripts/probe.mjs" --url <url> --selector <selector>`.
4. Translate each step with [steps.md](steps.md).
5. Write the JSON scenario to `<scratchpad>/sr/<name>.json`. Write a local page as an absolute path.
6. Show the resolved steps as a table: number, scenario text, token, expectation.

If a step has two readings with different keys, ask. Otherwise continue.

### 3. Confirm

Once per session, use `AskUserQuestion`: Do Not Disturb on, and the machine free for the run? Give the run time of the skill.

### 4. Run

```sh
node "<root>/scripts/<script>.mjs" --browser <browser> --scenario <scratchpad>/sr/<name>.json --out <scratchpad>/sr/<name>-<script>-<browser>.json
```

1. Run one command per shell call, with `timeout: 600000` and the sandbox rule of the skill.
2. For a repeat run, add `-2` to the `--out` name, so that the first log stays.
3. On exit code 4, no phrase matched `focus`. Read the `setup` entries, fix the regex, and run again.
4. On exit code 3, quote the error. The URL did not answer or the platform is wrong.
5. After a failed VoiceOver run, run `pgrep -x VoiceOver`. If VoiceOver still runs, run `osascript -e 'tell application "VoiceOver" to quit'`.

### 5. Report

1. Show a table: step, key, phrases, item text, expectation, result. The result is Met, Not met or Unclear. For NVDA, leave out the item text.
2. Quote the phrases. Never paraphrase them.
3. Give the log path and the scenario path.
4. If a step has an empty or a late phrase, repeat the run once and report both runs.
5. If the scenario file has a Results column for `<reader>` and `<browser>`, compare the phrases with it.

## Rules

- Do not edit the repository under test. A temporary page is the only exception. Delete it after the run.
- Run one reader at a time. To compare two pairs, run one pair skill after the other.
- Do not install or configure anything. Point to the README.
- Add a column to the Results table of a scenario file only when the user asks.

## References

| File | Read it when |
| --- | --- |
| [voiceover.md](voiceover.md), [nvda.md](nvda.md) | Before the first run of a session, and when a log looks wrong. |
| [steps.md](steps.md) | You translate a scenario or pick a focus regex. |
| [scenario.md](scenario.md) | You read a scenario file, write the JSON or add results. |
| [phrase-log.md](phrase-log.md) | A log looks wrong, or you pick a seek capture. |
| `<root>/scripts/<script>.mjs --help` | You need an option or a reader command. |
