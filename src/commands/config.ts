/**
 * Config command - Setup API keys and preferences
 *
 * Interactive setup for Deepgram, Gemini, GitHub API keys
 * using @clack/prompts
 */

import { Command } from 'commander';
import * as p from '@clack/prompts';
import { get, set, hasApiKeys, validateApiKey, validateGitHubRepo, getConfigPath } from '../utils/config.js';
import { log, success, error, blank, separator } from '../utils/logger.js';

/**
 * Interactive prompt for Deepgram API key
 */
async function promptDeepgramKey(): Promise<string | symbol> {
  const existingKey = get<string>('api.deepgram');

  blank();
  separator();
  p.log.step('Deepgram API Configuration');
  p.log.info('Get your API key from: https://console.deepgram.com/');
  blank();

  const key = await p.text({
    message: 'Enter your Deepgram API Key',
    placeholder: 'dg-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    validate: (value) => {
      if (!value) return 'API key is required';
      if (!validateApiKey(value)) return 'Invalid API key format (too short)';
      return undefined;
    },
    defaultValue: existingKey || undefined,
  });

  if (p.isCancel(key)) {
    p.cancel('Configuration cancelled');
    process.exit(0);
  }

  return key;
}

/**
 * Interactive prompt for Gemini API key
 */
async function promptGeminiKey(): Promise<string | symbol> {
  const existingKey = get<string>('api.gemini');

  blank();
  separator();
  p.log.step('Google Gemini API Configuration');
  p.log.info('Get your API key from: https://ai.google.dev/');
  blank();

  const key = await p.text({
    message: 'Enter your Gemini API Key',
    placeholder: 'AIzAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    validate: (value) => {
      if (!value) return 'API key is required';
      if (!validateApiKey(value)) return 'Invalid API key format (too short)';
      return undefined;
    },
    defaultValue: existingKey || undefined,
  });

  if (p.isCancel(key)) {
    p.cancel('Configuration cancelled');
    process.exit(0);
  }

  return key;
}

/**
 * Interactive prompt for GitHub configuration
 */
async function promptGitHubConfig(): Promise<{ token: string; owner: string; repo: string } | symbol> {
  const existingToken = get<string>('api.github.token');
  const existingOwner = get<string>('api.github.owner');
  const existingRepo = get<string>('api.github.repo');

  blank();
  separator();
  p.log.step('GitHub Configuration');
  p.log.info('Required for triggering cloud rendering via GitHub Actions');
  p.log.info('Get your token from: https://github.com/settings/tokens');
  p.log.info('Token needs: repo:status, repo_deployment');
  blank();

  const token = await p.text({
    message: 'Enter your GitHub Personal Access Token',
    placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    validate: (value) => {
      if (!value) return 'Token is required';
      if (!validateApiKey(value)) return 'Invalid token format (too short)';
      return undefined;
    },
    defaultValue: existingToken || undefined,
  });

  if (p.isCancel(token)) {
    p.cancel('Configuration cancelled');
    process.exit(0);
  }

  blank();

  const owner = await p.text({
    message: 'Enter GitHub repository owner',
    placeholder: 'your-username',
    validate: (value) => {
      if (!value) return 'Owner is required';
      if (!validateGitHubRepo(value, 'test')) return 'Invalid owner format';
      return undefined;
    },
    defaultValue: existingOwner || undefined,
  });

  if (p.isCancel(owner)) {
    p.cancel('Configuration cancelled');
    process.exit(0);
  }

  blank();

  const repo = await p.text({
    message: 'Enter GitHub repository name',
    placeholder: 'autocliper-renderer',
    validate: (value) => {
      if (!value) return 'Repository name is required';
      if (!validateGitHubRepo('test', value)) return 'Invalid repository name format';
      return undefined;
    },
    defaultValue: existingRepo || undefined,
  });

  if (p.isCancel(repo)) {
    p.cancel('Configuration cancelled');
    process.exit(0);
  }

  return { token, owner, repo };
}

/**
 * Save all configuration values
 */
function saveConfig(
  deepgramKey: string,
  geminiKey: string,
  githubConfig: { token: string; owner: string; repo: string }
): void {
  set('api.deepgram', deepgramKey);
  set('api.gemini', geminiKey);
  set('api.github.token', githubConfig.token);
  set('api.github.owner', githubConfig.owner);
  set('api.github.repo', githubConfig.repo);
}

/**
 * Display success message
 */
function displaySuccess(): void {
  blank();
  separator();
  success('Configuration saved successfully!');
  blank();
  log('API Keys configured:');
  log('  + Deepgram:    ' + '*'.repeat(20));
  log('  + Gemini:      ' + '*'.repeat(20));
  log('  + GitHub:      ' + '*'.repeat(20));
  blank();
  log(`Config file: ${getConfigPath()}`);
  blank();
  log('You can now run: autocliper run <youtube-url>');
  separator();
}

/**
 * Display current configuration status
 */
function displayStatus(): void {
  const keys = hasApiKeys();

  blank();
  separator();
  log('Current Configuration Status:');
  blank();
  log(`  Deepgram API:   ${keys.deepgram ? '+' : 'x'} ${keys.deepgram ? 'Configured' : 'Not configured'}`);
  log(`  Gemini API:     ${keys.gemini ? '+' : 'x'} ${keys.gemini ? 'Configured' : 'Not configured'}`);
  log(`  GitHub Config:  ${keys.github ? '+' : 'x'} ${keys.github ? 'Configured' : 'Not configured'}`);
  blank();
  log(`Config file: ${getConfigPath()}`);
  separator();
}

export const configCommand = new Command('config')
  .description('Configure AutoCliper API keys and preferences')
  .option('--status', 'Show current configuration status')
  .action(async (options: { status?: boolean }) => {
    // Show status if --status flag is provided
    if (options.status) {
      displayStatus();
      return;
    }

    // Start the interactive configuration
    blank();
    p.intro('AutoCliper Configuration');

    try {
      // Prompt for all API keys
      const deepgramKey = await promptDeepgramKey();
      const geminiKey = await promptGeminiKey();
      const githubConfig = await promptGitHubConfig();

      // Type guards after cancellation checks
      if (typeof deepgramKey !== 'string' || typeof geminiKey !== 'string') {
        process.exit(0);
      }
      if (typeof githubConfig !== 'object' || githubConfig instanceof Symbol) {
        process.exit(0);
      }

      // Save configuration
      saveConfig(deepgramKey, geminiKey, githubConfig as { token: string; owner: string; repo: string });

      // Display success message
      displaySuccess();

      p.outro('Configuration complete!');
    } catch (err) {
      blank();
      error(`Configuration failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      process.exit(1);
    }
  });
