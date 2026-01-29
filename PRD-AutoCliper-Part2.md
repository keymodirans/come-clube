# PRD AutoCliper - Part 2: Implementation Details

---

## 1. Face Detection (Python + Node.js Hybrid)

### 1.1 Python Script (Bundled)

```python
# scripts/face_detector.py
import sys
import json
import cv2
import mediapipe as mp
from pathlib import Path

mp_face = mp.solutions.face_detection

def detect_faces_in_segment(video_path: str, start_sec: float, end_sec: float, sample_count: int = 5) -> int:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 1
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    duration = end_sec - start_sec
    interval = duration / sample_count
    face_counts = []
    
    with mp_face.FaceDetection(model_selection=1, min_detection_confidence=0.5) as detector:
        for i in range(sample_count):
            timestamp = start_sec + (i * interval)
            frame_num = int(timestamp * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
            ret, frame = cap.read()
            if not ret:
                continue
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = detector.process(rgb)
            count = len(results.detections) if results.detections else 0
            face_counts.append(count)
    
    cap.release()
    if not face_counts:
        return 1
    return max(set(face_counts), key=face_counts.count)

def get_face_boxes(video_path: str, start_sec: float, end_sec: float) -> list:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    mid_time = (start_sec + end_sec) / 2
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(mid_time * fps))
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        return []
    
    boxes = []
    with mp_face.FaceDetection(model_selection=1, min_detection_confidence=0.5) as detector:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = detector.process(rgb)
        if results.detections:
            for det in results.detections[:2]:
                bbox = det.location_data.relative_bounding_box
                boxes.append({
                    'x': bbox.xmin, 'y': bbox.ymin,
                    'width': bbox.width, 'height': bbox.height
                })
    return boxes

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: python face_detector.py <video> <segments.json>'}))
        sys.exit(1)
    
    video_path = sys.argv[1]
    segments_json = sys.argv[2]
    
    if not Path(video_path).exists():
        print(json.dumps({'error': f'Video not found: {video_path}'}))
        sys.exit(1)
    
    with open(segments_json, 'r', encoding='utf-8') as f:
        segments = json.load(f)
    
    results = {}
    for seg in segments:
        seg_id = seg['id']
        start = float(seg['start_seconds'])
        end = float(seg['end_seconds'])
        
        face_count = detect_faces_in_segment(video_path, start, end)
        mode = 'SPLIT' if face_count >= 2 else 'CENTER'
        
        result = {'face_count': face_count, 'mode': mode}
        if mode == 'SPLIT':
            boxes = get_face_boxes(video_path, start, end)
            if len(boxes) >= 2:
                result['boxes'] = boxes[:2]
        
        results[seg_id] = result
    
    print(json.dumps(results))

if __name__ == '__main__':
    main()
```

### 1.2 Node.js Wrapper

```typescript
// src/core/faceDetector.ts
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Segment {
  id: string;
  start_seconds: number;
  end_seconds: number;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FaceResult {
  face_count: number;
  mode: 'CENTER' | 'SPLIT';
  boxes?: BoundingBox[];
}

export async function detectFaces(
  videoPath: string,
  segments: Segment[]
): Promise<Record<string, FaceResult>> {
  const tempDir = os.tmpdir();
  const segmentsPath = path.join(tempDir, `segments-${Date.now()}.json`);
  fs.writeFileSync(segmentsPath, JSON.stringify(segments));
  
  const scriptPath = path.join(__dirname, '../../scripts/face_detector.py');
  
  return new Promise((resolve) => {
    const python = spawn('python', [scriptPath, videoPath, segmentsPath]);
    let stdout = '';
    
    python.stdout.on('data', (data) => { stdout += data.toString(); });
    
    python.on('close', (code) => {
      try { fs.unlinkSync(segmentsPath); } catch {}
      
      if (code !== 0) {
        const fallback: Record<string, FaceResult> = {};
        segments.forEach(seg => {
          fallback[seg.id] = { face_count: 1, mode: 'CENTER' };
        });
        resolve(fallback);
        return;
      }
      
      try {
        resolve(JSON.parse(stdout));
      } catch {
        const fallback: Record<string, FaceResult> = {};
        segments.forEach(seg => {
          fallback[seg.id] = { face_count: 1, mode: 'CENTER' };
        });
        resolve(fallback);
      }
    });
    
    python.on('error', () => {
      try { fs.unlinkSync(segmentsPath); } catch {}
      const fallback: Record<string, FaceResult> = {};
      segments.forEach(seg => {
        fallback[seg.id] = { face_count: 1, mode: 'CENTER' };
      });
      resolve(fallback);
    });
  });
}

export async function checkPythonAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn('python', ['--version']);
    p.on('close', (code) => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
}

export async function checkMediaPipeInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn('python', ['-c', 'import mediapipe']);
    p.on('close', (code) => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
}
```

---

## 2. Auto-Install FFmpeg & yt-dlp

```typescript
// src/core/installer.ts
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, execSync } from 'child_process';
import { createWriteStream } from 'fs';
import extractZip from 'extract-zip';
import tar from 'tar';

const AUTOCLIPER_DIR = path.join(os.homedir(), '.autocliper');
const BIN_DIR = path.join(AUTOCLIPER_DIR, 'bin');

const URLS = {
  ffmpeg: {
    win32: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    darwin: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
    linux: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz'
  },
  ytdlp: {
    win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
    linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'
  }
};

export function ensureDirs(): void {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

export function getBinPath(tool: 'ffmpeg' | 'yt-dlp'): string {
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(BIN_DIR, `${tool}${ext}`);
}

export function isToolInstalled(tool: 'ffmpeg' | 'yt-dlp'): boolean {
  if (fs.existsSync(getBinPath(tool))) return true;
  try {
    execSync(`${tool} -version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function getToolPath(tool: 'ffmpeg' | 'yt-dlp'): string {
  const binPath = getBinPath(tool);
  return fs.existsSync(binPath) ? binPath : tool;
}

async function download(url: string, dest: string, onProgress?: (p: number) => void): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  
  const total = parseInt(res.headers.get('content-length') || '0', 10);
  let downloaded = 0;
  const writer = createWriteStream(dest);
  const reader = res.body?.getReader();
  
  if (!reader) throw new Error('No body');
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    writer.write(Buffer.from(value));
    downloaded += value.length;
    if (total > 0 && onProgress) onProgress(Math.round((downloaded / total) * 100));
  }
  
  writer.end();
  await new Promise((r, j) => { writer.on('finish', r); writer.on('error', j); });
}

export async function installFFmpeg(onProgress?: (p: number) => void): Promise<boolean> {
  ensureDirs();
  const platform = process.platform as 'win32' | 'darwin' | 'linux';
  const url = URLS.ffmpeg[platform];
  if (!url) return false;
  
  const tempDir = path.join(os.tmpdir(), `ffmpeg-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    const ext = platform === 'linux' ? '.tar.xz' : '.zip';
    const archive = path.join(tempDir, `ffmpeg${ext}`);
    
    await download(url, archive, onProgress);
    
    if (platform === 'linux') {
      await tar.extract({ file: archive, cwd: tempDir });
    } else {
      await extractZip(archive, { dir: tempDir });
    }
    
    // Find and copy ffmpeg binary
    const findBin = (dir: string): string | null => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = findBin(full);
          if (found) return found;
        } else if (entry.name === 'ffmpeg' || entry.name === 'ffmpeg.exe') {
          return full;
        }
      }
      return null;
    };
    
    const bin = findBin(tempDir);
    if (bin) {
      fs.copyFileSync(bin, getBinPath('ffmpeg'));
      if (platform !== 'win32') fs.chmodSync(getBinPath('ffmpeg'), 0o755);
    }
    
    fs.rmSync(tempDir, { recursive: true, force: true });
    return isToolInstalled('ffmpeg');
  } catch {
    fs.rmSync(tempDir, { recursive: true, force: true });
    return false;
  }
}

export async function installYtDlp(onProgress?: (p: number) => void): Promise<boolean> {
  ensureDirs();
  const platform = process.platform as 'win32' | 'darwin' | 'linux';
  const url = URLS.ytdlp[platform];
  if (!url) return false;
  
  try {
    await download(url, getBinPath('yt-dlp'), onProgress);
    if (platform !== 'win32') fs.chmodSync(getBinPath('yt-dlp'), 0o755);
    return isToolInstalled('yt-dlp');
  } catch {
    return false;
  }
}

export async function installMediaPipe(): Promise<boolean> {
  return new Promise((resolve) => {
    const pip = spawn('pip', ['install', 'mediapipe', 'opencv-python', '-q']);
    pip.on('close', (code) => resolve(code === 0));
    pip.on('error', () => resolve(false));
  });
}
```

---

## 3. GitHub Actions Polling

```typescript
// src/services/github.ts
import { setTimeout } from 'timers/promises';

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

interface JobPayload {
  jobId: string;
  videoUrl: string;
  props: Record<string, unknown>;
}

interface WorkflowRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
}

const API = 'https://api.github.com';

export class GitHubService {
  private headers: Record<string, string>;
  
  constructor(private config: GitHubConfig) {
    this.headers = {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }
  
  async triggerRender(payload: JobPayload): Promise<number | undefined> {
    const url = `${API}/repos/${this.config.owner}/${this.config.repo}/dispatches`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        event_type: 'render-video',
        client_payload: payload
      })
    });
    
    if (!res.ok) throw new Error('Failed to trigger workflow');
    
    await setTimeout(3000);
    return this.findLatestRunId();
  }
  
  async findLatestRunId(): Promise<number | undefined> {
    const url = `${API}/repos/${this.config.owner}/${this.config.repo}/actions/runs?per_page=1`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.workflow_runs?.[0]?.id;
  }
  
  async getRunStatus(runId: number): Promise<WorkflowRun> {
    const url = `${API}/repos/${this.config.owner}/${this.config.repo}/actions/runs/${runId}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error('Failed to get status');
    const data = await res.json();
    return { id: data.id, status: data.status, conclusion: data.conclusion };
  }
  
  async getArtifactUrl(runId: number): Promise<string | undefined> {
    const url = `${API}/repos/${this.config.owner}/${this.config.repo}/actions/runs/${runId}/artifacts`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.artifacts?.[0]?.archive_download_url;
  }
  
  async pollUntilComplete(
    runId: number,
    onProgress?: (s: WorkflowRun) => void,
    timeoutMs = 1800000
  ): Promise<WorkflowRun> {
    const start = Date.now();
    
    while (true) {
      const status = await this.getRunStatus(runId);
      onProgress?.(status);
      
      if (status.status === 'completed') return status;
      if (Date.now() - start > timeoutMs) throw new Error('Timeout');
      
      await setTimeout(10000);
    }
  }
}
```

---

## 4. Remotion Components

### 4.1 ViralClip.tsx

```tsx
// remotion-renderer/src/compositions/ViralClip.tsx
import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, useVideoConfig } from 'remotion';
import { Subtitle } from './Subtitle';
import { HookOverlay } from './HookOverlay';
import { SplitScreen } from './SplitScreen';
import { SegmentProps } from '../types';

export const ViralClip: React.FC<SegmentProps> = (props) => {
  const { width, height } = useVideoConfig();
  const { videoSrc, videoStartTime, cropMode, boxes, words, subtitleStyle, hookText, hookStyle } = props;
  
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {cropMode === 'SPLIT' && boxes?.length >= 2 ? (
        <SplitScreen videoSrc={videoSrc} startTime={videoStartTime} boxes={boxes} />
      ) : (
        <CenterCrop videoSrc={videoSrc} startTime={videoStartTime} />
      )}
      
      {hookStyle.show && (
        <Sequence from={0} durationInFrames={hookStyle.durationFrames}>
          <HookOverlay text={hookText} style={hookStyle} />
        </Sequence>
      )}
      
      <Subtitle words={words} style={subtitleStyle} segmentStartTime={videoStartTime} />
    </AbsoluteFill>
  );
};

const CenterCrop: React.FC<{ videoSrc: string; startTime: number }> = ({ videoSrc, startTime }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={videoSrc}
        startFrom={Math.floor(startTime * fps)}
        style={{
          width: '177.78%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)'
        }}
      />
    </AbsoluteFill>
  );
};
```

### 4.2 SplitScreen.tsx

```tsx
// remotion-renderer/src/compositions/SplitScreen.tsx
import React from 'react';
import { AbsoluteFill, OffthreadVideo, useVideoConfig } from 'remotion';

interface Box { x: number; y: number; width: number; height: number; }

interface Props {
  videoSrc: string;
  startTime: number;
  boxes: Box[];
}

export const SplitScreen: React.FC<Props> = ({ videoSrc, startTime, boxes }) => {
  const { width, height, fps } = useVideoConfig();
  const half = height / 2;
  const sorted = [...boxes].sort((a, b) => a.y - b.y);
  
  return (
    <AbsoluteFill>
      {/* Top */}
      <div style={{ position: 'absolute', top: 0, width, height: half - 2, overflow: 'hidden' }}>
        <OffthreadVideo
          src={videoSrc}
          startFrom={Math.floor(startTime * fps)}
          style={{
            width: '200%', height: '200%',
            objectFit: 'cover',
            objectPosition: `${(sorted[0].x + sorted[0].width/2)*100}% ${(sorted[0].y + sorted[0].height/2)*100}%`,
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)'
          }}
        />
      </div>
      
      {/* Divider */}
      <div style={{ position: 'absolute', top: half - 2, width, height: 4, backgroundColor: '#fff' }} />
      
      {/* Bottom */}
      <div style={{ position: 'absolute', top: half + 2, width, height: half - 2, overflow: 'hidden' }}>
        <OffthreadVideo
          src={videoSrc}
          startFrom={Math.floor(startTime * fps)}
          style={{
            width: '200%', height: '200%',
            objectFit: 'cover',
            objectPosition: `${(sorted[1].x + sorted[1].width/2)*100}% ${(sorted[1].y + sorted[1].height/2)*100}%`,
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)'
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
```

### 4.3 HookOverlay.tsx

```tsx
// remotion-renderer/src/compositions/HookOverlay.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

interface Style {
  durationFrames: number;
  fontFamily: string;
  fontSize: number;
  backgroundColor: string;
  position: 'top' | 'bottom';
}

export const HookOverlay: React.FC<{ text: string; style: Style }> = ({ text, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [style.durationFrames - 15, style.durationFrames], [1, 0], { extrapolateLeft: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);
  
  const slide = spring({ frame, fps, config: { damping: 15 } });
  const translateY = interpolate(slide, [0, 1], [style.position === 'top' ? -50 : 50, 0]);
  
  return (
    <AbsoluteFill style={{
      justifyContent: style.position === 'top' ? 'flex-start' : 'flex-end',
      alignItems: 'center',
      padding: 40,
      opacity
    }}>
      <div style={{
        backgroundColor: style.backgroundColor,
        padding: '16px 24px',
        borderRadius: 12,
        maxWidth: '90%',
        transform: `translateY(${translateY}px)`,
        marginTop: style.position === 'top' ? 60 : 0,
        marginBottom: style.position === 'bottom' ? 300 : 0
      }}>
        <p style={{
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: 700,
          color: '#fff',
          margin: 0,
          textAlign: 'center'
        }}>{text}</p>
      </div>
    </AbsoluteFill>
  );
};
```

### 4.4 Subtitle.tsx

```tsx
// remotion-renderer/src/compositions/Subtitle.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface Word { word: string; start: number; end: number; punctuatedWord: string; }
interface Style {
  fontFamily: string; fontSize: number; fontWeight: number;
  color: string; highlightColor: string; strokeColor: string;
  strokeWidth: number; position: 'bottom' | 'center';
}

export const Subtitle: React.FC<{ words: Word[]; style: Style; segmentStartTime: number }> = ({
  words, style, segmentStartTime
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = segmentStartTime + frame / fps;
  
  const { visible, activeIdx } = getVisible(words, currentTime, 5);
  if (!visible.length) return null;
  
  const shadow = Array.from({ length: style.strokeWidth * 2 + 1 }, (_, i) => i - style.strokeWidth)
    .flatMap(x => Array.from({ length: style.strokeWidth * 2 + 1 }, (_, j) => j - style.strokeWidth)
      .filter(y => x || y).map(y => `${x}px ${y}px 0 ${style.strokeColor}`))
    .join(',');
  
  return (
    <AbsoluteFill style={{
      justifyContent: style.position === 'bottom' ? 'flex-end' : 'center',
      alignItems: 'center',
      paddingBottom: style.position === 'bottom' ? 200 : 0
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, padding: '0 40px' }}>
        {visible.map((w, i) => {
          const active = i === activeIdx;
          const startFrame = Math.floor((w.start - segmentStartTime) * fps);
          const anim = spring({ frame: frame - startFrame, fps, config: { damping: 12, stiffness: 200 } });
          const scale = active ? interpolate(anim, [0, 1], [1, 1.15]) : 1;
          
          return (
            <span key={`${w.word}-${w.start}`} style={{
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              color: active ? style.highlightColor : style.color,
              textShadow: shadow,
              transform: `scale(${scale})`,
              display: 'inline-block'
            }}>{w.punctuatedWord}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

function getVisible(words: Word[], time: number, size: number) {
  let idx = words.findIndex(w => w.start <= time && w.end >= time);
  if (idx === -1) idx = Math.max(0, words.findIndex(w => w.start > time) - 1);
  const start = Math.max(0, idx - Math.floor(size / 2));
  const end = Math.min(words.length, start + size);
  return { visible: words.slice(start, end), activeIdx: idx - start };
}
```

---

## 5. Post-Processing

```typescript
// src/services/postProcess.ts
import { spawn } from 'child_process';
import { getToolPath } from '../core/installer.js';

const SOFTWARE = ['Adobe Premiere Pro 2025', 'DaVinci Resolve 19', 'Final Cut Pro 11', 'CapCut'];
const ARTISTS = ['Content Creator', 'Video Editor', 'Media Producer'];

const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randDate = () => new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();

export async function postProcess(input: string, output: string): Promise<void> {
  const ffmpeg = getToolPath('ffmpeg');
  
  const args = [
    '-i', input,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-metadata', `software=${rand(SOFTWARE)}`,
    '-metadata', `artist=${rand(ARTISTS)}`,
    '-metadata', `creation_time=${randDate()}`,
    '-map_metadata', '-1',
    '-y', output
  ];
  
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args);
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error('FFmpeg failed')));
    proc.on('error', reject);
  });
}
```

---

## 6. Retry Logic

```typescript
// src/utils/retry.ts
import { setTimeout } from 'timers/promises';

interface Options {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (err: Error, attempt: number) => void;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: Options = {}): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000, onRetry } = opts;
  let lastErr: Error;
  
  for (let i = 1; i <= maxRetries + 1; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e as Error;
      if (i > maxRetries) break;
      const delay = Math.min(baseDelayMs * 2 ** (i - 1), maxDelayMs);
      onRetry?.(lastErr, i);
      await setTimeout(delay);
    }
  }
  throw lastErr!;
}

export const retryApi = <T>(fn: () => Promise<T>, name: string) =>
  withRetry(fn, { onRetry: (_, i) => console.log(`  ! ${name} retry ${i}/3`) });
```

---

## 7. Build Configuration

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  minify: true,
  shims: true,
  banner: { js: '#!/usr/bin/env node' }
});
```

### package.json scripts

```json
{
  "scripts": {
    "build": "tsup",
    "pkg": "pkg dist/cli.js -t node20-win-x64,node20-macos-x64,node20-linux-x64 -o dist/autocliper"
  },
  "pkg": {
    "assets": ["scripts/**/*"],
    "outputPath": "dist"
  }
}
```

---

## 8. GitHub Actions Workflow

```yaml
# remotion-renderer/.github/workflows/render.yml
name: Render
on:
  repository_dispatch:
    types: [render-video]

jobs:
  render:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - uses: browser-actions/setup-chrome@v1
      
      - run: curl -L -o public/source.mp4 "${{ github.event.client_payload.videoUrl }}"
      - run: echo '${{ toJson(github.event.client_payload.props) }}' > props.json
      
      - run: npx remotion render ViralClip out/output.mp4 --props=props.json
        env:
          PUPPETEER_EXECUTABLE_PATH: /usr/bin/google-chrome-stable
      
      - uses: actions/upload-artifact@v4
        with:
          name: video-${{ github.event.client_payload.jobId }}
          path: out/output.mp4
          retention-days: 1
```

---

*PRD Part 2 Complete*
