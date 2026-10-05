#!/bin/sh
# Build and copy the packaged plugin (main.js, manifest.json, styles.css) into a vault.
# Usage: scripts/install.sh <path/to/vault>
set -e
vault=${1:?usage: $0 <path/to/vault>}
[ -d "$vault/.obsidian" ] || { echo "$vault is not an Obsidian vault" >&2; exit 1; }
cd "$(dirname "$0")/.."
npm run build >/dev/null
id=$(node -p 'require("./manifest.json").id')
dest="$vault/.obsidian/plugins/$id"
mkdir -p "$dest"
cp main.js manifest.json styles.css "$dest/"
echo "installed into $dest — reload Obsidian and enable \"$(node -p 'require("./manifest.json").name')\""
