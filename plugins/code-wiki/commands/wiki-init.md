Initialize Code Wiki for the current project.

IMPORTANT: You MUST use the `wiki_init` MCP tool (mcp__code-wiki__wiki_init). Do NOT use `npx code-wiki init` or any Bash/CLI command.

Steps:
1. Call `wiki_init({ force: false })` via MCP tool
2. Review the returned module list — confirm the detected modules are correct
3. Report what was detected: framework, language, module count
4. Suggest running `/wiki-update` next to generate detailed content for each module

The init tool will:
- Detect the project language and framework
- Identify modules and their boundaries
- Generate a team wiki skeleton in `.code-wiki/team/`
- Create a personal cache in `.code-wiki/cache/`
