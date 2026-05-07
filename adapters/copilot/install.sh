#!/usr/bin/env bash
# Code Wiki — GitHub Copilot CLI Adapter Installer
# Copies MCP config into the project root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing Code Wiki adapter for GitHub Copilot CLI..."

# Copy MCP config
if [ -f "mcp.json" ]; then
  echo "Existing mcp.json found — merging server config..."
  if command -v node &>/dev/null; then
    node -e "
      const existing = require('$(pwd)/mcp.json');
      const adapter = require('$SCRIPT_DIR/mcp.json');
      existing.mcpServers = { ...(existing.mcpServers || {}), ...(adapter.mcpServers || {}) };
      require('fs').writeFileSync('$(pwd)/mcp.json', JSON.stringify(existing, null, 2) + '\n');
    "
  else
    echo "  WARNING: node not found — please manually merge mcp.json"
  fi
else
  cp "$SCRIPT_DIR/mcp.json" mcp.json
fi

# Ensure .gitignore has .code-wiki/cache/
if [ -f .gitignore ]; then
  if ! grep -qF '.code-wiki/cache/' .gitignore; then
    echo '.code-wiki/cache/' >> .gitignore
    echo "Added .code-wiki/cache/ to .gitignore"
  fi
fi

echo ""
echo "Installation complete!"
echo "  MCP Config: mcp.json"
echo ""
echo "Next: restart Copilot CLI and the Code Wiki MCP server will be available."
