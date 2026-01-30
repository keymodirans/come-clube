/**
 * Storage Service - Upload files to temporary storage
 *
 * Handles uploading source videos to temporary file hosting services
 * for cloud rendering via GitHub Actions.
 *
 * Uses 0x0.st - no authentication required, privacy-focused
 */

import fs from 'fs-extra';
import { execSync } from 'child_process';
import { retryApi } from '../utils/retry.js';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Upload result from temporary storage service
 */
export interface UploadResult {
  /** Download URL for the uploaded file */
  link: string;
  /** Expiration time (if provided by service) */
  expiry?: string;
  /** File key/ID (if provided by service) */
  key?: string;
}

/**
 * Storage service configuration
 */
export interface StorageConfig {
  /** Maximum file size in bytes (default: 500MB) */
  maxFileSize?: number;
  /** Upload timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
}

// ============================================================================
// Error Codes
// ============================================================================

export const STORAGE_ERROR_CODES = {
  FILE_NOT_FOUND: '[E040] File not found',
  UPLOAD_FAILED: '[E040] Upload failed',
  INVALID_RESPONSE: '[E041] Invalid response from storage service',
  FILE_TOO_LARGE: '[E042] File size exceeds maximum allowed',
  TIMEOUT: '[E043] Upload timed out',
} as const;

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<StorageConfig> = {
  maxFileSize: 500 * 1024 * 1024, // 500MB
  timeout: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// File Upload Implementation
// ============================================================================

/**
 * Upload a file to temporary storage using 0x0.st
 *
 * 0x0.st provides free temporary file hosting with:
 * - No authentication required
 * - Privacy-focused service
 * - Direct download links
 * - Large file support
 * - Automatic expiration
 *
 * @param filePath - Path to file to upload
 * @param config - Storage configuration options
 * @returns UploadResult with download URL
 * @throws Error with [E04x] codes on failure
 */
export async function uploadFile(
  filePath: string,
  config: StorageConfig = {}
): Promise<UploadResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`${STORAGE_ERROR_CODES.FILE_NOT_FOUND}: ${filePath}`);
  }

  // Get file stats
  let fileStats: fs.Stats;
  try {
    fileStats = await fs.stat(filePath);
  } catch (err) {
    const error = err as Error;
    throw new Error(`${STORAGE_ERROR_CODES.FILE_NOT_FOUND}: ${error.message}`);
  }

  // Check file size
  if (fileStats.size > finalConfig.maxFileSize) {
    const sizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
    const maxMB = (finalConfig.maxFileSize / 1024 / 1024).toFixed(2);
    throw new Error(`${STORAGE_ERROR_CODES.FILE_TOO_LARGE}: ${sizeMB}MB exceeds ${maxMB}MB`);
  }

  // Read file as buffer
  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(filePath);
  } catch (err) {
    const error = err as Error;
    throw new Error(`${STORAGE_ERROR_CODES.FILE_NOT_FOUND}: Failed to read file: ${error.message}`);
  }

  // Upload with retry logic (for temporary network issues)
  // Note: 0x0.st allows retries as we're creating a new request each time
  return await retryApi(
    () => uploadToZeroX0St(fileBuffer, filePath, finalConfig.timeout),
    'File upload',
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 30000,
    }
  );
}

/**
 * Upload file to 0x0.st service
 * @param buffer - File content as buffer
 * @param filename - Original filename for content-type hint
 * @param timeout - Request timeout in milliseconds
 * @returns UploadResult with download link
 * @throws Error with [E04x] codes on failure
 */
async function uploadToZeroX0St(
  buffer: Buffer,
  filename: string,
  timeout: number
): Promise<UploadResult> {
  const ZERO_X0_URL = 'https://0x0.st';

  try {
    // Get basename for the file
    const basename = filename.split(/[\\/]/).pop() || 'video.mp4';

    // Create temp file for curl upload
    const tmpDir = process.env.TMPDIR || process.env.TEMP || '/tmp';
    const tmpPath = `${tmpDir}/${basename}-${Date.now()}`;
    await fs.writeFile(tmpPath, buffer);

    try {
      // Use curl to upload (0x0.st blocks Node.js fetch but allows curl)
      const timeoutSec = Math.floor(timeout / 1000);
      const curlResult = execSync(
        `curl -s -m ${timeoutSec} -F "file=@${tmpPath}" ${ZERO_X0_URL}`,
        {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout,
        }
      );

      const link = curlResult.trim();

      // Validate response
      if (!link || !link.startsWith('http')) {
        throw new Error(`${STORAGE_ERROR_CODES.INVALID_RESPONSE}: Response is not a valid URL: ${link.substring(0, 100)}`);
      }

      return {
        link: link,
      };

    } finally {
      // Cleanup temp file
      await fs.unlink(tmpPath).catch(() => {});
    }

  } catch (err) {
    const error = err as Error;

    // Re-throw our custom errors
    if (error.message.startsWith('[E04')) {
      throw error;
    }

    // Handle timeout errors
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      throw new Error(STORAGE_ERROR_CODES.TIMEOUT);
    }

    // Handle curl errors
    if (error.message.includes('curl')) {
      throw new Error(`${STORAGE_ERROR_CODES.UPLOAD_FAILED}: ${error.message}`);
    }

    // Wrap other errors
    throw new Error(`${STORAGE_ERROR_CODES.UPLOAD_FAILED}: ${error.message}`);
  }
}

/**
 * Get content type for file extension
 * @param filename - File name or extension
 * @returns Content type string
 */
function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const contentTypes: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

// ============================================================================
// Fallback Services (not implemented yet, reserved for future)
// ============================================================================

/**
 * Upload to litterbox.catbox.moe as fallback
 * @param buffer - File content
 * @param filename - Original filename
 * @param timeout - Request timeout
 * @returns UploadResult with download link
 */
async function uploadToLitterbox(
  buffer: Buffer,
  filename: string,
  timeout: number
): Promise<UploadResult> {
  const LITTERBOX_URL = 'https://litterbox.catbox.moe/resources/internals/api.php';

  try {
    const basename = filename.split(/[\\/]/).pop() || 'video.mp4';

    // Create FormData for litterbox
    const formData = new FormData();
    const blob = new Blob([buffer], { type: getContentType(basename) });
    formData.append('fileToUpload', blob, basename);
    formData.append('reqtype', 'fileupload');
    formData.append('time', '24h'); // 24 hour expiration

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(LITTERBOX_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const link = await response.text();

    if (!link || !link.startsWith('http')) {
      throw new Error(`${STORAGE_ERROR_CODES.INVALID_RESPONSE}: Invalid download link`);
    }

    return { link: link.trim() };
  } catch (err) {
    const error = err as Error;
    throw new Error(`${STORAGE_ERROR_CODES.UPLOAD_FAILED}: ${error.message}`);
  }
}

/**
 * Upload to transfer.sh as fallback
 * @param buffer - File content
 * @param filename - Original filename
 * @param timeout - Request timeout
 * @returns UploadResult with download link
 */
async function uploadToTransferSh(
  buffer: Buffer,
  filename: string,
  timeout: number
): Promise<UploadResult> {
  const TRANSFER_SH_URL = 'https://transfer.sh';

  try {
    const basename = filename.split(/[\\/]/).pop() || 'video.mp4';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // transfer.sh uses PUT request with the filename in the URL
    const response = await fetch(`${TRANSFER_SH_URL}/${basename}`, {
      method: 'PUT',
      body: buffer,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const link = await response.text();

    if (!link || !link.startsWith('http')) {
      throw new Error(`${STORAGE_ERROR_CODES.INVALID_RESPONSE}: Invalid download link`);
    }

    return { link: link.trim() };
  } catch (err) {
    const error = err as Error;
    throw new Error(`${STORAGE_ERROR_CODES.UPLOAD_FAILED}: ${error.message}`);
  }
}
