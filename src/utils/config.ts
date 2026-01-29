/**
 * Configuration management for AutoCliper
 *
 * Uses conf package for persistent config storage.
 * Config file: ~/.autocliper/config.json
 */

import Conf from 'conf';

/**
 * API configuration schema
 */
interface ApiConfig {
  deepgram: string;
  gemini: string;
  github: {
    token: string;
    owner: string;
    repo: string;
  };
}

/**
 * Preferences schema
 */
interface PreferencesConfig {
  outputFolder: string;
  maxSegments: number;
  minDuration: number;
  maxDuration: number;
}

/**
 * Subtitle styling schema
 */
interface SubtitleConfig {
  fontFamily: string;
  fontSize: number;
  highlightColor: string;
}

/**
 * Complete configuration schema
 */
export interface AutoCliperConfig {
  api: ApiConfig;
  preferences: PreferencesConfig;
  subtitle: SubtitleConfig;
}

/**
 * Default configuration values
 */
const DEFAULTS: Partial<AutoCliperConfig> = {
  api: {
    deepgram: '',
    gemini: '',
    github: {
      token: '',
      owner: '',
      repo: '',
    },
  },
  preferences: {
    outputFolder: '~/Downloads/autocliper',
    maxSegments: 3,
    minDuration: 30,
    maxDuration: 60,
  },
  subtitle: {
    fontFamily: 'Arial',
    fontSize: 24,
    highlightColor: '#FFFF00',
  },
};

/**
 * Conf instance for AutoCliper
 * Stored in ~/.autocliper/config.json
 */
const config = new Conf<AutoCliperConfig>({
  projectName: 'autocliper',
  projectSuffix: '',
  configName: 'config',
  fileExtension: 'json',
  defaults: DEFAULTS as AutoCliperConfig,
});

/**
 * Get a configuration value by path
 * @param path - Dot-notation path (e.g., 'api.deepgram')
 * @returns Configuration value or undefined
 */
export function get<T = unknown>(path: string): T | undefined {
  return config.get(path) as T | undefined;
}

/**
 * Set a configuration value by path
 * @param path - Dot-notation path (e.g., 'api.deepgram')
 * @param value - Value to set
 */
export function set(path: string, value: unknown): void {
  config.set(path, value);
}

/**
 * Check if a configuration path exists
 * @param path - Dot-notation path to check
 * @returns True if path exists and has a value
 */
export function has(path: string): boolean {
  return config.has(path);
}

/**
 * Clear all configuration (reset to defaults)
 */
export function clear(): void {
  config.clear();
}

/**
 * Get the entire configuration object
 * @returns Complete configuration
 */
export function getAll(): AutoCliperConfig {
  return config.store;
}

/**
 * Delete a specific configuration path
 * @param path - Dot-notation path to delete
 */
export function deletePath(path: string): void {
  config.delete(path);
}

/**
 * Check if API keys are configured
 * @returns Object with boolean flags for each API
 */
export function hasApiKeys(): {
  deepgram: boolean;
  gemini: boolean;
  github: boolean;
} {
  return {
    deepgram: !!config.get('api.deepgram'),
    gemini: !!config.get('api.gemini'),
    github: !!(
      config.get('api.github.token') &&
      config.get('api.github.owner') &&
      config.get('api.github.repo')
    ),
  };
}

/**
 * Get config file path for display
 * @returns Absolute path to config.json
 */
export function getConfigPath(): string {
  return config.path;
}

/**
 * Validate API key format (basic check)
 * @param key - API key to validate
 * @returns True if key appears valid
 */
export function validateApiKey(key: string): boolean {
  // Basic validation: non-empty, reasonable length
  return typeof key === 'string' && key.length >= 10;
}

/**
 * Validate GitHub repo format (owner/repo)
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns True if format appears valid
 */
export function validateGitHubRepo(owner: string, repo: string): boolean {
  // GitHub repo names: alphanumeric, hyphens, underscores, dots
  const repoRegex = /^[a-zA-Z0-9._-]+$/;
  return (
    typeof owner === 'string' &&
    owner.length > 0 &&
    typeof repo === 'string' &&
    repo.length > 0 &&
    repoRegex.test(owner) &&
    repoRegex.test(repo)
  );
}
