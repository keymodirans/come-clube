/**
 * Video downloader module for AutoCliper
 *
 * Downloads YouTube videos using yt-dlp and extracts audio using FFmpeg.
 * Error codes: E010-E019 (download domain)
 */

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { getToolPath, TOOLS } from './installer.js';
import { createDownloadProgress, Spinner } from '../utils/progress.js';
import { log, success, error } from '../utils/logger.js';

/**
 * Download options
 */
export interface DownloadOptions {
  /** Output directory (defaults to temp dir) */
  outputDir?: string;
  /** Progress callback */
  onProgress?: (percent: number, downloaded: number, total: number) => void;
  /** Whether to show progress bar */
  showProgress?: boolean;
}

/**
 * Download result
 */
export interface DownloadResult {
  /** Path to downloaded video file */
  videoPath: string;
  /** Duration in seconds */
  duration: number;
  /** File size in bytes */
  size: number;
}

/**
 * Audio extraction options
 */
export interface AudioExtractionOptions {
  /** Input video path */
  input: string;
  /** Output audio path (optional, auto-generated if not provided) */
  output?: string;
  /** Sample rate in Hz (default: 16000 for Deepgram) */
  sampleRate?: number;
  /** Number of audio channels (default: 1 for mono) */
  channels?: number;
  /** Whether to show progress */
  showProgress?: boolean;
}

/**
 * Audio extraction result
 */
export interface AudioExtractionResult {
  /** Path to extracted audio file */
  audioPath: string;
  /** Duration in seconds */
  duration: number;
  /** File size in bytes */
  size: number;
}

/**
 * Get temporary directory for downloads
 * @returns Path to temp directory
 */
export function getTempDir(): string {
  return os.tmpdir();
}

/**
 * Generate a unique temp file path
 * @param prefix - File name prefix
 * @param extension - File extension (with dot)
 * @returns Absolute path to temp file
 */
export function generateTempPath(prefix: string, extension: string): string {
  const tempDir = getTempDir();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const filename = `${prefix}-${timestamp}-${random}${extension}`;
  return path.join(tempDir, filename);
}

/**
 * Get file size
 * @param filePath - Path to file
 * @returns File size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * Get video duration using FFprobe
 * @param videoPath - Path to video file
 * @returns Duration in seconds
 */
export async function getVideoDuration(videoPath: string): Promise<number> {
  const ffprobePath = getToolPath(TOOLS.FFPROBE) || 'ffprobe';

  return new Promise<number>((resolve, reject) => {
    const ffprobe = spawn(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ]);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0 && stdout) {
        const duration = parseFloat(stdout.trim());
        resolve(isNaN(duration) ? 0 : duration);
      } else {
        reject(new Error(`[E015] Failed to get video duration: ${stderr || `exit code ${code}`}`));
      }
    });

    ffprobe.on('error', (err) => {
      reject(new Error(`[E015] FFprobe error: ${err.message}`));
    });
  });
}

/**
 * Check if FFmpeg/yt-dlp are installed
 * @returns true if tools are available
 */
export function checkToolsInstalled(): { ffmpeg: boolean; ytdlp: boolean } {
  const ffmpegPath = getToolPath(TOOLS.FFMPEG);
  const ytdlpPath = getToolPath(TOOLS.YT_DLP);

  return {
    ffmpeg: existsSync(ffmpegPath),
    ytdlp: existsSync(ytdlpPath),
  };
}

/**
 * Validate YouTube URL
 * @param url - URL to validate
 * @returns true if valid YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    // Standard YouTube watch URLs
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    // Shortened youtu.be URLs
    /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
    // YouTube Shorts
    /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
    // Embedded YouTube videos
    /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
  ];

  return patterns.some(pattern => pattern.test(url));
}

/**
 * Parse yt-dlp progress from stderr
 * @param line - Line of stderr output
 * @returns Progress info or null
 */
function parseYtDlpProgress(line: string): { percent: number; downloaded: number; total: number } | null {
  // yt-dlp outputs progress like: [download]  45.2% of 62.34MB at 1.23MB/s
  const match = line.match(/\[download\]\s+(\d+\.?\d*)%.*?of\s+(\d+\.?\d*)([A-Z]+) at/);
  if (match) {
    const percent = parseFloat(match[1]);
    const total = parseFloat(match[2]);
    const unit = match[3];

    // Convert to bytes
    const multiplier = unit === 'GB' ? 1e9 : unit === 'MB' ? 1e6 : unit === 'KB' ? 1e3 : 1;
    const totalBytes = total * multiplier;
    const downloadedBytes = (percent / 100) * totalBytes;

    return { percent, downloaded: downloadedBytes, total: totalBytes };
  }

  return null;
}

/**
 * Download video from YouTube URL
 * @param url - YouTube video URL
 * @param options - Download options
 * @returns Download result
 */
export async function downloadVideo(
  url: string,
  options: DownloadOptions = {}
): Promise<DownloadResult> {
  const { outputDir = getTempDir(), showProgress = true } = options;

  // Validate URL
  if (!isValidYouTubeUrl(url)) {
    throw new Error('[E016] Invalid YouTube URL');
  }

  // Check if yt-dlp is installed
  const tools = checkToolsInstalled();
  if (!tools.ytdlp) {
    throw new Error('[E015] yt-dlp is not installed. Run: autocliper init');
  }

  // Generate output path
  const outputPath = path.join(outputDir, `video-${Date.now()}.mp4`);

  log('Downloading video...');

  return new Promise<DownloadResult>((resolve, reject) => {
    const ytdlpPath = getToolPath(TOOLS.YT_DLP);
    const args = [
      '-f', 'bv*+ba/b', // Best video + audio, fallback to best
      '-o', outputPath, // Output file
      '--merge-output-format', 'mp4', // Ensure MP4 format
      '--no-playlist', // Download single video only
      url,
    ];

    const ytdlp = spawn(ytdlpPath, args);

    let stderr = '';
    let progress: typeof import('cli-progress') | null = null;

    if (showProgress) {
      progress = createDownloadProgress('Download', 100);
    }

    ytdlp.stderr.on('data', (data) => {
      const line = data.toString();
      stderr += line;

      // Parse progress
      const progressData = parseYtDlpProgress(line);
      if (progressData && progress) {
        progress.update(progressData.percent);
      }
    });

    ytdlp.on('close', async (code) => {
      if (progress) {
        progress.stop();
      }

      if (code === 0) {
        // Verify file exists
        if (!existsSync(outputPath)) {
          reject(new Error('[E017] Download failed - output file not found'));
          return;
        }

        try {
          const size = await getFileSize(outputPath);
          const duration = await getVideoDuration(outputPath);

          success('Download complete');
          resolve({
            videoPath: outputPath,
            duration,
            size,
          });
        } catch (err) {
          reject(new Error(`[E018] Failed to process downloaded video: ${(err as Error).message}`));
        }
      } else {
        reject(new Error(`[E019] yt-dlp failed: ${stderr || `exit code ${code}`}`));
      }
    });

    ytdlp.on('error', (err) => {
      if (progress) {
        progress.stop();
      }
      reject(new Error(`[E024] yt-dlp spawn error: ${err.message}`));
    });
  });
}

/**
 * Extract audio from video file
 * @param options - Audio extraction options
 * @returns Audio extraction result
 */
export async function extractAudio(
  options: AudioExtractionOptions
): Promise<AudioExtractionResult> {
  const {
    input,
    output,
    sampleRate = 16000, // Deepgram requires 16kHz
    channels = 1, // Mono for Deepgram
    showProgress = true,
  } = options;

  // Check if FFmpeg is installed
  const tools = checkToolsInstalled();
  if (!tools.ffmpeg) {
    throw new Error('[E015] FFmpeg is not installed. Run: autocliper init');
  }

  // Check if input file exists
  if (!existsSync(input)) {
    throw new Error(`[E025] Input file not found: ${input}`);
  }

  // Generate output path if not provided
  const audioPath = output || generateTempPath('audio', '.wav');

  log('Extracting audio...');

  const spinner = showProgress ? new Spinner('Extracting audio...') : null;
  if (spinner) spinner.start();

  return new Promise<AudioExtractionResult>((resolve, reject) => {
    const ffmpegPath = getToolPath(TOOLS.FFMPEG);

    const args = [
      '-i', input,
      '-vn', // No video
      '-acodec', 'pcm_s16le', // PCM 16-bit little-endian (WAV compatible)
      '-ar', sampleRate.toString(), // Sample rate
      '-ac', channels.toString(), // Audio channels (1 = mono)
      '-y', // Overwrite output
      audioPath,
    ];

    const ffmpeg = spawn(ffmpegPath, args);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', async (code) => {
      if (spinner) spinner.succeed('Audio extracted');

      if (code === 0) {
        try {
          // Verify output file exists
          if (!existsSync(audioPath)) {
            reject(new Error('[E026] Audio extraction failed - output file not found'));
            return;
          }

          const size = await getFileSize(audioPath);
          const duration = await getVideoDuration(input); // Same as video duration

          resolve({
            audioPath,
            duration,
            size,
          });
        } catch (err) {
          reject(new Error(`[E027] Failed to process extracted audio: ${(err as Error).message}`));
        }
      } else {
        if (spinner) spinner.fail('Audio extraction failed');
        reject(new Error(`[E028] FFmpeg failed: ${stderr || `exit code ${code}`}`));
      }
    });

    ffmpeg.on('error', (err) => {
      if (spinner) spinner.fail('FFmpeg error');
      reject(new Error(`[E029] FFmpeg spawn error: ${err.message}`));
    });
  });
}

/**
 * Clean up temporary files
 * @param files - Array of file paths to delete
 */
export async function cleanup(files: string[]): Promise<void> {
  const cleanupPromises = files.map(async (filePath) => {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore errors if file doesn't exist
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        console.warn(`! Failed to delete temp file: ${filePath}`);
      }
    }
  });

  await Promise.all(cleanupPromises);
}
