import {
	Notice,
	Plugin,
	TAbstractFile,
	TFile,
	debounce,
	normalizePath,
} from 'obsidian';

import {
	Abbreviation,
	AbbreviationPluginSettings,
	DEFAULT_SETTINGS,
} from './types';

import { expandLinks, parseConfig } from './config';
import { abbreviationInputHandler } from './abbreviation/AbbreviationExtention'
import Devlogger from './util/Devlogger';
import SettingsTab from './ui/SettingsTab';

/** Plugin id of upstream woodenmaiden/obsidian-abbreviations, for the import */
const UPSTREAM_ID = 'abbreviations';

interface UpstreamExpansion {
	value: string;
	isEnabled: boolean;
	position: number;
}

export interface ConfigNoteStatus {
	file: TFile;
	entries: number;
	warnings: string[];
}

export default class AbbreviationPlugin extends Plugin {
	@Devlogger()
	private readonly logger: Console;

	settings: AbbreviationPluginSettings;

	/** enabled abbreviations from all config notes, first definition wins */
	abbreviations = new Map<string, Abbreviation>();
	configNotes: ConfigNoteStatus[] = [];

	private requestReload = debounce(() => this.reloadConfig(), 300, true);

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SettingsTab(this.app, this));

		this.registerEditorExtension(abbreviationInputHandler(this));

		this.addCommand({
			id: 'import-from-abbreviations-expander',
			name: 'Import from Abbreviations expander',
			callback: () => this.importFromUpstream(),
		});
		this.addCommand({
			id: 'create-config-note',
			name: 'Create abbreviations note',
			callback: () => this.createConfigNote([]),
		});
		this.addCommand({
			id: 'reload',
			name: 'Reload abbreviations',
			callback: () => this.reloadConfig(),
		});

		this.app.workspace.onLayoutReady(() => {
			this.reloadConfig();

			const onFileEvent = (file: TAbstractFile) => {
				if (file instanceof TFile && (this.isConfigNote(file) || this.hasWantedUuid(file)))
					this.requestReload();
			};
			this.registerEvent(this.app.metadataCache.on('changed', onFileEvent));
			this.registerEvent(this.app.vault.on('delete', onFileEvent));
		});
	}

	async loadSettings() {
		this.settings = { ...structuredClone(DEFAULT_SETTINGS), ...(await this.loadData())};
	}

	async saveSettings() {
		await this.saveData(this.settings);
		await this.reloadConfig();
	}

	isConfigNote(file: TFile): boolean {
		return this.configNotes.some(c => c.file === file);
	}

	/** `uuid` frontmatter may be a single value or a list */
	private uuidsOf(file: TFile): string[] {
		const uuid: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter?.uuid;
		const list = Array.isArray(uuid) ? uuid : uuid == null ? [] : [uuid];
		return list.map(u => String(u).trim()).filter(Boolean);
	}

	private hasWantedUuid(file: TFile): boolean {
		return this.uuidsOf(file).some(u => this.settings.configUuids.includes(u));
	}

	/** config uuids that no note in the vault carries */
	missingUuids(): string[] {
		const found = new Set(this.configNotes.flatMap(c => this.uuidsOf(c.file)));
		return this.settings.configUuids.filter(u => !found.has(u));
	}

	async reloadConfig() {
		const order = (file: TFile) => Math.min(
			...this.uuidsOf(file).map(u => this.settings.configUuids.indexOf(u)).filter(i => i >= 0)
		);
		const files = this.app.vault.getMarkdownFiles()
			.filter(f => this.hasWantedUuid(f))
			.sort((a, b) => order(a) - order(b) || a.path.localeCompare(b.path));

		const abbreviations = new Map<string, Abbreviation>();
		const configNotes: ConfigNoteStatus[] = [];
		for (const file of files) {
			const { entries, warnings } = parseConfig(await this.app.vault.cachedRead(file));
			for (const entry of entries) {
				if (!entry.enabled) continue;
				const existing = abbreviations.get(entry.abbreviation);
				if (existing) {
					warnings.push(`line ${entry.line}: "${entry.abbreviation}" is already defined in ${existing.source.path}`);
					continue;
				}
				abbreviations.set(entry.abbreviation, { expansion: entry.expansion, source: file });
			}
			configNotes.push({ file, entries: entries.length, warnings });
		}

		this.abbreviations = abbreviations;
		this.configNotes = configNotes;
		this.logger.log('loaded abbreviations:', abbreviations);
	}

	/**
	 * The expansion as it should be inserted into `targetPath`: internal links
	 * are resolved relative to the config note and regenerated for the target
	 * note, following the vault's link format settings.
	 */
	expand(abbreviation: Abbreviation, targetPath: string): string {
		const sourcePath = abbreviation.source.path;
		return expandLinks(
			abbreviation.expansion,
			(linkpath) => this.resolveLink(linkpath, sourcePath),
			(file, subpath, alias) =>
				this.app.fileManager.generateMarkdownLink(file, targetPath, subpath, alias)
		);
	}

	private resolveLink(linkpath: string, sourcePath: string): TFile | null {
		if (linkpath.startsWith('./') || linkpath.startsWith('../')) {
			const parts = sourcePath.split('/').slice(0, -1);
			for (const part of linkpath.split('/')) {
				if (part === '..') parts.pop();
				else if (part !== '.' && part !== '') parts.push(part);
			}
			const path = normalizePath(parts.join('/'));
			for (const candidate of [path, `${path}.md`]) {
				const file = this.app.vault.getAbstractFileByPath(candidate);
				if (file instanceof TFile) return file;
			}
		}
		return this.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
	}

	/** Creates a new config note holding `lines`, registers its uuid and opens it. */
	async createConfigNote(lines: string[]): Promise<TFile> {
		const uuid = crypto.randomUUID();
		const content = [
			'---',
			`uuid: ${uuid}`,
			'---',
			'',
			'# Abbreviations',
			'',
			'One list item per abbreviation: `abbr: expansion`. Matching is case-sensitive.',
			'Strike an item through (`~~abbr: expansion~~`) to disable it. Links work and',
			'are rewritten to fit the note you type in.',
			'',
			...(lines.length ? lines : ['- btw: by the way']),
			'',
		].join('\n');

		let path = 'Abbreviations.md';
		for (let n = 1; this.app.vault.getAbstractFileByPath(path); n++)
			path = `Abbreviations ${n}.md`;

		const file = await this.app.vault.create(path, content);
		this.settings.configUuids.push(uuid);
		await this.saveSettings();
		await this.app.workspace.getLeaf(true).openFile(file);
		return file;
	}

	async importFromUpstream() {
		const dataPath = normalizePath(`${this.app.vault.configDir}/plugins/${UPSTREAM_ID}/data.json`);
		if (!(await this.app.vault.adapter.exists(dataPath))) {
			new Notice(`Nothing to import: ${dataPath} not found`);
			return;
		}

		let abbreviations: Record<string, UpstreamExpansion>;
		try {
			abbreviations = JSON.parse(await this.app.vault.adapter.read(dataPath)).abbreviations ?? {};
		} catch (e) {
			new Notice(`Could not read ${dataPath}: ${e}`);
			return;
		}

		const lines = Object.entries(abbreviations)
			.filter(([abbreviation, { value }]) => abbreviation.trim() && value?.trim())
			.sort((a, b) => a[1].position - b[1].position)
			.map(([abbreviation, { value, isEnabled }]) => {
				const entry = `${abbreviation.trim()}: ${value.replace(/\s*\n\s*/g, ' ').trim()}`;
				return isEnabled === false ? `- ~~${entry}~~` : `- ${entry}`;
			});

		const file = await this.createConfigNote(lines);
		new Notice(`Imported ${lines.length} abbreviations into ${file.path}. You can disable Abbreviations expander now.`);
	}
}
