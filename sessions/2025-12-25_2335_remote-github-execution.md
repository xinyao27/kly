# Session: Remote GitHub Execution

> Date: 2025-12-25 23:35
> Duration: ~1.5h

## Summary

Implemented `kly run user/repo` functionality to run GitHub repositories as kly apps. The feature supports git clone with caching, automatic entry point resolution, and dependency installation via bun.

## What We Did

- Designed package.json schema for kly apps (`main` for entry, `kly.version` for compatibility, `kly.env` for required env vars)
- Created `src/remote/` module with 6 files:
  - `types.ts` - Type definitions (RepoRef, CacheMetadata, KlyConfig, etc.)
  - `parser.ts` - URL parsing for various formats (user/repo, @version, @branch)
  - `cache.ts` - Cache management (~/.kly/cache/)
  - `fetcher.ts` - Git clone (shallow) + bun install
  - `resolver.ts` - Entry point resolution + version validation
  - `index.ts` - Main runRemote() API
- Updated `bin/kly.ts` to detect remote refs vs local files
- Added 62 unit tests for parser and resolver
- Fixed edge case: `.git` suffix with `@ref` (e.g., `user/repo.git@v1.0.0`)
- Tested successfully with `xinyao27/up` repo (works without kly adaptation!)

## Current State

Remote execution is fully functional:
```bash
kly run user/repo              # main branch
kly run user/repo@v1.0.0       # specific tag
kly run user/repo@branch       # specific branch
kly run user/repo --force      # force refresh cache
kly run user/repo -- --arg     # pass args to app
```

Cache stored at `~/.kly/cache/github.com/user/repo/ref/`

Key insight: Any TypeScript CLI project can run without `defineApp` adaptation - just needs a valid entry point.

## Next Steps

- [ ] Implement MCP adapter (Claude Desktop/Code integration)
- [ ] Write README documentation
- [ ] Implement `ctx.infer` for AI parameter parsing
- [ ] Add permission system (Phase 2)
- [ ] Consider esm.sh approach for faster execution (explored but deferred)
- [ ] Prepare v0.1.0 release

## Key Files

- `src/remote/index.ts` - Main runRemote() orchestration
- `src/remote/parser.ts` - URL parsing with isRemoteRef()
- `src/remote/cache.ts` - Cache validation and metadata
- `src/remote/fetcher.ts` - Git clone + bun install
- `src/remote/resolver.ts` - Entry resolution + version check
- `src/remote/__tests__/parser.test.ts` - 50+ parser tests
- `src/remote/__tests__/resolver.test.ts` - Version validation tests
- `bin/kly.ts` - Updated CLI with remote support

## Notes

- Explored esm.sh for CDN-based execution but Bun doesn't support https imports natively
- Git clone approach is more reliable and handles all import patterns
- Entry resolution order: `main` field → `index.ts` → `main.ts` → `src/index.ts` → `app.ts`
- Cache includes commit SHA for potential future cache invalidation
