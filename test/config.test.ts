import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseConfig, relink, Relinker } from '../src/config';

test('parses list items, ignores everything else', () => {
	const { entries, warnings } = parseConfig([
		'---',
		'uuid: [a, b]',
		'- fm: not an entry',
		'---',
		'# Abbreviations',
		'Some prose: with a colon',
		'- btw: by the way',
		'* w/o: without',
		'  - eg.: for example: really',
		'- ~~old: disabled one~~',
		'- just a list item',
		'```',
		'- code: not an entry',
		'```',
		'- two words: nope',
		'- empty: ',
	].join('\n'));

	assert.deepEqual(entries.map(e => [e.abbreviation, e.expansion, e.enabled]), [
		['btw', 'by the way', true],
		['w/o', 'without', true],
		['eg.', 'for example: really', true],
		['old', 'disabled one', false],
	]);
	assert.equal(warnings.length, 1); // "two words"; "empty:" has no ": " after trimming
	assert.match(warnings[0], /line 15/);
});

test('relink rewrites internal links and keeps the rest', () => {
	const calls: unknown[] = [];
	const relinker: Relinker = (linkpath, subpath, alias, embed) => {
		calls.push([linkpath, subpath, alias, embed]);
		return linkpath === 'missing' ? null : `<${linkpath}${subpath}|${alias ?? ''}>`;
	};
	const out = relink(
		'see [[Plan]], [[Plan#Goal|the goal]], [Log](./Foo%20Bar/Log.md#^x), ' +
		'![[img.png]], [web](https://example.org/a.md), [[missing]] and [x](<a b.md>)',
		relinker
	);
	assert.equal(out,
		'see <Plan|>, <Plan#Goal|the goal>, <./Foo Bar/Log.md#^x|Log>, ' +
		'<img.png|>, [web](https://example.org/a.md), [[missing]] and <a b.md|x>'
	);
	assert.deepEqual(calls[3], ['img.png', '', undefined, true]);
});
