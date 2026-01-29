# STATE

## Project Status

| Item | Status |
|------|--------|
| Repository | C:/Users/Rekabit/Downloads/cli-cliper |
| GSD | Phase 11 - Build & Packaging Complete |
| Last Activity | 2026-01-30 - Completed 11-PLAN.md |

---

## Current Position

**Phase:** 11 of 11 (Build & Packaging)
**Plan:** 11-01 (Build & Packaging) - COMPLETE
**Status:** ALL PHASES COMPLETE
**Progress:** ██████████ 100% (11/11 plans total)

---

## Decisions Made

### 001: Architecture Confirmation
**Date:** 2025-01-30
**Decision:** Hybrid local-cloud architecture confirmed
- Local CLI handles download, transcription, analysis, face detection
- Cloud rendering via GitHub Actions + Remotion
- Separation allows local processing without heavy GPU requirements

### 002: Dependency Lock
**Date:** 2025-01-30
**Decision:** Locked versions enforced
- @deepgram/sdk ^4.11.3 (v4 only)
- @google/genai ^1.38.0 (NOT @google/generative-ai)
- Remotion 4.0.57
- MediaPipe (optional, via pip)

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

### 018: Gemini AI Viral Analysis with 3-Act Framework
**Date:** 2026-01-30
**Decision:** Viral segment detection using gemini-2.5-flash with 3-Act framework
- HOOK (0-3s): Pattern interrupt to stop scroll
- TENSION (3-25s): Build curiosity and emotional investment
- PAYOFF (end): Satisfying conclusion or revelation
- 6 hook categories: CURIOSITY, CONTROVERSY, RELATABILITY, SHOCK, STORY, CHALLENGE
- Viral scores 0-100 with confidence levels (HIGH/MEDIUM/LOW)
- Timestamps embedded every 30 words for segment localization
- Temperature 0.3, topP 0.8 for consistent detection

### 019: file.io for Temporary File Storage
**Date:** 2026-01-30
**Decision:** Use file.io API for temporary video hosting
- 100 files/day free tier with no authentication required
- Returns direct download URL for GitHub Actions renderer
- Automatic expiration (1 day default) for storage efficiency
- Multipart form data upload with Buffer concatenation for binary data

### 020: Remotion Props Schema Definition
**Date:** 2026-01-30
**Decision:** Remotion props structure with TypeScript interfaces
- SegmentProps: id, fps (30), dimensions (1080x1920), durationInFrames
- videoSrc: download URL from file.io after upload
- videoStartTime: segment start time in seconds
- cropMode: CENTER (single face) or SPLIT (multiple faces)
- words: PropWord[] with punctuated_word, start, end for subtitles
- SubtitleStyle: Montserrat font, 48px, bold, white with yellow highlight
- HookStyle: 90 frames (3 seconds), top overlay with semi-transparent background

### 021: Error Codes [E040-E049] for Storage Operations
**Date:** 2026-01-30
**Decision:** Storage-specific error code range
- E040: File not found / Upload failed
- E041: Invalid response from storage service
- E042: File size exceeds maximum (500MB)
- E043: Upload timed out
- Retry logic with exponential backoff for transient failures

### 022: Props Debug Output to Temp Directory
**Date:** 2026-01-30
**Decision:** Save props JSON to os.tmpdir()/autocliper-debug/ for debugging
- Filename: props-{timestamp}.json
- Allows inspection of Remotion props before rendering
- Useful for troubleshooting subtitle sync and crop configuration

### 023: Face Detection Never Blocks Pipeline
**Date:** 2026-01-29
**Decision:** Face detection errors must fall back to CENTER mode
- AutoCliper should work even without Python/MediaPipe
- All error paths return fallback CENTER results
- Users see warning but processing continues

### 024: Five-Frame Sampling for Face Detection
**Date:** 2026-01-29
**Decision:** Sample 5 frames evenly distributed per segment
- Balances accuracy with performance
- Too few samples may miss faces; too many slows processing
- Interval = total_frames / 5, sample at start + interval * i

### 025: Relative Bounding Box Coordinates
**Date:** 2026-01-29
**Decision:** Use relative coordinates (0-1) for bounding boxes
- Resolution-agnostic, works with any video format
- MediaPipe provides relative coordinates natively
- Used by Remotion for split-screen cropping

### 026: MediaPipe Optional Installation
**Date:** 2026-01-29
**Decision:** MediaPipe is optional, not required
- Reduces setup friction
- Users can enable later if needed
- autocliper init prompts for MediaPipe but allows skipping

### 027: Multi-Command Python Detection
**Date:** 2026-01-29
**Decision:** Try multiple Python commands (python, python3, py)
- Cross-platform compatibility
- Windows uses `py`, Unix uses `python3`
- Loop through commands, use first that succeeds

### 028: GitHub Actions Polling Interval
**Date:** 2026-01-30
**Decision:** 10-second polling interval for workflow status checks
- Balances API rate limits (5000 requests/hour)
- Provides reasonably responsive progress updates
- Sufficient for render workflows that take 2-10 minutes

### 029: GitHub Actions Timeout
**Date:** 2026-01-30
**Decision:** 30-minute timeout for workflow polling
- Sufficient for rendering multiple 3-minute clips at 1080p
- GitHub Actions has 6-hour job timeout, 30min is conservative
- Prevents indefinite hangs on workflow failures

### 030: Concurrent Job Limit
**Date:** 2026-01-30
**Decision:** Limit to 2 concurrent render jobs
- Matches GitHub Actions free tier limit (20 concurrent jobs total)
- Additional jobs queue until active jobs complete
- Prevents API rate limit issues

### 031: GitHub Error Code Range [E060-E069]
**Date:** 2026-01-30
**Decision:** Dedicated error code range for GitHub Actions
- E060: Failed to trigger workflow
- E061: Workflow run not found
- E062: Render timeout exceeded
- E063: Invalid GitHub configuration
- E064: GitHub API error
- E065: Artifact not found
- E066: Artifact download failed
- E067: Artifact extraction failed

### 032: Post-Processing Error Code Range [E070-E079]
**Date:** 2026-01-30
**Decision:** Dedicated error code range for post-processing operations
- E070: Artifact download failed
- E071: Invalid artifact URL
- E072: Output directory creation failed
- E073: FFmpeg re-encoding failed
- E074: Input file not found
- E075: File size exceeds maximum
- E076: Download timeout
- E077: Artifact extraction failed

### 033: Fixed Output Directory
**Date:** 2026-01-30
**Decision:** Output folder is permanently fixed to ~/Downloads/autocliper/
- Never change this location (documented in CLAUDE.md)
- Creates directory if missing
- Cross-platform using os.homedir() + path.join()

### 034: Metadata Randomization for Platform Detection Avoidance
**Date:** 2026-01-30
**Decision:** Randomize video metadata to prevent platform algorithmic detection
- Random software name (Adobe Premiere Pro, DaVinci Resolve, etc.)
- Random artist name (Content Creator, Video Editor, etc.)
- Random creation_time within past year
- Strip existing metadata with -map_metadata -1

### 035: FFmpeg Re-encoding Settings
**Date:** 2026-01-30
**Decision:** Standardized FFmpeg settings for post-processing
- libx264 video codec with preset medium
- CRF 23 for good quality at reasonable size
- AAC audio at 128k bitrate
- +faststart for web playback optimization

### 036: ESM-First Distribution Strategy
**Date:** 2026-01-30
**Decision:** Use ESM as primary distribution format, acknowledge pkg limitations
- Node.js >=20 is required engine, ESM is the future
- pkg does not support Node.js 18+ or ESM properly
- CommonJS transpilation adds complexity and loses some ESM features
- npm handles all dependencies correctly when users `npm install -g`
- Users must have Node.js installed (no true standalone binaries)

### 037: String Concatenation for Prompt Templates
**Date:** 2026-01-30
**Decision:** Use string concatenation instead of template literals for prompts
- Template literals evaluate placeholders at module load time
- String concatenation defers evaluation to runtime when `.replace()` is called
- Required for dynamic prompt generation with runtime values

### 038: Build & Packaging Error Code Range [E080-E089]
**Date:** 2026-01-30
**Decision:** Dedicated error code range for build and packaging operations
- E080: Build failed - TypeScript compilation error
- E081: Build failed - Bundler error
- E082: Package failed - pkg error
- E083: Package failed - Native module incompatible
- E084: Package failed - Asset bundling error
- E085: Distribution failed - Release creation error

### 039: pkg Tool Limitations Documented
**Date:** 2026-01-30
**Decision:** Document known limitations with pkg for future resolution
- pkg v5.8.1 does not support Node.js 18+ (only up to node16)
- pkg cannot handle ESM modules with import.meta properly
- pkg fails bundling native dependencies (node:sqlite in conf package)
- Workaround: Use npm distribution instead of standalone binaries
- Future options: nexe with --build, switch config package, use alternative bundlers

---

## Context Notes

### Critical Constraints
1. NEVER use @google/generative-ai (deprecated, EOL August 2025)
2. NEVER use Deepgram v3 SDK
3. ALWAYS use ESM imports (no CommonJS require unless using createRequire)
4. ALWAYS use cross-platform paths (path + os modules)
5. Output folder is FIXED: ~/Downloads/autocliper/
6. HWID must NEVER be logged to console
7. Face detection is OPTIONAL - fallback to CENTER mode

### Code Style
- TypeScript strict mode enabled
- Target ES2022, Module NodeNext
- Error format: [E###] Description
- CLI output: ASCII only, no emoji
- Error codes: E001-E009 (license/HWID), E010-E019 (download/install), E020-E029 (transcription), E030-E039 (analysis), E040-E049 (face detection), E050-E059 (props), E060-E069 (GitHub Actions), E070-E079 (post-process), E080-E089 (build/packaging)

### Platform Notes
- Windows environment requires PowerShell for npm commands
- Node v24.13.0 in use (newer than required 20.0.0)
- Config stored in ~/.autocliper/device.lock and AppData (conf package default)
- Tools installed to ~/.autocliper/bin/ with platform-specific extensions
- Temp files created in os.tmpdir() (platform-specific temp directory)
- Python commands: `python`, `python3`, `py` (platform-dependent)

### Tool Installation
- FFmpeg 7.1 auto-installed from platform-specific sources
- yt-dlp 2025.10.22 (no Deno) or 2025.11.12+ (with Deno)
- Deno optional but recommended for full YouTube support
- MediaPipe optional (pip install mediapipe opencv-python)
- Download progress displayed via cli-progress bars
- Executable permissions set automatically on Unix

### Video Processing
- YouTube download via yt-dlp with progress tracking
- Audio extraction to WAV (16kHz mono) for Deepgram
- FFmpeg used for audio extraction with pcm_s16le codec
- Deepgram Nova-3 transcription with word-level timestamps
- TranscriptResult: transcript, words array, duration, language
- Gemini AI viral analysis with 3-Act framework
- ViralSegment: rank, timestamps (HH:MM:SS), hook_category, viral_score, confidence
- Face detection via Python + MediaPipe (optional)
- CENTER mode: 1 face, SPLIT mode: 2+ faces with bounding boxes
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
- **Python Requirement**: Face detection requires Python + MediaPipe (optional feature)
- **pkg ESM Limitations**: pkg cannot properly package ESM modules with import.meta, affects standalone binary creation
- **Native Module Bundling**: conf package uses node:sqlite which pkg cannot bundle

---

## Session Continuity

**Last Session:** 2026-01-30 03:30 UTC
**Stopped At:** Completed 11-PLAN.md (Build & Packaging)
**Resume File:** None (ALL PHASES COMPLETE)

---

## Completed Phases

| Phase | Plan | Name | Summary |
|-------|------|------|---------|
| 01 | 01 | Project Foundation | .planning/phases/01-foundation/01-01-SUMMARY.md |
| 02 | 01 | License & Config System | .planning/phases/02-license-config/02-01-SUMMARY.md |
| 03 | 01 | External Tools Installer | .planning/phases/03-installer/03-01-SUMMARY.md |
| 04 | 01 | Video Pipeline (Download + Audio) | .planning/phases/04-video-pipeline/04-01-SUMMARY.md |
| 05 | 01 | Transcription Service | .planning/phases/05-transcription/05-01-SUMMARY.md |
| 06 | 06 | Viral Analysis | .planning/phases/06-viral-analysis/06-SUMMARY.md |
| 07 | 07 | Face Detection | .planning/phases/07-face-detection/07-07-SUMMARY.md |
| 08 | 08 | Props Generation | .planning/phases/08-props-generation/08-08-SUMMARY.md |
| 09 | 09 | GitHub Integration | .planning/phases/09-github-integration/09-09-SUMMARY.md |
| 10 | 10 | Post-Processing | .planning/phases/10-post-processing/10-SUMMARY.md |
| 11 | 01 | Build & Packaging | .planning/phases/11-build-packaging/11-01-SUMMARY.md |
