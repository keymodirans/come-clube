/**
 * Init command - Setup AutoCliper dependencies
 *
 * Installs FFmpeg, yt-dlp, and optionally MediaPipe
 */

import { Command } from 'commander';
import { log, blank, separator } from '../utils/logger.js';

export const initCommand = new Command('init')
  .description('Initialize AutoCliper by installing required dependencies (FFmpeg, yt-dlp)')
  .action(() => {
    blank();
    separator();
    log('AutoCliper Initialization');
    blank();
    log('This command will install:');
    log('  - FFmpeg 7.1');
    log('  - yt-dlp 2025.01.x');
    log('  - MediaPipe (optional, for face detection)');
    blank();
    log('Coming soon in Phase 03: External Tools Installation');
    log('');
    log('For now, please ensure you have the following installed:');
    blank();
    log('  1. FFmpeg 7.1 or later');
    log('     Download from: https://github.com/BtbN/FFmpeg-Builds/releases');
    blank();
    log('  2. yt-dlp 2025.01.x or later');
    log('     Download from: https://github.com/yt-dlp/yt-dlp/releases');
    blank();
    log('  3. (Optional) Python with MediaPipe for face detection');
    log('     Install with: pip install mediapipe opencv-python');
    separator();
  });
