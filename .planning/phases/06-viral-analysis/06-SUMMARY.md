---
phase: 06-viral-analysis
plan: 06
subsystem: ai-analysis
tags: [@google/genai, gemini-2.5-flash, viral-detection, 3-act-framework]

# Dependency graph
requires:
  - phase: 05-transcription
    provides: TranscriptResult with word-level timestamps
provides:
  - ViralSegment interface with rank, timestamps, hook_category, viral_score
  - analyzeViral() function for Gemini AI-based segment detection
  - 3-Act framework prompt template (HOOK, TENSION, PAYOFF)
affects: [07-props-builder, 08-github-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI prompt engineering with 3-Act framework for viral content"
    - "Timestamp injection in transcripts for segment localization"
    - "Response parsing with markdown code block removal"

key-files:
  created: [src/core/analyzer.ts]
  modified: [src/commands/run.ts]

key-decisions:
  - "Use @google/genai SDK exclusively (forbidden @google/generative-ai)"
  - "Model locked to gemini-2.5-flash for fast, cost-effective analysis"
  - "Timestamps embedded every 30 words for precise segment localization"
  - "Exponential backoff retry for API resilience (3 retries, 30s max)"

patterns-established:
  - "Viral content analysis pattern: HOOK (0-3s) -> TENSION (3-25s) -> PAYOFF (end)"
  - "Hook categorization: CURIOSITY, CONTROVERSY, RELATABILITY, SHOCK, STORY, CHALLENGE"
  - "Viral scoring: 0-100 scale with confidence levels (HIGH/MEDIUM/LOW)"

# Metrics
duration: 3min
completed: 2026-01-30
---

# Phase 06: Viral Analysis Summary

**Gemini AI-powered viral segment detection using 3-Act framework with @google/genai SDK and gemini-2.5-flash model**

## Performance

- **Duration:** 3 min (Started: 2026-01-30T02:57:48Z, Completed: 2026-01-30T03:00:25Z)
- **Tasks:** 9
- **Files modified:** 2

## Accomplishments

- Implemented complete viral analysis service with Gemini AI integration
- Created 3-Act framework prompt template for viral content detection
- Built timestamp-aware transcript processing for segment localization
- Integrated analysis step into main CLI pipeline with formatted output

## Task Commits

Each task was committed atomically:

1. **Task 01-09: Viral analysis implementation** - `9a3ba75` (feat)

**Plan metadata:** Pending docs commit

_Note: Tasks 01-08 were all part of creating the analyzer.ts module, committed as a single unit._

## Files Created/Modified

- `src/core/analyzer.ts` - Viral segment detection using Gemini AI with 3-Act framework
  - ViralSegment interface with rank, timestamps, hook_category, viral_score, confidence
  - AnalysisResult interface wrapping detected segments
  - buildTranscriptWithTimestamps() - embeds [HH:MM:SS] every 30 words
  - analyzeViral() - main function calling Gemini gemini-2.5-flash
  - formatTimestamp/parseTimestamp - HH:MM:SS conversion utilities
  - parseJsonResponse() - strips markdown code blocks, validates structure
  - retryApi() - exponential backoff wrapper for API calls
  - Error codes: [E030] API key missing, [E031] API request failed, [E032] Invalid response, [E033] No segments found

- `src/commands/run.ts` - Updated to integrate viral analysis step
  - Import analyzeViral from analyzer module
  - Step 4: Analyze with Gemini after transcription
  - Display each segment with rank, timestamps, score, category, hook text
  - Updated "next steps" message to reflect Phase 07 tasks

## Decisions Made

- Used `get<string>('api.gemini')` from config module instead of non-existent getApiKey() (Rule 3 - Blocking)
- Config options: maxSegments defaults to 5 (CLI --max flag overrides), minDuration 30s, maxDuration 90s
- Temperature 0.3, topP 0.8 for consistent viral segment detection
- 4096 maxOutputTokens sufficient for 5 segments with explanations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed config import to use correct API**
- **Found during:** Task 06-01 (Build verification)
- **Issue:** analyzer.ts imported non-existent getApiKey function from config module
- **Fix:** Changed to use `get<string>('api.gemini')` which is the actual exported function
- **Files modified:** src/core/analyzer.ts
- **Verification:** Build succeeded after fix
- **Committed in:** 9a3ba75 (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Import fix necessary for build. No scope creep.

## Issues Encountered

None - all tasks completed as specified.

## User Setup Required

None - no external service configuration beyond existing Gemini API key (set up in Phase 02).

## Next Phase Readiness

- Viral analysis service complete and integrated into run command
- ViralSegment interface ready for Remotion props generation in Phase 07
- Timestamp utilities (formatTimestamp, parseTimestamp) available for subtitle sync
- Ready to build Remotion props JSON from detected segments

---
*Phase: 06-viral-analysis*
*Completed: 2026-01-30*
