/**
 * Hardware ID (HWID) generation and encryption for AutoCliper license system
 *
 * Uses node-machine-id for consistent device identification,
 * SHA-256 hashing with secret salt, and AES-256-CBC encryption.
 */

import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { machineIdSync } from 'node-machine-id';

/**
 * Secret salt for HWID generation
 * NEVER change this - it would invalidate all existing licenses
 */
const HWID_SECRET = 'autocliper-hwid-secret-2026';

/**
 * Key derivation salt for encryption
 */
const ENCRYPTION_SECRET = 'autocliper-encryption-key-2026';

/**
 * Config directory path (~/.autocliper/)
 */
export function getConfigDir(): string {
  return path.join(os.homedir(), '.autocliper');
}

/**
 * Device lock file path
 */
export function getLockFilePath(): string {
  return path.join(getConfigDir(), 'device.lock');
}

/**
 * Generate raw machine ID using node-machine-id
 * @returns Machine ID (UUID format)
 */
function getRawMachineId(): string {
  try {
    return machineIdSync();
  } catch (err) {
    // Fallback to platform-specific IDs if machineIdSync fails
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const cpus = os.cpus()[0]?.model || 'unknown';
    return `${hostname}-${platform}-${arch}-${cpus}`;
  }
}

/**
 * Hash machine ID with SHA-256 and secret salt
 * @param rawId - Raw machine identifier
 * @returns Hashed HWID
 */
function hashMachineId(rawId: string): string {
  return crypto
    .createHash('sha256')
    .update(rawId + HWID_SECRET)
    .digest('hex');
}

/**
 * Format hash as XXXX-XXXX-XXXX-XXXX
 * @param hash - 32-character hex string
 * @returns Formatted HWID
 */
function formatAsHWID(hash: string): string {
  // Take first 32 chars (128 bits) and format in groups of 4
  const truncated = hash.substring(0, 32);
  return [
    truncated.substring(0, 4),
    truncated.substring(4, 8),
    truncated.substring(8, 12),
    truncated.substring(12, 16),
  ].join('-');
}

/**
 * Generate Hardware ID for current device
 * HWID is consistent across runs on the same machine
 * @returns Formatted HWID (XXXX-XXXX-XXXX-XXXX)
 */
export function generateHWID(): string {
  const rawId = getRawMachineId();
  const hashed = hashMachineId(rawId);
  return formatAsHWID(hashed);
}

/**
 * Derive encryption key from secret using scrypt
 * @returns 32-byte key for AES-256
 */
function deriveKey(): Buffer {
  const salt = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
  return crypto.scryptSync(ENCRYPTION_SECRET, salt, 32);
}

/**
 * Encrypt HWID using AES-256-CBC
 * @param hwid - Hardware ID to encrypt
 * @returns Base64-encoded encrypted data with IV prepended
 */
export function encryptHWID(hwid: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(16); // Random IV for each encryption

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(hwid, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Prepend IV (hex) to encrypted data
  const ivHex = iv.toString('hex');
  return Buffer.from(ivHex + ':' + encrypted).toString('base64');
}

/**
 * Decrypt HWID using AES-256-CBC
 * @param encryptedData - Base64-encoded encrypted data with IV
 * @returns Decrypted HWID
 * @throws Error if decryption fails
 */
export function decryptHWID(encryptedData: string): string {
  try {
    const key = deriveKey();

    // Decode base64 and split IV from encrypted data
    const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
    const [ivHex, encrypted] = decoded.split(':');

    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    throw new Error('Failed to decrypt HWID');
  }
}

/**
 * Save encrypted HWID to device lock file
 * @param hwid - Hardware ID to encrypt and save
 * @throws Error if write fails
 */
export function saveDeviceLock(hwid: string): void {
  const configDir = getConfigDir();
  const lockFile = getLockFilePath();

  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const encrypted = encryptHWID(hwid);
  fs.writeFileSync(lockFile, encrypted, { mode: 0o600 });
}

/**
 * Load and decrypt HWID from device lock file
 * @returns Decrypted HWID or null if file doesn't exist
 * @throws Error if file exists but decryption fails
 */
export function loadDeviceLock(): string | null {
  const lockFile = getLockFilePath();

  if (!fs.existsSync(lockFile)) {
    return null;
  }

  const encrypted = fs.readFileSync(lockFile, 'utf8').trim();
  return decryptHWID(encrypted);
}
