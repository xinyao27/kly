# Session Save Command

Save the current session summary to `sessions/` folder for future reference.

## Instructions

1. **Analyze the current conversation** and extract:
   - What was discussed and decided
   - What was implemented or changed
   - Current progress status
   - Next steps planned

2. **Generate filename** using format: `YYYY-MM-DD_HHmm_<topic>.md`
   - Use current timestamp
   - Topic should be 2-4 words, lowercase, hyphen-separated
   - Example: `2024-12-24_1130_architecture-design.md`

3. **Write session file** to `sessions/` with this structure:

```markdown
# Session: <Topic Title>

> Date: YYYY-MM-DD HH:mm
> Duration: ~Xh (estimate based on conversation length)

## Summary

Brief 2-3 sentence overview of what this session accomplished.

## What We Did

- Bullet points of key activities
- Decisions made
- Code/docs created or modified

## Current State

Description of where the project stands now. What's working, what exists.

## Next Steps

- [ ] Actionable items for next session
- [ ] Questions to resolve
- [ ] Features to implement

## Key Files

- `path/to/file.ts` - brief description
- `path/to/another.md` - brief description

## Notes

Any additional context, ideas, or things to remember.
```

4. **Confirm** by showing the created filename and a brief summary.

## Usage

User triggers `/save` at the end of a session. Claude analyzes the conversation and creates the session file automatically.
