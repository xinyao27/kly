# Task: Rename `kly serve` to `kly mcp`

## Plan

- [x] Check current branch and create a task branch for the CLI rename
- [x] Update the CLI command surface from `serve` to `mcp`
- [x] Update help text and user-facing descriptions for the MCP command
- [x] Sync README and Chinese/English docs to use `kly mcp`
- [x] Verify built CLI help output shows `mcp` and no longer shows `serve`
- [x] Review the final diff and record verification results

## Notes

- Scope: rename the public CLI command only
- Non-goal: keep a backward-compatible `serve` alias
- Internal implementation names may remain unchanged to keep the diff minimal

## Review

- Built the project with `npm run build`
- Verified `node dist/cli.mjs --help` lists `mcp` and no longer lists `serve`
- Verified `node dist/cli.mjs help mcp` shows the MCP command help text
- Verified there are no remaining public `kly serve` references in README or docs

---

# Task: Assess The Next Phase

## Plan

- [x] Review roadmap, current task records, and project status
- [x] Inspect implementation and tests to measure how complete P0/P1 really are
- [x] Recommend the next phase with concrete scope and priority order

## Notes

- Roadmap source: `docs/technical.md` and `docs/technical.zh-CN.md`
- Documented status says P0 and P1 are complete
- P2 currently contains two items: npm publish and architecture visualization
- Existing `kly graph` already covers file-level dependency visualization
- No repo-local CI or release workflow was found under `.github/`
- `package.json` is publishable in principle (`bin`, `exports`, `files`, `prepublishOnly`, `publishConfig`) but release metadata is still thin
- Automated coverage is strong for core modules, but CLI commands and MCP server are still validated mainly through the manual checklist in `docs/testing.md`

## Review

- Corrected priority after user feedback: do not optimize for publish yet
- Recommended next phase: detail polish and quality closure
- Reason 1: the current product surface exists, but the user considers the details not ready enough for shipping
- Reason 2: publishing now would lock in UX, command semantics, output format, and behavior before they are fully refined
- Reason 3: the highest-value work is to improve trust in the current feature set, then decide whether to ship or expand

Proposed execution order:

1. Tighten current CLI and output details
2. Add verification around real user flows for existing commands
3. Define the next feature phase only after the current surface feels finished

Suggested scope for the polish phase:

1. Review command help text, error copy, and success messages for consistency across `init`, `build`, `query`, `show`, `overview`, `graph`, `mcp`, `hook`, and `gc`
2. Audit output shape and readability for `query`, `show`, `overview`, and `graph`
3. Add smoke tests or snapshot-style verification for user-facing CLI behavior
4. Close documentation mismatches such as the coverage wording difference between `docs/technical*.md` and `docs/testing*.md`
5. Identify rough edges in config flow, incremental build UX, and MCP startup behavior before considering publish

Candidate phase after polish:

1. Architecture visualization, if the product still needs a clearer repository-level view
2. npm publish, once the command surface and UX details are stable

---

# Task: Polish The Current CLI Surface

## Plan

- [ ] Audit and normalize command descriptions, argument names, and error/success copy across `init`, `build`, `query`, `show`, `overview`, `graph`, `mcp`, `hook`, and `gc`
- [ ] Refine user-facing output formatting for `query`, `show`, `overview`, and `graph` so dense repositories remain readable
- [ ] Add automated command-level verification for the uncovered paths: `init`, `build`, `mcp`, and the top-level CLI wiring in `src/cli.ts`
- [ ] Add smoke coverage for failure paths and boundary cases such as empty indexes, invalid graph options, missing files, and hook install/uninstall idempotency
- [ ] Verify MCP startup behavior and tool responses through a realistic stdio flow instead of relying on startup-only checks
- [ ] Resolve documentation drift between architecture/testing docs and actual coverage guarantees, command surface, and manual verification scope
- [ ] Re-run build and targeted tests, then record review notes with any remaining rough edges that should block publish

## Notes

- Priority is detail polish and trust-building for the current surface, not new features and not npm publish
- Existing tests already cover `show`, `overview`, `gc`, `graph`, and `ensureInitialized`, so the biggest gaps are `init`, `build`, `mcp`, CLI wiring, and realistic end-to-end behavior
- `docs/testing.md` still says "All automatable code must achieve 100% test coverage" while also excluding CLI commands and the MCP server, so the coverage story needs one consistent position
- Current command implementations surface a few likely polish targets:
  - `query` mixes summary and symbols into dense single blocks and truncates only in the non-rerank path
  - `overview` dumps every indexed file, which may become noisy on medium or large repositories
  - `graph` accepts parsed depth/format values without user-facing validation
  - `mcp` startup is only lightly exercised even though it is a public integration surface

## Review

- Pending
