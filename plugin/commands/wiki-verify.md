Verify Code Wiki consistency with the current codebase.

Steps:
1. Call `wiki_overview({ depth: "full" })` to get current project state
2. Compare with the existing `.code-wiki/team/` content
3. Check for stale modules (modules whose wiki hasn't been updated after code changes)
4. Report inconsistencies:
   - Modules in wiki but no longer in code
   - Modules in code but missing from wiki
   - Modules with outdated content (git hash mismatch)
5. Suggest running `/wiki-update` for stale modules

Exit with a summary of wiki health status.
