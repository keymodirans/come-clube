/**
 * Init command - Setup AutoCliper external tools
 *
 * Auto-installs FFmpeg, yt-dlp, and optionally Deno
 */

import { Command } from 'commander';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import * as p from '@clack/prompts';
import { log, blank, separator, success, error, warn, info } from '../utils/logger.js';
import {
  ensureDirs,
  installFFmpeg,
  installDeno,
  installYtDlp,
  detectDenoInstalled,
  getYtDlpVersion,
  getToolStatus,
  getBinPath,
  TOOLS,
  installMediaPipe,
  checkMediaPipeInstalled,
  type ProgressCallback,
} from '../core/installer.js';

const BIN_DIR = path.join(os.homedir(), '.autocliper', 'bin');

/**
 * Create a progress bar from ora
 */
async function createProgress(task: string): Promise<{ update: (percent: number) => void; succeed: () => void; fail: () => void }> {
  const ora = (await import('ora')).default;
  const spinner = ora({ text: task }).start();

  let currentPercent = 0;

  return {
    update: (percent: number) => {
      currentPercent = percent;
      spinner.text = `${task} ${percent}%`;
    },
    succeed: () => {
      spinner.succeed(`${task} 100%`);
    },
    fail: () => {
      spinner.fail(`${task} failed`);
    },
  };
}

/**
 * Download with progress display
 */
async function downloadWithProgress(toolName: string): Promise<ProgressCallback> {
  const progress = await createProgress(`Downloading ${toolName}`);
  return (percent: number) => {
    if (percent >= 100) {
      progress.succeed();
    } else {
      progress.update(percent);
    }
  };
}

export const initCommand = new Command('init')
  .description('Initialize AutoCliper by installing required dependencies (FFmpeg, yt-dlp)')
  .action(async () => {
    blank();
    separator();
    log('AutoCliper Initialization');
    blank();

    // Ensure directories exist
    await ensureDirs();

    // Check current status
    const status = await getToolStatus();

    p.intro('Tool Installation Status');
    blank();

    // Display tool status (manual table for compatibility)
    log('Tool          Status          Version');
    log('------------- --------------- -------------------');
    log('FFmpeg        ' + (status.ffmpeg.installed ? 'Installed  ' : 'Not installed') + '  ' + (status.ffmpeg.installed ? (status.ffmpeg.version || 'unknown') : '-'));
    log('yt-dlp        ' + (status.ytdlp.installed ? 'Installed  ' : 'Not installed') + '  ' + (status.ytdlp.installed ? (status.ytdlp.version || 'unknown') : '-'));
    log('Deno          ' + (status.deno.installed ? 'Installed  ' : 'Not installed') + '  ' + (status.deno.installed ? (status.deno.version || 'unknown') : '-'));
    log('MediaPipe     ' + (status.mediapipe.installed ? 'Installed  ' : 'Not installed') + '  ' + (status.mediapipe.installed ? (status.mediapipe.version || 'unknown') : '-'));
    blank();

    // Determine what needs to be installed
    const needsFFmpeg = !status.ffmpeg.installed;
    let needsYtDlp = !status.ytdlp.installed;

    if (!needsFFmpeg && !needsYtDlp) {
      success('Core tools are already installed!');
      blank();
      log('FFmpeg: ' + getBinPath(TOOLS.FFMPEG));
      log('yt-dlp: ' + getBinPath(TOOLS.YT_DLP));
      if (status.deno.installed) {
        log('Deno: ' + getBinPath(TOOLS.DENO));
      }

      // Offer MediaPipe installation if not installed
      if (!status.mediapipe.installed) {
        blank();
        info('MediaPipe (optional) - Enables intelligent face detection for video cropping');
        blank();
        const installMPPrompt = await p.confirm({
          message: 'Install MediaPipe for face detection?',
          initialValue: false,
        });

        if (installMPPrompt) {
          blank();
          await installMediaPipe();
          blank();
        } else {
          blank();
          info('You can install MediaPipe later with:');
          log('  pip install mediapipe opencv-python');
          blank();
        }
      }

      separator();
      return;
    }

    info('The following tools will be installed:');
    if (needsFFmpeg) {
      log('  - FFmpeg 7.1 (video processing)');
    }
    if (needsYtDlp) {
      log('  - yt-dlp (YouTube downloader)');
    }
    blank();

    // Confirm installation
    const confirm = await p.confirm({
      message: 'Install missing tools?',
      initialValue: true,
    });

    if (confirm !== true) {
      warn('Installation cancelled');
      separator();
      return;
    }

    blank();

    // Install FFmpeg
    if (needsFFmpeg) {
      try {
        await installFFmpeg(await downloadWithProgress('FFmpeg'));
      } catch (err) {
        error((err as Error).message);
        warn('FFmpeg installation failed. You may need to install it manually.');
      }
      blank();
    }

    // Check for Deno before installing yt-dlp
    let installLatestYtDlp = false;
    let installDenoChoice = false;

    if (needsYtDlp) {
      const denoInstalled = await detectDenoInstalled();

      if (!denoInstalled) {
        blank();
        separator();
        log('yt-dlp Version Selection');
        blank();
        info('yt-dlp 2025.11.12+ requires Deno for full YouTube support.');
        info('You have three options:');
        blank();
        log('  1. Install Deno + yt-dlp 2025.11.12+ (recommended)');
        log('     - Full YouTube support');
        log('     - Automatic updates');
        blank();
        log('  2. Install yt-dlp 2025.10.22 (no Deno required)');
        log('     - Limited YouTube support');
        log('     - May not work with all YouTube URLs');
        blank();
        log('  3. Skip yt-dlp installation');
        separator();
        blank();

        const choice = await p.select({
          message: 'Choose an option:',
          options: [
            {
              value: 'deno',
              label: 'Install Deno + yt-dlp 2025.11.12+ (recommended)',
            },
            {
              value: 'ytdlp-old',
              label: 'Install yt-dlp 2025.10.22 (no Deno, limited YouTube)',
            },
            {
              value: 'skip',
              label: 'Skip yt-dlp installation',
            },
          ],
        });

        if (choice === 'deno') {
          installDenoChoice = true;
          installLatestYtDlp = true;
        } else if (choice === 'ytdlp-old') {
          installLatestYtDlp = false;
        } else {
          installLatestYtDlp = false;
          needsYtDlp = false; // Skip yt-dlp
          blank();
          warn('Skipping yt-dlp installation');
          warn('You will need to install yt-dlp manually to use AutoCliper');
        }
      } else {
        // Deno is installed, use latest yt-dlp
        installLatestYtDlp = true;
      }
    }

    // Install Deno if requested
    if (installDenoChoice) {
      try {
        blank();
        await installDeno(await downloadWithProgress('Deno'));
      } catch (err) {
        error((err as Error).message);
        warn('Deno installation failed. Falling back to yt-dlp 2025.10.22');
        installLatestYtDlp = false;
      }
      blank();
    }

    // Install yt-dlp
    if (needsYtDlp) {
      try {
        const version = installLatestYtDlp ? getYtDlpVersion(true) : getYtDlpVersion(false);
        await installYtDlp(await downloadWithProgress('yt-dlp'), version);
      } catch (err) {
        error((err as Error).message);
        warn('yt-dlp installation failed. You may need to install it manually.');
      }
      blank();
    }

    // Offer MediaPipe installation
    blank();
    separator();
    log('MediaPipe Installation (Optional)');
    blank();
    info('MediaPipe enables intelligent face detection for automatic video cropping.');
    info('When enabled, videos with multiple faces will use split-screen layout.');
    blank();
    const installMPPrompt = await p.confirm({
      message: 'Install MediaPipe for face detection?',
      initialValue: false,
    });

    if (installMPPrompt) {
      blank();
      await installMediaPipe();
      blank();
    } else {
      blank();
      info('You can install MediaPipe later with:');
      log('  pip install mediapipe opencv-python');
      blank();
    }

    // Show final status
    separator();
    log('Installation Summary');
    blank();

    const finalStatus = await getToolStatus();

    if (finalStatus.ffmpeg.installed) {
      success('FFmpeg: installed at ' + getBinPath(TOOLS.FFMPEG));
    }
    if (finalStatus.ytdlp.installed) {
      success('yt-dlp: installed at ' + getBinPath(TOOLS.YT_DLP));
    }
    if (finalStatus.deno.installed) {
      success('Deno: installed at ' + getBinPath(TOOLS.DENO));
    }

    blank();

    if (!finalStatus.ffmpeg.installed || !finalStatus.ytdlp.installed) {
      warn('Some tools failed to install');
      blank();
      log('You can try running:');
      log('  autocliper init');
      blank();
      log('Or install manually:');
      log('  FFmpeg: https://github.com/BtbN/FFmpeg-Builds/releases');
      log('  yt-dlp: https://github.com/yt-dlp/yt-dlp/releases');
    } else {
      success('All tools installed successfully!');
      blank();
      log('You can now run:');
      log('  autocliper config  - Set up API keys');
      log('  autocliper run <url> - Process a video');
    }

    separator();
  });
