---
wave: 10
depends_on: [09]
files_modified:
  - src/services/postProcess.ts
  - src/services/github.ts
  - src/commands/run.ts
autonomous: true
---

# PLAN: Phase 10 - Post-Processing & Main Pipeline

## Phase Goal

Download rendered videos, apply metadata randomization, and wire complete end-to-end pipeline.

---

## must_haves

1. Download rendered video from GitHub artifacts
2. Metadata randomization (software, artist, creation_time)
3. FFmpeg re-encoding with libx264
4. Save to ~/Downloads/autocliper/
5. Complete pipeline orchestration in run command
6. Cleanup of temporary files

---

## Tasks

<task>
<id>10-01</id>
<name>Create post-process service</name>
Create src/services/postProcess.ts:
- Interfaces: PostProcessOptions
- SOFTWARE array: ['Adobe Premiere Pro 2025', 'DaVinci Resolve 19', ...]
- ARTISTS array: ['Content Creator', 'Video Editor', ...]
- rand<T>() utility
- randDate() utility
</task>

<task>
<id>10-02</id>
<name>Implement downloadArtifact()</name>
Add to github.ts (or postProcess.ts):
- Download from GitHub Actions artifact URL
- Extract zip if needed
- Save to temp location
- Return path to downloaded video
- Error [E044]: Download failed
- Use retry wrapper
</task>

<task>
<id>10-03</id>
<name>Implement metadata randomization</name>
In postProcess.ts:
- postProcess(input, output): Main function
- FFmpeg args:
  - -c:v libx264 -preset medium -crf 23
  - -c:a aac -b:a 128k
  - -movflags +faststart
  - -metadata software={random}
  - -metadata artist={random}
  - -metadata creation_time={random}
  - -map_metadata -1 (strip existing)
- Spawn FFmpeg process
</task>

<task>
<id>10-04</id>
<name>Implement output directory creation</name>
In postProcess.ts:
- getOutputDir(): Return ~/Downloads/autocliper/
- Create directory if missing
- Use path.join + os.homedir()
- Error [E050]: Output directory creation failed
</task>

<task>
<id>10-05</id>
<name>Implement filename generation</name>
In postProcess.ts:
- generateFilename(segment, index): Format string
- Pattern: video-{index:03d}-{hook_excerpt}.mp4
- Sanitize hook text for filename
- Avoid duplicate filenames
</task>

<task>
<id>10-06</id>
<name>Wire complete pipeline in run command</name>
Update src/commands/run.ts completely:
1. Parse URL and --max flag
2. Check config exists
3. Download video (downloader)
4. Extract audio (downloader)
5. Transcribe (transcriber)
6. Analyze for viral segments (analyzer)
7. Detect faces (faceDetector)
8. Build props (propsBuilder)
9. Upload video (storage)
10. Trigger render (github)
11. Poll for completion (github)
12. Download results (github)
13. Post-process each video (postProcess)
14. Save to output directory
15. Cleanup temp files
16. Display summary
</task>

<task>
<id>10-07</id>
<name>Add pipeline progress display</name>
In run command:
- Display major step headers (>)
- Display success (+) after each step
- Display progress bars for long operations
- Display "--- Monitoring ---" during polling
- Display "--- Complete ---" with output location
- List all generated files
</task>

<task>
<id>10-08</id>
<name>Implement cleanup function</name>
In run command:
- cleanup(tempFiles): Array of paths to remove
- Call on success or error
- Use fs.unlink with error handling
- Never leave temp files
</task>

<task>
<id>10-09</id>
<name>Add error recovery</name>
In run command:
- Wrap pipeline in try-catch
- On error: Cleanup + Display error with code
- Offer guidance for common errors
- Partial results saved if possible
</task>

<task>
<id>10-10</id>
<name>Implement --max segments flag</name>
In run command:
- Parse --max or -m argument
- Limit segments passed to analyzer
- Limit render jobs triggered
- Default: 5 segments
</task>

---

## Verification Criteria

- [ ] Complete pipeline executes end-to-end
- [ ] YouTube URL downloaded successfully
- [ ] Audio transcribed with word timestamps
- [ ] Viral segments identified
- [ ] Faces detected (or CENTER fallback)
- [ ] Props generated for each segment
- [ ] Video uploaded to temp storage
- [ ] GitHub Actions triggered
- [ ] Rendering completes (polling works)
- [ ] Rendered videos downloaded
- [ ] Metadata randomized in output
- [ ] Videos saved to ~/Downloads/autocliper/
- [ ] Filenames follow pattern: video-XXX-*.mp4
- [ ] Temporary files cleaned up
- [ ] Error at any step shows correct error code
- [ ] --max flag limits segments
- [ ] Progress displayed throughout
- [ ] Summary shows output location and file count

---

## Notes

- Output folder: ~/Downloads/autocliper/ (FIXED, never change)
- Error codes: E050-E059 for post-process domain
- Cleanup is mandatory - never leave temp files
- Partial results: Save what completed before error
- FFmpeg preset: medium (balance speed/quality)
- CRF 23 for good quality at reasonable size
- Metadata randomization prevents platform detection
