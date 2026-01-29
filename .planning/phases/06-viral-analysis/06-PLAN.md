---
wave: 6
depends_on: [05]
files_modified:
  - src/core/analyzer.ts
  - src/commands/run.ts
autonomous: true
---

# PLAN: Phase 06 - Viral Analysis Service

## Phase Goal

Identify viral-worthy video segments using Gemini AI with 3-Act framework.

---

## must_haves

1. Gemini API integration using @google/genai
2. 3-Act framework prompt (HOOK, TENSION, PAYOFF)
3. Segment detection with timestamps
4. Hook category classification
5. Viral scoring
6. Error handling with [E03x] codes

---

## Tasks

<task>
<id>06-01</id>
<name>Create analyzer module</name>
Create src/core/analyzer.ts:
- Import GoogleGenAI from @google/genai
- Interfaces: ViralSegment, AnalysisResult
- Config: maxSegments, minDuration, maxDuration
</task>

<task>
<id>06-02</id>
<name>Define ViralSegment interface</name>
Add to analyzer.ts:
- rank: number (1 = best)
- start: string (HH:MM:SS format)
- end: string
- duration_seconds: number
- hook_text: string
- hook_category: CURIOSITY|CONTROVERSY|RELATABILITY|SHOCK|STORY|CHALLENGE
- why_viral: string
- viral_score: number (0-100)
- confidence: HIGH|MEDIUM|LOW
</task>

<task>
<id>06-03</id>
<name>Create 3-Act prompt template</name>
Add PROMPT_TEMPLATE to analyzer.ts:
- ROLE: Viral Content Analyst with 10y experience
- TASK: Find segments with viral potential
- KRITERIA: Duration, standalone, hook requirement
- FRAMEWORK: 3-Act (HOOK 0-3s, TENSION 3-25s, PAYOFF end)
- HOOK CATEGORIES: 6 types with descriptions
- EXCLUDE criteria: too much context, weak hook, etc.
- OUTPUT FORMAT: JSON only
</task>

<task>
<id>06-04</id>
<name>Implement transcript with timestamps</name>
Add buildTranscriptWithTimestamps():
- Add [HH:MM:SS] every 30 words
- Include punctuated words
- Return formatted string for prompt
</task>

<task>
<id>06-05</id>
<name>Implement Gemini API call</name>
Add analyzeViral() to analyzer.ts:
- Create GoogleGenAI client with API key
- Build prompt with transcript + timestamps
- Call ai.models.generateContent()
- Model: gemini-2.5-flash (or gemini-2.0-flash)
- Config: temperature 0.3, topP 0.8, maxOutputTokens 4096
</task>

<task>
<id>06-06</id>
<name>Implement response parsing</name>
Add parseJsonResponse():
- Remove markdown code blocks (```json)
- Parse JSON string
- Validate against ViralSegment interface
- Throw [E032] on parse failure
</task>

<task>
<id>06-07</id>
<name>Implement error handling</name>
Add to analyzeViral():
- Error [E030]: API key not configured
- Error [E031]: API request failed
- Error [E032]: Invalid response format
- Error [E033]: No viral segments found
- Wrap in retryApi for retries
</task>

<task>
<id>06-08</id>
<name>Add timestamp utilities</name>
Add utility functions:
- formatTimestamp(seconds): Convert to HH:MM:SS
- parseTimestamp(hhmmss): Convert to seconds
- pad(n): Zero-pad numbers
</task>

<task>
<id>06-09</id>
<name>Update run command - analysis step</name>
Update src/commands/run.ts:
- Display "> Analyzing with Gemini..."
- Call analyzeViral() with words
- Display "+ Found N viral segments"
- Show each segment: rank, timestamps, score, category, hook
</task>

---

## Verification Criteria

- [ ] @google/genai used (NOT @google/generative-ai)
- [ ] Gemini model: gemini-2.5-flash or gemini-2.0-flash
- [ ] Prompt includes 3-Act framework
- [ ] All 6 hook categories documented
- [ ] Returns array of ViralSegment
- [ ] Each segment has rank, timestamps, hook_text, category, score
- [ ] Timestamps in HH:MM:SS format
- [ ] Viral scores 0-100
- [ ] Confidence levels: HIGH/MEDIUM/LOW
- [ ] API key missing shows [E030]
- [ ] No segments found shows [E033]
- [ ] Segments displayed in ranked order

---

## Notes

- CRITICAL: Use @google/genai (new SDK)
- FORBIDDEN: Do NOT use @google/generative-ai (deprecated, EOL Aug 2025)
- Model locked: gemini-2.5-flash or gemini-2.0-flash
- Language in prompt: Indonesian (matches transcript language)
- Segment limits: default 5, configurable via --max flag
- Duration range: 30-90 seconds default
