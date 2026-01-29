# GUARDRAILS: AutoCliper Development
## Rules for AI Assistants

---

## 1. PROJECT IDENTITY

```
Project: AutoCliper
Type: CLI Application
Language: TypeScript (Node.js)
Target: Cross-platform (Win/Mac/Linux)
```

**JANGAN:**
- Mengubah nama project
- Mengubah arsitektur (hybrid local-cloud)
- Mengganti tech stack tanpa konfirmasi

---

## 2. DEPENDENCY RULES

### 2.1 Locked Versions (WAJIB)

```json
{
  "commander": "^14.0.0",
  "chalk": "^5.6.0",
  "ora": "^9.1.0",
  "@clack/prompts": "^0.10.0",
  "@deepgram/sdk": "^4.11.3",
  "@google/genai": "^1.38.0",
  "remotion": "4.0.57",
  "@remotion/cli": "4.0.57",
  "@remotion/renderer": "4.0.57",
  "@remotion/captions": "4.0.57"
}
```

**Version Notes (updated 2025-01-30):**
- commander: ^14.0.0 (latest)
- chalk: ^5.6.0 (latest, ESM only)
- ora: ^9.1.0 (latest)
- @deepgram/sdk: ^4.11.3 (v5 is beta - stay on v4)
- @google/genai: ^1.38.0 (correct SDK - NOT @google/generative-ai)

**JANGAN:**
- Gunakan `@google/generative-ai` (DEPRECATED, EOL August 2025)
- Downgrade Remotion di bawah 4.0.x
- Gunakan Deepgram v3 atau lebih rendah

### 2.2 Deprecated Libraries (DILARANG)

| Library | Status | Gunakan |
|---------|--------|---------|
| @google/generative-ai | Deprecated | @google/genai |
| request | Deprecated | undici/fetch |
| node-fetch | Tidak perlu | Native fetch (Node 18+) |

---

## 3. CODE STYLE RULES

### 3.1 TypeScript Config

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  }
}
```

### 3.2 Import Style

```typescript
// BENAR - ESM style
import { createClient } from '@deepgram/sdk';
import fs from 'fs';
import path from 'path';

// SALAH - CommonJS
const { createClient } = require('@deepgram/sdk');
```

### 3.3 Async/Await

```typescript
// BENAR
async function transcribe(audioPath: string): Promise<Result> {
  const result = await deepgram.listen.prerecorded.transcribeFile(...);
  return result;
}

// SALAH - callback style
function transcribe(audioPath, callback) {
  deepgram.listen(..., (err, result) => callback(err, result));
}
```

---

## 4. API USAGE RULES

### 4.1 Deepgram

```typescript
// BENAR - v4 style
import { createClient } from '@deepgram/sdk';
const deepgram = createClient(apiKey);

const { result } = await deepgram.listen.prerecorded.transcribeFile(
  audioBuffer,
  { model: 'nova-3', smart_format: true }
);

// SALAH - v3 style (deprecated)
const { Deepgram } = require('@deepgram/sdk');
const dg = new Deepgram(apiKey);
```

### 4.2 Gemini

```typescript
// BENAR - @google/genai (NEW SDK)
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey });

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt
});

// SALAH - @google/generative-ai (DEPRECATED)
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(apiKey);
```

### 4.3 Remotion

```typescript
// BENAR - Remotion 4.x
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';

// Composition dengan React 19
export const ViralClip: React.FC<Props> = (props) => {
  const frame = useCurrentFrame();
  // ...
};

// SALAH - deprecated APIs
import { interpolate } from 'remotion'; // Cek docs untuk API terbaru
```

---

## 5. FILE STRUCTURE RULES

### 5.1 CLI Structure (WAJIB)

```
autocliper/
├── bin/
│   └── cli.js           # Entry point
├── src/
│   ├── commands/        # CLI commands
│   ├── core/            # Business logic
│   ├── services/        # External services
│   ├── license/         # HWID system
│   └── utils/           # Helpers
├── package.json
└── tsconfig.json
```

**JANGAN:**
- Taruh semua code di satu file
- Buat nested folder lebih dari 3 level
- Rename folder tanpa update imports

### 5.2 Remotion Structure (WAJIB)

```
autocliper-renderer/
├── src/
│   ├── Root.tsx
│   ├── compositions/
│   │   ├── ViralClip.tsx
│   │   ├── Subtitle.tsx
│   │   └── HookOverlay.tsx
│   └── lib/
├── public/
├── remotion.config.ts
└── package.json
```

---

## 6. HWID SYSTEM RULES

### 6.1 Logic Flow (JANGAN UBAH)

```
1. First Run:
   - Generate HWID
   - Encrypt dengan AES-256
   - Save ke ~/.autocliper/device.lock
   
2. Subsequent Runs:
   - Read lock file
   - Decrypt
   - Compare dengan current HWID
   - Block jika tidak match
```

### 6.2 Security Rules

- WAJIB encrypt HWID sebelum save
- WAJIB gunakan crypto.randomBytes untuk IV
- JANGAN simpan HWID plaintext
- JANGAN log HWID ke console

---

## 7. CLI OUTPUT RULES

### 7.1 Symbols (ASCII ONLY)

```
>  Arrow (proses)
+  Plus (success)
x  X (error)
!  Warning
-  Pending
#  Number
```

**JANGAN:**
- Gunakan emoji
- Gunakan unicode symbols
- Gunakan warna tanpa chalk

### 7.2 Progress Bar Format

```
[=========>          ] 45% | 28MB/62MB
```

### 7.3 Message Style

```typescript
// BENAR
console.log('> Downloading video...');
console.log('+ Download complete');
console.log('x Error: Invalid URL');

// SALAH
console.log('🚀 Downloading video...');
console.log('✅ Download complete');
console.log('❌ Error: Invalid URL');
```

---

## 8. ERROR HANDLING RULES

### 8.1 Error Format

```typescript
// BENAR
throw new Error('[E003] Deepgram API error: Invalid API key');

// SALAH
throw new Error('Something went wrong');
```

### 8.2 Error Codes (WAJIB)

| Code | Domain |
|------|--------|
| E001-E009 | License/HWID |
| E010-E019 | Download |
| E020-E029 | Transcription |
| E030-E039 | Analysis |
| E040-E049 | Rendering |
| E050-E059 | Post-process |

---

## 9. TESTING RULES

### 9.1 Test Files

```
src/
├── core/
│   ├── transcriber.ts
│   └── transcriber.test.ts    # Unit test
```

### 9.2 Mock External Services

```typescript
// BENAR - mock API calls
vi.mock('@deepgram/sdk', () => ({
  createClient: vi.fn(() => ({
    listen: {
      prerecorded: {
        transcribeFile: vi.fn().mockResolvedValue(mockResult)
      }
    }
  }))
}));

// SALAH - test dengan real API
const result = await transcribe(audioPath, REAL_API_KEY);
```

---

## 10. DOCUMENTATION RULES

### 10.1 Function Comments

```typescript
/**
 * Transcribe audio file menggunakan Deepgram Nova-3
 * @param audioPath - Path ke file audio (WAV/MP3)
 * @param apiKey - Deepgram API key
 * @returns TranscriptResult dengan words dan timestamps
 * @throws Error jika API call gagal
 */
export async function transcribe(
  audioPath: string,
  apiKey: string
): Promise<TranscriptResult> {
  // ...
}
```

### 10.2 File Headers

```typescript
/**
 * @file transcriber.ts
 * @description Deepgram transcription service
 * @module core/transcriber
 */
```

---

## 11. SECURITY RULES

### 11.1 API Keys

- JANGAN hardcode API keys
- JANGAN commit ke git
- WAJIB load dari config file
- WAJIB validate sebelum use

```typescript
// BENAR
const apiKey = config.get('api.deepgram');
if (!apiKey) throw new Error('[E020] Deepgram API key not configured');

// SALAH
const apiKey = 'dg_xxxxxxxxxxxxx';
```

### 11.2 User Data

- JANGAN log transcript ke file
- JANGAN upload data tanpa consent
- WAJIB cleanup temp files

---

## 12. PERFORMANCE RULES

### 12.1 Memory

- WAJIB gunakan streams untuk file besar
- JANGAN load entire video ke memory
- WAJIB cleanup setelah process

```typescript
// BENAR - streaming
const audioBuffer = fs.createReadStream(audioPath);

// SALAH - load all
const audioBuffer = fs.readFileSync(audioPath);
```

### 12.2 Concurrency

- GitHub Actions: max 2 concurrent jobs
- Local FFmpeg: max 1 concurrent
- API calls: respect rate limits

---

## 13. COMPATIBILITY RULES

### 13.1 Node.js

- Minimum: Node.js 20.x
- Target: Node.js 22.x
- JANGAN gunakan API yang deprecated di Node 20

### 13.2 OS Paths

```typescript
// BENAR - cross-platform
import path from 'path';
import os from 'os';

const configDir = path.join(os.homedir(), '.autocliper');

// SALAH - hardcoded
const configDir = '~/.autocliper';
const configDir = 'C:\\Users\\...';
```

---

## 14. GIT RULES

### 14.1 Ignore Files

```gitignore
# Dependencies
node_modules/

# Build
dist/

# Config (sensitive)
.autocliper/
*.lock

# Temp
*.mp4
*.wav
*.mp3
```

### 14.2 Commit Messages

```
feat: add Deepgram transcription
fix: HWID validation on Windows
docs: update API usage
refactor: extract subtitle component
```

---

## 15. FORBIDDEN ACTIONS

### JANGAN PERNAH:

1. **Ubah HWID logic** tanpa full review
2. **Gunakan library deprecated** yang sudah ada alternatif
3. **Skip error handling** untuk API calls
4. **Hardcode API keys** di source code
5. **Ubah output folder** dari ~/Downloads/autocliper
6. **Remove license check** dari CLI
7. **Log sensitive data** (HWID, API keys, user content)
8. **Gunakan eval()** atau dynamic code execution
9. **Disable TypeScript strict mode**
10. **Push langsung ke main** tanpa review

---

## 16. BEFORE CODING CHECKLIST

- [ ] Baca PRD section yang relevan
- [ ] Cek dependency versions
- [ ] Cek API documentation terbaru
- [ ] Siapkan mock untuk testing
- [ ] Plan error handling
- [ ] Consider edge cases

---

## 17. QUICK REFERENCE

### API Docs

| Service | URL |
|---------|-----|
| Deepgram | developers.deepgram.com |
| Gemini | ai.google.dev/gemini-api |
| Remotion | remotion.dev/docs |
| yt-dlp | github.com/yt-dlp/yt-dlp |

### Model Names

| Service | Model |
|---------|-------|
| Deepgram | nova-3 |
| Gemini | gemini-2.5-flash |

### File Extensions

| Type | Extension |
|------|-----------|
| Source video | .mp4 |
| Audio | .wav |
| Output | .mp4 |
| Config | .json |

---

## 18. CONTEXT WINDOW REMINDER

Jika AI kehilangan konteks, refer ke:

1. **PRD-AutoCliper-Final.md** - Full specification
2. **GUARDRAILS.md** - This file
3. **package.json** - Dependencies
4. **tsconfig.json** - TypeScript config

**Priority:** Guardrails > PRD > Common sense

---

*Document Version: 1.0*
*Last Updated: January 2026*
