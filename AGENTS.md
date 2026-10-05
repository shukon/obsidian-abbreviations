# AGENTS.md — obsidian-abbreviations

Fork of woodenmaiden/obsidian-abbreviations (remote `upstream`) with the config
moved into a vault note. See [README.md](README.md) for format, layout and build.

Aperture project: ~/Repos/Aperture/Aperture/Projects/Abbreviations from Note/Plan.md
(roadmap in the `+Abbreviations from Note.md` index next to it — check items off
there when tracked work lands here).

## Gotchas

- **Only `src/config.ts` is testable without Obsidian.** Keep parsing and link
  rewriting there, free of Obsidian imports; everything touching `app` can only be
  checked in a real vault.
- **Ship as a bundle.** Vaults sync via Syncthing, which copes badly with many small
  files: a release is exactly `main.js`, `manifest.json`, `styles.css`.
- **Plugin id is `abbreviations-note`**, deliberately different from upstream's
  `abbreviations` so both can be installed during migration. Don't change it —
  that orphans every vault's settings (`data.json`).
- `.github/workflows/release.yml` is upstream's; it only does anything on a GitHub
  mirror.

## Git

**Commit and push proactively, without asking first**, straight to `main`, with a
real descriptive message. Only pause for something genuinely irreversible
(force-push, rewriting published history).
