#!/usr/bin/env bash
# Code Wiki — Wiki PR Generation Script
# Can be run locally or in CI to generate a wiki update PR.

set -euo pipefail

SCOPE="${1:-changed}"
BASE_BRANCH="${2:-main}"

echo "Code Wiki — Generating wiki update (scope: $SCOPE)"

# Ensure we're on a clean branch
if [ -z "$(git status --porcelain)" ]; then
  echo "Working tree clean — proceeding"
else
  echo "ERROR: Working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

# Run wiki update
echo "Running wiki update..."
npx code-wiki-server --update --scope="$SCOPE"

# Check for changes
if git diff --quiet .code-wiki/team/; then
  echo "No wiki changes detected — nothing to do"
  exit 0
fi

echo "Wiki changes detected:"
git diff --stat .code-wiki/team/

# Create branch and commit
BRANCH_NAME="wiki-update-$(date +%Y%m%d-%H%M%S)"
git checkout -b "$BRANCH_NAME"
git add .code-wiki/team/
git commit -m "docs(wiki): update wiki content (scope: $SCOPE)"

echo ""
echo "Branch created: $BRANCH_NAME"
echo "Push with: git push -u origin $BRANCH_NAME"
echo "Then create a PR targeting $BASE_BRANCH"
