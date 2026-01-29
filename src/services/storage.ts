/**
 * Storage Service - Upload files to temporary storage
 *
 * Handles uploading source videos to temporary file hosting services
 * for cloud rendering via GitHub Actions.
 */

import fs from 'fs-extra';
import { request } from 'undici';
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
 * Upload a file to temporary storage using file.io
 *
 * file.io provides free temporary file hosting with:
 * - 100 files/day limit on free tier
 * - Automatic expiration (default: 1 day)
 * - Direct download links
 * - No authentication required
 *
 * Fallback services (if file.io fails):
 * - transfer.sh (14-day expiration, no auth)
 * - tempfile.io (similar to file.io)
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

  // Upload with retry logic
  return await retryApi(
    () => uploadToFileIo(fileBuffer, filePath, finalConfig.timeout),
    'File upload',
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 30000,
    }
  );
}

/**
 * Upload file to file.io service
 * @param buffer - File content as buffer
 * @param filename - Original filename for content-type hint
 * @param timeout - Request timeout in milliseconds
 * @returns UploadResult with download link
 * @throws Error with [E04x] codes on failure
 */
async function uploadToFileIo(
  buffer: Buffer,
  filename: string,
  timeout: number
): Promise<UploadResult> {
  const FILE_IO_URL = 'https://file.io';

  try {
    // Determine content type based on file extension
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const contentType = getContentType(ext);
    const basename = filename.split(/[\\/]/).pop() || 'video.mp4';

    // Create multipart form data boundary
    const boundary = `----FormDataBoundary${Date.now()}`;

    // Build the multipart form data properly
    // Note: We need to construct the body as a buffer with proper encoding
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${basename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    // Concatenate header + buffer + footer
    const headerBuffer = Buffer.from(header, 'utf8');
    const footerBuffer = Buffer.from(footer, 'utf8');
    const bodyBuffer = Buffer.concat([headerBuffer, buffer, footerBuffer]);

    // Make POST request to file.io
    const response = await request(FILE_IO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
      timeout,
    });

    // Parse response
    let responseData: any;
    try {
      responseData = await response.body.json();
    } catch (parseError) {
      const responseText = await response.body.text();
      throw new Error(`${STORAGE_ERROR_CODES.INVALID_RESPONSE}: ${responseText.substring(0, 200)}`);
    }

    // Validate response structure
    if (!responseData || typeof responseData !== 'object') {
      throw new Error(`${STORAGE_ERROR_CODES.INVALID_RESPONSE}: Response is not an object`);
    }

    if (!responseData.success) {
      throw new Error(`${STORAGE_ERROR_CODES.UPLOAD_FAILED}: ${responseData.message || 'Unknown error'}`);
    }

    if (!responseData.link || typeof responseData.link !== 'string') {
      throw new Error(`${STORAGE_ERROR_CODES.INVALID_RESPONSE}: Missing or invalid 'link' field`);
    }

    return {
      link: responseData.link,
      key: responseData.key,
      expiry: responseData.expiry,
    };

  } catch (err) {
    const error = err as Error;

    // Re-throw our custom errors
    if (error.message.startsWith('[E04')) {
      throw error;
    }

    // Handle timeout errors
    if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      throw new Error(STORAGE_ERROR_CODES.TIMEOUT);
    }

    // Wrap other errors
    throw new Error(`${STORAGE_ERROR_CODES.UPLOAD_FAILED}: ${error.message}`);
  }
}

/**
 * Get content type for file extension
 * @param ext - File extension
 * @returns Content type string
 */
function getContentType(ext: string): string {
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
 * Upload to transfer.sh as fallback
 * @param buffer - File content
 * @param filename - Original filename
 * @returns UploadResult with download link
 */
async function uploadToTransferSh(buffer: Buffer, filename: string): Promise<UploadResult> {
  const TRANSFER_SH_URL = 'https://transfer.sh';

  try {
    const response = await request(`${TRANSFER_SH_URL}/${filename}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
      timeout: 60000, // 1 minute
    });

    const link = await response.body.text();

    if (!link || !link.startsWith('http')) {
      throw new Error(`${STORAGE_ERROR_CODES.INVALID_RESPONSE}: Invalid download link`);
    }

    return { link };
  } catch (err) {
    const error = err as Error;
    throw new Error(`${STORAGE_ERROR_CODES.UPLOAD_FAILED}: ${error.message}`);
  }
}
