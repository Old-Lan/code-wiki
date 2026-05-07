#!/usr/bin/env bash
# Code Wiki — Codex Adapter Installer
# Copies AGENTS.md into the project root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing Code Wiki adapter for Codex..."

# Copy AGENTS.md (append if exists, copy if not)
if [ -f "AGENTS.md" ]; then
  echo "" >> AGENTS.md
  echo "---" >> AGENTS.md
  cat "$SCRIPT_DIR/AGENTS.md" >> AGENTS.md
  echo "Appended wiki instructions to existing AGENTS.md"
else
  cp "$SCRIPT_DIR/AGENTS.md" AGENTS.md
  echo "Created AGENTS.md"
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
echo "  Instructions: AGENTS.md"
echo ""
echo "Next: ensure the code-wiki MCP server is configured in your Codex MCP settings."
