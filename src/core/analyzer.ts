/**
 * Analyzer - Viral segment detection using Gemini AI
 *
 * Analyzes transcribed video content to identify segments with viral potential
 * using the 3-Act framework (HOOK, TENSION, PAYOFF)
 */

import { GoogleGenAI } from '@google/genai';
import { get } from '../utils/config.js';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Hook category types for viral content classification
 */
export type HookCategory =
  | 'CURIOSITY'
  | 'CONTROVERSY'
  | 'RELATABILITY'
  | 'SHOCK'
  | 'STORY'
  | 'CHALLENGE';

/**
 * Confidence level for viral segment detection
 */
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Viral segment detected by Gemini analysis
 */
export interface ViralSegment {
  /** Rank of segment (1 = best/most viral) */
  rank: number;
  /** Start timestamp in HH:MM:SS format */
  start: string;
  /** End timestamp in HH:MM:SS format */
  end: string;
  /** Segment duration in seconds */
  duration_seconds: number;
  /** The hook text that opens the segment */
  hook_text: string;
  /** Category of hook type */
  hook_category: HookCategory;
  /** Explanation of why this segment is viral */
  why_viral: string;
  /** Viral potential score (0-100) */
  viral_score: number;
  /** Confidence level in this detection */
  confidence: Confidence;
}

/**
 * Result of viral analysis
 */
export interface AnalysisResult {
  /** Detected viral segments, ranked by potential */
  segments: ViralSegment[];
  /** Total duration analyzed in seconds */
  total_duration: number;
  /** Number of segments requested */
  max_segments: number;
  /** Language of the transcript */
  language: string;
}

/**
 * Analysis configuration options
 */
export interface AnalysisOptions {
  /** Maximum number of segments to detect */
  maxSegments?: number;
  /** Minimum segment duration in seconds */
  minDuration?: number;
  /** Maximum segment duration in seconds */
  maxDuration?: number;
  /** Language code for prompt context */
  language?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG = {
  maxSegments: 5,
  minDuration: 30,
  maxDuration: 90,
  language: 'id',
} as const;

// ============================================================================
// 3-Act Framework Prompt Template
// ============================================================================

/**
 * Prompt template for Gemini viral content analysis
 * Uses 3-Act framework: HOOK (0-3s), TENSION (3-25s), PAYOFF (end)
 */
const PROMPT_TEMPLATE = `You are a Viral Content Analyst with 10 years of experience identifying content that performs well on TikTok, Instagram Reels, and YouTube Shorts.

Your task is to analyze a video transcript and identify segments with high viral potential.

## SEGMENT CRITERIA

1. DURATION: 30-90 seconds (ideal for short-form platforms)
2. STANDALONE: Must make sense without additional context
3. HOOK REQUIRED: Must open with a strong hook in the first 3 seconds
4. EMOTIONAL IMPACT: Should evoke curiosity, surprise, or engagement

## 3-ACT FRAMEWORK

Every viral segment follows this structure:

1. **HOOK (0-3 seconds)**: Pattern interrupt that stops the scroll
   - Contrarian statement
   - Open loop ("You won't believe...")
   - Shocking fact
   - Direct challenge
   - Provocative question

2. **TENSION (3-25 seconds)**: Build curiosity and emotional investment
   - Develop the premise
   - Create anticipation
   - Add stakes or consequences

3. **PAYOFF (end)**: Satisfying conclusion or revelation
   - Deliver on the hook's promise
   - Unexpected twist (optional but effective)
   - Clear takeaway

## HOOK CATEGORIES

- **CURIOSITY**: Opens knowledge gaps, teases insights, promises counterintuitive truths
  Example: "90% of people do this wrong..."
  Example: "The secret successful people hide..."

- **CONTROVERSY**: Challenges conventional wisdom, takes strong stance, polarizes
  Example: "Stop doing this popular thing..."
  Example: "Why I think [common belief] is wrong..."

- **RELATABILITY**: Shared struggles, common frustrations, "me too" moments
  Example: "You know when you try to..."
  Example: "We've all been there..."

- **SHOCK**: Surprising facts, unexpected stats, dramatic statements
  Example: "In 10 seconds, you'll lose 5000 brain cells..."
  Example: "This costs you 2 hours every day..."

- **STORY**: Narrative opening, character introduction, scene setting
  Example: "So there I was, standing at the edge..."
  Example: "Last week, something crazy happened..."

- **CHALLENGE**: Direct call to action, provokes response, sets stakes
  Example: "Can you do this?"
  Example: "Most people can't handle this..."

## EXCLUDE CRITERIA

Do NOT select segments that:
- Require too much external context to understand
- Have weak or unclear hooks
- Are too long (>90 seconds) or too short (<30 seconds)
- Lack emotional impact or surprise
- Are purely informational without entertainment value
- Are repetitive or rambling

## OUTPUT FORMAT

Return ONLY a JSON array. No markdown, no explanation, just the JSON:

[
  {
    "rank": 1,
    "start": "HH:MM:SS",
    "end": "HH:MM:SS",
    "duration_seconds": 45,
    "hook_text": "First few words that create the hook...",
    "hook_category": "CURIOSITY|CONTROVERSY|RELATABILITY|SHOCK|STORY|CHALLENGE",
    "why_viral": "Brief explanation of viral potential...",
    "viral_score": 85,
    "confidence": "HIGH|MEDIUM|LOW"
  }
]

Rank segments by viral potential (rank 1 = best).
Return exactly ${MAX_SEGMENTS} segments or fewer if the video doesn't have enough viral content.

## TRANSCRIPT WITH TIMESTAMPS

Below is the transcript with [HH:MM:SS] timestamps inserted every ~30 words to help locate segments:

${TRANSCRIPT_WITH_TIMESTAMPS}

Analyze this transcript and return the JSON array of viral segments.`;

// ============================================================================
// Timestamp Utilities
// ============================================================================

/**
 * Pad a number with leading zeros
 */
function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Convert seconds to HH:MM:SS format
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

/**
 * Convert HH:MM:SS string to seconds
 */
export function parseTimestamp(hhmmss: string): number {
  const parts = hhmmss.split(':').map(Number);
  if (parts.length !== 3) {
    throw new Error(`[E032] Invalid timestamp format: ${hhmmss}`);
  }
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

// ============================================================================
// Transcript Building
// ============================================================================

/**
 * Build transcript with embedded timestamps every ~30 words
 * Helps Gemini locate specific segments in the video
 */
function buildTranscriptWithTimestamps(words: Array<{ word: string; start: number; end: number }>): string {
  const lines: string[] = [];
  let currentLine = '';
  let wordCount = 0;
  const wordsPerTimestamp = 30;

  for (const w of words) {
    // Add timestamp at the start and every N words
    if (wordCount === 0 || wordCount % wordsPerTimestamp === 0) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      const timestamp = formatTimestamp(w.start);
      currentLine = `[${timestamp}] ${w.word}`;
    } else {
      currentLine += ` ${w.word}`;
    }
    wordCount++;
  }

  // Add remaining content
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.join('\n');
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse JSON response from Gemini
 * Removes markdown code blocks and validates structure
 */
function parseJsonResponse(responseText: string): ViralSegment[] {
  let cleanedText = responseText.trim();

  // Remove markdown code blocks if present
  if (cleanedText.startsWith('```')) {
    const lines = cleanedText.split('\n');
    // Remove first line (```json or ```)
    lines.shift();
    // Remove last line if it's closing ```
    if (lines[lines.length - 1].trim() === '```') {
      lines.pop();
    }
    cleanedText = lines.join('\n').trim();
  }

  // Parse JSON
  let segments: ViralSegment[];
  try {
    segments = JSON.parse(cleanedText);
  } catch (parseError) {
    throw new Error('[E032] Failed to parse Gemini response as JSON');
  }

  // Validate it's an array
  if (!Array.isArray(segments)) {
    throw new Error('[E032] Gemini response is not an array of segments');
  }

  // Validate each segment has required fields
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const requiredFields = ['rank', 'start', 'end', 'duration_seconds', 'hook_text', 'hook_category', 'why_viral', 'viral_score', 'confidence'];
    for (const field of requiredFields) {
      if (!(field in seg)) {
        throw new Error(`[E032] Segment ${i + 1} missing required field: ${field}`);
      }
    }

    // Validate hook_category is one of the allowed values
    const validCategories: HookCategory[] = ['CURIOSITY', 'CONTROVERSY', 'RELATABILITY', 'SHOCK', 'STORY', 'CHALLENGE'];
    if (!validCategories.includes(seg.hook_category as HookCategory)) {
      throw new Error(`[E032] Segment ${i + 1} has invalid hook_category: ${seg.hook_category}`);
    }

    // Validate confidence
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(seg.confidence as Confidence)) {
      throw new Error(`[E032] Segment ${i + 1} has invalid confidence: ${seg.confidence}`);
    }

    // Validate viral_score is a number between 0-100
    if (typeof seg.viral_score !== 'number' || seg.viral_score < 0 || seg.viral_score > 100) {
      throw new Error(`[E032] Segment ${i + 1} has invalid viral_score: ${seg.viral_score}`);
    }
  }

  return segments as ViralSegment[];
}

// ============================================================================
// Retry Wrapper for API Calls
// ============================================================================

/**
 * Retry wrapper for Gemini API calls with exponential backoff
 */
async function retryApi<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number; onRetry?: (attempt: number, error: Error) => void } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000, onRetry } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err as Error;

      // Don't retry if it's a validation error
      if (lastError.message.startsWith('[E032]')) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        onRetry?.(attempt + 1, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze transcript for viral segments using Gemini AI
 *
 * @param words - Array of word objects with timestamps from Deepgram
 * @param options - Analysis configuration options
 * @returns AnalysisResult with detected viral segments
 */
export async function analyzeViral(
  words: Array<{ word: string; start: number; end: number }>,
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  // Merge options with defaults
  const config = {
    maxSegments: options.maxSegments ?? DEFAULT_CONFIG.maxSegments,
    minDuration: options.minDuration ?? DEFAULT_CONFIG.minDuration,
    maxDuration: options.maxDuration ?? DEFAULT_CONFIG.maxDuration,
    language: options.language ?? DEFAULT_CONFIG.language,
  };

  // Validate input
  if (!words || words.length === 0) {
    throw new Error('[E033] No words provided for analysis');
  }

  // Get API key
  const apiKey = get<string>('api.gemini');
  if (!apiKey) {
    throw new Error('[E030] Gemini API key not configured. Please run: autocliper config');
  }

  // Calculate total duration
  const totalDuration = words[words.length - 1].end;

  // Build transcript with timestamps
  const transcriptWithTimestamps = buildTranscriptWithTimestamps(words);

  // Build prompt
  const prompt = PROMPT_TEMPLATE
    .replace('${MAX_SEGMENTS}', config.maxSegments.toString())
    .replace('${MIN_DURATION}', config.minDuration.toString())
    .replace('${MAX_DURATION}', config.maxDuration.toString())
    .replace('${TRANSCRIPT_WITH_TIMESTAMPS}', transcriptWithTimestamps);

  // Call Gemini API with retry
  const segments = await retryApi(async () => {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.3,
          topP: 0.8,
          maxOutputTokens: 4096,
        },
      });

      if (!response || !response.text) {
        throw new Error('[E031] Empty response from Gemini API');
      }

      // Parse and validate response
      const parsedSegments = parseJsonResponse(response.text);

      // Validate we got segments
      if (parsedSegments.length === 0) {
        throw new Error('[E033] No viral segments detected in video');
      }

      return parsedSegments;
    } catch (err) {
      const error = err as Error;

      // Re-throw our custom errors as-is
      if (error.message.startsWith('[E03')) {
        throw error;
      }

      // Wrap API errors
      throw new Error(`[E031] Gemini API request failed: ${error.message}`);
    }
  }, {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    onRetry: (attempt, err) => {
      console.log(`x Gemini API failed (attempt ${attempt}), retrying...`);
      console.log(`  Error: ${err.message}`);
    },
  });

  return {
    segments,
    total_duration: totalDuration,
    max_segments: config.maxSegments,
    language: config.language,
  };
}
