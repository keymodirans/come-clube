---
phase: 03-installer
plan: 01
subsystem: infra
tags: [ffmpeg, yt-dlp, deno, cross-platform, auto-install]

# Dependency graph
requires:
  - phase: 02-license-config
    provides: config management, logger utilities
provides:
  - FFmpeg auto-installation to ~/.autocliper/bin/
  - yt-dlp auto-installation with version selection
  - Deno detection and optional installation
  - Cross-platform tool status checking
affects: [04-downloader, 05-transcriber, 06-analyzer]

# Tech tracking
tech-stack:
  added: [extract-zip (already in dependencies)]
  patterns: [platform detection, progress callbacks, async download with retry]

key-files:
  created: [src/core/installer.ts]
  modified: [src/commands/init.ts]

key-decisions:
  - "yt-dlp version defaults to 2025.10.22 (no Deno) with option to install Deno for 2025.11.12+"
  - "Platform-specific URLs for FFmpeg from different sources (BtbN, evermeet.cx, johnvansickle.com)"
  - "Manual table display instead of p.table for @clack/prompts compatibility"

patterns-established:
  - "Pattern: Tool installation with ora progress spinners"
  - "Pattern: Version selection based on runtime dependencies (Deno detection)"
  - "Pattern: Cross-platform binary handling (.exe on Windows, +x on Unix)"

# Metrics
duration: 35min
completed: 2026-01-30
---

# Phase 03 Plan 01: External Tools Installer Summary

**Cross-platform auto-installation of FFmpeg, yt-dlp, and Deno with progress display and version selection based on Deno availability**

## Performance

- **Duration:** 35 min
- **Started:** 2026-01-30T00:35:00Z
- **Completed:** 2026-01-30T01:10:00Z
- **Tasks:** 6
- **Files modified:** 2

## Accomplishments

- **FFmpeg auto-installation** for Windows, macOS, and Linux from platform-specific sources
- **yt-dlp auto-installation** with intelligent version selection (2025.10.22 without Deno, 2025.11.12+ with Deno)
- **Deno detection and installation** system for full YouTube support
- **Interactive init command** with status table, progress bars, and user prompts
- **Cross-platform support** for binary execution permissions and file extensions
- **Tool status checking** with version detection for FFmpeg, yt-dlp, and Deno

## Task Commits

Each task was committed atomically:

1. **Task 03-01: Implement external tools installer module** - `9b05e42` (feat)

**Plan metadata:** (to be added after STATE update)

## Files Created/Modified

- `src/core/installer.ts` - Tool installation module with download, extraction, and detection
- `src/commands/init.ts` - Interactive init command with status display and installation flow

## Decisions Made

- **yt-dlp version selection:** Default to 2025.10.22 (last version without Deno requirement) but offer Deno + 2025.11.12+ for full YouTube support
- **FFmpeg sources:** Platform-specific URLs (BtbN for Windows, evermeet.cx for macOS, johnvansickle.com for Linux)
- **Manual table display:** Used string concatenation instead of `p.table` due to @clack/prompts compatibility issues
- **Progress display:** Used ora spinners with percentage updates during downloads
- **Error codes:** E010-E019 for download/install domain errors

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

1. **@clack/prompts p.table() not available** - The `p.table` function was not available in version 0.10.1, replaced with manual table formatting using string concatenation
2. **Template literal syntax error** - Using `yt-dlp` in template literals caused parser issues, fixed by using string concatenation instead
3. **Async function in createProgress** - Required making `createProgress` async to properly import ora dynamically
4. **const to let for needsYtDlp** - Had to change `const needsYtDlp` to `let` because the variable is reassigned in the skip flow
5. **require('fs') in ESM** - Replaced with proper ESM import of `existsSync` from 'fs'

## User Setup Required

None - no external service configuration required. Users run `autocliper init` to install tools.

## Next Phase Readiness

- External tools installer complete and tested
- Ready for Phase 04 (Downloader) which will use yt-dlp for video download
- Ready for Phase 05 (Transcriber) which will use FFmpeg for audio extraction
- Tool detection and fallback logic will allow downloader to work with system-installed tools if local installation fails

---
*Phase: 03-installer*
*Completed: 2026-01-30*
