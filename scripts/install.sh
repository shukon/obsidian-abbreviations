#!/bin/sh
# Build and copy the packaged plugin (main.js, manifest.json, styles.css) into a vault.
# Usage: scripts/install.sh <path/to/vault> [config-folder]
# config-folder defaults to .obsidian; pass e.g. .obsidian-laptop when the vault
# uses Obsidian's "Override config folder" setting.
set -e
vault=${1:?usage: $0 <path/to/vault> [config-folder]}
config=${2:-.obsidian}
if [ ! -d "$vault/$config" ]; then
	echo "$vault/$config not found. Config folders in this vault:" >&2
	ls -d "$vault"/.obsidian* 2>/dev/null | sed 's|.*/|  |' >&2
	exit 1
fi
cd "$(dirname "$0")/.."
npm run build >/dev/null
id=$(node -p 'require("./manifest.json").id')
dest="$vault/$config/plugins/$id"
mkdir -p "$dest"
cp main.js manifest.json styles.css "$dest/"
echo "installed into $dest — reload Obsidian and enable \"$(node -p 'require("./manifest.json").name')\""
