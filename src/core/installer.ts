/**
 * External Tools Installer for AutoCliper
 *
 * Auto-installs FFmpeg, yt-dlp, and Deno to ~/.autocliper/bin/
 * Cross-platform support for Windows, macOS, and Linux
 *
 * Error codes: E010-E019 (download/install domain)
 */

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { constants } from 'fs';
import extractZip from 'extract-zip';
import { get as getConfig, set as setConfig } from '../utils/config.js';

// Platform detection
const PLATFORM = os.platform();
const IS_WINDOWS = PLATFORM === 'win32';
const IS_MAC = PLATFORM === 'darwin';
const IS_LINUX = PLATFORM === 'linux';

// Directory constants
export const AUTOCLIPER_DIR = path.join(os.homedir(), '.autocliper');
export const BIN_DIR = path.join(AUTOCLIPER_DIR, 'bin');

// Tool names
export const TOOLS = {
  FFMPEG: IS_WINDOWS ? 'ffmpeg.exe' : 'ffmpeg',
  YT_DLP: IS_WINDOWS ? 'yt-dlp.exe' : 'yt-dlp',
  DENO: IS_WINDOWS ? 'deno.exe' : 'deno',
} as const;

export type ToolName = typeof TOOLS[keyof typeof TOOLS];

// Platform-specific download URLs
const URLs = {
  ffmpeg: {
    win32: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    darwin: 'https://evermeet.cx/ffmpeg/getrelease/zip',
    linux: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
  },
  ytdlp: {
    // Base URL for yt-dlp releases
    baseUrl: 'https://github.com/yt-dlp/yt-dlp/releases/download/',
    // Version without Deno requirement
    versionNoDeno: '2025.10.22',
    // Latest version (requires Deno for full YouTube support)
    versionLatest: '2025.11.12',
  },
  deno: {
    win32: 'https://dl.deno.land/windows-x64/deno.exe',
    darwin: 'https://dl.deno.land/x86_64-apple-darwin/deno',
    linux: 'https://dl.deno.land/x86_64-unknown-linux-gnu/deno',
  },
} as const;

/**
 * Download progress callback type
 */
export type ProgressCallback = (percent: number, downloaded: number, total: number) => void;

/**
 * Ensure ~/.autocliper/bin/ directory exists
 */
export async function ensureDirs(): Promise<void> {
  try {
    await fs.mkdir(BIN_DIR, { recursive: true });
  } catch (error) {
    throw new Error(`[E010] Failed to create directory: ${BIN_DIR}`);
  }
}

/**
 * Download file with progress tracking
 * @param url - URL to download from
 * @param destPath - Destination file path
 * @param onProgress - Progress callback
 */
export async function download(
  url: string,
  destPath: string,
  onProgress?: ProgressCallback
): Promise<void> {
  let response: Response;
  let retries = 3;
  let lastError: Error | null = null;

  // Retry logic for downloads
  while (retries > 0) {
    try {
      response = await fetch(url, { redirect: 'follow' });
      break;
    } catch (error) {
      lastError = error as Error;
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
      }
    }
  }

  if (!response || !response.ok) {
    throw new Error(`[E011] Download failed: ${url}${response ? ` (${response.status})` : ''}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  const buffer = await response.arrayBuffer();
  const data = Buffer.from(buffer);

  await fs.writeFile(destPath, data);

  if (onProgress && total > 0) {
    onProgress(100, data.length, total);
  }
}

/**
 * Set executable permission on Unix-like systems
 * @param filePath - Path to the file
 */
async function setExecutable(filePath: string): Promise<void> {
  if (!IS_WINDOWS) {
    try {
      await fs.chmod(filePath, 0o755);
    } catch (error) {
      throw new Error(`[E012] Failed to set executable permission: ${filePath}`);
    }
  }
}

/**
 * Extract .zip file
 * @param zipPath - Path to .zip file
 * @param destDir - Destination directory
 */
async function extractZipFile(zipPath: string, destDir: string): Promise<void> {
  try {
    await extractZip(zipPath, { dir: destDir });
  } catch (error) {
    throw new Error(`[E013] Failed to extract zip file: ${zipPath}`);
  }
}

/**
 * Extract .tar.xz file on Linux
 * @param tarPath - Path to .tar.xz file
 * @param destDir - Destination directory
 */
async function extractTarXz(tarPath: string, destDir: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tar = spawn('tar', ['-xJf', tarPath, '-C', destDir]);

    let stderr = '';

    tar.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    tar.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`[E014] Failed to extract tar.xz file: ${stderr || `exit code ${code}`}`));
      }
    });
  });
}

/**
 * Find FFmpeg binary in extracted directory
 * @param dir - Directory to search
 * @returns Path to FFmpeg binary or null
 */
async function findFFmpegBinary(dir: string): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const found = await findFFmpegBinary(fullPath);
      if (found) return found;
    } else if (entry.name.includes('ffmpeg') && !entry.name.includes('ffplay') && !entry.name.includes('ffprobe')) {
      // On Windows, check for .exe
      if (IS_WINDOWS && !entry.name.endsWith('.exe')) {
        continue;
      }
      return fullPath;
    }
  }

  return null;
}

/**
 * Install FFmpeg to ~/.autocliper/bin/
 * @param onProgress - Progress callback
 */
export async function installFFmpeg(onProgress?: ProgressCallback): Promise<string> {
  await ensureDirs();

  const platform = PLATFORM;
  if (!URLs.ffmpeg[platform as keyof typeof URLs.ffmpeg]) {
    throw new Error(`[E015] Unsupported platform for FFmpeg: ${platform}`);
  }

  const url = URLs.ffmpeg[platform as keyof typeof URLs.ffmpeg];
  const fileName = path.basename(url);
  const downloadPath = path.join(AUTOCLIPER_DIR, fileName);
  const destPath = path.join(BIN_DIR, TOOLS.FFMPEG);

  log(`Downloading FFmpeg for ${platform}...`);

  await download(url, downloadPath, onProgress);

  log('Extracting FFmpeg...');

  // Extract based on file type
  if (fileName.endsWith('.zip')) {
    const tempDir = path.join(AUTOCLIPER_DIR, 'ffmpeg-temp');
    await fs.mkdir(tempDir, { recursive: true });
    await extractZipFile(downloadPath, tempDir);

    const binaryPath = await findFFmpegBinary(tempDir);
    if (!binaryPath) {
      throw new Error('[E016] FFmpeg binary not found in extracted archive');
    }

    await fs.copyFile(binaryPath, destPath);

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  } else if (fileName.endsWith('.tar.xz')) {
    const tempDir = path.join(AUTOCLIPER_DIR, 'ffmpeg-temp');
    await fs.mkdir(tempDir, { recursive: true });
    await extractTarXz(downloadPath, tempDir);

    const binaryPath = await findFFmpegBinary(tempDir);
    if (!binaryPath) {
      throw new Error('[E016] FFmpeg binary not found in extracted archive');
    }

    await fs.copyFile(binaryPath, destPath);

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  } else {
    // Direct binary (macOS single file)
    await fs.copyFile(downloadPath, destPath);
  }

  // Set executable permission on Unix
  await setExecutable(destPath);

  // Cleanup download file
  await fs.rm(downloadPath, { force: true });

  success('FFmpeg installed successfully');
  return destPath;
}

/**
 * Detect if Deno is installed on the system
 * @returns true if Deno is installed
 */
export async function detectDenoInstalled(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const deno = spawn('deno', ['--version'], { stdio: 'pipe' });

    deno.on('close', (code) => {
      resolve(code === 0);
    });

    deno.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get appropriate yt-dlp version based on Deno availability
 * @param denoInstalled - Whether Deno is installed
 * @returns Version string to use
 */
export function getYtDlpVersion(denoInstalled: boolean): string {
  // Check if user has overridden version in config
  const override = getConfig<string>('tools.ytdlp_version');
  if (override) {
    return override;
  }

  // Return version based on Deno availability
  return denoInstalled ? URLs.ytdlp.versionLatest : URLs.ytdlp.versionNoDeno;
}

/**
 * Install Deno to ~/.autocliper/bin/
 * @param onProgress - Progress callback
 */
export async function installDeno(onProgress?: ProgressCallback): Promise<string> {
  await ensureDirs();

  const platform = PLATFORM;
  if (!URLs.deno[platform as keyof typeof URLs.deno]) {
    throw new Error(`[E017] Unsupported platform for Deno: ${platform}`);
  }

  const url = URLs.deno[platform as keyof typeof URLs.deno];
  const destPath = path.join(BIN_DIR, TOOLS.DENO);

  log(`Downloading Deno for ${platform}...`);

  await download(url, destPath, onProgress);

  // Set executable permission on Unix
  await setExecutable(destPath);

  success('Deno installed successfully');
  return destPath;
}

/**
 * Install yt-dlp to ~/.autocliper/bin/
 * @param onProgress - Progress callback
 * @param version - Optional version override
 */
export async function installYtDlp(
  onProgress?: ProgressCallback,
  version?: string
): Promise<string> {
  await ensureDirs();

  const denoInstalled = await detectDenoInstalled();
  const ytdlpVersion = version || getYtDlpVersion(denoInstalled);

  const platform = PLATFORM;
  let url: string;

  if (IS_WINDOWS) {
    url = `${URLs.ytdlp.baseUrl}${ytdlpVersion}/yt-dlp.exe`;
  } else {
    url = `${URLs.ytdlp.baseUrl}${ytdlpVersion}/yt-dlp`;
  }

  const destPath = path.join(BIN_DIR, TOOLS.YT_DLP);

  log(`Downloading yt-dlp ${ytdlpVersion}...`);

  await download(url, destPath, onProgress);

  // Set executable permission on Unix
  await setExecutable(destPath);

  success(`yt-dlp ${ytdlpVersion} installed successfully`);

  // Save version to config
  setConfig('tools.ytdlp_installed_version', ytdlpVersion);

  return destPath;
}

/**
 * Check if a tool is installed in ~/.autocliper/bin/
 * @param tool - Tool name
 * @returns true if tool exists
 */
export async function isToolInstalled(tool: ToolName): Promise<boolean> {
  const toolPath = getBinPath(tool);
  try {
    await fs.access(toolPath, constants.F_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get path to binary in ~/.autocliper/bin/
 * @param tool - Tool name
 * @returns Full path to binary
 */
export function getBinPath(tool: ToolName): string {
  return path.join(BIN_DIR, tool);
}

/**
 * Get path to use for executing a tool
 * Returns local bin path if tool exists, otherwise system tool name
 * @param tool - Tool name
 * @returns Path to use for execution
 */
export function getToolPath(tool: ToolName): string {
  const binPath = getBinPath(tool);
  // Check if file exists synchronously for quick check
  if (existsSync(binPath)) {
    return binPath;
  }
  return tool; // Use system PATH
}

/**
 * Get version of installed tool
 * @param tool - Tool name
 * @returns Version string or null
 */
export async function getToolVersion(tool: ToolName): Promise<string | null> {
  const toolPath = getToolPath(tool);

  return new Promise<string | null>((resolve) => {
    const args = tool.includes('ffmpeg') ? ['-version'] : ['--version'];
    const child = spawn(toolPath, args, { stdio: 'pipe' });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        const output = stdout || stderr;
        // Parse version from output
        const match = output.match(/(\d+\.\d+[\d.]*)/);
        resolve(match ? match[1] : output.split('\n')[0]);
      } else {
        resolve(null);
      }
    });

    child.on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Check if tool is available on system PATH
 * @param tool - Tool name (without extension)
 * @returns true if tool is on PATH
 */
async function isToolOnPath(tool: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const fullTool = IS_WINDOWS ? `${tool}.exe` : tool;
    const child = spawn(fullTool, ['--version'], { stdio: 'pipe', shell: true });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get installation status for all tools
 */
export async function getToolStatus(): Promise<{
  ffmpeg: { installed: boolean; path: string; version?: string };
  ytdlp: { installed: boolean; path: string; version?: string };
  deno: { installed: boolean; path: string; version?: string };
}> {
  const [ffmpegInstalled, ytdlpInstalled, denoInstalled] = await Promise.all([
    isToolInstalled(TOOLS.FFMPEG),
    isToolInstalled(TOOLS.YT_DLP),
    isToolInstalled(TOOLS.DENO),
  ]);

  const [ffmpegVersion, ytdlpVersion, denoVersion] = await Promise.all([
    ffmpegInstalled ? getToolVersion(TOOLS.FFMPEG) : Promise.resolve(null),
    ytdlpInstalled ? getToolVersion(TOOLS.YT_DLP) : Promise.resolve(null),
    denoInstalled ? getToolVersion(TOOLS.DENO) : Promise.resolve(null),
  ]);

  return {
    ffmpeg: {
      installed: ffmpegInstalled,
      path: getBinPath(TOOLS.FFMPEG),
      version: ffmpegVersion || undefined,
    },
    ytdlp: {
      installed: ytdlpInstalled,
      path: getBinPath(TOOLS.YT_DLP),
      version: ytdlpVersion || undefined,
    },
    deno: {
      installed: denoInstalled,
      path: getBinPath(TOOLS.DENO),
      version: denoVersion || undefined,
    },
  };
}

// Import logger functions for internal use
function log(message: string): void {
  console.log(`> ${message}`);
}

function success(message: string): void {
  console.log(`+ ${message}`);
}

function error(message: string): void {
  console.error(`x ${message}`);
}
