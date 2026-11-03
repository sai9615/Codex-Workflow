# Maintaining Native Codex Workflows

This repository distributes three reusable skills, their references, an optional model profile, and dependency-free install/build tools. It is separate from any coordinator application and target project.

- Source skills live in skills/. Keep the main chat as coordinator; questions and permission requests must reach the user there. Follow a selected workflow's native delegation instructions; do not invent external model sessions or background services.
- Keep local Obsidian vaults, trackers, raw execution evidence, credentials and machine state outside this Git root. Publish only the explicit file list in scripts/package-files.mjs. Skill references and this user-facing README are distributable product files.
- Preserve unrelated work. Do not change installed personal skills, global configuration or another project while maintaining this package.
- Use Node 24.22.1 within Node 24. There are no package dependencies to install. Run npm run test:run and npm run build before committing. Preserve warnings and actual failures; static and installer tests do not establish live Codex behavior.
- Native workflow agents request gpt-6.1-sol / medium. High requires prior scoped user approval. Report unavailable runtime telemetry without claiming enforcement.
- Use RTK for shell commands when available. Main handles any required sandbox approval; workers return concrete proposals without invoking escalation tools.
- Publish only to the user-authorized repository/branch after inspecting the exact file list and automatic effects. No merge, deployment or provider connection follows from a successful test.
