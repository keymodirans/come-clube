# STATE

## Project Status

| Item | Status |
|------|--------|
| Repository | C:/Users/Rekabit/Downloads/cli-cliper |
| GSD | Phase 05 - Transcription Service Complete |
| Last Activity | 2026-01-30 - Completed 05-01-PLAN.md |

---

## Current Position

**Phase:** 05 of 10 (Transcription Service)
**Plan:** 05-01 (Transcription Service - Deepgram Nova-3) - COMPLETE
**Status:** Phase complete
**Progress:** ██████████ 67% (5/6 plans total)

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

### 010: 16kHz Mono Audio for Deepgram
**Date:** 2026-01-30
**Decision:** Audio extraction uses 16kHz sample rate and mono channel
- Deepgram API requires 16kHz for optimal transcription
- PCM 16-bit little-endian codec for WAV compatibility
- Not using 44.1kHz stereo (unnecessary for speech-to-text)

### 011: cli-progress for Progress Tracking
**Date:** 2026-01-30
**Decision:** Use cli-progress library instead of manual implementation
- Already in dependencies from project setup
- ASCII-only format: `[=========>] 45% | 28MB/62MB`
- Spinner class for non-numeric progress

### 012: Exponential Backoff Retry Pattern
**Date:** 2026-01-30
**Decision:** Retry with exponential backoff for network operations
- Formula: min(baseDelayMs * 2^attempt, maxDelayMs)
- Default: 1s, 2s, 4s, 8s, 16s, 30s max
- onRetry callback for logging
- Generic withRetry<T>() function for any async operation

### 013: Temp File Cleanup on Both Paths
**Date:** 2026-01-30
**Decision:** Cleanup temp files on both success and error paths
- Track temp files in array during processing
- Call cleanup() in try block (success) and catch block (error)
- Ignore ENOENT errors in cleanup (file may already be deleted)
- Use os.tmpdir() for cross-platform temp directory

### 014: Deepgram v4 SDK Only
**Date:** 2026-01-30
**Decision:** Use @deepgram/sdk v4 createClient() pattern exclusively
- Import: `import { createClient } from '@deepgram/sdk'`
- FORBIDDEN: v3 `new Deepgram()` pattern (deprecated, EOL August 2025)
- Client: `const deepgram = createClient(apiKey)`
- API: `deepgram.listen.prerecorded.transcribeFile(audioBuffer, options)`

### 015: 16kHz Mono Audio for Deepgram
**Date:** 2026-01-30
**Decision:** Audio extraction uses 16kHz sample rate and mono channel
- Deepgram API requires 16kHz for optimal transcription
- PCM 16-bit little-endian codec for WAV compatibility
- Already configured in Phase 04 audio extraction

### 016: Word-Level Timestamps Required
**Date:** 2026-01-30
**Decision:** Transcription must include word-level timestamps
- Each word has start/end seconds for subtitle sync
- Word interface: word, start, end, confidence, punctuated_word
- Essential for Remotion subtitle synchronization

### 017: Indonesian Default Language
**Date:** 2026-01-30
**Decision:** Primary language set to Indonesian ('id')
- Target audience: Indonesia
- Configurable via preferences.language
- English ('en') also supported

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
- Error codes: E001-E009 (license/HWID), E010-E019 (download/install), E020-E029 (transcription), E030-E039 (analysis)

### Platform Notes
- Windows environment requires PowerShell for npm commands
- Node v24.13.0 in use (newer than required 20.0.0)
- Config stored in ~/.autocliper/device.lock and AppData (conf package default)
- Tools installed to ~/.autocliper/bin/ with platform-specific extensions
- Temp files created in os.tmpdir() (platform-specific temp directory)

### Tool Installation
- FFmpeg 7.1 auto-installed from platform-specific sources
- yt-dlp 2025.10.22 (no Deno) or 2025.11.12+ (with Deno)
- Deno optional but recommended for full YouTube support
- Download progress displayed via cli-progress bars
- Executable permissions set automatically on Unix

### Video Processing
- YouTube download via yt-dlp with progress tracking
- Audio extraction to WAV (16kHz mono) for Deepgram
- FFmpeg used for audio extraction with pcm_s16le codec
- Deepgram Nova-3 transcription with word-level timestamps
- TranscriptResult: transcript, words array, duration, language
- Retry logic with exponential backoff for network operations
- Temp file cleanup on success/error paths

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

**Last Session:** 2026-01-30 02:55 UTC
**Stopped At:** Completed 05-01-PLAN.md (Transcription Service)
**Resume File:** None (ready for next plan)

---

## Completed Phases

| Phase | Plan | Name | Summary |
|-------|------|------|---------|
| 01 | 01 | Project Foundation | .planning/phases/01-foundation/01-01-SUMMARY.md |
| 02 | 01 | License & Config System | .planning/phases/02-license-config/02-01-SUMMARY.md |
| 03 | 01 | External Tools Installer | .planning/phases/03-installer/03-01-SUMMARY.md |
| 04 | 01 | Video Pipeline (Download + Audio) | .planning/phases/04-video-pipeline/04-01-SUMMARY.md |
| 05 | 01 | Transcription Service | .planning/phases/05-transcription/05-01-SUMMARY.md |
