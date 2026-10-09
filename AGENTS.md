This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

This project uses **pnpm** (`pnpm-lock.yaml` present). Always use `pnpm`, never `npm`, `yarn`, or `bun`.

```bash
pnpm expo install <package>  # ALWAYS use instead of pnpm add — resolves SDK-compatible versions
pnpm expo start              # start the dev server
pnpm expo lint               # lint
pnpm exec tsc --noEmit       # typecheck
pnpm dlx expo-doctor@latest  # diagnose dependency and config issues
pnpm expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

---

# Universal Agent Guidelines (Skill-First)

This project's rules above take priority. The guidelines below add the required skill workflow and coding discipline for every task.

## Mandatory Skills

For every coding-related task, load and follow these skills before doing any work:

- **caveman** — terse output, less filler, full technical accuracy.
- **ponytail** — laziest correct solution (YAGNI, native/stdlib first, fewest files).
- **grill-with-docs** — sharpen plans/design and keep docs updated as decisions change.

Applies to: creating, editing, reviewing, refactoring, debugging, fixing bugs, changing config, modifying tests, changing project structure, and technical implementation planning. Do not skip a required skill, even for small tasks.

## Skill Enforcement

Before any coding action:

1. Verify caveman is loaded.
2. Verify ponytail is loaded.
3. Verify grill-with-docs is loaded.
4. Apply all three to the task.

If a required skill is unavailable, stop and report which skill is missing. Do not proceed while any required skill has not been applied.

## Skill Priority

When skill instructions conflict, use this order (higher overrides lower):

1. caveman
2. ponytail
3. grill-with-docs

## Ponytail Mode

Use ponytail as the default implementation philosophy.

- **lite** (default) — small fixes, minor edits, config changes, isolated bugs, straightforward tasks. Proceed directly.
- **full** — large features, significant refactors, architecture decisions, high-impact structural changes, unclear tradeoffs. Run the full reasoning process before implementation; ask the user first.

## Core Coding Rules

- YAGNI — do not build what is not currently required.
- Prefer native / standard-library / built-in / existing project capabilities before adding dependencies.
- Use the smallest working implementation.
- Minimize files, layers, abstractions, and indirection.
- Do not create an abstraction with only one implementation unless there is a concrete reason.
- Reuse existing patterns before inventing new ones.
- Avoid speculative extensibility and premature optimization.
- Avoid unnecessary wrappers, factories, interfaces, helpers, or utility layers.

## Simplification Marker

When intentionally choosing a simpler implementation over a more abstract one, mark it where the decision is non-obvious:

```ts
// ponytail: keep validation inline until another caller needs reuse
```

## Dependency Discipline

Before introducing any new dependency:

1. Check whether the runtime/language already provides the capability.
2. Check whether the project already solves it.
3. Add a dependency only when it clearly beats the simpler alternatives; never for convenience alone.

## Documentation Discipline

- Apply grill-with-docs before creating or changing documentation.
- Do not create documentation unless it is useful; do not duplicate existing info.
- Keep docs close to the code or decision they explain; prefer concise docs.
- Document non-obvious behavior, constraints, and decisions.
- Keep documentation synchronized with implementation.

## Caveman Discipline

Reduce unnecessary complexity. Prefer direct code over indirection, explicit behavior over clever abstractions, fewer moving parts, existing conventions, simple control flow, and solutions easy to inspect and delete. Complexity must justify itself.

## Change Discipline

Before a change: understand the smallest scope, avoid unrelated cleanup, avoid opportunistic refactoring, and preserve existing behavior unless the task requires changing it.

After a change: add a brief comment explaining what changed and why (concise, useful context only; do not comment obvious code), validate only what is relevant, fix issues introduced by the change, and never silently ignore failures.

## Default Principle

Use all required skills first, then build the smallest correct solution. When uncertain, prefer less code, fewer files, fewer dependencies, fewer abstractions, fewer assumptions, and clearer behavior.

## Strict Rules

1. **Never commit or push without explicit instruction** — never run `git commit`, `git push`, `git add`, or any commit/push-related command unless the user explicitly asks in the current prompt.

## Response Constraints

1. **No preamble** — never start with filler such as "Sure", "OK", or "Let's start".
2. **Short summary** — summarize in no more than 3 lines unless the user specifies otherwise.
3. **100 words max** — general answers stay under 100 words unless detail is requested.
4. **Stay on point** — answer only what is asked.
5. **Use bullets/tables** — for multiple points, prefer bullets or a table over long paragraphs.

## File Organization Rules

When creating MD, HTML, or Plan/Todo files:

1. **Always use subfolders** — never place files in the root of `MD/`, `HTML/`, or `plan/`; use a topic subfolder.
2. **Filename includes date** — format `ddMMyyyy-{name}`, e.g. `02072026-flow-checklist.md`.
3. **Content max 200 lines** — keep it concise.
4. **English primary** — unless the user requests Thai.

## Critical Gotchas

1. **Package manager** — follow this project's Commands section: use `bunx` when `bun.lock` is present, otherwise `npx` (this project currently has no Bun lock, so use `npx`). Always use `npx expo install` for SDK-compatible package versions, never a bare add command.
2. **RTK (Rust Token Killer)** — prefix shell commands with `rtk` to compress terminal output (saves 60-90% tokens on common operations).

## Language Preference

Thai-English bilingual output: accept input in any language (mainly Thai), translate internally to English, and present the final answer in Thai with English technical terms alongside.

## Confirm-First Rule

Never start working immediately. Before any task, restate understanding and wait for confirmation:

1. Restate what the user asked for (bullet points).
2. List the files/folders to be modified.
3. State the approach/steps.
4. Wait for user confirmation before starting.

Example:

```
Here is my understanding:
- [restate the user's request]
- Files to modify: [list of files]
- Steps: [list of steps]
Confirm this is correct?
```

## Generate Commit Skill

When the user asks to generate a commit message (triggers: "generate commit", "commit message", "สร้าง commit message", "gen commit"), use the `generate-commit` skill. It analyzes staged/unstaged changes, generates a conventional commit message (`type: description`), presents it for confirmation, and commits only after approval. Allowed types: `feat`, `fix`, `refactor`, `docs`, `chore`, `style`, `test`, `perf`.

## Project Roadmap and Status Documentation

Every project must maintain `PROJECT_ROADMAP_AND_STATUS.md` in its root as the Single Source of Truth for roadmap, feature status, and change history.

- **Check before work** — verify the file exists in the project root.
- **Auto-create if missing** — analyze project structure and source, then create it (split Frontend/Backend if applicable).
- **Read before development** — understand current status before changing features.
- **Update after changes** — new features, fixes, refactors, breaking changes, dependency/schema/API changes.
- **Reflect actual source** — remove listed features that no longer exist.
- **No false completion** — never mark a feature Complete without real code.
- **Separate planned vs current** — planned features live only in the Roadmap section.
- **Source code is truth** — on conflict, source wins; update the file.
- **Verify impact after tasks** — update before considering a task done.
- **Preserve change history** — do not delete important entries unless incorrect or duplicated.
- **No line limit** — exempt from the 200-line guideline.

Required structure:

```markdown
# Project Overview
# Current Status
# Architecture
# Current Features
# In Progress
# Roadmap / Planned Features
# Known Issues
# Important Decisions
# Change History
```

Cycle: `Inspect Project → Read PROJECT_ROADMAP_AND_STATUS.md → Perform Task → Verify Implementation → Update PROJECT_ROADMAP_AND_STATUS.md`
