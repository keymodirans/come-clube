/**
 * Props Builder - Generates Remotion render props for viral segments
 *
 * Converts viral segment analysis results into Remotion-compatible JSON props
 * for the video rendering pipeline.
 */

import { nanoid } from 'nanoid';
import type { ViralSegment } from './analyzer.js';
import type { Word } from './transcriber.js';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Word entry for subtitle synchronization
 */
export interface PropWord {
  /** Word with punctuation */
  word: string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
}

/**
 * Subtitle style configuration
 */
export interface SubtitleStyle {
  /** Font family for subtitles */
  fontFamily: string;
  /** Font size in pixels */
  fontSize: number;
  /** Font weight */
  fontWeight: number;
  /** Text color */
  color: string;
  /** Highlight color for emphasis words */
  highlightColor: string;
  /** Stroke/outline color */
  strokeColor: string;
  /** Stroke width in pixels */
  strokeWidth: number;
  /** Vertical position */
  position: 'bottom' | 'center';
}

/**
 * Hook overlay style configuration
 */
export interface HookStyle {
  /** Whether to show hook overlay */
  show: boolean;
  /** Duration in frames (90 = 3 seconds @ 30fps) */
  durationFrames: number;
  /** Font family */
  fontFamily: string;
  /** Font size in pixels */
  fontSize: number;
  /** Background color (rgba) */
  backgroundColor: string;
  /** Vertical position */
  position: 'top' | 'bottom';
}

/**
 * Crop data for split-screen mode
 */
export interface CropData {
  /** X position of crop area */
  x: number;
  /** Y position of crop area */
  y: number;
  /** Width of crop area */
  width: number;
  /** Height of crop area */
  height: number;
}

/**
 * Face detection result
 */
export interface FaceDetectionResult {
  /** Number of faces detected */
  faceCount: number;
  /** Crop mode based on face count */
  cropMode: 'CENTER' | 'SPLIT';
  /** Optional bounding boxes for detected faces */
  boxes?: Array<{ x: number; y: number; width: number; height: number }>;
}

/**
 * Remotion render props for a single segment
 */
export interface SegmentProps {
  /** Unique segment identifier */
  id: string;
  /** Frame rate (frames per second) */
  fps: number;
  /** Video width in pixels */
  width: number;
  /** Video height in pixels */
  height: number;
  /** Duration in frames */
  durationInFrames: number;
  /** Source video URL (after upload to temp storage) */
  videoSrc: string;
  /** Start time in seconds */
  videoStartTime: number;
  /** Crop mode (CENTER = single face/center, SPLIT = multiple faces) */
  cropMode: 'CENTER' | 'SPLIT';
  /** Crop data for SPLIT mode */
  cropData?: CropData;
  /** Words array for subtitle synchronization */
  words: PropWord[];
  /** Subtitle style configuration */
  subtitleStyle: SubtitleStyle;
  /** Hook text to display */
  hookText: string;
  /** Hook overlay style configuration */
  hookStyle: HookStyle;
}

/**
 * Props builder options
 */
export interface PropsBuilderOptions {
  /** Video URL after upload to temporary storage */
  videoSrc: string;
  /** Viral segments to generate props for */
  segments: ViralSegment[];
  /** Full transcript words array */
  words: Word[];
  /** Face detection results per segment */
  faceDetections: FaceDetectionResult[];
  /** Frame rate (default: 30) */
  fps?: number;
  /** Video dimensions (default: 1080x1920 for 9:16 vertical) */
  dimensions?: { width: number; height: number };
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'Montserrat',
  fontSize: 48,
  fontWeight: 800,
  color: '#FFFFFF',
  highlightColor: '#FFFF00',
  strokeColor: '#000000',
  strokeWidth: 4,
  position: 'bottom',
};

const DEFAULT_HOOK_STYLE: HookStyle = {
  show: true,
  durationFrames: 90, // 3 seconds @ 30fps
  fontFamily: 'Montserrat',
  fontSize: 32,
  backgroundColor: 'rgba(0,0,0,0.7)',
  position: 'top',
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Calculate duration in frames from seconds
 * @param seconds - Duration in seconds
 * @param fps - Frames per second
 * @returns Duration in frames
 */
export function calculateDuration(seconds: number, fps: number = 30): number {
  return Math.ceil(seconds * fps);
}

/**
 * Convert HH:MM:SS timestamp to seconds
 * @param hhmmss - Timestamp in HH:MM:SS format
 * @returns Seconds
 */
export function timestampToSeconds(hhmmss: string): number {
  const parts = hhmmss.split(':').map(Number);
  if (parts.length !== 3) {
    throw new Error(`[E050] Invalid timestamp format: ${hhmmss}`);
  }
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Filter words to segment time range
 * @param words - All words from transcript
 * @param startTime - Segment start time in seconds
 * @param endTime - Segment end time in seconds
 * @returns Filtered words with timestamps
 */
function filterWordsForSegment(
  words: Word[],
  startTime: number,
  endTime: number
): PropWord[] {
  return words
    .filter(w => w.start >= startTime && w.end <= endTime)
    .map(w => ({
      word: w.punctuated_word || w.word,
      start: w.start,
      end: w.end,
    }));
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Build Remotion props for viral segments
 *
 * @param options - Props builder options
 * @returns Array of SegmentProps for rendering
 */
export function buildProps(options: PropsBuilderOptions): SegmentProps[] {
  const {
    videoSrc,
    segments,
    words,
    faceDetections,
    fps = 30,
    dimensions = { width: 1080, height: 1920 },
  } = options;

  // Validate inputs
  if (!videoSrc) {
    throw new Error('[E051] Video source URL is required');
  }

  if (!segments || segments.length === 0) {
    throw new Error('[E052] No segments provided for props building');
  }

  if (!words || words.length === 0) {
    throw new Error('[E053] No words provided for props building');
  }

  if (faceDetections.length !== segments.length) {
    throw new Error('[E054] Face detection count must match segments count');
  }

  // Build props for each segment
  const props: SegmentProps[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const faceDetection = faceDetections[i];

    // Convert timestamps to seconds
    const startTime = timestampToSeconds(segment.start);
    const endTime = timestampToSeconds(segment.end);
    const duration = segment.duration_seconds;

    // Calculate duration in frames
    const durationInFrames = calculateDuration(duration, fps);

    // Filter words for this segment
    const segmentWords = filterWordsForSegment(words, startTime, endTime);

    // Build crop data if SPLIT mode
    let cropData: CropData | undefined;
    if (faceDetection.cropMode === 'SPLIT' && faceDetection.boxes && faceDetection.boxes.length > 0) {
      // Use first face box as crop area
      const box = faceDetection.boxes[0];
      cropData = {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
    }

    // Generate segment props
    const segmentProps: SegmentProps = {
      id: nanoid(10),
      fps,
      width: dimensions.width,
      height: dimensions.height,
      durationInFrames,
      videoSrc,
      videoStartTime: startTime,
      cropMode: faceDetection.cropMode,
      cropData,
      words: segmentWords,
      subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
      hookText: segment.hook_text,
      hookStyle: { ...DEFAULT_HOOK_STYLE },
    };

    props.push(segmentProps);
  }

  return props;
}

/**
 * Validate props against Remotion schema requirements
 * @param props - Segment props to validate
 * @returns true if valid
 * @throws Error with [E055] code if validation fails
 */
export function validateProps(props: SegmentProps): boolean {
  const requiredFields = [
    'id',
    'fps',
    'width',
    'height',
    'durationInFrames',
    'videoSrc',
    'videoStartTime',
    'cropMode',
    'words',
    'subtitleStyle',
    'hookText',
    'hookStyle',
  ];

  for (const field of requiredFields) {
    if (!(field in props)) {
      throw new Error(`[E055] Props validation failed: missing field '${field}'`);
    }
  }

  // Validate types
  if (typeof props.fps !== 'number' || props.fps <= 0) {
    throw new Error('[E055] Props validation failed: fps must be a positive number');
  }

  if (typeof props.width !== 'number' || props.width <= 0) {
    throw new Error('[E055] Props validation failed: width must be a positive number');
  }

  if (typeof props.height !== 'number' || props.height <= 0) {
    throw new Error('[E055] Props validation failed: height must be a positive number');
  }

  if (typeof props.durationInFrames !== 'number' || props.durationInFrames <= 0) {
    throw new Error('[E055] Props validation failed: durationInFrames must be a positive number');
  }

  if (typeof props.videoSrc !== 'string' || props.videoSrc.length === 0) {
    throw new Error('[E055] Props validation failed: videoSrc must be a non-empty string');
  }

  if (typeof props.videoStartTime !== 'number' || props.videoStartTime < 0) {
    throw new Error('[E055] Props validation failed: videoStartTime must be a non-negative number');
  }

  if (!['CENTER', 'SPLIT'].includes(props.cropMode)) {
    throw new Error('[E055] Props validation failed: cropMode must be CENTER or SPLIT');
  }

  if (!Array.isArray(props.words)) {
    throw new Error('[E055] Props validation failed: words must be an array');
  }

  if (!props.subtitleStyle || typeof props.subtitleStyle !== 'object') {
    throw new Error('[E055] Props validation failed: subtitleStyle must be an object');
  }

  if (!props.hookStyle || typeof props.hookStyle !== 'object') {
    throw new Error('[E055] Props validation failed: hookStyle must be an object');
  }

  // Validate SPLIT mode has cropData
  if (props.cropMode === 'SPLIT' && !props.cropData) {
    throw new Error('[E055] Props validation failed: SPLIT mode requires cropData');
  }

  return true;
}

/**
 * Validate all props in an array
 * @param propsArray - Array of segment props
 * @returns true if all valid
 * @throws Error with [E055] code if any validation fails
 */
export function validateAllProps(propsArray: SegmentProps[]): boolean {
  if (!Array.isArray(propsArray)) {
    throw new Error('[E055] Props must be an array');
  }

  if (propsArray.length === 0) {
    throw new Error('[E055] Props array is empty');
  }

  for (let i = 0; i < propsArray.length; i++) {
    try {
      validateProps(propsArray[i]);
    } catch (err) {
      const error = err as Error;
      throw new Error(`[E055] Props validation failed at index ${i}: ${error.message}`);
    }
  }

  return true;
}
