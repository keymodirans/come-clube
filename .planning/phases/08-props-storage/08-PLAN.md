---
wave: 8
depends_on: [07]
files_modified:
  - src/core/propsBuilder.ts
  - src/services/storage.ts
  - src/commands/run.ts
autonomous: true
---

# PLAN: Phase 08 - Props Builder & Storage

## Phase Goal

Generate Remotion render props and upload source video to temporary storage.

---

## must_haves

1. Remotion props JSON matching schema
2. Words array with timestamps for subtitles
3. Hook overlay configuration
4. Subtitle style configuration
5. Video upload to temporary storage (file.io)
6. Proper error handling with [E04x] codes

---

## Tasks

<task>
<id>08-01</id>
<name>Create props builder module</name>
Create src/core/propsBuilder.ts:
- Interfaces: SegmentProps, SubtitleStyle, HookStyle, CropData
- buildProps(): Main function generating Remotion props
- calculateDuration(): Convert segment duration to frames
</task>

<task>
<id>08-02</id>
<name>Define Remotion props schema</name>
Add interfaces to propsBuilder.ts:
- id: string (segment identifier)
- fps: number (30)
- width: number (1080)
- height: number (1920)
- durationInFrames: number
- videoSrc: string (URL after upload)
- videoStartTime: number (seconds)
- cropMode: 'CENTER' | 'SPLIT'
- cropData?: {x, y, width, height}
- words: Word[] (for subtitles)
- subtitleStyle: SubtitleStyle
- hookText: string
- hookStyle: HookStyle
</task>

<task>
<id>08-03</id>
<name>Implement subtitle style defaults</name>
Define SubtitleStyle interface:
- fontFamily: 'Montserrat' (default)
- fontSize: 48
- fontWeight: 800
- color: '#FFFFFF'
- highlightColor: '#FFFF00'
- strokeColor: '#000000'
- strokeWidth: 4
- position: 'bottom' | 'center'
</task>

<task>
<id>08-04</id>
<name>Implement hook style defaults</name>
Define HookStyle interface:
- show: true
- durationFrames: 90 (3 seconds @ 30fps)
- fontFamily: 'Montserrat'
- fontSize: 32
- backgroundColor: 'rgba(0,0,0,0.7)'
- position: 'top' | 'bottom'
</task>

<task>
<id>08-05</id>
<name>Implement props builder logic</name>
In buildProps():
- Map ViralSegment to SegmentProps
- Calculate durationInFrames from segment duration
- Filter words for segment time range
- Set cropMode from face detection result
- Include cropData if SPLIT mode with boxes
- Generate unique ID using nanoid
</task>

<task>
<id>08-06</id>
<name>Create storage service</name>
Create src/services/storage.ts:
- uploadFile(): Upload to temporary storage
- Uses file.io API (or similar)
- Returns download URL
- Error handling with retry
</task>

<task>
<id>08-07</id>
<name>Implement file upload</name>
In uploadFile():
- Read file as Buffer
- POST to file.io with form data
- Parse JSON response for link field
- Return download URL
- Error [E040]: Upload failed
- Error [E041]: Invalid response
- Wrap with retryApi
</task>

<task>
<id>08-08</id>
<name>Update run command - props and upload</name>
Update src/commands/run.ts:
- Display "> Uploading source video..."
- Call storage.uploadFile() with video path
- Display "+ Uploaded to temp storage"
- Display "> Generating render props..."
- Build props for each segment
- Save props to file for debugging (optional)
</task>

---

## Verification Criteria

- [ ] Props JSON matches Remotion schema
- [ ] Each segment has unique ID
- [ ] durationInFrames calculated correctly
- [ ] Words filtered to segment time range
- [ ] cropMode matches face detection (CENTER/SPLIT)
- [ ] SPLIT mode includes cropData with boxes
- [ ] Subtitle style has all required fields
- [ ] Hook style has all required fields
- [ ] Video uploaded to temporary storage
- [ ] Download URL returned and valid
- [ ] Props include videoSrc (download URL)
- [ ] Upload failure shows [E040]
- [ ] Invalid response shows [E041]

---

## Notes

- Temporary storage: file.io (100 files/day free)
- Alternative: transfer.sh, tempfile.io (fallbacks)
- Video URL must be publicly accessible for GitHub Actions
- Props saved as JSON for debugging (optional, verbose mode)
- Words array: punctuated_word, start, end for each word
- Hook text: First 3-5 words of segment or hook_text from analysis
