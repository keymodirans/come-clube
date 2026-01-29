---
wave: 4
depends_on: [03]
files_modified:
  - src/core/downloader.ts
  - src/utils/progress.ts
  - src/utils/retry.ts
  - src/commands/run.ts
autonomous: true
---

# PLAN: Phase 04 - Video Pipeline (Download + Audio)

## Phase Goal

Download YouTube videos and extract audio for transcription.

---

## must_haves

1. yt-dlp wrapper downloads video from URL
2. FFmpeg extracts audio to WAV format
3. Progress tracking during download
4. Retry logic with exponential backoff
5. Temporary file cleanup
6. Error handling with [E01x] codes

---

## Tasks

<task>
<id>04-01</id>
<name>Create retry utility</name>
Create src/utils/retry.ts:
- withRetry<T>() generic function
- Config: maxRetries, baseDelayMs, maxDelayMs, onRetry callback
- Exponential backoff calculation
- Throw last error after retries exhausted
- retryApi wrapper for API calls
</task>

<task>
<id>04-02</id>
<name>Create progress utility</name>
Create src/utils/progress.ts:
- createProgressBar() using cli-progress
- Download bar format: [=========>] 45% | 28MB/62MB
- Process indicators with ASCII symbols
</task>

<task>
<id>04-03</id>
<name>Create downloader module</name>
Create src/core/downloader.ts:
- Interfaces: DownloadOptions, DownloadResult
- getToolPath() from installer module
- Temporary directory using os.tmpdir()
</task>

<task>
<id>04-04</id>
<name>Implement video download</name>
Add downloadVideo() to downloader.ts:
- Spawn yt-dlp process
- Arguments: -f best, -o, --merge-output-format mp4
- Parse progress from stderr
- Update progress bar
- Return path to downloaded video
- Error code [E010] for download failures
</task>

<task>
<id>04-05</id>
<name>Implement audio extraction</name>
Add extractAudio() to downloader.ts:
- Spawn FFmpeg process
- Arguments: -i, -vn, -acodec pcm_s16le, -ar 16000, -ac 1
- Output: WAV format for Deepgram compatibility
- Return path to extracted audio
- Error code [E011] for extraction failures
</task>

<task>
<id>04-06</id>
<name>Implement temp file cleanup</name>
Add to downloader.ts:
- cleanup(files: string[]) function
- Use fs.unlink with error handling
- Call on successful completion or error
</task>

<task>
<id>04-07</id>
<name>Create URL validator</name>
Add to downloader.ts:
- isValidYouTubeUrl(url): RegExp validation
- Support: youtube.com, youtu.be, shorts
- Return boolean
</task>

<task>
<id>04-08</id>
<name>Update run command - download step</name>
Update src/commands/run.ts:
- Validate URL argument
- Check if FFmpeg/yt-dlp installed (error [E007])
- Display "> Downloading video..."
- Call downloadVideo() with retry
- Display "+ Download complete"
- Call extractAudio()
- Display "+ Audio extracted"
</task>

---

## Verification Criteria

- [ ] Valid YouTube URL downloads successfully
- [ ] yt-dlp progress shown during download
- [ ] Downloaded video is MP4 format
- [ ] Audio extraction produces WAV file
- [ ] WAV file is 16kHz mono (Deepgram compatible)
- [ ] Temporary files created in os.tmpdir()
- [ ] Cleanup removes temp files after processing
- [ ] Invalid URL shows error
- [ ] Download failure triggers retry
- [ ] Missing FFmpeg shows [E007] error
- [ ] All error codes in E010-E019 range

---

## Notes

- Use fluent-ffmpeg for cleaner FFmpeg calls
- Retry with exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
- yt-dlp path from installer.getToolPath('yt-dlp')
- FFmpeg path from installer.getToolPath('ffmpeg')
- Don't load entire video into memory - use streams
