/**
 * Face Detector - Python MediaPipe wrapper
 *
 * Spawns Python process to detect faces in video segments.
 * Determines display mode (CENTER vs SPLIT) based on face count.
 * Extracts bounding boxes for split-screen layout.
 */

import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { log, warn, success } from '../utils/logger.js';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Bounding box for a face in relative coordinates (0-1)
 */
export interface BoundingBox {
  /** X position of top-left corner (0-1) */
  x: number;
  /** Y position of top-left corner (0-1) */
  y: number;
  /** Width of bounding box (0-1) */
  width: number;
  /** Height of bounding box (0-1) */
  height: number;
}

/**
 * Video segment with timestamps
 */
export interface Segment {
  /** Start timestamp in HH:MM:SS format or seconds */
  start: string | number;
  /** End timestamp in HH:MM:SS format or seconds */
  end: string | number;
}

/**
 * Display mode for video layout
 */
export type DisplayMode = 'CENTER' | 'SPLIT';

/**
 * Face detection result for a single segment
 */
export interface FaceSegmentResult {
  /** Zero-based index of the segment */
  segment_index: number;
  /** Start timestamp from input */
  start: string | number;
  /** End timestamp from input */
  end: string | number;
  /** Number of faces detected (0-2+) */
  face_count: number;
  /** Display mode based on face count */
  mode: DisplayMode;
  /** Bounding boxes for split screen (only when mode=SPLIT) */
  boxes: BoundingBox[];
}

/**
 * Complete result from Python face detector
 */
export interface FaceDetectorOutput {
  /** Results for each segment */
  results: FaceSegmentResult[];
}

/**
 * Face detection configuration options
 */
export interface FaceDetectionOptions {
  /** Whether to log progress (default: true) */
  verbose?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Path to Python face detector script */
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'face_detector.py');

/** Error codes for face detection */
const ERROR_CODES = {
  PYTHON_NOT_FOUND: '[E040]',
  SCRIPT_FAILED: '[E041]',
  INVALID_JSON: '[E042]',
  VIDEO_NOT_FOUND: '[E043]',
  DETECTION_ERROR: '[E044]',
} as const;

// ============================================================================
// Python Availability Checks
// ============================================================================

/**
 * Check if Python is available on the system
 *
 * @returns Promise<boolean> - true if Python is installed
 */
export async function checkPythonAvailable(): Promise<boolean> {
  const isWindows = os.platform() === 'win32';
  const pythonCommands = isWindows ? ['python', 'py'] : ['python3', 'python'];

  for (const cmd of pythonCommands) {
    try {
      const result = await spawnPython(cmd, ['--version'], true);
      if (result.success && result.stdout.includes('Python')) {
        return true;
      }
    } catch {
      // Continue to next command
    }
  }

  return false;
}

/**
 * Check if MediaPipe is installed in Python
 *
 * @returns Promise<boolean> - true if MediaPipe is available
 */
export async function checkMediaPipeInstalled(): Promise<boolean> {
  const isWindows = os.platform() === 'win32';
  const pythonCommands = isWindows ? ['python', 'py'] : ['python3', 'python'];

  for (const cmd of pythonCommands) {
    try {
      const result = await spawnPython(
        cmd,
        ['-c', 'import mediapipe; print(mediapipe.__version__)'],
        true
      );
      if (result.success && result.stdout.trim().length > 0) {
        return true;
      }
    } catch {
      // Continue to next command
    }
  }

  return false;
}

// ============================================================================
// Python Process Spawning
// ============================================================================

/**
 * Result from spawned Python process
 */
interface SpawnResult {
  /** Whether the process succeeded */
  success: boolean;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  exitCode: number | null;
}

/**
 * Spawn a Python process and capture output
 *
 * @param command - Python command to run (python, python3, py)
 * @param args - Arguments to pass to Python
 * @param silent - Whether to suppress errors
 * @returns Promise<SpawnResult> - Process result
 */
async function spawnPython(
  command: string,
  args: string[],
  silent: boolean = false
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300000, // 5 minutes timeout
    });

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
        exitCode: code,
      });
    });

    proc.on('error', (err) => {
      if (!silent) {
        stderr += err.message;
      }
      resolve({
        success: false,
        stdout,
        stderr,
        exitCode: -1,
      });
    });
  });
}

/**
 * Find the working Python command
 *
 * @returns Promise<string | null> - Python command or null if not found
 */
async function findPythonCommand(): Promise<string | null> {
  const isWindows = os.platform() === 'win32';
  const pythonCommands = isWindows ? ['python', 'py'] : ['python3', 'python'];

  for (const cmd of pythonCommands) {
    try {
      const result = await spawnPython(cmd, ['--version'], true);
      if (result.success && result.stdout.includes('Python')) {
        return cmd;
      }
    } catch {
      // Continue to next command
    }
  }

  return null;
}

// ============================================================================
// Face Detection Main Function
// ============================================================================

/**
 * Detect faces in video segments using Python + MediaPipe
 *
 * @param videoPath - Path to video file
 * @param segments - Array of segments with start/end times
 * @param options - Detection options
 * @returns Promise<FaceSegmentResult[]> - Face detection results
 */
export async function detectFaces(
  videoPath: string,
  segments: Segment[],
  options: FaceDetectionOptions = {}
): Promise<FaceSegmentResult[]> {
  const { verbose = true } = options;

  // Fallback: Return CENTER mode for all segments if Python unavailable
  const fallbackResult = segments.map((seg, i) => ({
    segment_index: i,
    start: seg.start,
    end: seg.end,
    face_count: 1,
    mode: 'CENTER' as DisplayMode,
    boxes: [],
  }));

  try {
    // Check if Python is available
    if (verbose) {
      log('> Checking Python availability...');
    }

    const pythonCmd = await findPythonCommand();
    if (!pythonCmd) {
      if (verbose) {
        warn('! Python not found. Face detection disabled.');
        warn('  Install Python and MediaPipe for face detection feature.');
        warn('  Run: pip install mediapipe opencv-python');
      }
      return fallbackResult;
    }

    if (verbose) {
      success(`+ Python found: ${pythonCmd}`);
    }

    // Check if MediaPipe is installed
    if (verbose) {
      log('> Checking MediaPipe installation...');
    }

    const hasMediaPipe = await checkMediaPipeInstalled();
    if (!hasMediaPipe) {
      if (verbose) {
        warn('! MediaPipe not installed. Face detection disabled.');
        warn('  Install with: pip install mediapipe opencv-python');
      }
      return fallbackResult;
    }

    if (verbose) {
      success('+ MediaPipe installed');
    }

    // Check if script exists
    try {
      await fs.access(SCRIPT_PATH);
    } catch {
      if (verbose) {
        warn(`! Face detector script not found: ${SCRIPT_PATH}`);
      }
      return fallbackResult;
    }

    // Create temp JSON file for segments data
    const segmentsJson = JSON.stringify(segments);

    if (verbose) {
      log(`> Detecting faces in ${segments.length} segment(s)...`);
    }

    // Spawn Python process
    const result = await spawnPython(pythonCmd, [SCRIPT_PATH, videoPath, segmentsJson]);

    if (!result.success) {
      if (verbose) {
        warn(`! Face detection failed: ${result.stderr || 'Unknown error'}`);
        warn('  Falling back to CENTER mode for all segments');
      }
      return fallbackResult;
    }

    // Parse JSON output
    let output: FaceDetectorOutput;
    try {
      output = JSON.parse(result.stdout);
    } catch (parseError) {
      if (verbose) {
        warn(`! Failed to parse face detection output: ${parseError}`);
        warn('  Falling back to CENTER mode for all segments');
      }
      return fallbackResult;
    }

    // Validate output structure
    if (!output.results || !Array.isArray(output.results)) {
      if (verbose) {
        warn('! Invalid face detection output structure');
        warn('  Falling back to CENTER mode for all segments');
      }
      return fallbackResult;
    }

    if (verbose) {
      success(`+ Face detection complete`);
    }

    return output.results;

  } catch (error) {
    const err = error as Error;
    if (verbose) {
      warn(`! Face detection error: ${err.message}`);
      warn('  Falling back to CENTER mode for all segments');
    }
    return fallbackResult;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get display mode for a single segment result
 *
 * @param result - Face detection result
 * @returns Display mode (CENTER or SPLIT)
 */
export function getDisplayMode(result: FaceSegmentResult): DisplayMode {
  return result.mode;
}

/**
 * Check if a segment should use split-screen layout
 *
 * @param result - Face detection result
 * @returns true if mode is SPLIT
 */
export function isSplitScreen(result: FaceSegmentResult): boolean {
  return result.mode === 'SPLIT';
}
