/**
 * AutoCliper CLI - Main Entry Point
 *
 * CLI tool for automatically generating viral short-form video clips
 * from YouTube videos using hybrid local-cloud processing.
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';
import { runCommand } from './commands/run.js';
import { log } from './utils/logger.js';

const program = new Command();

/**
 * Main CLI program setup and execution
 */
export async function runCli(): Promise<void> {
  program
    .name('autocliper')
    .description('CLI tool for automatically generating viral short-form video clips from YouTube videos')
    .version('1.0.0');

  // Register commands
  program.addCommand(initCommand);
  program.addCommand(configCommand);
  program.addCommand(runCommand);

  // HWID command (inline - no separate file needed)
  program
    .command('hwid')
    .description('Show device hardware ID')
    .action(() => {
      log('HWID command - Not yet implemented');
    });

  await program.parseAsync(process.argv);
}

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('x Fatal error:', error.message);
    process.exit(1);
  });
}
