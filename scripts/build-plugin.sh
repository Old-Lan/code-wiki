#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building plugin for code-wiki..."

# Step 1: Type check
echo "  Running type check..."
npx tsc --noEmit

# Step 2: Bundle server with esbuild
echo "  Bundling server..."
node scripts/bundle.mjs

# Step 3: Assemble plugin directory
PLUGIN_DIR="plugins/code-wiki"
echo "  Assembling plugin at $PLUGIN_DIR/..."
rm -rf "$PLUGIN_DIR"
mkdir -p "$PLUGIN_DIR"

# Copy bundled server
cp dist/bundle/server.cjs "$PLUGIN_DIR/server.cjs"

# Copy plugin metadata
cp -r plugin/.claude-plugin "$PLUGIN_DIR/.claude-plugin"
cp plugin/.mcp.json "$PLUGIN_DIR/.mcp.json"
cp plugin/README.md "$PLUGIN_DIR/README.md"

# Copy commands
cp -r plugin/commands "$PLUGIN_DIR/commands"

# Copy skills
cp -r plugin/skills "$PLUGIN_DIR/skills"

# Copy hooks
if [ -d "plugin/hooks" ]; then
  cp -r plugin/hooks "$PLUGIN_DIR/hooks"
fi

echo "==> Plugin built at $PLUGIN_DIR/"
echo "    Files:"
find "$PLUGIN_DIR" -type f | sed 's/^/    /'
echo ""
echo "Commit and push to publish."
