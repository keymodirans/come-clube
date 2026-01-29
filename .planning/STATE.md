# STATE

## Project Status

| Item | Status |
|------|--------|
| Repository | C:/Users/Rekabit/Downloads/cli-cliper |
| GSD | Phase 03 - External Tools Installer Complete |
| Last Activity | 2026-01-30 - Completed 03-01-PLAN.md |

---

## Current Position

**Phase:** 03 of [unknown] (External Tools Installer)
**Plan:** 03-01 (External Tools Installer) - COMPLETE
**Status:** Phase complete
**Progress:** ████████░░ 40% (3/6 plans total)

---

## Decisions Made

### 001: Architecture Confirmation
**Date:** 2025-01-30
**Decision:** Hybrid local-cloud architecture confirmed
- Local CLI handles download, transcription, analysis
- Cloud rendering via GitHub Actions + Remotion
- Separation allows local processing without heavy GPU requirements

### 002: Dependency Lock
**Date:** 2025-01-30
**Decision:** Locked versions enforced
- @deepgram/sdk ^4.11.3 (v4 only)
- @google/genai ^1.38.0 (NOT @google/generative-ai)
- Remotion 4.0.57

### 003: License System
**Date:** 2025-01-30
**Decision:** HWID-based device locking
- AES-256-CBC encryption
- Stored in ~/.autocliper/device.lock
- Auto-lock on first run

### 004: PowerShell Required for Build on Windows
**Date:** 2026-01-30
**Decision:** Use PowerShell for running npm commands on Windows
- Git Bash cannot execute npm.cmd directly
- Use: `powershell.exe -Command "npm <command>"`
- Consider cross-platform npm runner alternative

### 005: ESM CommonJS Interop Pattern
**Date:** 2026-01-29
**Decision:** Use createRequire for CommonJS packages in ESM
- node-machine-id is CommonJS only
- Pattern: `const require = createRequire(import.meta.url)`
- Needed for any CommonJS dependencies in ESM project

### 006: License Validation Bypass
**Date:** 2026-01-29
**Decision:** Config and hwid commands bypass device validation
- Allows recovery on device mismatch
- Users can view device ID and reconfigure without valid license
- PreAction hook with bypass list pattern

### 007: yt-dlp Version Selection Strategy
**Date:** 2026-01-30
**Decision:** yt-dlp defaults to 2025.10.22 (no Deno required)
- yt-dlp 2025.11.12+ requires Deno for full YouTube support
- Auto-detect Deno and offer version choice to user
- Options: Install Deno + latest, use 2025.10.22, or skip
- Version override via config.set('tools.ytdlp_version')

### 008: Platform-Specific FFmpeg Sources
**Date:** 2026-01-30
**Decision:** Different FFmpeg sources per platform
- Windows: github.com/BtbN/FFmpeg-Builds (win64-gpl.zip)
- macOS: evermeet.cx/ffmpeg (single binary in zip)
- Linux: johnvansickle.com/ffmpeg (release-amd64-static.tar.xz)
- Extract and find binary in extracted files

### 009: clack/prompts Table Compatibility
**Date:** 2026-01-30
**Decision:** Manual table formatting instead of p.table()
- @clack/prompts 0.10.1 does not have p.table function
- Use string concatenation for table display
- Consider upgrading to latest version for table support

---

## Context Notes

### Critical Constraints
1. NEVER use @google/generative-ai (deprecated, EOL August 2025)
2. NEVER use Deepgram v3 SDK
3. ALWAYS use ESM imports (no CommonJS require unless using createRequire)
4. ALWAYS use cross-platform paths (path + os modules)
5. Output folder is FIXED: ~/Downloads/autocliper/
6. HWID must NEVER be logged to console

### Code Style
- TypeScript strict mode enabled
- Target ES2022, Module NodeNext
- Error format: [E###] Description
- CLI output: ASCII only, no emoji
- Error codes: E001-E009 (license/HWID), E010-E019 (download/install), E020-E029 (transcription)

### Platform Notes
- Windows environment requires PowerShell for npm commands
- Node v24.13.0 in use (newer than required 20.0.0)
- Config stored in ~/.autocliper/device.lock and AppData (conf package default)
- Tools installed to ~/.autocliper/bin/ with platform-specific extensions

### Tool Installation
- FFmpeg 7.1 auto-installed from platform-specific sources
- yt-dlp 2025.10.22 (no Deno) or 2025.11.12+ (with Deno)
- Deno optional but recommended for full YouTube support
- Download progress displayed via ora spinners
- Executable permissions set automatically on Unix

---

## Blockers & Concerns

### Blockers
None

### Concerns
- **Node Version**: Running v24.13.0 vs required 20.0.0 - verify before production
- **PowerShell Dependency**: Windows builds require PowerShell wrapper - document or find alternative
- **Config Location**: conf package stores config.json in AppData instead of ~/.autocliper/ (acceptable but inconsistent)
- **clack/prompts version**: Using 0.10.1 which lacks p.table() - consider upgrade

---

## Session Continuity

**Last Session:** 2026-01-30 01:10 UTC
**Stopped At:** Completed 03-01-PLAN.md (External Tools Installer)
**Resume File:** None (ready for next plan)

---

## Completed Phases

| Phase | Plan | Name | Summary |
|-------|------|------|---------|
| 01 | 01 | Project Foundation | .planning/phases/01-foundation/01-01-SUMMARY.md |
| 02 | 01 | License & Config System | .planning/phases/02-license-config/02-01-SUMMARY.md |
| 03 | 01 | External Tools Installer | .planning/phases/03-installer/03-01-SUMMARY.md |
