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

- Recommended next phase: P2.1 npm publish hardening
- Reason 1: README already advertises `npm install -g kly`, so publishing is the shortest path to making the current feature set actually consumable
- Reason 2: Core indexing, query, graph, overview, rerank, and MCP features are already implemented and covered in tests; the main gap is shipping confidence, not feature breadth
- Reason 3: Architecture visualization is valuable, but its user value is lower than making the existing CLI installable and releasable

Proposed execution order:

1. Add release-readiness work for npm publish
2. Add smoke coverage for CLI and MCP entrypoints
3. Add architecture visualization after release flow is stable

Suggested scope for P2.1:

1. Complete package metadata (`repository`, `homepage`, `bugs`, `keywords`, engine expectations)
2. Add a documented release checklist and versioning flow
3. Add automated smoke tests for `kly --help`, `kly mcp`, and one end-to-end happy path
4. Validate install/build behavior from a packed tarball before first publish

Suggested scope for P2.2:

1. Define what “architecture visualization” means beyond the current file import graph
2. Prefer module/package-level dependency views instead of another file-level graph
3. Reuse the existing Mermaid rendering pipeline where possible
