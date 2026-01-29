/**
 * Config command - Setup API keys and preferences
 *
 * Interactive setup for Deepgram, Gemini API keys
 */

import { Command } from 'commander';
import { log } from '../utils/logger.js';

export const configCommand = new Command('config')
  .description('Configure AutoCliper API keys and preferences')
  .action(() => {
    log('Configuring AutoCliper...');
    log('');
    log('You will need to provide:');
    log('  - Deepgram API key (for transcription)');
    log('  - Google Gemini API key (for viral detection)');
    log('');
    log('[Command not yet implemented]');
  });
