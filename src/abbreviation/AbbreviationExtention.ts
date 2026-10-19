import { EditorView } from '@codemirror/view';

import { editorInfoField } from 'obsidian';

import type AbbreviationPlugin from '../main';

/**
 * Expands the abbreviation left of the cursor when a space is typed.
 *
 * example (lets assume atm is in the list of abbreviations):
 * 			               v cursor
 * > what are you doing atm|
 * ☝️ typing a space here expands atm
 *
 * The typed space is handled here instead of reacting to it afterwards: word,
 * expansion and space go in as one transaction computed from the current
 * document, so nothing typed or changed in between can shift the positions
 * (the upstream plugin dispatched a frame later with stale positions, which
 * scrambled expansions). Matching is always case-sensitive.
 */
export function abbreviationInputHandler(plugin: AbbreviationPlugin) {
	return EditorView.inputHandler.of((view, from, to, text) => {
		if (text !== ' ' || from !== to) return false;

		const line = view.state.doc.lineAt(from);
		const word = /\S+$/.exec(line.text.slice(0, from - line.from))?.[0];
		if (!word) return false;

		const abbreviation = plugin.abbreviations.get(word);
		if (!abbreviation) return false;

		const targetFile = view.state.field(editorInfoField, false)?.file ?? null;
		if (targetFile && plugin.isConfigNote(targetFile)) return false; // don't expand while editing the config itself

		const start = from - word.length;
		const insert = plugin.expand(abbreviation, targetFile?.path ?? '') + ' ';
		view.dispatch({
			changes: { from: start, to, insert },
			selection: { anchor: start + insert.length },
			scrollIntoView: true,
			userEvent: 'input.abbreviation',
		});
		plugin.onExpanded();
		return true;
	});
}
