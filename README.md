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

### Links

Links in an expansion are resolved relative to the config note and **rewritten for
the note you are typing in**, following the vault's *Files and links* settings
(wikilink vs. markdown link, relative vs. shortest path). Unresolvable and external
links are inserted unchanged.

For links in the config note to follow renames, keep *Settings → Files and links →
Automatically update internal links* on.

## Migrating from Abbreviations expander

Run the command **Import from Abbreviations expander** (or the button in the
settings). It reads `.obsidian/plugins/abbreviations/data.json`, writes the entries
into a new `Abbreviations.md` at the vault root (order and disabled state kept),
gives it a uuid and registers it. Then disable the old plugin — both can be
installed side by side since this fork has its own id (`abbreviations-note`).

Note: the old plugin matched case-insensitively unless an entry was flagged; this
one doesn't.

## Install

The plugin is a single bundled `main.js` plus `manifest.json` and `styles.css`.

- From a checkout: `npm ci && scripts/install.sh <path/to/vault>`
- Or download those three files from a Forgejo release into
  `<vault>/.obsidian/plugins/abbreviations-note/`.

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
