#!/usr/bin/env bash
# Code Wiki — Gemini CLI Adapter Installer
# Copies GEMINI.md, skills, and commands into the project root and .gemini/ directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing Code Wiki adapter for Gemini CLI..."

# Copy GEMINI.md (append if exists, copy if not)
if [ -f "GEMINI.md" ]; then
  echo "" >> GEMINI.md
  echo "---" >> GEMINI.md
  cat "$SCRIPT_DIR/GEMINI.md" >> GEMINI.md
  echo "Appended wiki instructions to existing GEMINI.md"
else
  cp "$SCRIPT_DIR/GEMINI.md" GEMINI.md
  echo "Created GEMINI.md"
fi

# Create Gemini skills directory
mkdir -p .gemini/skills/wiki-context
mkdir -p .gemini/commands

# Copy skills
cp "$SCRIPT_DIR/skills/wiki-context/SKILL.md" .gemini/skills/wiki-context/SKILL.md

# Copy commands
for cmd in wiki-init wiki-query; do
  cp "$SCRIPT_DIR/commands/${cmd}.md" ".gemini/commands/${cmd}.md"
done

# Ensure .gitignore has .code-wiki/cache/
if [ -f .gitignore ]; then
  if ! grep -qF '.code-wiki/cache/' .gitignore; then
    echo '.code-wiki/cache/' >> .gitignore
    echo "Added .code-wiki/cache/ to .gitignore"
  fi
fi

echo ""
echo "Installation complete!"
echo "  Instructions: GEMINI.md"
echo "  Skills:  .gemini/skills/wiki-context/"
echo "  Commands: .gemini/commands/wiki-{init,query}.md"
echo ""
echo "Next: restart Gemini CLI and the Code Wiki MCP server will be available."
