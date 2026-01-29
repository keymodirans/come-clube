/**
 * Run command - Main processing pipeline
 *
 * Downloads video, transcribes, analyzes viral segments,
 * and triggers cloud rendering
 */

import { Command } from 'commander';
import { hasApiKeys } from '../utils/config.js';
import { ERROR_CODES } from '../license/validator.js';
import { log, success, error, blank, separator } from '../utils/logger.js';
import { downloadVideo, extractAudio, cleanup, isValidYouTubeUrl, checkToolsInstalled } from '../core/downloader.js';
import { withRetry } from '../utils/retry.js';

export const runCommand = new Command('run')
  .description('Process a YouTube video and generate viral clips')
  .argument('<url>', 'YouTube video URL')
  .option('-m, --max <number>', 'Maximum number of clips to generate', '3')
  .option('-l, --language <code>', 'Video language code (id, en)', 'id')
  .action(async (url: string, options: { max?: string; language?: string }) => {
    blank();
    separator();
    log('Processing video...');
    blank();

    // Validate URL format
    if (!isValidYouTubeUrl(url)) {
      error('[E010] Invalid YouTube URL');
      blank();
      log('Please provide a valid YouTube video URL:');
      log('  - https://www.youtube.com/watch?v=...');
      log('  - https://youtu.be/...');
      log('  - https://www.youtube.com/shorts/...');
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

    // Check if FFmpeg and yt-dlp are installed
    const tools = checkToolsInstalled();
    if (!tools.ffmpeg || !tools.ytdlp) {
      error('[E007] Required tools not installed');
      blank();

      if (!tools.ffmpeg) {
        log('x FFmpeg not found');
      }
      if (!tools.ytdlp) {
        log('x yt-dlp not found');
      }

      blank();
      log('Please run: autocliper init');
      separator();
      process.exit(1);
    }

    log(`URL:      ${url}`);
    log(`Max clips: ${options.max}`);
    log(`Language: ${options.language}`);
    blank();

    // Track temp files for cleanup
    const tempFiles: string[] = [];

    try {
      // Step 1: Download video with retry
      log('> Downloading video...');
      blank();

      const downloadResult = await withRetry(
        () => downloadVideo(url, { showProgress: true }),
        {
          maxRetries: 3,
          baseDelayMs: 2000,
          maxDelayMs: 30000,
          onRetry: (attempt, err) => {
            blank();
            error(`Download failed (attempt ${attempt}), retrying...`);
            log(`  Error: ${err.message}`);
            blank();
          },
        }
      );

      tempFiles.push(downloadResult.videoPath);

      blank();
      log(`Video downloaded: ${downloadResult.videoPath}`);
      log(`Duration: ${Math.floor(downloadResult.duration / 60)}:${Math.floor(downloadResult.duration % 60).toString().padStart(2, '0')}`);
      log(`Size: ${(downloadResult.size / 1024 / 1024).toFixed(2)} MB`);
      blank();

      // Step 2: Extract audio for transcription
      log('> Extracting audio for transcription...');
      blank();

      const audioResult = await extractAudio({
        input: downloadResult.videoPath,
        sampleRate: 16000, // Deepgram requires 16kHz
        channels: 1, // Mono for Deepgram
        showProgress: true,
      });

      tempFiles.push(audioResult.audioPath);

      blank();
      log(`Audio extracted: ${audioResult.audioPath}`);
      log(`Duration: ${Math.floor(audioResult.duration / 60)}:${Math.floor(audioResult.duration % 60).toString().padStart(2, '0')}`);
      log(`Size: ${(audioResult.size / 1024 / 1024).toFixed(2)} MB`);
      blank();

      // TODO: Continue with transcription in Phase 05
      separator();
      log('Download and audio extraction complete!');
      blank();
      log('Next steps (coming in Phase 05):');
      log('  1. Transcribe using Deepgram API');
      log('  2. Detect viral segments using Gemini');
      log('  3. Generate Remotion props JSON');
      log('  4. Trigger cloud rendering via GitHub Actions');
      log('  5. Download and post-process rendered clips');
      separator();
      blank();

      // Cleanup temp files
      log('> Cleaning up temporary files...');
      await cleanup(tempFiles);
      success('Cleanup complete');
      blank();

    } catch (err) {
      const errorObj = err as Error;
      blank();
      error(`Processing failed: ${errorObj.message}`);
      blank();

      // Cleanup on error
      log('> Cleaning up temporary files...');
      await cleanup(tempFiles);
      success('Cleanup complete');
      blank();

      separator();
      process.exit(1);
    }
  });
