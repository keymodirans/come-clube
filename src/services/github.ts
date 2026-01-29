/**
 * GitHub Service - Trigger and monitor GitHub Actions for cloud rendering
 *
 * Handles repository_dispatch events, workflow polling, and artifact retrieval
 * for Remotion-based video rendering via GitHub Actions.
 */

import { request } from 'undici';
import { retryApi } from '../utils/retry.js';
import { nanoid } from 'nanoid';
import type { SegmentProps } from '../core/propsBuilder.js';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * GitHub service configuration
 */
export interface GitHubConfig {
  /** GitHub personal access token */
  token: string;
  /** Repository owner (username or organization) */
  owner: string;
  /** Repository name */
  repo: string;
}

/**
 * Job payload for repository_dispatch event
 */
export interface JobPayload {
  /** Unique job identifier */
  jobId: string;
  /** Download URL for source video */
  videoUrl: string;
  /** Remotion render props for this segment */
  props: SegmentProps;
}

/**
 * Workflow run status from GitHub API
 */
export interface WorkflowRun {
  /** Run ID */
  id: number;
  /** Run status */
  status: 'queued' | 'in_progress' | 'completed';
  /** Run conclusion (null if not completed) */
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  /** Run URL */
  url: string;
}

/**
 * Workflow run progress callback
 */
export type ProgressCallback = (status: WorkflowRun) => void;

// ============================================================================
// Error Codes
// ============================================================================

export const GITHUB_ERROR_CODES = {
  TRIGGER_FAILED: '[E060] Failed to trigger workflow',
  RUN_NOT_FOUND: '[E061] Workflow run not found',
  TIMEOUT: '[E062] Render timeout exceeded',
  INVALID_CONFIG: '[E063] Invalid GitHub configuration',
  API_ERROR: '[E064] GitHub API error',
  ARTIFACT_NOT_FOUND: '[E065] Artifact not found',
} as const;

// ============================================================================
// Constants
// ============================================================================

const API_BASE = 'https://api.github.com';
const POLL_INTERVAL = 10000; // 10 seconds
const DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const TRIGGER_WAIT = 3000; // 3 seconds for workflow registration

// ============================================================================
// GitHubService Class
// ============================================================================

/**
 * GitHub Service for Actions workflow management
 *
 * Provides methods to trigger rendering workflows, poll for completion,
 * and retrieve artifacts from GitHub Actions.
 */
export class GitHubService {
  private readonly headers: Record<string, string>;
  private readonly config: GitHubConfig;

  /**
   * Create a new GitHubService instance
   * @param config - GitHub configuration
   */
  constructor(config: GitHubConfig) {
    this.config = config;

    // Validate configuration
    if (!config.token || !config.owner || !config.repo) {
      throw new Error(`${GITHUB_ERROR_CODES.INVALID_CONFIG}: Missing token, owner, or repo`);
    }

    this.headers = {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AutoCliper-CLI',
    };
  }

  /**
   * Trigger a render workflow via repository_dispatch
   * @param payload - Job payload with jobId, videoUrl, props
   * @returns Run ID if successful, undefined otherwise
   * @throws Error with [E060] on trigger failure
   */
  async triggerRender(payload: JobPayload): Promise<number | undefined> {
    const url = `${API_BASE}/repos/${this.config.owner}/${this.config.repo}/dispatches`;

    try {
      // Trigger the workflow
      await retryApi(
        () => this.sendDispatch(url, payload),
        'Workflow trigger',
        {
          maxRetries: 3,
          baseDelayMs: 2000,
          maxDelayMs: 10000,
        }
      );

      // Wait for workflow to register
      await this.sleep(TRIGGER_WAIT);

      // Find the triggered workflow run
      const runId = await this.findLatestRunId();

      if (!runId) {
        throw new Error(`${GITHUB_ERROR_CODES.RUN_NOT_FOUND}: Workflow not found after trigger`);
      }

      return runId;
    } catch (err) {
      const error = err as Error;

      // Re-throw our custom errors
      if (error.message.startsWith('[E06')) {
        throw error;
      }

      // Wrap other errors
      throw new Error(`${GITHUB_ERROR_CODES.TRIGGER_FAILED}: ${error.message}`);
    }
  }

  /**
   * Find the latest workflow run ID
   * @returns Run ID or undefined if no runs found
   * @throws Error with [E061] if run not found
   */
  async findLatestRunId(): Promise<number | undefined> {
    const url = `${API_BASE}/repos/${this.config.owner}/${this.config.repo}/actions/runs?per_page=1`;

    try {
      const response = await request(url, {
        method: 'GET',
        headers: this.headers,
        timeout: 10000,
      });

      const data = await response.body.json();

      if (!data.workflow_runs || data.workflow_runs.length === 0) {
        return undefined;
      }

      return data.workflow_runs[0].id;
    } catch (err) {
      const error = err as Error;

      if (error.message.startsWith('[E06')) {
        throw error;
      }

      throw new Error(`${GITHUB_ERROR_CODES.API_ERROR}: Failed to list runs: ${error.message}`);
    }
  }

  /**
   * Get the status of a workflow run
   * @param runId - Workflow run ID
   * @returns WorkflowRun with current status
   * @throws Error with [E061] if run not found
   */
  async getRunStatus(runId: number): Promise<WorkflowRun> {
    const url = `${API_BASE}/repos/${this.config.owner}/${this.config.repo}/actions/runs/${runId}`;

    try {
      const response = await request(url, {
        method: 'GET',
        headers: this.headers,
        timeout: 10000,
      });

      if (response.statusCode === 404) {
        throw new Error(`${GITHUB_ERROR_CODES.RUN_NOT_FOUND}: Run ${runId} not found`);
      }

      const data = await response.body.json();

      return {
        id: data.id,
        status: data.status as 'queued' | 'in_progress' | 'completed',
        conclusion: data.conclusion as 'success' | 'failure' | 'cancelled' | null,
        url: data.html_url,
      };
    } catch (err) {
      const error = err as Error;

      if (error.message.startsWith('[E06')) {
        throw error;
      }

      throw new Error(`${GITHUB_ERROR_CODES.API_ERROR}: Failed to get run status: ${error.message}`);
    }
  }

  /**
   * Poll a workflow run until completion
   * @param runId - Workflow run ID
   * @param onProgress - Optional callback for status updates
   * @param timeout - Timeout in milliseconds (default: 30 minutes)
   * @returns Final WorkflowRun when complete
   * @throws Error with [E062] on timeout
   */
  async pollUntilComplete(
    runId: number,
    onProgress?: ProgressCallback,
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<WorkflowRun> {
    const startTime = Date.now();

    while (true) {
      // Check timeout
      if (Date.now() - startTime > timeout) {
        throw new Error(`${GITHUB_ERROR_CODES.TIMEOUT}: Workflow ${runId} exceeded ${timeout}ms timeout`);
      }

      // Get current status
      const status = await this.getRunStatus(runId);

      // Report progress
      if (onProgress) {
        onProgress(status);
      }

      // Check if complete
      if (status.status === 'completed') {
        return status;
      }

      // Wait before next poll
      await this.sleep(POLL_INTERVAL);
    }
  }

  /**
   * Get artifact download URL for a completed run
   * @param runId - Workflow run ID
   * @returns Artifact download URL
   * @throws Error with [E065] if artifact not found
   */
  async getArtifactUrl(runId: number): Promise<string> {
    const url = `${API_BASE}/repos/${this.config.owner}/${this.config.repo}/actions/runs/${runId}/artifacts`;

    try {
      const response = await request(url, {
        method: 'GET',
        headers: this.headers,
        timeout: 10000,
      });

      const data = await response.body.json();

      if (!data.artifacts || data.artifacts.length === 0) {
        throw new Error(`${GITHUB_ERROR_CODES.ARTIFACT_NOT_FOUND}: No artifacts found for run ${runId}`);
      }

      // Return the first artifact's download URL
      // Note: This URL requires authentication, will be used in Phase 10
      return data.artifacts[0].archive_download_url;
    } catch (err) {
      const error = err as Error;

      if (error.message.startsWith('[E06')) {
        throw error;
      }

      throw new Error(`${GITHUB_ERROR_CODES.API_ERROR}: Failed to get artifacts: ${error.message}`);
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Send repository_dispatch event
   * @param url - Dispatch endpoint URL
   * @param payload - Job payload
   */
  private async sendDispatch(url: string, payload: JobPayload): Promise<void> {
    const response = await request(url, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'render-video',
        client_payload: payload,
      }),
      timeout: 15000,
    });

    // GitHub returns 204 No Content on success
    if (response.statusCode !== 204) {
      const text = await response.body.text();
      throw new Error(`${GITHUB_ERROR_CODES.API_ERROR}: Unexpected response ${response.statusCode}: ${text}`);
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique job ID
 * @returns Job ID in format ac-{timestamp}-{random}
 */
export function generateJobId(): string {
  const timestamp = Date.now();
  const random = nanoid(6);
  return `ac-${timestamp}-${random}`;
}
