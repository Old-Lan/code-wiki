#!/usr/bin/env bash
# Code Wiki — Cursor Adapter Installer
# Copies MCP config and rules into the project's .cursor/ directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$(pwd)/.cursor"

echo "Installing Code Wiki adapter for Cursor..."

# Create target directories
mkdir -p "$TARGET_DIR/rules"

# Copy MCP config
if [ -f "$TARGET_DIR/mcp.json" ]; then
  echo "Existing mcp.json found — merging server config..."
  if command -v node &>/dev/null; then
    node -e "
      const existing = require('$TARGET_DIR/mcp.json');
      const adapter = require('$SCRIPT_DIR/mcp.json');
      existing.mcpServers = { ...(existing.mcpServers || {}), ...(adapter.mcpServers || {}) };
      require('fs').writeFileSync('$TARGET_DIR/mcp.json', JSON.stringify(existing, null, 2) + '\n');
    "
  else
    echo "  WARNING: node not found — please manually merge mcp.json"
  fi
else
  cp "$SCRIPT_DIR/mcp.json" "$TARGET_DIR/mcp.json"
fi

# Copy rules
cp "$SCRIPT_DIR/rules/wiki-context.md" "$TARGET_DIR/rules/wiki-context.md"

# Ensure .gitignore has .code-wiki/cache/
if [ -f .gitignore ]; then
  if ! grep -qF '.code-wiki/cache/' .gitignore; then
    echo '.code-wiki/cache/' >> .gitignore
    echo "Added .code-wiki/cache/ to .gitignore"
  fi
fi

echo ""
echo "Installation complete!"
echo "  MCP Config: $TARGET_DIR/mcp.json"
echo "  Rules:      $TARGET_DIR/rules/wiki-context.md"
echo ""
echo "Next: restart Cursor and the Code Wiki MCP server will be available."
