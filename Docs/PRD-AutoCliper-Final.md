# PRD: AutoCliper v1.0
## CLI Viral Video Clipping Tool

---

## 1. Product Overview

| Item | Detail |
|------|--------|
| Product | AutoCliper - CLI tool untuk auto-generate viral short clips |
| Platform | Windows, macOS, Linux |
| License | HWID-locked (1 device per license) |
| Output | 9:16 vertical video dengan animated subtitle |

### Core Features
1. Download video YouTube via URL
2. Transcription dengan word-level timestamps
3. AI viral segment detection
4. Face tracking (center/split screen)
5. Animated subtitle (TikTok style)
6. Hook overlay burn
7. Cloud rendering via GitHub Actions
8. Metadata randomization

---

## 2. Tech Stack (Updated January 2026)

### 2.1 CLI Application (Node.js)

```json
{
  "name": "autocliper",
  "version": "1.0.0",
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "commander": "^13.1.0",
    "@clack/prompts": "^0.10.0",
    "chalk": "^5.4.1",
    "ora": "^8.1.1",
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
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "tsup": "^8.3.6",
    "pkg": "^5.8.1"
  }
}
```

### 2.2 Remotion Renderer (Separate Repo)

```json
{
  "name": "autocliper-renderer",
  "version": "1.0.0",
  "dependencies": {
    "remotion": "4.0.57",
    "@remotion/cli": "4.0.57",
    "@remotion/renderer": "4.0.57",
    "@remotion/captions": "4.0.57",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/react": "^19.0.7",
    "typescript": "^5.7.3"
  }
}
```

### 2.3 External Tools (Auto-install)

| Tool | Version | Source |
|------|---------|--------|
| FFmpeg | 7.1 | github.com/BtbN/FFmpeg-Builds |
| yt-dlp | 2025.01.x | github.com/yt-dlp/yt-dlp |

---

## 3. Architecture

### 3.1 System Flow

```
[LOCAL CLI]
    |
    +-- yt-dlp: Download video
    +-- FFmpeg: Extract audio (WAV)
    +-- Deepgram API: Transcription + word timestamps
    +-- Gemini API: Viral segment detection
    +-- FFmpeg: Extract sample frames per segment
    +-- Face count analysis (simple heuristic atau ImageMagick)
    +-- Generate Remotion props JSON
    +-- Upload source video ke temp storage
    +-- Trigger GitHub Actions
    |
    v
[GITHUB ACTIONS]
    |
    +-- Download source video
    +-- Render dengan Remotion
    +-- Upload hasil ke temp storage
    +-- Webhook callback
    |
    v
[LOCAL CLI]
    |
    +-- Download rendered video
    +-- Post-process (metadata randomization)
    +-- Save ke ~/Downloads/autocliper/
```

### 3.2 Directory Structure

```
autocliper/
├── bin/
│   └── cli.js
├── src/
│   ├── commands/
│   │   ├── run.ts          # Main command
│   │   ├── init.ts         # Setup dependencies
│   │   └── config.ts       # API keys setup
│   ├── core/
│   │   ├── downloader.ts   # yt-dlp wrapper
│   │   ├── transcriber.ts  # Deepgram
│   │   ├── analyzer.ts     # Gemini viral detection
│   │   ├── faceCounter.ts  # Simple face detection
│   │   └── propsBuilder.ts # Remotion props
│   ├── services/
│   │   ├── github.ts       # Actions trigger
│   │   ├── storage.ts      # Temp file upload
│   │   └── postProcess.ts  # Metadata randomizer
│   ├── license/
│   │   ├── hwid.ts
│   │   └── validator.ts
│   └── utils/
│       ├── logger.ts
│       ├── progress.ts
│       └── config.ts
├── package.json
└── tsconfig.json

autocliper-renderer/
├── src/
│   ├── Root.tsx
│   ├── compositions/
│   │   ├── ViralClip.tsx
│   │   ├── Subtitle.tsx
│   │   ├── HookOverlay.tsx
│   │   └── SplitScreen.tsx
│   └── lib/
│       └── timing.ts
├── .github/
│   └── workflows/
│       └── render.yml
├── remotion.config.ts
└── package.json
```

---

## 4. Implementation Details

### 4.1 Deepgram Transcription

```typescript
// src/core/transcriber.ts
import { createClient } from '@deepgram/sdk';
import fs from 'fs';

interface Word {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word: string;
}

interface TranscriptResult {
  transcript: string;
  words: Word[];
  duration: number;
}

export async function transcribe(
  audioPath: string, 
  apiKey: string
): Promise<TranscriptResult> {
  const deepgram = createClient(apiKey);
  
  const audioBuffer = fs.readFileSync(audioPath);
  
  const { result } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: 'nova-3',
      language: 'id',        // atau 'en' untuk English
      smart_format: true,
      punctuate: true,
      diarize: false,        // true jika perlu speaker detection
      utterances: false
    }
  );
  
  const channel = result.results.channels[0];
  const alternative = channel.alternatives[0];
  
  return {
    transcript: alternative.transcript,
    words: alternative.words.map(w => ({
      word: w.word,
      start: w.start,
      end: w.end,
      confidence: w.confidence,
      punctuated_word: w.punctuated_word
    })),
    duration: result.metadata.duration
  };
}
```

### 4.2 Gemini Viral Detection

```typescript
// src/core/analyzer.ts
import { GoogleGenAI } from '@google/genai';

interface ViralSegment {
  rank: number;
  start: string;        // "HH:MM:SS"
  end: string;
  duration_seconds: number;
  hook_text: string;
  hook_category: string;
  why_viral: string;
  viral_score: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface AnalysisResult {
  video_topic: string;
  segments: ViralSegment[];
}

const PROMPT_TEMPLATE = `
ROLE:
Kamu adalah Viral Content Analyst dengan pengalaman 10 tahun di TikTok, YouTube Shorts, dan Instagram Reels.

TASK:
Analisis transcript berikut dan temukan maksimal {max_segments} segmen dengan potensi viral tertinggi.

KRITERIA WAJIB:
- Durasi per segmen: {min_duration}-{max_duration} detik
- Harus standalone (bisa dipahami tanpa konteks video penuh)
- Harus punya hook kuat di 3 detik pertama

FRAMEWORK ANALISIS (3-Act):
1. HOOK (0-3s): Pattern interrupt - buat viewer stop scrolling
   - Contrarian statement ("Semua orang salah tentang...")
   - Open loop ("Ada satu hal yang tidak kamu tahu...")
   - Shocking fact ("97% orang gagal karena...")
   - Direct challenge ("Kamu pasti pernah...")
   
2. TENSION (3-25s): Build curiosity atau emotional investment
   - Story escalation
   - Problem agitation
   - Unexpected turn
   
3. PAYOFF (end): Satisfying conclusion
   - Revelation/twist
   - Actionable insight
   - Emotional resolution

HOOK CATEGORIES:
- CURIOSITY: Membuka loop mental yang harus ditutup
- CONTROVERSY: Opini berlawanan dengan mainstream
- RELATABILITY: "This is so me" moment
- SHOCK: Data/fakta yang tidak terduga
- STORY: Narrative hook yang compelling
- CHALLENGE: Menantang belief viewer

EXCLUDE jika:
- Terlalu banyak konteks yang dibutuhkan
- Tidak ada hook yang jelas
- Ending menggantung tanpa payoff
- Topik terlalu niche/teknikal

TRANSCRIPT:
{transcript}

OUTPUT FORMAT (JSON only, no explanation, no markdown):
{
  "video_topic": "topik utama video",
  "segments": [
    {
      "rank": 1,
      "start": "HH:MM:SS",
      "end": "HH:MM:SS",
      "duration_seconds": 45,
      "hook_text": "kalimat pembuka",
      "hook_category": "CURIOSITY",
      "why_viral": "1 kalimat alasan",
      "viral_score": 85,
      "confidence": "HIGH"
    }
  ]
}
`;

export async function analyzeViral(
  transcript: string,
  words: Word[],
  config: {
    apiKey: string;
    maxSegments: number;
    minDuration: number;
    maxDuration: number;
  }
): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  
  // Build transcript dengan timestamps
  const transcriptWithTimestamps = buildTranscriptWithTimestamps(words);
  
  const prompt = PROMPT_TEMPLATE
    .replace('{max_segments}', String(config.maxSegments))
    .replace('{min_duration}', String(config.minDuration))
    .replace('{max_duration}', String(config.maxDuration))
    .replace('{transcript}', transcriptWithTimestamps);
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      temperature: 0.3,
      topP: 0.8,
      maxOutputTokens: 4096
    }
  });
  
  const text = response.text;
  return parseJsonResponse(text);
}

function buildTranscriptWithTimestamps(words: Word[]): string {
  let result = '';
  
  for (let i = 0; i < words.length; i++) {
    if (i % 30 === 0) {
      const ts = formatTimestamp(words[i].start);
      result += `\n[${ts}] `;
    }
    result += words[i].punctuated_word + ' ';
  }
  
  return result.trim();
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function parseJsonResponse(text: string): AnalysisResult {
  // Remove markdown code blocks if present
  let cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Failed to parse Gemini response as JSON');
  }
}
```

### 4.3 HWID License System

```typescript
// src/license/hwid.ts
import { machineIdSync } from 'node-machine-id';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.autocliper');
const LOCK_FILE = path.join(CONFIG_DIR, 'device.lock');
const SECRET = 'autocliper-hwid-secret-2026';

export function getHWID(): string {
  const machineId = machineIdSync();
  const hash = crypto
    .createHash('sha256')
    .update(machineId + SECRET)
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();
  
  return hash.match(/.{1,4}/g)!.join('-');
}

export function verifyDevice(): { valid: boolean; firstRun: boolean; error?: string } {
  const currentHWID = getHWID();
  
  // Ensure config dir exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  // First run - auto lock
  if (!fs.existsSync(LOCK_FILE)) {
    const encrypted = encrypt(currentHWID);
    fs.writeFileSync(LOCK_FILE, encrypted);
    return { valid: true, firstRun: true };
  }
  
  // Verify existing lock
  try {
    const encrypted = fs.readFileSync(LOCK_FILE, 'utf-8');
    const lockedHWID = decrypt(encrypted);
    
    if (currentHWID === lockedHWID) {
      return { valid: true, firstRun: false };
    } else {
      return { valid: false, firstRun: false, error: 'Device mismatch' };
    }
  } catch (e) {
    return { valid: false, firstRun: false, error: 'Lock file corrupted' };
  }
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(SECRET, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = crypto.scryptSync(SECRET, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 4.4 Remotion Subtitle Component

```tsx
// remotion-renderer/src/compositions/Subtitle.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface Word {
  word: string;
  start: number;
  end: number;
  punctuatedWord: string;
}

interface SubtitleProps {
  words: Word[];
  style: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    highlightColor: string;
    strokeColor: string;
    strokeWidth: number;
    position: 'bottom' | 'center';
  };
  segmentStartTime: number;
}

export const Subtitle: React.FC<SubtitleProps> = ({ 
  words, 
  style, 
  segmentStartTime 
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const currentTime = segmentStartTime + (frame / fps);
  
  // Get visible words (3-5 at a time)
  const visibleWords = getVisibleWords(words, currentTime, 5);
  const activeIndex = getActiveWordIndex(visibleWords, currentTime);
  
  return (
    <div
      style={{
        position: 'absolute',
        bottom: style.position === 'bottom' ? 200 : '45%',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 12,
        padding: '0 40px',
      }}
    >
      {visibleWords.map((word, index) => {
        const isActive = index === activeIndex;
        
        const scale = isActive
          ? spring({
              frame: frame - Math.floor((word.start - segmentStartTime) * fps),
              fps,
              config: { damping: 12, stiffness: 200 },
            })
          : 1;
        
        return (
          <span
            key={`${word.word}-${word.start}`}
            style={{
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              color: isActive ? style.highlightColor : style.color,
              textShadow: `
                -${style.strokeWidth}px -${style.strokeWidth}px 0 ${style.strokeColor},
                 ${style.strokeWidth}px -${style.strokeWidth}px 0 ${style.strokeColor},
                -${style.strokeWidth}px  ${style.strokeWidth}px 0 ${style.strokeColor},
                 ${style.strokeWidth}px  ${style.strokeWidth}px 0 ${style.strokeColor}
              `,
              transform: `scale(${scale})`,
              display: 'inline-block',
            }}
          >
            {word.punctuatedWord}
          </span>
        );
      })}
    </div>
  );
};

function getVisibleWords(words: Word[], currentTime: number, windowSize: number): Word[] {
  const currentIndex = words.findIndex(
    w => w.start <= currentTime && w.end >= currentTime
  );
  
  if (currentIndex === -1) {
    // Find closest upcoming word
    const nextIndex = words.findIndex(w => w.start > currentTime);
    if (nextIndex === -1) return words.slice(-windowSize);
    return words.slice(Math.max(0, nextIndex - 1), nextIndex + windowSize - 1);
  }
  
  const start = Math.max(0, currentIndex - 1);
  const end = Math.min(words.length, start + windowSize);
  return words.slice(start, end);
}

function getActiveWordIndex(visibleWords: Word[], currentTime: number): number {
  return visibleWords.findIndex(
    w => w.start <= currentTime && w.end >= currentTime
  );
}
```

### 4.5 GitHub Actions Workflow

```yaml
# remotion-renderer/.github/workflows/render.yml
name: Render Video

on:
  repository_dispatch:
    types: [render-video]

jobs:
  render:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Chrome
        uses: browser-actions/setup-chrome@v1
      
      - name: Download source video
        run: |
          curl -L -o public/source.mp4 "${{ github.event.client_payload.videoUrl }}"
      
      - name: Write props file
        run: |
          echo '${{ toJson(github.event.client_payload.props) }}' > input-props.json
      
      - name: Render video
        run: |
          npx remotion render ViralClip out/output.mp4 \
            --props="./input-props.json" \
            --concurrency=2
      
      - name: Upload result
        id: upload
        run: |
          RESPONSE=$(curl -F "file=@out/output.mp4" https://file.io)
          URL=$(echo $RESPONSE | jq -r '.link')
          echo "download_url=$URL" >> $GITHUB_OUTPUT
      
      - name: Callback to CLI
        if: ${{ github.event.client_payload.callbackUrl }}
        run: |
          curl -X POST "${{ github.event.client_payload.callbackUrl }}" \
            -H "Content-Type: application/json" \
            -d '{
              "jobId": "${{ github.event.client_payload.jobId }}",
              "status": "completed",
              "downloadUrl": "${{ steps.upload.outputs.download_url }}"
            }'
```

### 4.6 Remotion Props Schema

```typescript
// remotion-renderer/src/types.ts
import { z } from 'zod';

export const WordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
  punctuatedWord: z.string(),
});

export const SubtitleStyleSchema = z.object({
  fontFamily: z.string().default('Montserrat'),
  fontSize: z.number().default(48),
  fontWeight: z.number().default(800),
  color: z.string().default('#FFFFFF'),
  highlightColor: z.string().default('#FFFF00'),
  strokeColor: z.string().default('#000000'),
  strokeWidth: z.number().default(4),
  position: z.enum(['bottom', 'center']).default('center'),
});

export const HookStyleSchema = z.object({
  show: z.boolean().default(true),
  durationFrames: z.number().default(90),
  fontFamily: z.string().default('Montserrat'),
  fontSize: z.number().default(32),
  backgroundColor: z.string().default('rgba(0,0,0,0.7)'),
  position: z.enum(['top', 'bottom']).default('top'),
});

export const SegmentPropsSchema = z.object({
  id: z.string(),
  fps: z.number().default(30),
  width: z.number().default(1080),
  height: z.number().default(1920),
  durationInFrames: z.number(),
  
  // Video source
  videoSrc: z.string(),
  videoStartTime: z.number(),  // in seconds
  
  // Crop mode
  cropMode: z.enum(['CENTER', 'SPLIT']),
  cropData: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  
  // Subtitle
  words: z.array(WordSchema),
  subtitleStyle: SubtitleStyleSchema.default({}),
  
  // Hook overlay
  hookText: z.string(),
  hookStyle: HookStyleSchema.default({}),
});

export type SegmentProps = z.infer<typeof SegmentPropsSchema>;
```

---

## 5. CLI Commands & UI

### 5.1 Commands

```bash
# Setup
autocliper init              # Install FFmpeg, yt-dlp
autocliper config            # Setup API keys

# Main
autocliper run <url>         # Process video
autocliper run <url> --max 3 # Limit segments

# Utility
autocliper hwid              # Show device ID
autocliper --version
autocliper --help
```

### 5.2 Output Style

```
autocliper v1.0.0

> Device: Verified

> Downloading video...
  [=========>          ] 45% | 28MB/62MB
+ Download complete

> Extracting audio...
+ Audio extracted

> Transcribing with Deepgram...
  -- Model: nova-3
  -- Duration: 12:45
+ Transcript ready (1,847 words)

> Analyzing with Gemini...
+ Found 3 viral segments

  #1 [00:02:15 - 00:03:01] Score: 92
     CONTROVERSY: "Semua orang salah..."
     
  #2 [00:07:44 - 00:08:35] Score: 88
     CURIOSITY: "Ada satu rahasia..."

> Detecting faces...
  #1: 1 face -> CENTER
  #2: 2 faces -> SPLIT

> Uploading source...
+ Uploaded to temp storage

> Triggering render jobs...
  Job ac-001 ... queued
  Job ac-002 ... queued

--- Monitoring ---
  ac-001: [======>   ] 60%
  ac-002: pending

+ ac-001 completed
  ac-002: [=========>] 95%

+ ac-002 completed

> Downloading results...
+ Downloaded 2 videos

> Post-processing...
+ Metadata randomized

------------------------------------
+ All done!
+ Output: ~/Downloads/autocliper/

  video-001-viral.mp4
  video-002-viral.mp4
------------------------------------
```

---

## 6. Configuration

### 6.1 Config File Location

```
~/.autocliper/
├── config.json      # API keys & preferences
├── device.lock      # HWID lock (encrypted)
└── bin/             # FFmpeg, yt-dlp
```

### 6.2 Config Schema

```json
{
  "api": {
    "deepgram": "dg_xxxxxxxx",
    "gemini": "AIzaSyxxxxxxxx",
    "github": {
      "token": "ghp_xxxxxxxx",
      "owner": "username",
      "repo": "autocliper-renderer"
    }
  },
  "preferences": {
    "outputFolder": "~/Downloads/autocliper",
    "maxSegments": 5,
    "minDuration": 30,
    "maxDuration": 90
  },
  "subtitle": {
    "fontFamily": "Montserrat",
    "fontSize": 48,
    "highlightColor": "#FFFF00"
  }
}
```

---

## 7. Error Codes

| Code | Message | Action |
|------|---------|--------|
| E001 | Device mismatch | CLI locked to different device |
| E002 | Config not found | Run `autocliper config` |
| E003 | Deepgram API error | Check API key |
| E004 | Gemini API error | Check API key |
| E005 | GitHub Actions failed | Check workflow logs |
| E006 | Download failed | Check URL validity |
| E007 | FFmpeg not found | Run `autocliper init` |
| E008 | No viral segments found | Video mungkin tidak cocok |

---

## 8. API Costs Estimate

| Service | Free Tier | Paid |
|---------|-----------|------|
| Deepgram | $200 credit (~46K min) | $0.0043/min |
| Gemini | 15 RPM, 1M tokens/day | Free |
| GitHub Actions | 2000 min/month | $0.008/min |
| file.io | 100 files/day | Free |

**Estimate per video (10 min source, 4 clips):**
- Deepgram: ~$0.043
- Gemini: Free
- GitHub: ~$0.16 (20 min render)
- **Total: ~$0.20/video**

---

## 9. Build & Distribution

### 9.1 Build Binary

```bash
# Build TypeScript
npm run build

# Package to binary
npx pkg . --targets node22-win-x64,node22-macos-x64,node22-linux-x64 \
  --output dist/autocliper
```

### 9.2 Output Files

```
dist/
├── autocliper-win.exe
├── autocliper-macos
└── autocliper-linux
```

---

## 10. Testing Checklist

### Unit Tests
- [ ] HWID generation (consistent across restarts)
- [ ] HWID encryption/decryption
- [ ] Timestamp formatting
- [ ] Gemini JSON parsing
- [ ] Props schema validation

### Integration Tests
- [ ] Deepgram transcription (sample audio)
- [ ] Gemini analysis (sample transcript)
- [ ] GitHub Actions trigger
- [ ] Video download (yt-dlp)
- [ ] FFmpeg processing

### E2E Tests
- [ ] Full flow: URL to output
- [ ] Multiple segments
- [ ] Error recovery
- [ ] First run (HWID lock)

---

## 11. Future Enhancements (v2.0)

- [ ] Batch processing (multiple URLs)
- [ ] Custom Remotion templates
- [ ] Local render option
- [ ] Direct upload to TikTok/YouTube
- [ ] Team license support
- [ ] Auto music/SFX overlay
