/**
 * Transcriber module for AutoCliper
 *
 * Uses Deepgram Nova-3 API for speech-to-text with word-level timestamps.
 */

import { createClient } from '@deepgram/sdk';
import fs from 'fs-extra';
import { get } from '../utils/config.js';
import { retryApi } from '../utils/retry.js';

/**
 * Word interface from Deepgram transcript
 */
export interface Word {
  /** Raw word without punctuation */
  word: string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Word with punctuation applied */
  punctuated_word: string;
}

/**
 * Transcript result interface
 */
export interface TranscriptResult {
  /** Full transcript text with punctuation */
  transcript: string;
  /** Array of words with timestamps */
  words: Word[];
  /** Audio duration in seconds */
  duration: number;
  /** Language detected/used */
  language: string;
}

/**
 * Deepgram API error codes
 */
export const TRANSCRIPTION_ERROR_CODES = {
  API_KEY_NOT_CONFIGURED: '[E020] Deepgram API key not configured',
  API_KEY_INVALID: '[E021] Deepgram API key is invalid',
  TRANSCRIPTION_FAILED: '[E022] Transcription failed',
  AUDIO_FILE_INVALID: '[E023] Audio file is invalid or not found',
} as const;

/**
 * Supported language codes
 */
type SupportedLanguage = 'id' | 'en';

/**
 * Get language preference from config or use default
 * @returns Language code (default: 'id' for Indonesian)
 */
function getLanguagePreference(): SupportedLanguage {
  const langFromConfig = get<string>('preferences.language');
  if (langFromConfig === 'id' || langFromConfig === 'en') {
    return langFromConfig;
  }
  return 'id'; // Default to Indonesian
}

/**
 * Detect language from audio (optional heuristic)
 * Currently defaults to config preference.
 *
 * @param _audioPath - Path to audio file (unused in current implementation)
 * @returns Detected language code
 */
export function detectLanguage(_audioPath: string): SupportedLanguage {
  // Simple heuristic: default to config preference
  // Future enhancement: Use language detection API
  return getLanguagePreference();
}

/**
 * Transcribe audio file using Deepgram Nova-3 API
 *
 * @param audioPath - Path to audio file (WAV format recommended)
 * @param language - Language code ('id' or 'en')
 * @returns TranscriptResult with transcript, words, and metadata
 * @throws Error with [E02x] codes on failure
 */
export async function transcribe(
  audioPath: string,
  language?: SupportedLanguage
): Promise<TranscriptResult> {
  // Get API key from config
  const apiKey = get<string>('api.deepgram');

  if (!apiKey) {
    throw new Error(TRANSCRIPTION_ERROR_CODES.API_KEY_NOT_CONFIGURED);
  }

  // Validate API key format (basic check)
  if (apiKey.trim().length < 10) {
    throw new Error(TRANSCRIPTION_ERROR_CODES.API_KEY_INVALID);
  }

  // Check if audio file exists
  if (!fs.existsSync(audioPath)) {
    throw new Error(`${TRANSCRIPTION_ERROR_CODES.AUDIO_FILE_INVALID}: ${audioPath}`);
  }

  // Read audio file as buffer
  let audioBuffer: Buffer;
  try {
    audioBuffer = fs.readFileSync(audioPath);
  } catch (err) {
    const error = err as Error;
    throw new Error(`${TRANSCRIPTION_ERROR_CODES.AUDIO_FILE_INVALID}: ${error.message}`);
  }

  // Use provided language or get from config
  const lang = language || getLanguagePreference();

  // Create Deepgram client
  const deepgram = createClient(apiKey);

  try {
    // Transcribe using retry logic for network resilience
    const result = await retryApi(
      async () => {
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
          audioBuffer,
          {
            model: 'nova-3',
            language: lang,
            smart_format: true,
            punctuate: true,
            diarize: false,
            utterances: false,
          }
        );

        if (error) {
          throw new Error(`${TRANSCRIPTION_ERROR_CODES.TRANSCRIPTION_FAILED}: ${error.message}`);
        }

        return result;
      },
      'Deepgram transcription',
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      }
    );

    // Extract transcript data
    const metadata = result.metadata;
    const channel = result.results?.channels?.[0];
    const alternatives = channel?.alternatives?.[0];

    if (!alternatives) {
      throw new Error(TRANSCRIPTION_ERROR_CODES.TRANSCRIPTION_FAILED);
    }

    // Extract words with timestamps
    const words: Word[] = (alternatives.words || []).map((w: any) => ({
      word: w.word,
      start: w.start,
      end: w.end,
      confidence: w.confidence || 1.0,
      punctuated_word: w.punctuated_word || w.word,
    }));

    // Get transcript text
    const transcript = alternatives.transcript || '';

    // Get duration from metadata or calculate from last word
    const duration = metadata?.duration ||
      (words.length > 0 ? words[words.length - 1].end : 0);

    return {
      transcript,
      words,
      duration,
      language: lang,
    };

  } catch (err) {
    const error = err as Error;

    // Check for authentication error
    if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('authentication')) {
      throw new Error(TRANSCRIPTION_ERROR_CODES.API_KEY_INVALID);
    }

    // Re-throw with error code if already formatted
    if (error.message.includes('[E02')) {
      throw error;
    }

    // Generic transcription failure
    throw new Error(`${TRANSCRIPTION_ERROR_CODES.TRANSCRIPTION_FAILED}: ${error.message}`);
  }
}

/**
 * Format transcript for debugging/verbose output
 * @param result - TranscriptResult to format
 * @returns Formatted transcript string
 */
export function formatTranscript(result: TranscriptResult): string {
  const lines: string[] = [];

  lines.push(`Language: ${result.language}`);
  lines.push(`Duration: ${formatDuration(result.duration)}`);
  lines.push(`Word count: ${result.words.length}`);
  lines.push('');
  lines.push('Transcript:');
  lines.push(result.transcript);

  return lines.join('\n');
}

/**
 * Create word timestamps table for debugging
 * @param words - Array of words with timestamps
 * @returns Formatted table string
 */
export function wordTimestampsTable(words: Word[]): string {
  if (words.length === 0) {
    return 'No words found';
  }

  const lines: string[] = [];

  // Table header
  lines.push('  Time      | Word');
  lines.push('-----------|' + '-'.repeat(50));

  // Word rows
  for (const word of words) {
    const startTime = formatTime(word.start);
    const endTime = formatTime(word.end);
    const timeRange = `${startTime} - ${endTime}`;
    const paddedTime = timeRange.padEnd(10);
    lines.push(`  ${paddedTime}| ${word.punctuated_word}`);
  }

  return lines.join('\n');
}

/**
 * Format seconds to MM:SS display
 * @param seconds - Time in seconds
 * @returns Formatted time string
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to SS.sss display
 * @param seconds - Time in seconds
 * @returns Formatted time string
 */
function formatTime(seconds: number): string {
  return seconds.toFixed(3);
}
