/**
 * AutoCliper CLI - Main Entry Point
 *
 * CLI tool for automatically generating viral short-form video clips
 * from YouTube videos using hybrid local-cloud processing.
 */

import { Command } from 'commander';
import { verifyDevice, ERROR_CODES } from './license/validator.js';
import { initCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';
import { runCommand } from './commands/run.js';
import { hwidCommand } from './commands/hwid.js';
import { log, error, blank, separator } from './utils/logger.js';

const program = new Command();

/**
 * Check device license before running commands
 *
 * Bypassed commands: 'config', 'hwid' (should work even on mismatched device)
 *
 * @param commandName - Name of the command being executed
 * @throws Error if device validation fails
 */
function checkLicense(commandName: string): void {
  // Skip license check for config and hwid commands
  const bypassCommands = ['config', 'hwid'];

  if (bypassCommands.includes(commandName)) {
    return;
  }

  // Verify device license
  const result = verifyDevice();

  if (!result.valid) {
    blank();
    separator();
    error(result.error || 'Device validation failed');
    blank();

    if (result.error?.includes(ERROR_CODES.DEVICE_MISMATCH)) {
      log('This license is locked to a different device.');
      blank();
      log('To resolve this issue:');
      log('  1. If you moved this installation, copy the device.lock file');
      log('  2. Or request a new license for this device');
      blank();
      log('Run "autocliper hwid" to see your current device ID.');
    } else {
      log('Please ensure you have proper permissions to access ~/.autocliper/');
    }

    separator();
    blank();
    throw new Error('Device license validation failed');
  }

  // First run - welcome message
  if (result.firstRun) {
    blank();
    separator();
    log('Welcome to AutoCliper!');
    blank();
    log('This appears to be your first run.');
    log('Your device has been automatically registered.');
    blank();
    log('Next steps:');
    log('  1. Run "autocliper config" to setup your API keys');
    log('  2. Run "autocliper run <youtube-url>" to process videos');
    separator();
    blank();
  }
}

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
  program.addCommand(hwidCommand);

  // Hook into command execution to check license
  program.hook('preAction', (thisCommand) => {
    const commandName = thisCommand.name();
    checkLicense(commandName);
  });

  await program.parseAsync(process.argv);
}

// Allow direct execution for testing
// Check if this is the main module (works with both Node.js and pkg)
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  runCli().catch(() => {
    // Already logged by checkLicense, just exit
    process.exit(1);
  });
}
