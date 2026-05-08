Initialize Code Wiki for the current project.

Steps:
1. Run `npx code-wiki init` in the project root
2. Review the generated `.code-wiki/team/` directory
3. Confirm the detected modules are correct
4. Commit the `.code-wiki/team/` directory to version control
5. Add `.code-wiki/cache/` to `.gitignore` (should already be there)

The init command will:
- Detect the project language and framework
- Identify modules and their boundaries
- Generate a team wiki skeleton in `.code-wiki/team/`
- Create a personal cache in `.code-wiki/cache/`
