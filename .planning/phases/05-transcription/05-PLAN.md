---
wave: 5
depends_on: [04]
files_modified:
  - src/core/transcriber.ts
  - src/commands/run.ts
autonomous: true
---

# PLAN: Phase 05 - Transcription Service

## Phase Goal

Transcribe audio using Deepgram Nova-3 API with word-level timestamps.

---

## must_haves

1. Deepgram v4 SDK integration (NOT v3)
2. Word-level timestamps
3. Punctuation and smart formatting
4. Error handling with [E02x] codes
5. Retry logic for API failures
6. Support for Indonesian and English

---

## Tasks

<task>
<id>05-01</id>
<name>Create transcriber module</name>
Create src/core/transcriber.ts:
- Import createClient from @deepgram/sdk (v4)
- Interfaces: Word, TranscriptResult
- Language config: 'id' or 'en'
</task>

<task>
<id>05-02</id>
<name>Implement transcription function</name>
Add transcribe() to transcriber.ts:
- Create Deepgram client with API key
- Read audio file as Buffer
- Call deepgram.listen.prerecorded.transcribeFile()
- Options: model='nova-3', smart_format=true, punctuate=true
- Extract: transcript, words with timestamps, duration
- Return TranscriptResult
</task>

<task>
<id>05-03</id>
<name>Define Word interface</name>
Add to transcriber.ts:
- word: string (raw word)
- start: number (seconds)
- end: number (seconds)
- confidence: number (0-1)
- punctuated_word: string (with punctuation)
</task>

<task>
<id>05-04</id>
<name>Implement error handling</name>
Add to transcribe():
- Wrap API call in try-catch
- Error [E020]: API key not configured
- Error [E021]: API key invalid
- Error [E022]: Transcription failed
- Error [E023]: Audio file invalid
- Include retry with retryApi wrapper
</task>

<task>
<id>05-05</id>
<name>Add language detection</name>
Add to transcriber.ts:
- detectLanguage(audioPath): Optional heuristic
- Default to 'id' (Indonesian)
- Config override via config.get('preferences.language')
</task>

<task>
<id>05-06</id>
<name>Update run command - transcription step</name>
Update src/commands/run.ts:
- Display "> Transcribing with Deepgram..."
- Show model: nova-3
- Show duration from audio
- Call transcribe() with retry
- Display "+ Transcript ready (N words)"
- Pass transcript and words to next step
</task>

<task>
<id>05-07</id>
<name>Add transcript formatting</name>
Add utility function to transcriber.ts:
- formatTranscript(): Pretty print for debugging
- wordTimestampsTable(): Display timing data
- Only used in verbose mode
</task>

---

## Verification Criteria

- [ ] Deepgram v4 SDK used (createClient import)
- [ ] NOT using @deepgram/sdk v3 patterns
- [ ] Audio file transcribed successfully
- [ ] Word array contains timestamps (start, end)
- [ ] Transcript includes punctuation
- [ ] Words include punctuated_word field
- [ ] API key missing shows [E020]
- [ ] Invalid API key shows [E021]
- [ ] Retry triggers on network failures
- [ ] Transcript shows word count in success message
- [ ] Duration displayed from result metadata

---

## Notes

- CRITICAL: Use @deepgram/sdk v4 only - createClient() pattern
- FORBIDDEN: Do NOT use v3 new Deepgram() pattern
- Model: nova-3 (locked)
- Language: default Indonesian ('id'), configurable
- Retry with exponential backoff via retryApi()
- Don't log transcript content (privacy)
