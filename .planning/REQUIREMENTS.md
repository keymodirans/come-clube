# REQUIREMENTS

## Project Overview

**AutoCliper** is a CLI tool for automatically generating viral short-form video clips (9:16 vertical) from YouTube videos.

---

## Functional Requirements

### FR-001: YouTube Video Download
- Download video from YouTube URL using yt-dlp
- Support standard YouTube URLs and shorts
- Download to temporary location with progress tracking

### FR-002: Audio Extraction
- Extract audio from downloaded video in WAV format using FFmpeg
- Preserve audio quality for transcription accuracy

### FR-003: Transcription
- Transcribe audio using Deepgram Nova-3 API
- Return word-level timestamps
- Support Indonesian and English languages
- Include punctuation and smart formatting

### FR-004: Viral Segment Detection
- Analyze transcript using Gemini API (gemini-2.5-flash)
- Identify segments with viral potential using 3-Act framework
- Return segments with: start, end, hook_text, hook_category, viral_score, confidence

### FR-005: Face Detection
- Detect faces in video segments using MediaPipe
- Determine display mode: CENTER (1 face) or SPLIT (2+ faces)
- Return bounding boxes for split screen positioning

### FR-006: Remotion Props Generation
- Generate JSON props for Remotion renderer
- Include: video source, words, subtitle style, hook text, crop mode

### FR-007: Video Upload & Render Trigger
- Upload source video to temporary storage
- Trigger GitHub Actions workflow via repository_dispatch
- Include render props in workflow payload

### FR-008: Render Polling
- Poll GitHub Actions workflow status every 10 seconds
- Display progress updates to user
- Handle timeout after 30 minutes

### FR-009: Result Download
- Download rendered video from temporary storage
- Handle download errors gracefully

### FR-010: Post-Processing
- Randomize video metadata (software, artist, creation_time)
- Re-encode with FFmpeg (libx264, CRF 23)
- Save to ~/Downloads/autocliper/

---

## Non-Functional Requirements

### NFR-001: License System
- HWID-based device locking using AES-256-CBC encryption
- Config stored in ~/.autocliper/device.lock
- Block execution on device mismatch

### NFR-002: Configuration
- Store API keys in ~/.autocliper/config.json
- Interactive setup via `autocliper config` command

### NFR-003: Cross-Platform
- Support Windows, macOS, Linux
- Use path/os modules for all file operations
- No hardcoded paths

### NFR-004: Error Handling
- All errors use format: `[E###] Description`
- Error code ranges by domain (E001-E009: License, etc.)

### NFR-005: API Dependencies
- Deepgram v4 SDK only (NOT v3)
- @google/genai (NOT @google/generative-ai)
- Node.js >= 20.0.0

### NFR-006: CLI Output
- ASCII only, no emoji
- Use symbols: > (process), + (success), x (error), ! (warning)

---

## Tech Stack

### CLI Application
- Node.js 20+, TypeScript ES2022, NodeNext modules
- Dependencies: commander, @clack/prompts, chalk, ora, cli-progress
- API SDKs: @deepgram/sdk ^4.11.3, @google/genai ^1.38.0
- Video: fluent-ffmpeg, yt-dlp (external binary)

### External Tools
- FFmpeg 7.1 (auto-installed to ~/.autocliper/bin/)
- yt-dlp 2025.01.x (auto-installed)
- Python + MediaPipe (optional, for face detection)

---

## Commands

| Command | Purpose |
|---------|---------|
| `autocliper init` | Install FFmpeg, yt-dlp |
| `autocliper config` | Setup API keys |
| `autocliper run <url>` | Process video and generate clips |
| `autocliper run <url> --max N` | Limit number of segments |
| `autocliper hwid` | Show device ID |

---

## Out of Scope

For v1.0, the following are explicitly out of scope:
- Batch processing (multiple URLs)
- Local rendering option
- Direct upload to TikTok/YouTube
- Custom Remotion templates
- Team license support
