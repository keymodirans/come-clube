/**
 * Device validation for AutoCliper license system
 *
 * Verifies that the current device matches the stored license.
 * Auto-locks on first run.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateHWID, saveDeviceLock, loadDeviceLock, getConfigDir, getLockFilePath } from './hwid.js';

/**
 * Device validation result
 */
export interface DeviceValidationResult {
  valid: boolean;
  firstRun: boolean;
  error?: string;
}

/**
 * Error codes for license/HWID domain
 */
export const ERROR_CODES = {
  DEVICE_MISMATCH: '[E001]',
  CONFIG_MISSING: '[E002]',
} as const;

/**
 * Verify device license
 *
 * - First run: Creates device.lock with encrypted HWID
 * - Subsequent runs: Compares current HWID with stored value
 * - Different device: Returns error with [E001] code
 *
 * @returns Validation result with valid, firstRun, and optional error
 */
export function verifyDevice(): DeviceValidationResult {
  const configDir = getConfigDir();
  const lockFile = getLockFilePath();

  // Create config directory if missing
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // First run - no lock file exists
  if (!fs.existsSync(lockFile)) {
    try {
      const currentHWID = generateHWID();
      saveDeviceLock(currentHWID);
      return {
        valid: true,
        firstRun: true,
      };
    } catch (err) {
      return {
        valid: false,
        firstRun: false,
        error: 'Failed to create device lock file',
      };
    }
  }

  // Subsequent run - verify HWID matches
  try {
    const storedHWID = loadDeviceLock();

    if (!storedHWID) {
      return {
        valid: false,
        firstRun: false,
        error: 'Failed to read device lock file',
      };
    }

    const currentHWID = generateHWID();

    if (currentHWID !== storedHWID) {
      // Device mismatch - NEVER log the actual HWID values
      return {
        valid: false,
        firstRun: false,
        error: `${ERROR_CODES.DEVICE_MISMATCH} Device license mismatch. This license is locked to a different device.`,
      };
    }

    // HWID matches - device is valid
    return {
      valid: true,
      firstRun: false,
    };
  } catch (err) {
    return {
      valid: false,
      firstRun: false,
      error: `Failed to verify device license: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get license status information
 * @returns Object with license status details
 */
export function getLicenseStatus(): {
  locked: boolean;
  configDir: string;
  lockFileExists: boolean;
} {
  const configDir = getConfigDir();
  const lockFile = getLockFilePath();

  return {
    locked: fs.existsSync(lockFile),
    configDir,
    lockFileExists: fs.existsSync(lockFile),
  };
}
