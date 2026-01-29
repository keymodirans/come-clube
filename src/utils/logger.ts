/**
 * Logger utility for AutoCliper CLI
 *
 * Provides cross-platform, ASCII-only output formatting.
 * No emoji - uses ASCII symbols: > + x ! - #
 */

/**
 * Standard log message with arrow prefix
 */
export function log(message: string): void {
  console.log(`> ${message}`);
}

/**
 * Success message with plus prefix
 */
export function success(message: string): void {
  console.log(`+ ${message}`);
}

/**
 * Error message with X prefix
 */
export function error(message: string): void {
  console.error(`x ${message}`);
}

/**
 * Warning message with exclamation prefix
 */
export function warn(message: string): void {
  console.log(`! ${message}`);
}

/**
 * Info message with dash prefix
 */
export function info(message: string): void {
  console.log(`- ${message}`);
}

/**
 * Numbered list item
 */
export function number(num: number, message: string): void {
  console.log(`# ${num} ${message}`);
}

/**
 * Blank line for spacing
 */
export function blank(): void {
  console.log('');
}

/**
 * Separator line
 */
export function separator(): void {
  console.log(''.padEnd(50, '-'));
}
