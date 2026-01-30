/**
 * GitHub Service - Trigger and monitor GitHub Actions for cloud rendering
 */

import { request } from 'undici';
import { retryApi } from '../utils/retry.js';
import { nanoid } from 'nanoid';
import type { SegmentProps } from '../core/propsBuilder.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { createReadStream } from 'fs';
// @ts-ignore - unzip-stream is CommonJS
import unzip from 'unzip-stream';

// ============================================================================
// Interfaces
// ============================================================================

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface JobPayload {
  jobId: string;
  videoUrl: string;
  props: SegmentProps;
}

export interface WorkflowRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  url: string;
}

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
  DOWNLOAD_FAILED: '[E066] Artifact download failed',
  EXTRACTION_FAILED: '[E067] Artifact extraction failed',
} as const;

// ============================================================================
// Constants
// ============================================================================

const API_BASE = 'https://api.github.com';
const DEFAULT_RENDERER_OWNER = 'keymodirans';
const DEFAULT_RENDERER_REPO = 'renderer-clips';
const POLL_INTERVAL = 10000;
const DEFAULT_TIMEOUT = 30 * 60 * 1000;
const TRIGGER_WAIT = 3000;

// ============================================================================
// GitHubService Class
// ============================================================================

export class GitHubService {
  private readonly headers: Record<string, string>;
  private readonly config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;

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

  async triggerRender(payload: JobPayload): Promise<number | undefined> {
    const url = `${API_BASE}/repos/${this.config.owner}/${this.config.repo}/dispatches`;

    try {
      await retryApi(
        () => this.sendDispatch(url, payload),
        'Workflow trigger',
        { maxRetries: 3, baseDelayMs: 2000, maxDelayMs: 10000 }
      );

      await this.sleep(TRIGGER_WAIT);
      const runId = await this.findLatestRunId();

      if (!runId) {
        throw new Error(`${GITHUB_ERROR_CODES.RUN_NOT_FOUND}: Workflow not found after trigger`);
      }

      return runId;
    } catch (err) {
      const error = err as Error;
      if (error.message.startsWith('[E06')) throw error;
      throw new Error(`${GITHUB_ERROR_CODES.TRIGGER_FAILED}: ${error.message}`);
    }
  }

  async findLatestRunId(): Promise<number | undefined> {
    const url = `${API_BASE}/repos/${this.config.owner}/${this.config.repo}/actions/runs?per_page=1`;

    try {
      const response = await request(url, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.body.json() as any;

      if (!data.workflow_runs || data.workflow_runs.length === 0) {
        return undefined;
      }

      return data.workflow_runs[0].id;
    } catch (err) {
      const error = err as Error;
      if (error.message.startsWith('[E06')) throw error;
      throw new Error(`${GITHUB_ERROR_CODES.API_ERROR}: Failed to list runs: ${error.message}`);
    }
  }

  async getRunStatus(runId: number): Promise<WorkflowRun> {
    const url = `${API_BASE}/repos/${this.config.owner}/${this.config.repo}/actions/runs/${runId}`;

    try {
      const response = await request(url, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(10000),
      });

      if (response.statusCode === 404) {
        throw new Error(`${GITHUB_ERROR_CODES.RUN_NOT_FOUND}: Run ${runId} not found`);
      }

      const data = await response.body.json() as any;

      return {
        id: data.id,
        status: data.status as 'queued' | 'in_progress' | 'completed',
        conclusion: data.conclusion as 'success' | 'failure' | 'cancelled' | null,
        url: data.html_url,
      };
    } catch (err) {
      const error = err as Error;
      if (error.message.startsWith('[E06')) throw error;
      throw new Error(`${GITHUB_ERROR_CODES.API_ERROR}: Failed to get run status: ${error.message}`);
    }
  }

  async pollUntilComplete(
    runId: number,
    onProgress?: ProgressCallback,
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<WorkflowRun> {
    const startTime = Date.now();

    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`${GITHUB_ERROR_CODES.TIMEOUT}: Workflow ${runId} exceeded ${timeout}ms timeout`);
      }

      const status = await this.getRunStatus(runId);

      if (onProgress) {
        onProgress(status);
      }

      if (status.status === 'completed') {
        return status;
      }

      await this.sleep(POLL_INTERVAL);
    }
  }

  async getArtifactUrl(runId: number): Promise<string> {
    const url = `${API_BASE}/repos/${this.config.owner}/${this.config.repo}/actions/runs/${runId}/artifacts`;

    try {
      const response = await request(url, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.body.json() as any;

      if (!data.artifacts || data.artifacts.length === 0) {
        throw new Error(`${GITHUB_ERROR_CODES.ARTIFACT_NOT_FOUND}: No artifacts found for run ${runId}`);
      }

      return data.artifacts[0].archive_download_url;
    } catch (err) {
      const error = err as Error;
      if (error.message.startsWith('[E06')) throw error;
      throw new Error(`${GITHUB_ERROR_CODES.API_ERROR}: Failed to get artifacts: ${error.message}`);
    }
  }

  /**
   * Download and extract artifact ZIP from workflow run
   */
  async downloadArtifact(runId: number, outputDir?: string): Promise<string> {
    const artifactUrl = await this.getArtifactUrl(runId);

    // Create temp directory
    const tempDir = path.join(os.tmpdir(), `autocliper-artifact-${runId}-${Date.now()}`);
    await fs.ensureDir(tempDir);

    const zipPath = path.join(tempDir, 'artifact.zip');
    const extractDir = path.join(tempDir, 'extracted');
    await fs.ensureDir(extractDir);

    try {
      // Download ZIP with auth
      const response = await request(artifactUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'User-Agent': 'AutoCliper-CLI',
          'Accept': 'application/vnd.github+json',
        },
        // @ts-ignore - maxRedirections exists in undici
        maxRedirections: 5,
      });

      if (response.statusCode !== 200) {
        throw new Error(`HTTP ${response.statusCode}`);
      }

      // Save ZIP to file
      const chunks: Buffer[] = [];
      for await (const chunk of response.body) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);
      await fs.writeFile(zipPath, buffer);

      // Verify ZIP exists
      const zipStats = await fs.stat(zipPath);
      if (zipStats.size < 100) {
        throw new Error('ZIP file too small or empty');
      }

      // Extract ZIP
      await new Promise<void>((resolve, reject) => {
        createReadStream(zipPath)
          .pipe(unzip.Extract({ path: extractDir }))
          .on('close', resolve)
          .on('error', reject);
      });

      // Find MP4 files
      const files = await fs.readdir(extractDir);
      const mp4Files = files.filter(f => f.toLowerCase().endsWith('.mp4'));

      if (mp4Files.length === 0) {
        // Check subdirectories
        for (const file of files) {
          const subPath = path.join(extractDir, file);
          const stat = await fs.stat(subPath);
          if (stat.isDirectory()) {
            const subFiles = await fs.readdir(subPath);
            const subMp4 = subFiles.filter(f => f.toLowerCase().endsWith('.mp4'));
            if (subMp4.length > 0) {
              return path.join(subPath, subMp4[0]);
            }
          }
        }
        throw new Error(`${GITHUB_ERROR_CODES.DOWNLOAD_FAILED}: No MP4 files found in artifact`);
      }

      // Copy to output directory if specified
      const mp4Path = path.join(extractDir, mp4Files[0]);

      if (outputDir) {
        await fs.ensureDir(outputDir);
        const destPath = path.join(outputDir, mp4Files[0]);
        await fs.copy(mp4Path, destPath);
        return destPath;
      }

      return mp4Path;

    } catch (err) {
      const error = err as Error;
      if (error.message.startsWith('[E06')) throw error;
      throw new Error(`${GITHUB_ERROR_CODES.DOWNLOAD_FAILED}: ${error.message}`);
    }
  }

  async listArtifacts(runId: number): Promise<Array<{ id: number; name: string; size: number }>> {
    const url = `${API_BASE}/repos/${this.config.owner}/${this.config.repo}/actions/runs/${runId}/artifacts`;

    try {
      const response = await request(url, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.body.json() as any;

      if (!data.artifacts) {
        return [];
      }

      return data.artifacts.map((a: any) => ({
        id: a.id,
        name: a.name,
        size: a.size_in_bytes,
      }));
    } catch (err) {
      const error = err as Error;
      if (error.message.startsWith('[E06')) throw error;
      throw new Error(`${GITHUB_ERROR_CODES.API_ERROR}: Failed to list artifacts: ${error.message}`);
    }
  }

  async downloadAllArtifacts(runId: number, outputDir?: string): Promise<string[]> {
    const artifacts = await this.listArtifacts(runId);

    if (artifacts.length === 0) {
      return [];
    }

    const results: string[] = [];

    for (const artifact of artifacts) {
      try {
        const filePath = await this.downloadArtifact(runId, outputDir);
        results.push(filePath);
      } catch (err) {
        console.error(`Failed to download artifact ${artifact.name}:`, err);
      }
    }

    return results;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

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
      signal: AbortSignal.timeout(15000),
    });

    if (response.statusCode !== 204) {
      const text = await response.body.text();
      throw new Error(`${GITHUB_ERROR_CODES.API_ERROR}: Unexpected response ${response.statusCode}: ${text}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function generateJobId(): string {
  const timestamp = Date.now();
  const random = nanoid(6);
  return `ac-${timestamp}-${random}`;
}

export function createRendererService(token: string): GitHubService {
  return new GitHubService({
    token,
    owner: DEFAULT_RENDERER_OWNER,
    repo: DEFAULT_RENDERER_REPO,
  });
}
