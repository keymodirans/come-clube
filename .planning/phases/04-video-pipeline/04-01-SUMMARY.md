---
phase: 04-video-pipeline
plan: 01
subsystem: video-processing
tags: [yt-dlp, ffmpeg, retry, progress, audio-extraction, download]

# Dependency graph
requires:
  - phase: 03-installer
    provides: FFmpeg and yt-dlp auto-installation to ~/.autocliper/bin/
provides:
  - Video download from YouTube URLs using yt-dlp
  - Audio extraction to WAV format (16kHz mono) for Deepgram
  - Retry utility with exponential backoff for API calls
  - Progress tracking utilities for CLI operations
  - Temp file cleanup on success/error
affects: [05-transcription, 06-analysis, 07-rendering]

# Tech tracking
tech-stack:
  added: [cli-progress]
  patterns: [exponential-backoff-retry, progress-bar-tracking, temp-file-cleanup]

key-files:
  created: [src/utils/retry.ts, src/utils/progress.ts, src/core/downloader.ts]
  modified: [src/commands/run.ts]

key-decisions:
  - "Used cli-progress for download progress bars instead of manual implementation"
  - "16kHz mono WAV output for Deepgram compatibility (not 44.1kHz stereo)"
  - "Separate downloadVideo() and extractAudio() functions for modularity"
  - "Temp files tracked in array and cleaned up on both success and error paths"

patterns-established:
  - "Pattern: Retry with withRetry<T>() generic function"
  - "Pattern: Progress bars using cli-progress with ASCII format"
  - "Pattern: Temp file generation with timestamp and random suffix"
  - "Pattern: Cleanup function that ignores ENOENT errors"

# Metrics
duration: 15min
completed: 2026-01-30
---

# Phase 04 Plan 01: Video Pipeline (Download + Audio) Summary

**YouTube video download with yt-dlp, FFmpeg audio extraction to 16kHz mono WAV, exponential backoff retry logic, and progress tracking utilities**

## Performance

- **Duration:** 15 min
- **Started:** 2026-01-30T02:46:27Z
- **Completed:** 2026-01-30T03:01:00Z
- **Tasks:** 8
- **Files modified:** 4

## Accomplishments

- Created retry utility with exponential backoff (baseDelay * 2^attempt, max 30s)
- Created progress bar utility using cli-progress with ASCII-only output
- Created downloader module with YouTube URL validation and download progress parsing
- Integrated video download and audio extraction into run command
- Implemented temp file cleanup on both success and error paths
- All error codes in E010-E019 range for download domain

## Task Commits

Each task was committed atomically:

1. **Task 1-8: Retry utility, progress utility, and downloader module** - `3d0891e` (feat)
2. **Task 1-8: Run command integration** - `1838378` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

### Created
- `src/utils/retry.ts` - Exponential backoff retry with withRetry<T>() generic and retryApi wrapper
- `src/utils/progress.ts` - CLI progress bars using cli-progress, Spinner class for operations
- `src/core/downloader.ts` - YouTube video download (yt-dlp), audio extraction (FFmpeg), URL validation

### Modified
- `src/commands/run.ts` - Integrated downloadVideo() and extractAudio() with retry logic and cleanup

## Decisions Made

1. **16kHz mono for Deepgram** - Used 16kHz sample rate and mono channel instead of 44.1kHz stereo for Deepgram API compatibility
2. **cli-progress library** - Used existing cli-progress dependency instead of manual progress implementation for cleaner code
3. **Separate functions** - Split downloadVideo() and extractAudio() for modularity and testing, rather than single combined function
4. **Temp file in os.tmpdir()** - Used system temp directory instead of ~/.autocliper/temp for better cross-platform behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues. Build passed successfully with tsup.

## User Setup Required

None - no external service configuration required for this phase.

## Next Phase Readiness

### Ready for Phase 05 (Transcription)
- Audio extraction produces WAV files in Deepgram-compatible format (16kHz mono)
- Temp file cleanup prevents disk space issues
- Retry logic handles transient network failures during download

### Integration points for next phase
- Phase 05 will use `audioResult.audioPath` from download result
- Should call `cleanup()` after Deepgram transcription completes
- May extend retry utility for Deepgram API calls

### Blockers/concerns
- None identified

---
*Phase: 04-video-pipeline*
*Completed: 2026-01-30*
