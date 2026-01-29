/**
 * HWID command - Show device hardware ID
 *
 * Displays current device ID, license status, and config directory
 */

import { Command } from 'commander';
import { generateHWID, getLockFilePath, loadDeviceLock } from '../license/hwid.js';
import { getLicenseStatus } from '../license/validator.js';
import { log, success, blank, separator } from '../utils/logger.js';

export const hwidCommand = new Command('hwid')
  .description('Show device hardware ID and license status')
  .action(() => {
    blank();
    separator();
    log('Device Information');
    blank();

    // Get license status
    const status = getLicenseStatus();

    // Generate current HWID
    const currentHWID = generateHWID();

    log(`Device ID:        ${currentHWID}`);
    blank();

    // License status
    if (status.locked) {
      success('License Status:   Locked');
      blank();

      // Verify HWID matches (for troubleshooting)
      try {
        const storedHWID = loadDeviceLock();
        if (storedHWID === currentHWID) {
          success('Validation:       Valid - Device matches license');
        } else {
          log('x Validation:       INVALID - Device mismatch!');
        }
      } catch (err) {
        log('! Validation:       Unable to verify lock file');
      }
    } else {
      log('! License Status:   Unlocked (first run)');
    }

    blank();
    log(`Config Directory: ${status.configDir}`);
    log(`Lock File:        ${getLockFilePath()}`);
    separator();
  });
