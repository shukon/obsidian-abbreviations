# Abbreviations from Note

Fork of [woodenmaiden/obsidian-abbreviations](https://github.com/woodenmaiden/obsidian-abbreviations)
(MIT). Abbreviations still expand when you type a space, but they are defined in a
**note in the vault** instead of the plugin settings, so expansions can contain links
that Obsidian keeps up to date when files move.

## Config note

Any note whose `uuid` frontmatter (a single value or a list) contains one of the
uuids in the plugin settings. Several notes are allowed; if an abbreviation is
defined twice, the note listed first in the settings wins.

```markdown
---
uuid: 0d6f6c1e-…
---

- btw: by the way
- np: next step, see [Plan](./Projects/Foo/Plan.md)
- wst: [[WanShiTong Homepage|WanShiTong]]
- ~~atm: at the moment~~
```

- Every list item `abbr: expansion` is an entry, split at the first `: `.
  Everything else (headings, prose, code blocks) is ignored.
- Abbreviations are one word and **always case-sensitive**.
- Strike an item through to disable it.
- Nothing expands while you type in a config note itself.
- Changes to the note apply immediately.
- Entries are kept **sorted alphabetically within each heading section** (setting
  *Sort entries*, on by default; command *Sort abbreviations notes*). Sorting runs
  after an expansion, and skips notes edited in the last 30 seconds. Only top-level
  entries move, together with the indented lines below them; headings, prose, plain
  list items and code blocks stay put.

### Links

Links in an expansion are resolved relative to the config note and **rewritten for
the note you are typing in**, following the vault's *Files and links* settings
(wikilink vs. markdown link, relative vs. shortest path). Unresolvable and external
links are inserted unchanged.

For links in the config note to follow renames, keep *Settings → Files and links →
Automatically update internal links* on.

## Migrating from Abbreviations expander

Run the command **Import from Abbreviations expander** (or the button in the
settings). It reads `<config-folder>/plugins/abbreviations/data.json` of the current machine, writes the entries
into a new `Abbreviations.md` at the vault root (order and disabled state kept),
gives it a uuid and registers it. Then disable the old plugin — both can be
installed side by side since this fork has its own id (`abbreviations-note`).

Note: the old plugin matched case-insensitively unless an entry was flagged; this
one doesn't.

## Install

The plugin is a single bundled `main.js` plus `manifest.json` and `styles.css`.

- From a checkout: `npm ci && scripts/install.sh <path/to/vault> [config-folder]`
  (`config-folder` defaults to `.obsidian`; pass e.g. `.obsidian-laptop` if the vault
  uses *Override config folder*, one per machine).
- With [BRAT](https://github.com/TfTHacker/obsidian42-brat): *Add beta plugin* →
  `shukon/obsidian-abbreviations`. BRAT installs and updates from the GitHub
  releases of the mirror.
- Or download those three files from a [GitHub release](https://github.com/shukon/obsidian-abbreviations/releases)
  into `<vault>/<config-folder>/plugins/abbreviations-note/`.

## Releasing

Forgejo push-mirrors to GitHub (`shukon/obsidian-abbreviations`), where
`.github/workflows/release.yml` builds a release for every pushed tag:

```sh
npm version minor   # bumps manifest.json + versions.json, tags without "v" (.npmrc)
git push --follow-tags
```

With per-machine config folders, the plugin settings (the config note uuids) are per
machine too: paste the uuid from the config note's frontmatter on each machine. The
abbreviations themselves live in the note and are shared.

Works on desktop and mobile.

## Development

```sh
npm ci
npm run dev     # watch build
npm test        # parser / link rewriting tests (plain Node, no Obsidian)
npm run build   # type-check + production bundle
```

Code: `src/config.ts` (pure parsing and link rewriting), `src/main.ts` (finding
config notes, reloading, import), `src/abbreviation/AbbreviationExtention.ts`
(the CodeMirror extension that does the expanding).
