# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**AutoCliper** is a CLI tool for automatically generating viral short-form video clips (9:16 vertical) from YouTube videos. The project consists of two separate repositories:

1. **CLI Application** (this repo) - Node.js/TypeScript CLI for local processing
2. **autocliper-renderer** (separate repo) - Remotion-based video renderer deployed via GitHub Actions

---

## Architecture: Hybrid Local-Cloud Processing

```
[LOCAL CLI]
    |
    +-- yt-dlp: Download video
    +-- FFmpeg: Extract audio (WAV)
    +-- Deepgram API: Transcription + word timestamps
    +-- Gemini API: Viral segment detection
    +-- FFmpeg: Extract sample frames per segment
    +-- Face count analysis (simple heuristic)
    +-- Generate Remotion props JSON
    +-- Upload source video to temp storage
    +-- Trigger GitHub Actions
    |
    v
[GITHUB ACTIONS]
    |
    +-- Download source video
    +-- Render with Remotion
    +-- Upload result to temp storage
    +-- Webhook callback
    |
    v
[LOCAL CLI]
    |
    +-- Download rendered video
    +-- Post-process (metadata randomization)
    +-- Save to ~/Downloads/autocliper/
```

---

## Tech Stack (Locked Versions)

### CLI Application

```json
{
  "engines": { "node": ">=20.0.0" },
  "type": "module",
  "dependencies": {
    "commander": "^14.0.0",
    "@clack/prompts": "^0.10.0",
    "chalk": "^5.6.0",
    "ora": "^9.1.0",
    "cli-progress": "^3.12.0",
    "@deepgram/sdk": "^4.11.3",
    "@google/genai": "^1.38.0",
    "node-machine-id": "^1.1.12",
    "fluent-ffmpeg": "^2.1.3",
    "conf": "^13.1.0",
    "undici": "^7.3.0",
    "fs-extra": "^11.3.0",
    "extract-zip": "^2.0.1",
    "nanoid": "^5.0.9"
  }
}
```

**Version Notes (updated 2025-01-30):**
- commander: Updated to ^14.0.0 (latest stable, ESM only)
- chalk: Updated to ^5.6.0 (latest stable, ESM only)
- ora: Updated to ^9.1.0 (latest stable)
- @deepgram/sdk: Locked at ^4.11.3 (v5 is beta, use v4 for stability)
- @google/genai: ^1.38.0 (correct package - NOT @google/generative-ai)

### External Tools (Auto-installed via `autocliper init`)
- **FFmpeg** 7.1 - from github.com/BtbN/FFmpeg-Builds
- **yt-dlp** 2025.01.x - from github.com/yt-dlp/yt-dlp
  - **IMPORTANT:** yt-dlp 2025.11.12+ requires Deno runtime for YouTube support
  - Installer will offer to install Deno if not detected
  - Fallback: pin to yt-dlp 2025.10.22 (last version without Deno requirement)
- **Python MediaPipe** (optional) - via pip for face detection

---

## Directory Structure

```
autocliper/
├── bin/
│   └── cli.js              # Entry point (shebang + ESM import)
├── scripts/
│   └── face_detector.py    # Python MediaPipe script for face detection
├── src/
│   ├── commands/
│   │   ├── run.ts          # Main command: full pipeline
│   │   ├── init.ts         # Setup FFmpeg, yt-dlp
│   │   └── config.ts       # API keys setup
│   ├── core/
│   │   ├── downloader.ts   # yt-dlp wrapper
│   │   ├── transcriber.ts  # Deepgram (nova-3, word timestamps)
│   │   ├── analyzer.ts     # Gemini viral detection
│   │   ├── faceDetector.ts # Python wrapper for MediaPipe
│   │   ├── installer.ts    # Auto-install FFmpeg, yt-dlp
│   │   └── propsBuilder.ts # Remotion props JSON generator
│   ├── services/
│   │   ├── github.ts       # Actions trigger via repository_dispatch
│   │   ├── storage.ts      # Temp file upload (file.io or similar)
│   │   └── postProcess.ts  # Metadata randomization
│   ├── license/
│   │   ├── hwid.ts         # Hardware ID generation + encryption
│   │   └── validator.ts    # Device lock verification
│   └── utils/
│       ├── logger.ts       # CLI output formatting
│       ├── progress.ts     # Progress bars
│       ├── retry.ts        # Exponential backoff retry logic
│       └── config.ts       # Config file management
├── package.json
└── tsconfig.json
```

---

## CLI Commands

```bash
autocliper init              # Install FFmpeg, yt-dlp to ~/.autocliper/bin/
autocliper config            # Setup API keys interactively
autocliper run <url>         # Process video and generate clips
autocliper run <url> --max 3 # Limit segments
autocliper hwid              # Show device ID
```

---

## Critical API Usage Patterns

### Deepgram (v4 SDK only - do NOT use v3)
```typescript
import { createClient } from '@deepgram/sdk';

const deepgram = createClient(apiKey);
const { result } = await deepgram.listen.prerecorded.transcribeFile(
  audioBuffer,
  {
    model: 'nova-3',
    language: 'id',  // or 'en'
    smart_format: true,
    punctuate: true,
    diarize: false,
    utterances: false
  }
);
```

### Gemini (use @google/genai - NOT @google/generative-ai)
```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey });
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',  // or gemini-2.0-flash
  contents: prompt,
  config: { temperature: 0.3, topP: 0.8, maxOutputTokens: 4096 }
});
```

---

## HWID License System

Config directory: `~/.autocliper/`
- `config.json` - API keys & preferences
- `device.lock` - Encrypted HWID (AES-256-CBC)
- `bin/` - FFmpeg, yt-dlp binaries

**Flow:**
1. First run: Generate HWID, encrypt, save to device.lock
2. Subsequent runs: Decrypt lock file, compare with current HWID
3. Block execution if mismatch

**Security rules:**
- HWID must be encrypted with AES-256-CBC before saving
- Use `crypto.randomBytes` for IV
- Never log HWID to console
- Secret: `'autocliper-hwid-secret-2026'`

---

## Code Style Requirements

### TypeScript Config
- Target: ES2022
- Module: NodeNext
- Strict mode enabled
- ESM imports only (no CommonJS `require`)

### CLI Output (ASCII only - no emoji)
```
>  Arrow (process)
+  Plus (success)
x  X (error)
!  Warning
-  Pending
#  Number
```

Example:
```typescript
console.log('> Downloading video...');
console.log('+ Download complete');
console.log('x Error: Invalid URL');
```

### Error Format
```typescript
throw new Error('[E003] Deepgram API error: Invalid API key');
```

Error code ranges:
- E001-E009: License/HWID
- E010-E019: Download
- E020-E029: Transcription
- E030-E039: Analysis
- E040-E049: Rendering
- E050-E059: Post-process

---

## Viral Detection Prompt Framework

The Gemini analyzer uses a 3-Act framework:
1. **HOOK (0-3s)**: Pattern interrupt - stop scrolling
   - Contrarian statement, open loop, shocking fact, direct challenge
2. **TENSION (3-25s)**: Build curiosity/emotional investment
3. **PAYOFF (end)**: Satisfying conclusion

Hook categories: CURIOSITY, CONTROVERSY, RELATABILITY, SHOCK, STORY, CHALLENGE

---

## Cross-Platform Compatibility

Use `path` and `os` modules for all paths:
```typescript
import path from 'path';
import os from 'os';

const configDir = path.join(os.homedir(), '.autocliper');
// NEVER hardcode ~ or C:\Users\...
```

---

## Forbidden Actions

1. NEVER use `@google/generative-ai` (deprecated, EOL August 2025)
2. NEVER use Deepgram v3 SDK
3. NEVER hardcode API keys
4. NEVER log sensitive data (HWID, API keys, user content)
5. NEVER change output folder from `~/Downloads/autocliper`
6. NEVER skip error handling for API calls
7. NEVER use `eval()` or dynamic code execution
8. NEVER disable TypeScript strict mode

---

## External Documentation

| Service | URL |
|---------|-----|
| Deepgram | developers.deepgram.com |
| Gemini | ai.google.dev/gemini-api |
| Remotion | remotion.dev/docs |
| yt-dlp | github.com/yt-dlp/yt-dlp |

---

## Models Used

| Service | Model |
|---------|-------|
| Deepgram | nova-3 |
| Gemini | gemini-2.0-flash or gemini-2.5-flash |

---

## Additional Implementation Notes

### Face Detection (Python + Node Hybrid)
- Face detection uses a bundled Python script (`scripts/face_detector.py`) with MediaPipe
- Node.js wrapper in `src/core/faceDetector.ts` spawns Python process
- Falls back to CENTER mode if Python/MediaPipe unavailable
- Mode determination: 1 face = CENTER, 2+ faces = SPLIT screen

### Auto-Install Dependencies
The `init` command downloads and installs:
- **FFmpeg 7.1** from github.com/BtbN/FFmpeg-Builds (platform-specific)
- **yt-dlp 2025.01.x** from github.com/yt-dlp/yt-dlp
- **Deno** (optional) - Required for yt-dlp 2025.11.12+ full YouTube support
- **MediaPipe** (optional) via pip for face detection
All binaries stored in `~/.autocliper/bin/`

**yt-dlp Note:**
- Versions 2025.11.12+ require Deno for JavaScript challenge solving
- CLI will offer: (A) Install Deno, (B) Use yt-dlp 2025.10.22, (C) Skip yt-dlp

### GitHub Actions Integration
- Uses `repository_dispatch` event type `render-video`
- Polls workflow run status every 10 seconds
- 30-minute timeout default
- Renders uploaded to temp storage, then downloaded by CLI

### Post-Processing
- Randomizes video metadata (software, artist, creation_time)
- Uses FFmpeg with libx264 preset medium, CRF 23
- Output fixed to `~/Downloads/autocliper/`

### Retry Logic
API calls use exponential backoff retry with:
- Max 3 retries
- Base delay 1s, max 30s
- Configurable per-service

---

## Build & Development Commands

```bash
# Build TypeScript
npm run build                # Build with tsup

# Package to standalone binary
npx pkg . -t node22-win-x64,node22-macos-x64,node22-linux-x64

# Development
npm run dev                  # Watch mode (if configured)
npm run test                 # Run tests
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `Docs/PRD-AutoCliper-Final.md` | Complete PRD with code examples |
| `Docs/GUARDRAILS-AutoCliper.md` | Development rules and forbidden actions |
| `PRD-AutoCliper-Part2.md` | Extended implementation details |
