/**
 * Run command - Main processing pipeline
 *
 * Downloads video, transcribes, analyzes viral segments,
 * and triggers cloud rendering
 */

import { Command } from 'commander';
import { hasApiKeys } from '../utils/config.js';
import { ERROR_CODES } from '../license/validator.js';
import { log, error, blank, separator } from '../utils/logger.js';

export const runCommand = new Command('run')
  .description('Process a YouTube video and generate viral clips')
  .argument('<url>', 'YouTube video URL')
  .option('-m, --max <number>', 'Maximum number of clips to generate', '3')
  .option('-l, --language <code>', 'Video language code (id, en)', 'id')
  .action((url: string, options: { max?: string; language?: string }) => {
    blank();
    separator();
    log('Processing video...');
    blank();

    // Validate URL format (basic check)
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      error('Invalid YouTube URL');
      blank();
      log('Please provide a valid YouTube video URL:');
      log('  - https://www.youtube.com/watch?v=...');
      log('  - https://youtu.be/...');
      separator();
      process.exit(1);
    }

    // Check if configuration exists
    const keys = hasApiKeys();

    if (!keys.deepgram || !keys.gemini || !keys.github) {
      error(`${ERROR_CODES.CONFIG_MISSING} Missing API configuration`);
      blank();

      if (!keys.deepgram) {
        log('x Deepgram API key not configured');
      }
      if (!keys.gemini) {
        log('x Gemini API key not configured');
      }
      if (!keys.github) {
        log('x GitHub configuration not set (token, owner, repo)');
      }

      blank();
      log('Please run: autocliper config');
      separator();
      process.exit(1);
    }

    log(`URL:      ${url}`);
    log(`Max clips: ${options.max}`);
    log(`Language: ${options.language}`);
    blank();
    log('Main pipeline coming soon in Phase 04: Video Processing Pipeline');
    log('');
    log('The pipeline will:');
    log('  1. Download video using yt-dlp');
    log('  2. Extract audio for transcription');
    log('  3. Transcribe using Deepgram API');
    log('  4. Detect viral segments using Gemini');
    log('  5. Generate Remotion props JSON');
    log('  6. Trigger cloud rendering via GitHub Actions');
    log('  7. Download and post-process rendered clips');
    separator();
  });
