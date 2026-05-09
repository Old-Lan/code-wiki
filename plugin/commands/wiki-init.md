Initialize Code Wiki for the current project.

IMPORTANT: You MUST use the `wiki_init` MCP tool (mcp__code-wiki__wiki_init). Do NOT use `npx code-wiki init` or any Bash/CLI command.

Steps:
1. Call `wiki_init({ force: false })` via MCP tool
2. Check the response status:
   - If `status: "detection_required"`:
     a. Review the `prompt` field — it contains the file tree and import graph
     b. Analyze the project structure and determine module grouping by business domain
     c. Group files by business domain (not technical layer): same domain's router/service/model/schema belong together
     d. Call `wiki_init({ module_grouping: "<JSON>" })` where JSON has `{ modules: [{ name: "...", files: [...], reason: "..." }] }`
   - If `status: "initialized"`:
     a. Grouping was already cached or provided
     b. Review the returned module list — confirm the detected modules are correct
3. Report what was detected: framework, language, module count
4. Suggest running `/wiki-update` next to generate detailed content for each module
