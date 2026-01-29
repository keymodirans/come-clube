# STATE

## Project Status

| Item | Status |
|------|--------|
| Repository | C:/Users/Rekabit/Downloads/cli-cliper |
| GSD | Phase 02 - License & Config Complete |
| Last Activity | 2026-01-29 - Completed 02-01-PLAN.md |

---

## Current Position

**Phase:** 02 of [unknown] (License & Config)
**Plan:** 02-01 (License & Config System) - COMPLETE
**Status:** Phase complete
**Progress:** ██████░░░░ 30% (2/6 plans total)

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
- Error codes: E001-E009 (license/HWID), E010-E019 (download), E020-E029 (transcription)

### Platform Notes
- Windows environment requires PowerShell for npm commands
- Node v24.13.0 in use (newer than required 20.0.0)
- Config stored in ~/.autocliper/device.lock and AppData (conf package default)

---

## Blockers & Concerns

### Blockers
None

### Concerns
- **Node Version**: Running v24.13.0 vs required 20.0.0 - verify before production
- **PowerShell Dependency**: Windows builds require PowerShell wrapper - document or find alternative
- **Config Location**: conf package stores config.json in AppData instead of ~/.autocliper/ (acceptable but inconsistent)

---

## Session Continuity

**Last Session:** 2026-01-29 19:46 UTC
**Stopped At:** Completed 02-01-PLAN.md (License & Config System)
**Resume File:** None (ready for next plan)

---

## Completed Phases

| Phase | Plan | Name | Summary |
|-------|------|------|---------|
| 01 | 01 | Project Foundation | .planning/phases/01-foundation/01-01-SUMMARY.md |
| 02 | 01 | License & Config System | .planning/phases/02-license-config/02-01-SUMMARY.md |
