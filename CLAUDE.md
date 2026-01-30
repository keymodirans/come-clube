# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**AutoCliper** is a CLI tool for automatically generating viral short-form video clips (9:16 vertical) from YouTube videos. The project consists of two separate repositories:

1. **CLI Application** (this repo) - Node.js/TypeScript CLI for local processing
2. **autocliper-renderer** (separate repo) - Remotion-based video renderer deployed via GitHub Actions

---

## Build & Development Commands

```bash
# Build TypeScript (uses tsup)
npm run build                # Output to dist/

# Development with watch mode
npm run dev                  # Rebuild on file changes

# Run CLI directly (for development)
node bin/cli.js <command>

# Show device HWID
npm run hwid                 # Shortcut for 'autocliper hwid'

# Package standalone binaries (requires pkg)
npm run pkg:win              # Build Windows executable
npm run pkg:mac              # Build macOS executable
npm run pkg:linux            # Build Linux executable
npm run pkg:all              # Build all platforms
```

**Entry point:** `bin/cli.js` imports `dist/index.js`, which is the compiled output of `src/index.ts`.

**Build tool:** tsup with ES modules, targeting Node 20+, platform: node.

---

## Architecture: Hybrid Local-Cloud Processing

```
[LOCAL CLI]
    |
    +-- yt-dlp: Download video
    +-- FFmpeg: Extract audio (WAV)
    +-- Deepgram API: Transcription + word timestamps
    +-- Gemini API: Viral segment detection
    +-- Python MediaPipe: Face detection for layout (CENTER vs SPLIT)
    +-- Generate Remotion props JSON
    +-- Upload source video to temp storage (file.io)
    +-- Trigger GitHub Actions
    |
    v
[GITHUB ACTIONS]
    |
    +-- Download source video
    +-- Render with Remotion (9:16 vertical video)
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
- commander: ^14.0.0 (latest stable, ESM only)
- chalk: ^5.6.0 (latest stable, ESM only)
- ora: ^9.1.0 (latest stable)
- @deepgram/sdk: ^4.11.3 (v5 is beta, use v4 for stability)
- @google/genai: ^1.38.0 (correct package - NOT @google/generative-ai)
- undici: ^7.3.0 (HTTP client for GitHub API, fetch-native)

### External Tools (Auto-installed via `autocliper init`)
- **FFmpeg** 7.1 - from github.com/BtbN/FFmpeg-Builds
- **yt-dlp** 2025.01.x - from github.com/yt-dlp/yt-dlp
  - **IMPORTANT:** yt-dlp 2025.11.12+ requires Deno runtime for YouTube support
  - Installer will offer to install Deno if not detected
  - Fallback: pin to yt-dlp 2025.10.22 (last version without Deno requirement)
- **Python + MediaPipe** (optional) - via pip for face detection
  - Uses opencv-python and mediapipe packages
  - Falls back to CENTER layout if unavailable

---

## Directory Structure

```
autocliper/
├── bin/
│   └── cli.js              # Entry point (shebang + imports dist/index.js)
├── scripts/
│   └── face_detector.py    # Python MediaPipe script for face detection
├── src/
│   ├── index.ts            # Main entry: CLI setup with commander
│   ├── commands/
│   │   ├── run.ts          # Main pipeline (FULLY IMPLEMENTED)
│   │   ├── init.ts         # Setup FFmpeg, yt-dlp, Deno
│   │   ├── config.ts       # API keys interactive setup
│   │   └── hwid.ts         # Show device ID command
│   ├── core/
│   │   ├── installer.ts    # External tools auto-installation
│   │   ├── downloader.ts   # Video download & audio extraction
│   │   ├── transcriber.ts  # Deepgram transcription
│   │   ├── analyzer.ts     # Gemini viral segment analysis
│   │   ├── faceDetector.ts # Python MediaPipe wrapper
│   │   └── propsBuilder.ts # Remotion props JSON generator
│   ├── services/
│   │   ├── storage.ts      # File upload to temporary storage
│   │   ├── github.ts       # GitHub Actions integration
│   │   └── postProcess.ts  # Video metadata randomization
│   ├── license/
│   │   ├── hwid.ts         # Hardware ID generation + AES-256-CBC encryption
│   │   └── validator.ts    # Device lock verification
│   └── utils/
│       ├── logger.ts       # CLI output formatting (ASCII only)
│       ├── config.ts       # Conf-based config management
│       ├── retry.ts        # Exponential backoff retry logic
│       └── progress.ts     # Progress bars & spinners
├── dist/                   # Compiled output (generated by tsup)
├── .planning/              # Phase plans and requirements
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**All 11 phases are FULLY IMPLEMENTED as of 2025-01-30.**

---

## CLI Commands

```bash
autocliper init              # Install FFmpeg, yt-dlp to ~/.autocliper/bin/
autocliper config            # Setup API keys interactively
autocliper config --status   # Show current configuration
autocliper run <url>         # Process video and generate clips
autocliper run <url> --max 3 # Limit number of segments
autocliper run <url> -l en   # Specify language (id, en)
autocliper hwid              # Show device ID and license status
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

### GitHub Actions API (uses undici, not fetch)
```typescript
import { request } from 'undici';

const response = await request(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'AutoCliper-CLI',
  },
  body: JSON.stringify(payload),
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
- E040-E049: Rendering/Face Detection
- E050-E059: Post-process
- E060-E069: GitHub Integration

---

## Viral Detection Prompt Framework

The Gemini analyzer uses a 3-Act framework:
1. **HOOK (0-3s)**: Pattern interrupt - stop scrolling
   - Contrarian statement, open loop, shocking fact, direct challenge
2. **TENSION (3-25s)**: Build curiosity/emotional investment
3. **PAYOFF (end)**: Satisfying conclusion

Hook categories: CURIOSITY, CONTROVERSY, RELATABILITY, SHOCK, STORY, CHALLENGE

---

## Face Detection & Video Layout

Face detection determines the video crop mode:

- **CENTER** (0-1 faces): Single speaker, center crop
- **SPLIT** (2+ faces): Split screen layout for interviews/conversations

The Python script (`scripts/face_detector.py`) is called from `faceDetector.ts` and:
1. Samples 5 frames evenly across each segment
2. Uses MediaPipe FaceDetection with model_selection=1 (full-range)
3. Returns mode of face counts + bounding boxes for SPLIT layout

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
2. NEVER use Deepgram v3 SDK - use v4 createClient() pattern only
3. NEVER hardcode API keys - always use `get()` from utils/config
4. NEVER log sensitive data (HWID, API keys, user content)
5. NEVER change output folder from `~/Downloads/autocliper`
6. NEVER skip error handling for API calls
7. NEVER use `eval()` or dynamic code execution
8. NEVER disable TypeScript strict mode
9. NEVER import CommonJS modules directly - use `createRequire` for CJS deps like `node-machine-id`
10. NEVER use `fetch` directly - use `undici` `request()` for HTTP (Node compatibility)

---

## Key Implementation Patterns

### CommonJS Import (node-machine-id)

The `node-machine-id` package is CommonJS only. Use `createRequire`:

```typescript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const machineIdModule = require('node-machine-id');
```

### License Check Hook

All commands except `config` and `hwid` require license validation. This is enforced via commander's `preAction` hook in `src/index.ts:93-96`.

### Config Management

Uses `conf` package with dot-notation paths:
```typescript
import { get, set } from '../utils/config.js';

// Get value
const apiKey = get<string>('api.deepgram');

// Set value
set('api.github.token', 'ghp_...');
```

Config stored in: `~/.autocliper/config.json`

### Tool Path Resolution

Always use `getToolPath()` from `core/installer.ts` - returns local bin path if tool exists, otherwise system PATH:
```typescript
import { getToolPath, TOOLS } from '../core/installer.js';

const ffmpegPath = getToolPath(TOOLS.FFMPEG);
```

### Retry Logic

Two retry utilities are available:
- `withRetry()` from `utils/retry.ts` - Generic exponential backoff wrapper
- `retryApi()` from `utils/retry.ts` - Pre-configured for API calls with logging

Always use retry wrappers for:
- Deepgram API calls
- Gemini API calls
- GitHub API calls (also has internal retry via `retryApi` in `github.ts`)

### Run Command Flow (All 11 Steps)

The `run` command in `src/commands/run.ts` orchestrates the complete pipeline:

1. **Validate URL** - Check if YouTube URL is valid
2. **Download Video** - Use yt-dlp to download video
3. **Extract Audio** - Use FFmpeg to extract WAV for Deepgram (16kHz, mono)
4. **Transcribe** - Call Deepgram Nova-3 for word timestamps
5. **Analyze Viral** - Call Gemini for viral segment detection (3-Act framework)
6. **Face Detection** - Use Python MediaPipe for layout determination (CENTER/SPLIT)
7. **Upload Video** - Upload to temporary storage (file.io)
8. **Build Props** - Generate Remotion render props JSON with face detection data
9. **Trigger Render** - Call GitHub Actions for each segment (max 2 concurrent)
10. **Poll Jobs** - Monitor workflow completion (30min timeout per job)
11. **Download & Post-Process** - Download artifacts, randomize metadata

All steps include retry logic with exponential backoff.

---

## External Documentation

| Service | URL |
|---------|-----|
| Deepgram | developers.deepgram.com |
| Gemini | ai.google.dev/gemini-api |
| Remotion | remotion.dev/docs |
| yt-dlp | github.com/yt-dlp/yt-dlp |
| undici | github.com/nodejs/undici |

---

## Models Used

| Service | Model |
|---------|-------|
| Deepgram | nova-3 |
| Gemini | gemini-2.0-flash or gemini-2.5-flash |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/index.ts` | Main CLI entry, license check hook, command registration |
| `src/commands/run.ts` | Complete pipeline orchestration (all 11 steps) |
| `src/license/hwid.ts` | HWID generation, AES-256-CBC encryption/decryption |
| `src/license/validator.ts` | Device verification on every run (except config/hwid) |
| `src/core/installer.ts` | FFmpeg, yt-dlp, Deno download and install |
| `src/core/downloader.ts` | YouTube video download + audio extraction |
| `src/core/transcriber.ts` | Deepgram Nova-3 transcription with word timestamps |
| `src/core/analyzer.ts` | Gemini viral segment analysis (3-Act framework) |
| `src/core/faceDetector.ts` | Python MediaPipe wrapper for face detection |
| `src/core/propsBuilder.ts` | Remotion render props JSON generation |
| `src/services/storage.ts` | File upload to temporary storage (file.io) |
| `src/services/github.ts` | GitHub Actions workflow trigger & polling |
| `src/services/postProcess.ts` | Video metadata randomization |
| `scripts/face_detector.py` | Standalone Python script for face detection |
| `.planning/REQUIREMENTS.md` | Complete functional requirements |
| `.planning/phases/*/PLAN.md` | Individual phase implementation plans |
