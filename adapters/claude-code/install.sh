#!/usr/bin/env bash
# Code Wiki — Claude Code Adapter Installer
# Copies skills, commands, and settings into the project's .claude/ directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$(pwd)/.claude"

echo "Installing Code Wiki adapter for Claude Code..."

# Create target directories
mkdir -p "$TARGET_DIR/skills/wiki-context"
mkdir -p "$TARGET_DIR/commands"

# Copy skills
mkdir -p "$TARGET_DIR/skills/wiki-context"
cp "$SCRIPT_DIR/skills/wiki-context/SKILL.md" "$TARGET_DIR/skills/wiki-context/SKILL.md"

for skill in wiki-context-brainstorm wiki-context-planning wiki-constraints-review wiki-update-completion; do
  mkdir -p "$TARGET_DIR/skills/$skill"
  cp "$SCRIPT_DIR/skills/$skill/SKILL.md" "$TARGET_DIR/skills/$skill/SKILL.md"
done

# Copy commands
for cmd in wiki-init wiki-update wiki-query wiki-verify; do
  cp "$SCRIPT_DIR/commands/${cmd}.md" "$TARGET_DIR/commands/${cmd}.md"
done

# Merge settings (preserve existing)
if [ -f "$TARGET_DIR/settings.json" ]; then
  echo "Existing settings.json found — merging MCP server config..."
  # Use node to merge JSON if available, otherwise skip
  if command -v node &>/dev/null; then
    node -e "
      const existing = require('$TARGET_DIR/settings.json');
      const adapter = require('$SCRIPT_DIR/settings.json');
      existing.mcpServers = { ...(existing.mcpServers || {}), ...(adapter.mcpServers || {}) };
      existing.permissions = { ...(existing.permissions || {}), ...(adapter.permissions || {}) };
      require('fs').writeFileSync('$TARGET_DIR/settings.json', JSON.stringify(existing, null, 2) + '\n');
    "
  else
    echo "  WARNING: node not found — please manually merge settings.json"
  fi
else
  cp "$SCRIPT_DIR/settings.json" "$TARGET_DIR/settings.json"
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
echo "  Skills:   $TARGET_DIR/skills/wiki-context/"
echo "  Commands: $TARGET_DIR/commands/wiki-{init,update,query,verify}.md"
echo "  Settings: $TARGET_DIR/settings.json"
echo ""
echo "Next: restart Claude Code and run /wiki-init to initialize your project wiki."
