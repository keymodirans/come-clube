/**
 * Run command - Main processing pipeline
 *
 * Downloads video, transcribes, analyzes viral segments,
 * and triggers cloud rendering
 */

import { Command } from 'commander';
import { hasApiKeys, get } from '../utils/config.js';
import { ERROR_CODES } from '../license/validator.js';
import { log, success, error, blank, separator } from '../utils/logger.js';
import { downloadVideo, extractAudio, cleanup, isValidYouTubeUrl, checkToolsInstalled } from '../core/downloader.js';
import { withRetry } from '../utils/retry.js';
import { transcribe, type TranscriptResult } from '../core/transcriber.js';
import { analyzeViral, type ViralSegment, parseTimestamp } from '../core/analyzer.js';
import { detectFaces, type Segment } from '../core/faceDetector.js';
import { buildProps, validateAllProps, type FaceDetectionResult, type SegmentProps } from '../core/propsBuilder.js';
import { uploadFile } from '../services/storage.js';
import { GitHubService, generateJobId, type GitHubConfig, type WorkflowRun } from '../services/github.js';
import type { UploadResult } from '../services/storage.js';
import { postProcess, getOutputDir } from '../services/postProcess.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export const runCommand = new Command('run')
  .description('Process a YouTube video and generate viral clips')
  .argument('<url>', 'YouTube video URL')
  .option('-m, --max <number>', 'Maximum number of clips to generate', '3')
  .option('-l, --language <code>', 'Video language code (id, en)', 'id')
  .action(async (url: string, options: { max?: string; language?: string }) => {
    blank();
    separator();
    log('Processing video...');
    blank();

    // Validate URL format
    if (!isValidYouTubeUrl(url)) {
      error('[E010] Invalid YouTube URL');
      blank();
      log('Please provide a valid YouTube video URL:');
      log('  - https://www.youtube.com/watch?v=...');
      log('  - https://youtu.be/...');
      log('  - https://www.youtube.com/shorts/...');
      separator();
      process.exit(1);
    }

    // Check if configuration exists
    const keys = hasApiKeys();

    if (!keys.deepgram || !keys.gemini || !keys.github) {
      error(`${ERROR_CODES.CONFIG_MISSING} Missing API configuration`);
      blank();

      if (!keys.deepgram) {
        log('x Deepgram API key not configured');
      }
      if (!keys.gemini) {
        log('x Gemini API key not configured');
      }
      if (!keys.github) {
        log('x GitHub configuration not set (token, owner, repo)');
      }

      blank();
      log('Please run: autocliper config');
      separator();
      process.exit(1);
    }

    // Check if FFmpeg and yt-dlp are installed
    const tools = checkToolsInstalled();
    if (!tools.ffmpeg || !tools.ytdlp) {
      error('[E007] Required tools not installed');
      blank();

      if (!tools.ffmpeg) {
        log('x FFmpeg not found');
      }
      if (!tools.ytdlp) {
        log('x yt-dlp not found');
      }

      blank();
      log('Please run: autocliper init');
      separator();
      process.exit(1);
    }

    log(`URL:      ${url}`);
    log(`Max clips: ${options.max}`);
    log(`Language: ${options.language}`);
    blank();

    // Track temp files for cleanup
    const tempFiles: string[] = [];

    try {
      // Step 1: Download video with retry
      log('> Downloading video...');
      blank();

      const downloadResult = await withRetry(
        () => downloadVideo(url, { showProgress: true }),
        {
          maxRetries: 3,
          baseDelayMs: 2000,
          maxDelayMs: 30000,
          onRetry: (attempt, err) => {
            blank();
            error(`Download failed (attempt ${attempt}), retrying...`);
            log(`  Error: ${err.message}`);
            blank();
          },
        }
      );

      tempFiles.push(downloadResult.videoPath);

      blank();
      log(`Video downloaded: ${downloadResult.videoPath}`);
      log(`Duration: ${Math.floor(downloadResult.duration / 60)}:${Math.floor(downloadResult.duration % 60).toString().padStart(2, '0')}`);
      log(`Size: ${(downloadResult.size / 1024 / 1024).toFixed(2)} MB`);
      blank();

      // Step 2: Extract audio for transcription
      log('> Extracting audio for transcription...');
      blank();

      const audioResult = await extractAudio({
        input: downloadResult.videoPath,
        sampleRate: 16000, // Deepgram requires 16kHz
        channels: 1, // Mono for Deepgram
        showProgress: true,
      });

      tempFiles.push(audioResult.audioPath);

      blank();
      log(`Audio extracted: ${audioResult.audioPath}`);
      log(`Duration: ${Math.floor(audioResult.duration / 60)}:${Math.floor(audioResult.duration % 60).toString().padStart(2, '0')}`);
      log(`Size: ${(audioResult.size / 1024 / 1024).toFixed(2)} MB`);
      blank();

      // Step 3: Transcribe audio using Deepgram
      log('> Transcribing with Deepgram...');
      blank();
      log(`Model: nova-3`);
      log(`Language: ${options.language}`);
      blank();

      const transcriptResult = await withRetry(
        () => transcribe(audioResult.audioPath, options.language as 'id' | 'en'),
        {
          maxRetries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 30000,
          onRetry: (attempt, err) => {
            blank();
            error(`Transcription failed (attempt ${attempt}), retrying...`);
            log(`  Error: ${err.message}`);
            blank();
          },
        }
      );

      blank();
      success(`Transcript ready (${transcriptResult.words.length} words)`);
      log(`Duration: ${Math.floor(transcriptResult.duration / 60)}:${Math.floor(transcriptResult.duration % 60).toString().padStart(2, '0')}`);
      blank();

      // Step 4: Analyze for viral segments using Gemini
      log('> Analyzing with Gemini...');
      blank();
      log(`Model: gemini-2.5-flash`);
      log(`Max segments: ${options.max}`);
      blank();

      const maxSegments = parseInt(options.max || '3', 10);
      const analysisResult = await withRetry(
        () => analyzeViral(transcriptResult.words, {
          maxSegments,
          language: options.language,
        }),
        {
          maxRetries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 30000,
          onRetry: (attempt, err) => {
            blank();
            error(`Analysis failed (attempt ${attempt}), retrying...`);
            log(`  Error: ${err.message}`);
            blank();
          },
        }
      );

      blank();
      success(`Found ${analysisResult.segments.length} viral segments`);
      blank();

      // Display each segment
      for (const segment of analysisResult.segments) {
        log(`  [#${segment.rank}] ${segment.hook_text.substring(0, 50)}${segment.hook_text.length > 50 ? '...' : ''}`);
        log(`  ${segment.start} - ${segment.end} (${segment.duration_seconds}s)`);
        log(`  Category: ${segment.hook_category} | Score: ${segment.viral_score}/100 | Confidence: ${segment.confidence}`);
        blank();
      }

      separator();
      log('Analysis complete!');
      blank();

      // Step 5: Face detection using Python + MediaPipe
      log('> Detecting faces for video layout...');
      blank();

      // Prepare segments for face detection
      const segmentsForDetection: Segment[] = analysisResult.segments.map(seg => ({
        start: seg.start,
        end: seg.end,
      }));

      // Run face detection (falls back to CENTER if Python unavailable)
      const faceDetectionResults = await detectFaces(
        downloadResult.videoPath,
        segmentsForDetection,
        { verbose: true }
      );

      // Convert to FaceDetectionResult format for props builder
      const faceDetections: FaceDetectionResult[] = faceDetectionResults.map(result => ({
        faceCount: result.face_count,
        cropMode: result.mode,
        boxes: result.boxes.length > 0 ? result.boxes : undefined,
      }));

      // Display face detection results
      blank();
      success('Face detection complete');
      blank();

      for (let i = 0; i < faceDetectionResults.length; i++) {
        const result = faceDetectionResults[i];
        const segment = analysisResult.segments[i];
        const modeSymbol = result.mode === 'SPLIT' ? '=' : 'o';
        log(`  [#${i + 1}] ${segment.hook_text.substring(0, 40)}${segment.hook_text.length > 40 ? '...' : ''}`);
        log(`  ${modeSymbol} ${result.face_count} face(s) detected -> ${result.mode}`);
        blank();
      }

      // Step 6: Upload source video to temporary storage
      log('> Uploading source video to temporary storage...');
      blank();

      // No retry on upload - file body cannot be reused
      const uploadResult = await uploadFile(downloadResult.videoPath);

      blank();
      success('Source video uploaded');
      log(`Download URL: ${uploadResult.link}`);
      blank();

      // Step 7: Generate Remotion render props
      log('> Generating Remotion render props...');
      blank();

      const props = buildProps({
        videoSrc: uploadResult.link,
        segments: analysisResult.segments,
        words: transcriptResult.words,
        faceDetections,
      });

      // Validate props
      validateAllProps(props);

      blank();
      success(`Generated props for ${props.length} segments`);
      blank();

      // Display props summary
      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        log(`  [Segment ${i + 1}] ID: ${prop.id}`);
        log(`  Duration: ${prop.durationInFrames} frames (${Math.floor(prop.durationInFrames / 30)}s @ ${prop.fps}fps)`);
        log(`  Video start: ${prop.videoStartTime.toFixed(2)}s`);
        log(`  Crop mode: ${prop.cropMode}`);
        log(`  Words: ${prop.words.length} words for subtitles`);
        log(`  Hook text: ${prop.hookText.substring(0, 40)}${prop.hookText.length > 40 ? '...' : ''}`);
        blank();
      }

      // Optionally save props to file for debugging
      const debugDir = path.join(os.tmpdir(), 'autocliper-debug');
      await fs.ensureDir(debugDir);
      const propsPath = path.join(debugDir, `props-${Date.now()}.json`);
      await fs.writeJSON(propsPath, props, { spaces: 2 });
      log(`Debug: Props saved to ${propsPath}`);
      blank();

      separator();
      log('Props generation complete!');
      blank();

      // Step 8: Trigger cloud rendering via GitHub Actions
      log('> Triggering cloud rendering via GitHub Actions...');
      blank();

      // Load GitHub configuration
      const githubConfig: GitHubConfig = {
        token: get<string>('api.github.token') || '',
        owner: get<string>('api.github.owner') || '',
        repo: get<string>('api.github.repo') || '',
      };

      const githubService = new GitHubService(githubConfig);

      // Track all rendering jobs
      const renderJobs: Array<{
        jobId: string;
        segmentIndex: number;
        runId?: number;
        status?: WorkflowRun;
      }> = [];

      // Trigger render jobs (limit to 2 concurrent)
      const MAX_CONCURRENT = 2;
      for (let i = 0; i < props.length; i++) {
        // Check concurrent limit
        const activeJobs = renderJobs.filter(j => !j.status || j.status.status !== 'completed').length;
        if (activeJobs >= MAX_CONCURRENT) {
          log(`Waiting for active jobs to complete... (${activeJobs}/${MAX_CONCURRENT} running)`);
          blank();
        }

        const prop = props[i];
        const jobId = generateJobId();

        log(`[Job ${i + 1}/${props.length}] Triggering render for segment ${prop.id}...`);
        log(`  Job ID: ${jobId}`);

        try {
          // Trigger the workflow
          const runId = await withRetry(
            () => githubService.triggerRender({
              jobId,
              videoUrl: uploadResult.link,
              props: prop,
            }),
            {
              maxRetries: 3,
              baseDelayMs: 2000,
              maxDelayMs: 15000,
              onRetry: (attempt, err) => {
                log(`  Retrying trigger (attempt ${attempt})...`);
              },
            }
          );

          if (!runId) {
            throw new Error('Failed to get workflow run ID');
          }

          renderJobs.push({
            jobId,
            segmentIndex: i,
            runId,
          });

          log(`  Workflow run ID: ${runId}`);
          success(`Job ${jobId} queued`);
          blank();

        } catch (err) {
          const errorObj = err as Error;
          error(`Failed to trigger render job: ${errorObj.message}`);
          renderJobs.push({
            jobId,
            segmentIndex: i,
            status: {
              id: 0,
              status: 'completed',
              conclusion: 'failure',
              url: '',
            },
          });
        }
      }

      separator();
      log('All render jobs triggered');
      blank();
      log('--- Monitoring ---');
      blank();

      // Monitor all jobs until completion
      const completedJobs = new Set<number>();

      for (const job of renderJobs) {
        if (job.status?.status === 'completed') {
          continue; // Skip failed triggers
        }

        const segment = analysisResult.segments[job.segmentIndex];
        log(`Monitoring job ${job.jobId} (${segment.hook_text.substring(0, 30)}...)`);

        try {
          const startTime = Date.now();
          const finalStatus = await githubService.pollUntilComplete(
            job.runId!,
            (status) => {
              // Progress callback
              const statusSymbol = status.status === 'queued' ? '-' : '>';
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              log(`  ${statusSymbol} ${status.status}${status.conclusion ? ` -> ${status.conclusion}` : ''}`);
            },
            30 * 60 * 1000 // 30 minutes
          );

          job.status = finalStatus;
          completedJobs.add(job.segmentIndex);

          if (finalStatus.conclusion === 'success') {
            success(`Job ${job.jobId} completed`);
            log(`  URL: ${finalStatus.url}`);
          } else {
            error(`Job ${job.jobId} failed: ${finalStatus.conclusion}`);
            log(`  URL: ${finalStatus.url}`);
          }
        } catch (err) {
          const errorObj = err as Error;
          error(`Job ${job.jobId} error: ${errorObj.message}`);
        }

        blank();
      }

      separator();
      log(`Rendering complete: ${completedJobs.size}/${props.length} jobs successful`);
      blank();

      // Display final status
      for (let i = 0; i < renderJobs.length; i++) {
        const job = renderJobs[i];
        const segment = analysisResult.segments[i];
        const symbol = job.status?.conclusion === 'success' ? '+' : 'x';
        log(`  ${symbol} [${i + 1}] ${segment.hook_text.substring(0, 40)}${segment.hook_text.length > 40 ? '...' : ''}`);
        log(`    Job: ${job.jobId} | Status: ${job.status?.conclusion || 'unknown'}`);
      }
      blank();

      // Step 9: Download rendered videos from artifacts
      separator();
      log('> Downloading rendered videos...');
      blank();

      const downloadedFiles: Array<{ index: number; path: string; segment: ViralSegment }> = [];

      for (const job of renderJobs) {
        if (job.status?.conclusion !== 'success') {
          continue; // Skip failed jobs
        }

        const segment = analysisResult.segments[job.segmentIndex];
        log(`[Job ${job.jobId}] Downloading artifact...`);

        try {
          const artifactPath = await githubService.downloadArtifact(job.runId!);
          tempFiles.push(artifactPath); // Track for cleanup

          log(`  Downloaded: ${artifactPath}`);
          downloadedFiles.push({
            index: job.segmentIndex,
            path: artifactPath,
            segment,
          });
          success(`Download complete`);
        } catch (err) {
          const errorObj = err as Error;
          error(`Download failed: ${errorObj.message}`);
        }
        blank();
      }

      log(`Downloaded ${downloadedFiles.length} video(s)`);
      blank();

      // Step 10: Post-process videos with metadata randomization
      separator();
      log('> Post-processing videos...');
      blank();

      const outputFiles: Array<{ index: number; path: string; segment: ViralSegment }> = [];
      const outputDir = await getOutputDir();

      log(`Output directory: ${outputDir}`);
      blank();

      for (const file of downloadedFiles) {
        const segment = file.segment;
        log(`[Video ${file.index + 1}] Post-processing...`);

        try {
          const outputPath = await postProcess({
            input: file.path,
            segment: file.segment,
            index: file.index,
            showProgress: true,
          });

          outputFiles.push({
            index: file.index,
            path: outputPath,
            segment: file.segment,
          });

          const filename = path.basename(outputPath);
          success(`Post-processed: ${filename}`);
        } catch (err) {
          const errorObj = err as Error;
          error(`Post-process failed: ${errorObj.message}`);
        }
        blank();
      }

      // Step 11: Display final summary
      separator();
      log('--- Complete ---');
      blank();

      if (outputFiles.length > 0) {
        log(`Generated ${outputFiles.length} video(s):`);
        blank();

        for (let i = 0; i < outputFiles.length; i++) {
          const file = outputFiles[i];
          const stats = await fs.stat(file.path);
          const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
          const filename = path.basename(file.path);

          log(`  [${i + 1}] ${filename}`);
          log(`      ${file.segment.hook_text.substring(0, 50)}${file.segment.hook_text.length > 50 ? '...' : ''}`);
          log(`      ${file.segment.start} - ${file.segment.end} | ${sizeMB} MB`);
          blank();
        }

        separator();
        log(`Output folder: ${outputDir}`);
        blank();
      } else {
        log('No videos were generated successfully.');
        blank();
      }

      // Cleanup temp files
      log('> Cleaning up temporary files...');
      await cleanup(tempFiles);
      success('Cleanup complete');
      blank();

    } catch (err) {
      const errorObj = err as Error;
      blank();
      error(`Processing failed: ${errorObj.message}`);
      blank();

      // Cleanup on error
      log('> Cleaning up temporary files...');
      await cleanup(tempFiles);
      success('Cleanup complete');
      blank();

      separator();
      process.exit(1);
    }
  });
