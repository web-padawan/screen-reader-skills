# screen-reader-skills

Claude Code plugin to run a screen reader using [Guidepup](https://www.guidepup.dev/) and report announcements for a scenario.

One skill runs one reader with one browser:

| Skill              | Reader    | Browser | Platform |
| ------------------ | --------- | ------- | -------- |
| `voiceover-safari` | VoiceOver | Safari  | macOS    |
| `voiceover-chrome` | VoiceOver | Chrome  | macOS    |
| `nvda-chrome`      | NVDA      | Chrome  | Windows  |
| `nvda-firefox`     | NVDA      | Firefox | Windows  |

Supported scenario formats: free text, markdown file or a JSON file. See [references/scenario.md](references/scenario.md) and the `examples/` folder.

## Requirements

- Node 20.19 or later.
- Google Chrome.
- macOS for VoiceOver, with Safari.
- Windows for NVDA. Firefox is optional.
- Dev server running (skills do not start it).

## Install

1. Clone the repository.
2. Run `npm ci`.
3. Run `claude plugin marketplace add <path to the repository>`.
4. Run `claude plugin install screen-reader-skills@screen-reader-skills`.

The plugin cache copies the folder with its `node_modules`. Run `npm ci` before an install or an update. If `check.mjs` reports missing modules, run the `npm ci --prefix` command that it prints.

To update after a change, commit and run `claude plugin update screen-reader-skills@screen-reader-skills`. Each `@guidepup/guidepup` version pins one reader build. After a Guidepup update, run the `install` step of the OS setup again.

## macOS setup

Do these steps once per machine for VoiceOver.

1. Quit VoiceOver.
2. In VoiceOver Utility, General, tick "Allow VoiceOver to be controlled with AppleScript".
3. In System Settings, Privacy and Security, add the terminal app to Accessibility and to Full Disk Access.
4. Run `npx @guidepup/setup@0.29.3 setup --macos-ignore-tcc-db`.
5. In the repository root, run `npx @guidepup/setup@0.29.3 install`.
6. On the first run, allow the Automation prompts for VoiceOver, Safari and System Events.
7. In Safari Settings, Advanced, tick "Show features for web developers". Then in the Developer tab, tick "Allow JavaScript from Apple Events".
8. Run `node scripts/check.mjs voiceover`. It must print no `FAIL` line.

Step 4 enables the AppleScript control that Guidepup reads. The tick of step 2 alone does not set it. System Integrity Protection blocks the `TCC.db` edit, so the flag skips that edit.

Step 5 downloads the Guidepup VoiceOver profile to `~/Library/Caches/guidepup/`. Guidepup links that profile into `~/Library/Group Containers/group.com.apple.VoiceOver/`. That link needs the Full Disk Access of step 3.

Step 7 lets `--focus-selector` focus the target in Safari through `do JavaScript`. Without it, a Safari run with `--focus-selector` fails. The setting lets each app with the Automation permission for Safari run JavaScript in all Safari tabs.

In Claude Code, a VoiceOver run needs the Bash sandbox off. The skill asks for it.

## Windows setup

Do these steps once per machine for NVDA.

1. In the repository root, run `npx @guidepup/setup@0.29.3 install`.
2. Run `node scripts/check.mjs nvda`. It must print no `FAIL` line.

Step 1 downloads a portable NVDA with the Guidepup add-on to `%LOCALAPPDATA%\guidepup\`. An installed NVDA is not needed.

The first run of a new NVDA build shows a Windows Firewall prompt for "NVDA application (no UIAccess)". Select Cancel, and run again. Guidepup connects through `127.0.0.1`, so it does not need the rule.

## Usage

Run the skill with a page URL and a scenario:

```text
/screen-reader-skills:voiceover-safari localhost:8000/dev/select.html focus the Size select, press Enter, select an item with arrow keys, press Esc
/screen-reader-skills:voiceover-chrome examples/select.md
/screen-reader-skills:nvda-firefox examples/dialog.md
```

To compare pairs, run one skill after the other. The skill shows the resolved keys before the run. It asks once per session if the machine is free. It then quotes the reader for each step and gives the path of the JSON log.

The scripts also run without Claude:

```sh
node scripts/probe.mjs --url examples/pages/select.html --selector "#size"
node scripts/voiceover.mjs --url examples/pages/select.html --focus Size --focus-selector "#size" --steps Alt+ArrowDown,ArrowDown,Enter
node scripts/nvda.mjs --url examples/pages/select.html --focus Size --focus-selector "#size" --steps Alt+ArrowDown,Enter
```

Run a script with `--help` for all options. Without `--out`, the script writes the log to the system temporary folder.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `VoiceOver cannot be started`, with `Failed to mount Guidepup preferences` and `EPERM` on a `symlink` | Give the terminal app Full Disk Access, macOS step 3. In Claude Code, run with the sandbox off. |
| `ERR_MODULE_NOT_FOUND` for `@guidepup/guidepup` | Run `npm ci` in the plugin root. The scripts import from their own `node_modules`. |
| `NVDA is not installed` | Do Windows setup step 1 again. A Guidepup update can pin a new NVDA build. |
| `Safari blocks JavaScript from Apple Events` | Do macOS setup step 7, or run without `--focus-selector`. |
| `Cannot find Firefox installation for channel 'moz-firefox'` | Install Firefox in the program folders or in the folder of the user. |
| `No answer from <url>` | Start the dev server, or fix the host and the port. |
| `Unknown keys: Esc` | Use a Guidepup key name, such as `Escape`. See [references/steps.md](references/steps.md). |
| `No phrase matched` after 20 Tab presses | Read the `setup` entries of the log. Fix `--focus` to match a phrase or the item text. |
| A notification in the log | Enable Do Not Disturb, and run again. |
| VoiceOver stays on after a stopped run | Run `osascript -e 'tell application "VoiceOver" to quit'`. |
| NVDA reads the terminal, not the page | Run one script per shell command. |
| `No window "<title>" in front` | Close other windows of the page in that browser, and run again. The `activate` lines of the output give what NVDA read. |
| `No window "<title>" in front`, and NVDA read "Windows Security" | Answer the Windows Firewall prompt for NVDA. See Windows setup. |
