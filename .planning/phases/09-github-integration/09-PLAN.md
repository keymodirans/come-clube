---
wave: 9
depends_on: [08]
files_modified:
  - src/services/github.ts
  - src/commands/run.ts
autonomous: true
---

# PLAN: Phase 09 - GitHub Actions Integration

## Phase Goal

Trigger cloud rendering via GitHub Actions and poll for completion.

---

## must_haves

1. GitHubService class for Actions API
2. repository_dispatch event trigger
3. Workflow status polling every 10 seconds
4. Job ID tracking
5. 30-minute timeout
6. Progress display during polling

---

## Tasks

<task>
<id>09-01</id>
<name>Create GitHub service module</name>
Create src/services/github.ts:
- Interfaces: GitHubConfig, JobPayload, WorkflowRun
- GitHubService class with constructor
- Headers setup with Bearer token
- API base URL: https://api.github.com
</task>

<task>
<id>09-02</id>
<name>Define service interfaces</name>
Add interfaces:
- GitHubConfig: {token, owner, repo}
- JobPayload: {jobId, videoUrl, props}
- WorkflowRun: {id, status, conclusion}
- status: 'queued' | 'in_progress' | 'completed'
- conclusion: 'success' | 'failure' | 'cancelled' | null
</task>

<task>
<id>09-03</id>
<name>Implement triggerRender()</name>
In GitHubService:
- POST to /repos/{owner}/{repo}/dispatches
- Event type: 'render-video'
- Client payload with jobId, videoUrl, props
- Wait 3 seconds for workflow registration
- Call findLatestRunId()
- Return run ID or undefined
- Error [E042]: Trigger failed
</task>

<task>
<id>09-04</id>
<name>Implement findLatestRunId()</name>
In GitHubService:
- GET /repos/{owner}/{repo}/actions/runs?per_page=1
- Parse workflow_runs array
- Return first run ID
- Handle empty results
</task>

<task>
<id>09-05</id>
<name>Implement getRunStatus()</name>
In GitHubService:
- GET /repos/{owner}/{repo}/actions/runs/{runId}
- Parse status and conclusion
- Return WorkflowRun object
</task>

<task>
<id>09-06</id>
<name>Implement pollUntilComplete()</name>
In GitHubService:
- Loop every 10 seconds (setTimeout 10000)
- Call getRunStatus() each iteration
- Call onProgress callback with status
- Return when status == 'completed'
- Throw Error after 30 minutes (1800000ms)
- Error [E043]: Render timeout
</task>

<task>
<id>09-07</id>
<name>Implement artifact URL retrieval</name>
In GitHubService:
- getArtifactUrl(runId): GET artifacts endpoint
- Return download URL for first artifact
- Used for result download in next phase
</task>

<task>
<id>09-08</id>
<name>Create job ID generator</name>
Add utility:
- generateJobId(): Using nanoid
- Format: ac-{timestamp}-{random}
- Display in progress updates
</task>

<task>
<id>09-09</id>
<name>Update run command - GitHub integration</name>
Update src/commands/run.ts:
- Load GitHub config from config.json
- Display "> Triggering render jobs..."
- For each segment: triggerRender()
- Display "Job ac-XXX ... queued"
- Display "--- Monitoring ---" header
- Poll each job with progress
- Show progress bar per job
- Display "+ ac-XXX completed"
</task>

<task>
<id>09-10</id>
<name>Add concurrent job handling</name>
Update run command:
- Limit to 2 concurrent jobs (GitHub Actions free tier)
- Queue additional jobs
- Poll all active jobs in parallel
- Display combined progress
</task>

---

## Verification Criteria

- [ ] GitHubService instantiable with config
- [ ] triggerRender() successfully triggers workflow
- [ ] Workflow receives correct payload (jobId, videoUrl, props)
- [ ] findLatestRunId() returns valid run ID
- [ ] getRunStatus() returns current status
- [ ] pollUntilComplete() waits for completion
- [ ] Polling interval is 10 seconds
- [ ] Timeout after 30 minutes
- [ ] Progress displayed during polling
- [ ] Multiple jobs handled correctly
- [ ] Trigger failure shows [E042]
- [ ] Timeout shows [E043]
- [ ] Completed jobs marked with success/failure

---

## Notes

- GitHub config: api.github.token, api.github.owner, api.github.repo
- Repository must be the autocliper-renderer repo
- Workflow file: .github/workflows/render.yml (in renderer repo)
- Event type: repository_dispatch with type render-video
- Poll interval: 10 seconds (hardcoded)
- Timeout: 1800000ms (30 minutes)
- Concurrency: Max 2 jobs (GitHub Actions free tier limit)
- Job IDs tracked for result download in Phase 10
