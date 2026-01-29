/**
 * Init command - Setup AutoCliper dependencies
 *
 * Installs FFmpeg, yt-dlp, and optionally MediaPipe
 */

import { Command } from 'commander';
import { log } from '../utils/logger.js';

export const initCommand = new Command('init')
  .description('Initialize AutoCliper by installing required dependencies (FFmpeg, yt-dlp)')
  .action(() => {
    log('Initializing AutoCliper...');
    log('');
    log('This will install:');
    log('  - FFmpeg 7.1');
    log('  - yt-dlp 2025.01.x');
    log('  - MediaPipe (optional, for face detection)');
    log('');
    log('[Command not yet implemented]');
  });
