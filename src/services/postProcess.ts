/**
 * Post-Processing Service - Download, metadata randomization, FFmpeg re-encoding
 *
 * Handles:
 * - Downloading rendered videos from GitHub artifacts
 * - Metadata randomization (software, artist, creation_time)
 * - FFmpeg re-encoding with libx264
 * - Saving to ~/Downloads/autocliper/
 *
 * Error codes: E070-E079
 */

import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { getToolPath, TOOLS } from '../core/installer.js';
import type { ViralSegment } from '../core/analyzer.js';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Post-processing options
 */
export interface PostProcessOptions {
  /** Input video path (rendered clip) */
  input: string;
  /** Output path (optional, auto-generated if not provided) */
  output?: string;
  /** Segment information for filename generation */
  segment?: ViralSegment;
  /** Segment index for filename generation */
  index?: number;
  /** Whether to show progress */
  showProgress?: boolean;
}

/**
 * Download artifact options
 */
export interface DownloadArtifactOptions {
  /** Artifact download URL */
  url: string;
  /** Output directory (defaults to temp dir) */
  outputDir?: string;
  /** Maximum file size in bytes (default: 500MB) */
  maxSize?: number;
  /** Timeout in milliseconds (default: 10 minutes) */
  timeout?: number;
}

/**
 * Download artifact result
 */
export interface DownloadArtifactResult {
  /** Path to downloaded file */
  filePath: string;
  /** File size in bytes */
  size: number;
}

// ============================================================================
// Error Codes
// ============================================================================

export const POST_PROCESS_ERROR_CODES = {
  DOWNLOAD_FAILED: '[E070] Artifact download failed',
  INVALID_URL: '[E071] Invalid artifact URL',
  OUTPUT_DIR_FAILED: '[E072] Output directory creation failed',
  FFMPEG_FAILED: '[E073] FFmpeg re-encoding failed',
  FILE_NOT_FOUND: '[E074] Input file not found',
  FILE_TOO_LARGE: '[E075] File size exceeds maximum',
  TIMEOUT: '[E076] Download timeout',
  EXTRACTION_FAILED: '[E077] Artifact extraction failed',
} as const;

// ============================================================================
// Metadata Randomization Arrays
// ============================================================================

/**
 * Random software names for metadata
 */
const SOFTWARE = [
  'Adobe Premiere Pro 2025',
  'DaVinci Resolve 19',
  'Final Cut Pro 10.8',
  'Adobe After Effects 2025',
  'Filmora 14',
  'CapCut Desktop 5.0',
  'Sony Vegas Pro 22',
  'Avid Media Composer 2024',
  'Lightworks 2025',
  'HitFilm Pro 2024',
];

/**
 * Random artist names for metadata
 */
const ARTISTS = [
  'Content Creator',
  'Video Editor',
  'Social Media Manager',
  'Creative Studio',
  'Digital Producer',
  'Media House',
  'Content Agency',
  'Video Productions',
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get random item from array
 * @param arr - Array to pick from
 * @returns Random item
 */
export function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate random date within the past year
 * @returns ISO 8601 date string
 */
export function randDate(): string {
  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const randomTime = oneYearAgo + Math.random() * (now - oneYearAgo);
  return new Date(randomTime).toISOString();
}

// ============================================================================
// Output Directory
// ============================================================================

/**
 * Get output directory for processed videos
 * Fixed: ~/Downloads/autocliper/
 * @returns Absolute path to output directory
 * @throws Error with [E072] if directory creation fails
 */
export async function getOutputDir(): Promise<string> {
  const outputDir = path.join(os.homedir(), 'Downloads', 'autocliper');

  try {
    await fs.ensureDir(outputDir);
    return outputDir;
  } catch (err) {
    const error = err as Error;
    throw new Error(`${POST_PROCESS_ERROR_CODES.OUTPUT_DIR_FAILED}: ${error.message}`);
  }
}

// ============================================================================
// Filename Generation
// ============================================================================

/**
 * Sanitize text for filename (remove special characters)
 * @param text - Text to sanitize
 * @returns Sanitized text safe for filenames
 */
function sanitizeFilename(text: string): string {
  // Remove or replace special characters
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove duplicate hyphens
    .trim()
    .substring(0, 50); // Limit length
}

/**
 * Generate output filename for a segment
 * Pattern: video-{index:03d}-{hook_excerpt}.mp4
 * @param segment - Viral segment information
 * @param index - Segment index (0-based)
 * @returns Generated filename
 */
export function generateFilename(segment: ViralSegment, index: number): string {
  const sanitized = sanitizeFilename(segment.hook_text);
  const indexStr = (index + 1).toString().padStart(3, '0');
  return `video-${indexStr}-${sanitized}.mp4`;
}

/**
 * Ensure unique filename (avoid duplicates)
 * @param basePath - Base path (directory + filename without extension)
 * @param extension - File extension (with dot)
 * @returns Unique filename path
 */
async function ensureUniqueFilename(basePath: string, extension: string): Promise<string> {
  let finalPath = basePath + extension;
  let counter = 1;

  while (await fs.pathExists(finalPath)) {
    finalPath = `${basePath}-${counter}${extension}`;
    counter++;
  }

  return finalPath;
}

// ============================================================================
// Artifact Download
// ============================================================================

/**
 * Download artifact from URL
 * @param options - Download options
 * @returns Download result with file path
 * @throws Error with [E070-E077] codes on failure
 */
export async function downloadArtifact(
  options: DownloadArtifactOptions
): Promise<DownloadArtifactResult> {
  const {
    url,
    outputDir = path.join(os.tmpdir(), 'autocliper-artifacts'),
    maxSize = 500 * 1024 * 1024, // 500MB
    timeout = 10 * 60 * 1000, // 10 minutes
  } = options;

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error(`${POST_PROCESS_ERROR_CODES.INVALID_URL}: ${url}`);
  }

  // Ensure output directory exists
  await fs.ensureDir(outputDir);

  // Generate output path
  const filename = path.basename(new URL(url).pathname) || `artifact-${Date.now()}.zip`;
  const outputPath = path.join(outputDir, filename);

  try {
    // Download using undici for better performance
    const { request } = await import('undici');
    const response = await request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'AutoCliper/1.0',
      },
      timeout,
    });

    // Check content length if available
    const contentLength = response.headers['content-length'];
    if (contentLength && parseInt(contentLength) > maxSize) {
      throw new Error(`${POST_PROCESS_ERROR_CODES.FILE_TOO_LARGE}: ${parseInt(contentLength)} bytes exceeds ${maxSize} bytes`);
    }

    // Stream to file
    const fileStream = fs.createWriteStream(outputPath);
    const reader = response.body;

    await new Promise<void>((resolve, reject) => {
      reader.on('data', (chunk: Buffer) => {
        fileStream.write(chunk);
      });
      reader.on('end', () => {
        fileStream.end();
        resolve();
      });
      reader.on('error', reject);
      fileStream.on('error', reject);
    });

    // Verify file size
    const stats = await fs.stat(outputPath);
    if (stats.size > maxSize) {
      await fs.remove(outputPath);
      throw new Error(`${POST_PROCESS_ERROR_CODES.FILE_TOO_LARGE}: ${stats.size} bytes exceeds ${maxSize} bytes`);
    }

    return {
      filePath: outputPath,
      size: stats.size,
    };
  } catch (err) {
    const error = err as Error;

    // Re-throw our custom errors
    if (error.message.startsWith('[E07')) {
      throw error;
    }

    // Handle timeout
    if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      throw new Error(POST_PROCESS_ERROR_CODES.TIMEOUT);
    }

    // Wrap other errors
    throw new Error(`${POST_PROCESS_ERROR_CODES.DOWNLOAD_FAILED}: ${error.message}`);
  }
}

// ============================================================================
// Post-Processing
// ============================================================================

/**
 * Post-process video with metadata randomization and FFmpeg re-encoding
 * @param options - Post-processing options
 * @returns Path to processed video
 * @throws Error with [E073-E074] codes on failure
 */
export async function postProcess(options: PostProcessOptions): Promise<string> {
  const {
    input,
    output,
    segment,
    index = 0,
    showProgress = true,
  } = options;

  // Check if input file exists
  if (!fs.existsSync(input)) {
    throw new Error(`${POST_PROCESS_ERROR_CODES.FILE_NOT_FOUND}: ${input}`);
  }

  // Get output directory
  const outputDir = await getOutputDir();

  // Generate output path if not provided
  let outputPath: string;
  if (output) {
    outputPath = output;
  } else if (segment) {
    const filename = generateFilename(segment, index);
    const basePath = path.join(outputDir, filename.replace('.mp4', ''));
    outputPath = await ensureUniqueFilename(basePath, '.mp4');
  } else {
    const basePath = path.join(outputDir, `video-${(index + 1).toString().padStart(3, '0')}`);
    outputPath = await ensureUniqueFilename(basePath, '.mp4');
  }

  // Randomize metadata
  const software = rand(SOFTWARE);
  const artist = rand(ARTISTS);
  const creationTime = randDate();

  // FFmpeg path
  const ffmpegPath = getToolPath(TOOLS.FFMPEG) || 'ffmpeg';

  return new Promise<string>((resolve, reject) => {
    const args = [
      '-i', input,
      // Video codec
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      // Audio codec
      '-c:a', 'aac',
      '-b:a', '128k',
      // Fast start for web playback
      '-movflags', '+faststart',
      // Metadata: strip existing, add new
      '-map_metadata', '-1',
      '-metadata', `software=${software}`,
      '-metadata', `artist=${artist}`,
      '-metadata', `creation_time=${creationTime}`,
      '-metadata', 'comment=Generated by AutoCliper',
      // Overwrite output
      '-y',
      outputPath,
    ];

    const ffmpeg = spawn(ffmpegPath, args);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', async (code) => {
      if (code === 0) {
        // Verify output file exists
        if (fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          reject(new Error(`${POST_PROCESS_ERROR_CODES.FFMPEG_FAILED}: Output file not created`));
        }
      } else {
        reject(new Error(`${POST_PROCESS_ERROR_CODES.FFMPEG_FAILED}: ${stderr || `exit code ${code}`}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`${POST_PROCESS_ERROR_CODES.FFMPEG_FAILED}: ${err.message}`));
    });
  });
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Post-process multiple videos
 * @param inputs - Array of input paths with optional segment info
 * @returns Array of output paths
 */
export async function postProcessBatch(
  inputs: Array<{ input: string; segment?: ViralSegment; index?: number }>
): Promise<string[]> {
  const results: string[] = [];

  for (const item of inputs) {
    const outputPath = await postProcess({
      input: item.input,
      segment: item.segment,
      index: item.index ?? 0,
      showProgress: true,
    });
    results.push(outputPath);
  }

  return results;
}
