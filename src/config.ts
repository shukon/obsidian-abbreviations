/**
 * Pure parsing of the abbreviations config note and link rewriting.
 * Nothing in here touches the Obsidian API, so it can be tested in plain Node.
 */

export interface ConfigEntry {
	abbreviation: string;
	expansion: string;
	enabled: boolean;
	line: number; // 1-based, for warnings
}

export interface ParseResult {
	entries: ConfigEntry[];
	warnings: string[];
}

const ITEM = /^\s*[-*+]\s+(.*?)\s*$/;
const FENCE = /^\s*(```|~~~)/;
const STRUCK = /^~~(.*)~~$/;
const SEPARATOR = ': ';

/**
 * Every list item `abbr: expansion` is an abbreviation; everything else in the
 * note (frontmatter, headings, prose, code blocks) is ignored. An item wrapped
 * in `~~strikethrough~~` is disabled.
 */
export function parseConfig(text: string): ParseResult {
	const entries: ConfigEntry[] = [];
	const warnings: string[] = [];
	const lines = text.split(/\r?\n/);

	let i = 0;
	if (lines[0] === '---') {
		const end = lines.indexOf('---', 1);
		if (end > 0) i = end + 1;
	}

	let inFence = false;
	for (; i < lines.length; i++) {
		const line = lines[i];
		if (FENCE.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;

		const item = ITEM.exec(line);
		if (!item) continue;

		let body = item[1];
		let enabled = true;
		const struck = STRUCK.exec(body);
		if (struck) {
			body = struck[1];
			enabled = false;
		}

		const sep = body.indexOf(SEPARATOR);
		if (sep < 0) continue; // a plain list item, not an entry

		const abbreviation = body.slice(0, sep).trim();
		const expansion = body.slice(sep + SEPARATOR.length).trim();
		if (!abbreviation || /\s/.test(abbreviation)) {
			warnings.push(`line ${i + 1}: abbreviation "${abbreviation}" must be one word`);
			continue;
		}
		if (!expansion) {
			warnings.push(`line ${i + 1}: "${abbreviation}" has an empty expansion`);
			continue;
		}
		entries.push({ abbreviation, expansion, enabled, line: i + 1 });
	}

	return { entries, warnings };
}

const HEADING = /^#{1,6}\s/;
const COLLATOR = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function compareAbbreviations(a: string, b: string): number {
	// a fixed locale plus a code-unit tiebreak, so every device sorts the same way
	// and synced copies never flip-flop between orders
	return COLLATOR.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

/**
 * Sorts the entries of each heading section alphabetically by abbreviation, or
 * returns null when they already are. Only top-level entries move, each with the
 * indented lines below it; headings, prose, plain list items and code blocks
 * stay where they are, and the sorted entries fill the slots the entries had.
 */
export function sortConfig(text: string): string | null {
	const eol = text.includes('\r\n') ? '\r\n' : '\n';
	const lines = text.split(/\r?\n/);

	let i = 0;
	if (lines[0] === '---') {
		const end = lines.indexOf('---', 1);
		if (end > 0) i = end + 1;
	}

	interface Block { abbreviation: string; lines: string[] }
	const out = lines.slice(0, i);
	let section: (Block | string)[] = []; // a string is a line that stays put
	let changed = false;

	const flush = () => {
		const blocks = section.filter((b): b is Block => typeof b !== 'string');
		const sorted = [...blocks].sort((a, b) => compareAbbreviations(a.abbreviation, b.abbreviation));
		if (sorted.some((b, n) => b !== blocks[n])) changed = true;
		let n = 0;
		for (const item of section) {
			if (typeof item === 'string') out.push(item);
			else out.push(...sorted[n++].lines);
		}
		section = [];
	};

	let inFence = false;
	for (; i < lines.length; i++) {
		const line = lines[i];
		const last = section[section.length - 1];
		if (FENCE.test(line)) inFence = !inFence;
		else if (inFence) { /* stays put */ }
		else if (HEADING.test(line)) {
			flush();
			out.push(line);
			continue;
		} else if (/^\s+\S/.test(line) && last && typeof last !== 'string') {
			last.lines.push(line); // child or continuation of the entry above
			continue;
		} else {
			const abbreviation = topLevelAbbreviation(line);
			if (abbreviation !== null) {
				section.push({ abbreviation, lines: [line] });
				continue;
			}
		}
		section.push(line);
	}
	flush();

	return changed ? out.join(eol) : null;
}

function topLevelAbbreviation(line: string): string | null {
	if (/^\s/.test(line)) return null;
	const item = ITEM.exec(line);
	if (!item) return null;
	const body = STRUCK.exec(item[1])?.[1] ?? item[1];
	const sep = body.indexOf(SEPARATOR);
	return sep < 0 ? null : body.slice(0, sep).trim();
}

/**
 * Builds the replacement for one link found in an expansion, or returns null to
 * keep the link exactly as written (unresolvable or external).
 *
 * @param linkpath target as written, without `#subpath`, already URL-decoded
 * @param subpath  `#heading` / `#^block` including the `#`, or ''
 * @param alias    display text, if the link had any
 * @param embed    whether the link was an embed (`![[...]]` / `![...](...)`)
 */
export type Relinker = (
	linkpath: string,
	subpath: string,
	alias: string | undefined,
	embed: boolean
) => string | null;

const LINK = /(!?)\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]|(!?)\[([^\]]*)\]\((<[^>]+>|[^)\s]+)\)/g;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function splitSubpath(target: string): [string, string] {
	const hash = target.indexOf('#');
	return hash < 0 ? [target, ''] : [target.slice(0, hash), target.slice(hash)];
}

function safeDecode(s: string): string {
	try {
		return decodeURI(s);
	} catch {
		return s;
	}
}

/** Rewrites every internal link (wikilink or markdown link) in `expansion`. */
export function relink(expansion: string, relinker: Relinker): string {
	return expansion.replace(
		LINK,
		(match, wikiEmbed, wikiTarget, wikiAlias, mdEmbed, mdText, mdDest) => {
			if (wikiTarget !== undefined) {
				const [linkpath, subpath] = splitSubpath(wikiTarget.trim());
				return relinker(linkpath, subpath, wikiAlias, wikiEmbed === '!') ?? match;
			}
			const dest = mdDest.startsWith('<') ? mdDest.slice(1, -1) : mdDest;
			if (URL_SCHEME.test(dest)) return match;
			const [linkpath, subpath] = splitSubpath(safeDecode(dest));
			return relinker(linkpath, subpath, mdText, mdEmbed === '!') ?? match;
		}
	);
}

/**
 * Regenerates every resolvable internal link in `expansion` for its target note.
 * The display text is passed on exactly as written: whether it is redundant
 * depends on the vault's link format, which only `generate` knows.
 *
 * @param resolve  finds the file a link points to, or null to keep the link as is
 * @param generate builds the new link, as Obsidian's `generateMarkdownLink` does
 */
export function expandLinks<F>(
	expansion: string,
	resolve: (linkpath: string) => F | null,
	generate: (file: F, subpath: string | undefined, alias: string | undefined) => string
): string {
	return relink(expansion, (linkpath, subpath, alias, embed) => {
		const file = resolve(linkpath);
		if (!file) return null;
		const link = generate(file, subpath || undefined, alias).replace(/^!/, '');
		return (embed ? '!' : '') + link;
	});
}
