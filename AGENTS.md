# Worknote repository instructions

Read README.md, docs/requirements.md, and docs/architecture.md before changing domain behavior. The latest agreed product is a Windows personal application with local storage, not a hosted multi-user application.

- Use the existing checkout. Each Codex cloud task is already isolated; do not create a Git worktree unless the user requests one.
- Route and administrative nodes are equal work units on one board. Sort actual due dates ascending, overdue first, missing/terminated last, and ties by ID.
- A route name is not a unique ID. Preserve distinct route/contract IDs and uppercase route codes.
- Contract nodes contain reference metadata to an external LLM notebook. Never add confidential contract bodies, files, or automatic notebook fetching.
- History belongs to its Route node. Due date is latest update + cycle. Vessel n means estimated n weeks; month boundaries and leap years must be handled.
- Route manuals are local Notion-style block pages. Manual edits must not change route History, recent update date, Due date, or board order.
- AI creates reviewable drafts. Send only explicitly selected, confirmed text; never send an entire DB, notebook, or manual automatically. Do not execute AI-proposed file operations or email actions.
- Keep secrets, actual company data, databases and backups out of Git. Never print API keys or source documents in logs. Maintain TLS verification.
- The server remains bound to 127.0.0.1. Preserve Host/Origin checks, request authentication and CSP.
- Preserve existing user data and browser storage keys during migrations. No silent sample-data overwrite or destructive database reset.
- React UI lives in frontend/, Node.js handles local HTTP and GPT in server.js/lib/, and Python owns domain validation and SQLite persistence in backend/. Python is the authoritative source for stored work deadlines.
- SQLite is active. Keep the DB outside the checkout; browser storage is an explicit, non-destructive migration source. config/worknote.defaults.json documents defaults but is not a runtime configuration loader.
- Use npm ci and npm run verify. For UI changes, exercise meaningful browser flows and mobile layout; distinguish real API calls from mocked responses.
- Do not add Gmail or real Notion synchronization until the user asks. Keep the user-requested Python + React + SQLite + Node.js stack.
