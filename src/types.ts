import { TFile } from 'obsidian';

export interface AbbreviationPluginSettings {
	/** `uuid` frontmatter values of the notes holding the abbreviations */
	configUuids: string[];
}

export const DEFAULT_SETTINGS: AbbreviationPluginSettings = {
	configUuids: [],
};

export interface Abbreviation {
	expansion: string;
	/** config note the expansion came from; its links resolve relative to it */
	source: TFile;
}

export interface AbbreviationLocation {
	startingCharacter: number;
	abbreviation: Abbreviation;
}
