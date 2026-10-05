import {
	App,
	PluginSettingTab,
	Setting,
} from 'obsidian';

import AbbreviationPlugin from '../main';

export default class AbbreviationSettingTab extends PluginSettingTab {
	plugin: AbbreviationPlugin;

	constructor(app: App, plugin: AbbreviationPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('p', {
			text: 'Abbreviations live in notes of this vault. A note is used when one of the ' +
				'values of its "uuid" frontmatter field is listed below. In the note, every list ' +
				'item "abbr: expansion" is an abbreviation; strike it through to disable it.'
		});

		new Setting(containerEl)
			.setName('Config note uuids')
			.setDesc('One per line. Earlier notes win when an abbreviation is defined twice.')
			.addTextArea(text => {
				text
					.setValue(this.plugin.settings.configUuids.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.configUuids = value.split('\n').map(u => u.trim()).filter(Boolean);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 4;
				text.inputEl.cols = 40;
				// re-render the status only once editing is done, not on every keystroke
				text.inputEl.addEventListener('blur', () => this.display());
			});

		new Setting(containerEl)
			.setName('New config note')
			.setDesc('Create a note with a fresh uuid and add it above.')
			.addButton(button => button
				.setButtonText('Create')
				.onClick(async () => {
					await this.plugin.createConfigNote([]);
					this.display();
				}));

		new Setting(containerEl)
			.setName('Import')
			.setDesc('Turn the abbreviations of the "Abbreviations expander" plugin into a new config note.')
			.addButton(button => button
				.setButtonText('Import')
				.onClick(async () => {
					await this.plugin.importFromUpstream();
					this.display();
				}));

		containerEl.createEl('h3', { text: 'Loaded' });
		const listEl = containerEl.createEl('ul');
		for (const note of this.plugin.configNotes) {
			const item = listEl.createEl('li');
			const link = item.createEl('a', { text: note.file.path, href: '#' });
			link.addEventListener('click', (e) => {
				e.preventDefault();
				this.app.workspace.getLeaf(true).openFile(note.file);
			});
			item.appendText(` — ${note.entries} entries`);
			if (note.warnings.length) {
				const warnings = item.createEl('ul');
				for (const warning of note.warnings) warnings.createEl('li', { text: `⚠️ ${warning}` });
			}
		}
		for (const uuid of this.plugin.missingUuids()) {
			listEl.createEl('li', { text: `⚠️ no note has uuid ${uuid}` });
		}
		if (!this.plugin.settings.configUuids.length) {
			listEl.createEl('li', { text: 'No config notes configured.' });
		}
		containerEl.createEl('p', { text: `${this.plugin.abbreviations.size} active abbreviations.` });
	}
}
