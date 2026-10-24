# screen-reader-skills

This repository is a private Claude Code plugin and its single-plugin marketplace. `README.md` holds the install and the setup steps. Do not repeat them here or in a skill.

## Layout

- `skills/<reader>-<browser>/SKILL.md`: one skill per pair: `voiceover-safari`, `voiceover-chrome`, `nvda-chrome` and `nvda-firefox`. Each runs `references/workflow.md` with its values.
- `references/`: the files that the skill reads. The next section gives the content of each.
- `scripts/lib/runner.mjs`: the run loop that both reader scripts share. `scripts/lib/util.mjs` holds the helpers, with Node built-ins only.
- `scripts/voiceover.mjs`, `scripts/nvda.mjs`: the reader scripts. Run them with `--help` for the options.
- `scripts/probe.mjs`: the headless Chrome check of a page. `scripts/check.mjs`: the machine check, with Node built-ins only.
- `examples/`: scenarios for the native HTML pages in `examples/pages/`, plus two for dev pages of vaadin/web-components, with the phrases of earlier runs. Run them to check a change with both readers.
- `test/`: `node:test` tests of the helpers, and of the run loop with a fake reader, so no test starts a screen reader.

## One home per fact

Put each fact in one file. Link to it from the other files.

| File | Content |
| --- | --- |
| `skills/<reader>-<browser>/SKILL.md` | The values of one pair and the facts of its browser |
| `references/workflow.md` | The workflow and the actions during a run |
| `references/voiceover.md`, `references/nvda.md` | The facts of one reader in all its browsers, with evidence |
| `references/steps.md` | The step tokens and the translation rules |
| `references/scenario.md` | The scenario format and the Results format |
| `references/phrase-log.md` | How Guidepup logs, the capture and the log shape |
| `examples/*.md` | Scenarios and the phrases of their runs |
| `README.md` | Install, setup and troubleshooting, for people |

## Conventions

- Write every markdown file in Simplified Technical English. The global writing-style rule applies.
- Add a lesson about one browser to its pair skill, and a lesson about all browsers of a reader to the reader file. Add the phrases of a run to the Results table of its example.
- Pin `@guidepup/guidepup` and `playwright` to exact versions. A Guidepup update can change the phrase log.

## Test loop

1. Run `npm test` and `npm run lint`.
2. Commit the change.
3. Run `claude plugin update screen-reader-skills@screen-reader-skills`.
4. In a new session, run the skill once on a real page.

## Do not

- Do not commit `node_modules/`, `.omc/` or `logs/`.
- Do not add a `version` field to `plugin.json`. Every commit is a new version.
