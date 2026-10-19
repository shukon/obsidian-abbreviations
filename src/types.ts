import { TFile } from 'obsidian';

export interface AbbreviationPluginSettings {
	/** `uuid` frontmatter values of the notes holding the abbreviations */
	configUuids: string[];
	/** sort the entries of each heading section of the config notes alphabetically */
	sortEntries: boolean;
}

export const DEFAULT_SETTINGS: AbbreviationPluginSettings = {
	configUuids: [],
	sortEntries: true,
};

export interface Abbreviation {
	expansion: string;
	/** config note the expansion came from; its links resolve relative to it */
	source: TFile;
}
