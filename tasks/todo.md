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
