/**
 * Progress bar utility for AutoCliper
 *
 * Provides CLI progress tracking using cli-progress.
 * ASCII only output (no emoji).
 */

import createProgressBar, { ProgressBar } from 'cli-progress';

/**
 * Progress bar options
 */
export interface ProgressOptions {
  /** Title for the progress bar */
  title?: string;
  /** Total value (default: 100) */
  total?: number;
  /** Display format (uses default if not specified) */
  format?: string;
}

/**
 * Create a new progress bar
 * @param options - Progress bar options
 * @returns Progress bar instance
 */
export function createProgressBar(options: ProgressOptions = {}): ProgressBar {
  const {
    title = '',
    total = 100,
    format,
  } = options;

  // Default format: [=========>] 45% | 28MB/62MB
  const defaultFormat = `${title ? title + ' ' : ''}[{bar}] {percentage}% | {value}/{total}`;

  return createProgressBar.create({
    format: format || defaultFormat,
    barCompleteChar: '=',
    barIncompleteChar: '-',
    hideCursor: true,
    clearOnComplete: true,
    stopOnComplete: true,
    barsize: 40,
    autoptracing: true,
  }, total);
}

/**
 * Create a download progress bar with size tracking
 * @param title - Title for the download
 * @param totalBytes - Total bytes to download
 * @returns Progress bar instance
 */
export function createDownloadProgress(title: string, totalBytes: number): ProgressBar {
  return createProgressBar({
    title,
    total: totalBytes,
    format: `${title} [{bar}] {percentage}% | {value_formatted}/{total_formatted}`,
  });
}

/**
 * Progress indicator states (ASCII only)
 */
export const ProgressIndicator = {
  PENDING: '-',
  RUNNING: '>',
  SUCCESS: '+',
  ERROR: 'x',
  WARNING: '!',
} as const;

/**
 * Simple spinner using ASCII characters
 */
export class Spinner {
  private frames = ['-', '\\', '|', '/'];
  private frameIndex = 0;
  private interval: NodeJS.Timeout | null = null;
  private message: string = '';

  constructor(message: string) {
    this.message = message;
  }

  /**
   * Start the spinner
   */
  start(): void {
    // Only start if not already running
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      process.stdout.write(`\r${frame} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 100);
  }

  /**
   * Stop the spinner with success message
   * @param message - Success message to display
   */
  succeed(message: string): void {
    this.stop(message, '+');
  }

  /**
   * Stop the spinner with error message
   * @param message - Error message to display
   */
  fail(message: string): void {
    this.stop(message, 'x');
  }

  /**
   * Stop the spinner
   * @param message - Final message
   * @param symbol - Prefix symbol
   */
  private stop(message: string, symbol: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // Clear the spinner line and print final message
    process.stdout.write('\r' + ' '.repeat(this.message.length + 10) + '\r');
    console.log(`${symbol} ${message}`);
  }
}

/**
 * Create a new spinner
 * @param message - Initial message
 * @returns Spinner instance
 */
export function createSpinner(message: string): Spinner {
  return new Spinner(message);
}
