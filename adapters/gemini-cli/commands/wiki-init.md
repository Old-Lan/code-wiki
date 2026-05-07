Initialize Code Wiki for the current project.

Steps:
1. Call `wiki_overview({ depth: "full" })` to analyze the project structure
2. Review the detected modules, their exports, and dependency graph
3. Call `wiki_update({ scope: "full" })` to generate the initial wiki content
4. Review generated content and confirm the wiki is complete
5. Report: number of modules indexed, dependency count, any issues detected

The wiki is stored in `.code-wiki/team/` (committed to git) and cache in `.code-wiki/cache/` (gitignored).
