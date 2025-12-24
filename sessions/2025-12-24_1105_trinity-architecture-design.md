# Session: Trinity Architecture Design & Session Management

> Date: 2025-12-24 11:05
> Duration: ~2h

## Summary

Completed comprehensive architecture design for Clai, a framework that unifies CLI/MCP/Skill into a single "defineApp" interface. Researched OpenTUI for TUI layer, solved the context-aware inference problem (who calls me, I use their brain), and created session management tooling for conversation continuity.

## What We Did

- **Researched OpenTUI** - Analyzed architecture, component API, and integration feasibility
  - Monorepo structure with React/Solid/Vue reconcilers
  - Rich component library (Text, Box, Input, Select, Slider, Code, Diff, etc.)
  - 60fps rendering with Yoga layout engine
  - **Risk identified**: Zig dependency may increase friction

- **Designed Trinity Architecture** - One app definition, three execution modes
  - CLI mode: direct human interaction
  - MCP mode: AI tool for Claude Code/Desktop
  - Composable mode: apps can import and use other apps

- **Solved Inference Attribution Problem**
  - MCP mode: Zero cost, Claude does all reasoning (~0ms latency)
  - CLI mode: Cascading fallback (Ollama → API Key → Gateway)
  - Unified `ctx.infer()` API with automatic provider detection

- **Standard Schema Integration**
  - Not binding to Zod specifically
  - Supports any Standard Schema compliant library (Zod/Valibot/ArkType/TypeBox)
  - Better ecosystem interoperability

- **Designed Permission System**
  - iOS-style tiered permissions (silent/ask-once/ask-always)
  - Runtime TUI popups for consent
  - Permanent deny list for dangerous commands

- **Distribution Strategy**
  - Go-style URL imports: `clai run github.com/user/repo@v1.2.3`
  - Subresource integrity verification (clai.sum)
  - Vanity URLs support

- **Created Session Management**
  - `/save` command for conversation summaries
  - Standardized filename format: `YYYY-MM-DD_HHmm_<topic>.md`
  - Sessions folder structure for continuity

- **Organized Documentation**
  - Created `docs/` folder
  - `docs/ARCHITECTURE.md` - Complete technical design
  - `docs/ROADMAP.md` - Project phases and goals

## Current State

**Documentation**: Architecture fully documented with:
- Trinity pattern explanation
- `defineApp` API design
- Context-aware inference mechanism
- Permission system design
- Distribution strategy
- MVP sprint plan (14 days)

**Project Structure**:
```
clai/
├── docs/
│   ├── ARCHITECTURE.md   # Complete technical design
│   └── ROADMAP.md        # Project roadmap
├── sessions/
│   └── README.md         # Session management guide
├── .claude/
│   └── commands/
│       └── save.md       # /save command definition
└── src/
    └── index.ts          # Starter template (minimal)
```

**Technology Decisions**:
- Runtime: Bun
- Schema: Standard Schema spec (Zod/Valibot/ArkType)
- TUI: OpenTUI (with simplified wrapper)
- Build: tsdown
- Distribution: GitHub-first + Cloudflare Workers

## Next Steps

- [ ] **Start MVP Implementation** - Begin with `@clai/kit` core
  - [ ] Implement `defineApp` function with Standard Schema support
  - [ ] Create `ctx.infer()` with provider detection
  - [ ] Build minimal `ctx.ui` wrapper around OpenTUI

- [ ] **Resolve OpenTUI Dependency**
  - [ ] Test if Zig pre-compilation is feasible
  - [ ] Investigate fallback to simpler TUI library (Clack)
  - [ ] Create OpenTUI compatibility layer

- [ ] **Permission System PoC**
  - [ ] Implement runtime interception for `fetch`, `shell`, `fs`
  - [ ] Build TUI permission dialog component
  - [ ] Design permission storage format

- [ ] **Distribution PoC**
  - [ ] GitHub URL parser for `github.com/user/repo@version`
  - [ ] Local cache implementation
  - [ ] Basic integrity verification

- [ ] **First Demo App**
  - [ ] Create `examples/weather.ts` using full `defineApp` API
  - [ ] Test in both CLI and MCP modes
  - [ ] Document as reference implementation

## Key Files

- `docs/ARCHITECTURE.md` - Complete technical architecture (Trinity pattern, inference strategy, permission system)
- `docs/ROADMAP.md` - Project phases from MVP to platform
- `.claude/commands/save.md` - Session save command definition
- `sessions/README.md` - Session management guide
- `src/index.ts` - Current starter template (to be replaced with @clai/kit)

## Notes

**Key Architectural Insight**: The "who calls me, I use their brain" principle elegantly solves the cost/latency problem. In MCP mode, Claude has already parsed natural language into structured parameters - we just ride on that for free.

**Standard Schema Benefits**: By not binding to Zod specifically, we open the door to:
- Bundle size optimization (Valibot is 10x smaller)
- Runtime performance (ArkType is fastest)
- Future compatibility (new libraries work automatically)

**OpenTUI Risk**: Zig dependency is the main friction point. Need to:
1. Test if we can bundle pre-compiled binaries
2. Have a fallback plan (Clack or custom renderer)

**Distribution Philosophy**: GitHub-first means instant discoverability. No central registry needed initially. Users can share tools just by sharing URLs.

**Next Session Priority**: Start coding `@clai/kit` core. The architecture is solid - time to build the foundation.
