# ROADMAP

## AutoCliper v1.0 Implementation

---

## Phase 01: Project Foundation

Initialize the project structure, configuration, and build system.

**Goal:** Establish project scaffolding with TypeScript, build tools, and basic CLI structure.

**Deliverables:**
- package.json with all dependencies
- tsconfig.json with strict settings
- Directory structure (src/, bin/, scripts/)
- Basic CLI entry point with commander

---

## Phase 02: License & Config System

Implement HWID-based licensing and configuration management.

**Goal:** Device locking and secure API key storage.

**Deliverables:**
- HWID generation and encryption (src/license/hwid.ts)
- Device validation (src/license/validator.ts)
- Config management with conf package (src/utils/config.ts)
- init and config commands

---

## Phase 03: External Tools Installer

Auto-install FFmpeg and yt-dlp to ~/.autocliper/bin/.

**Goal:** Seamless external tool setup across platforms.

**Deliverables:**
- Platform-specific download logic (src/core/installer.ts)
- FFmpeg download and extraction
- yt-dlp download
- Binaries stored in ~/.autocliper/bin/
- init command integration

---

## Phase 04: Video Pipeline (Download + Audio)

Implement video download and audio extraction.

**Goal:** Download YouTube videos and extract audio for transcription.

**Deliverables:**
- yt-dlp wrapper (src/core/downloader.ts)
- FFmpeg audio extraction
- Progress tracking with cli-progress
- Temporary file management

---

## Phase 05: Transcription Service

Deepgram integration for speech-to-text with word timestamps.

**Goal:** Transcribe audio with word-level timing data.

**Deliverables:**
- Deepgram v4 SDK integration (src/core/transcriber.ts)
- Word interface and TranscriptResult
- Error handling with [E02x] codes
- Retry logic with exponential backoff

---

## Phase 06: Viral Analysis Service

Gemini integration for viral segment detection.

**Goal:** Identify high-potential clips using AI analysis.

**Deliverables:**
- Gemini API integration (src/core/analyzer.ts)
- 3-Act framework prompt template
- ViralSegment interface
- JSON response parsing
- Hook category classification

---

## Phase 07: Face Detection

Python + Node.js hybrid for face counting and mode determination.

**Goal:** Determine CENTER vs SPLIT screen mode.

**Deliverables:**
- Python MediaPipe script (scripts/face_detector.py)
- Node.js wrapper (src/core/faceDetector.ts)
- Fallback to CENTER on Python unavailable
- Bounding box extraction for split screen

---

## Phase 08: Props Builder & Storage

Generate Remotion props and handle file uploads.

**Goal:** Prepare render data and upload to temporary storage.

**Deliverables:**
- Remotion props builder (src/core/propsBuilder.ts)
- Storage service (src/services/storage.ts)
- Props schema validation
- File upload to temp storage (file.io)

---

## Phase 09: GitHub Actions Integration

Trigger cloud rendering and poll for completion.

**Goal:** Orchestrate remote video rendering.

**Deliverables:**
- GitHubService class (src/services/github.ts)
- repository_dispatch trigger
- Workflow status polling
- 30-minute timeout handling

---

## Phase 10: Post-Processing & Main Pipeline

Download results, apply metadata randomization, and wire everything together.

**Goal:** Complete end-to-end video generation flow.

**Deliverables:**
- Post-processing service (src/services/postProcess.ts)
- Main run command orchestration (src/commands/run.ts)
- Output to ~/Downloads/autocliper/
- Progress display and error recovery

---

## Phase 11: Build & Packaging

Create standalone binaries for distribution.

**Goal:** Distributable executables for Win/Mac/Linux.

**Deliverables:**
- tsup configuration
- pkg packaging setup
- Binary build scripts
- Distribution files

---

## Legend

| Symbol | Meaning |
|--------|---------|
| \u25cb | Pending |
| \u25c6 | In Progress |
| \u2713 | Complete |

---

## Progress Summary

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 01 | Project Foundation | \u2713 | 100% |
| 02 | License & Config | \u25cb | 0% |
| 03 | External Tools Installer | \u25cb | 0% |
| 04 | Video Pipeline | \u25cb | 0% |
| 05 | Transcription Service | \u25cb | 0% |
| 06 | Viral Analysis Service | \u25cb | 0% |
| 07 | Face Detection | \u25cb | 0% |
| 08: Props Builder & Storage | \u25cb | 0% |
| 09: GitHub Actions Integration | \u25cb | 0% |
| 10: Post-Processing & Pipeline | \u25cb | 0% |
| 11: Build & Packaging | \u25cb | 0% |
