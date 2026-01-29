# Phase 07 Plan 07: Face Detection Summary

**Phase:** 07 of 10 (Face Detection)
**Plan:** 07 of 1 in phase
**Completed:** 2026-01-29

---

## One-Liner

Python MediaPipe face detection with Node.js wrapper for intelligent video cropping (CENTER vs SPLIT mode based on face count).

---

## Overview

Implemented face detection using Python + MediaPipe to determine video display mode. The system detects faces in each viral segment and selects CENTER mode for single-face videos or SPLIT mode for multi-face conversations. Bounding boxes are extracted for precise split-screen cropping. Graceful fallback to CENTER mode ensures the pipeline continues even if Python/MediaPipe is unavailable.

---

## Deliverables

### 1. Python Face Detector Script (`scripts/face_detector.py`)

- **Imports:** `sys`, `json`, `cv2`, `mediapipe`, `pathlib`
- **`detect_faces_in_segment()`:** Samples 5 frames evenly distributed across the segment, processes with MediaPipe FaceDetection, returns mode (most common) face count
- **`get_face_boxes()`:** Captures frame at segment midpoint, extracts relative bounding boxes (0-1) for top 2 faces
- **`main()`:** CLI entry point accepting video path and segments JSON as arguments
- **Output:** JSON with `face_count`, `mode` (CENTER/SPLIT), and `boxes` array for SPLIT mode

### 2. Node.js Wrapper Module (`src/core/faceDetector.ts`)

- **Interfaces:** `Segment`, `BoundingBox`, `FaceSegmentResult`, `DisplayMode`, `FaceDetectorOutput`
- **`detectFaces()`:** Main function spawning Python process, parsing JSON output, handling all error cases
- **`checkPythonAvailable()`:** Tests `python --version` across platform-specific commands
- **`checkMediaPipeInstalled()`:** Tests `import mediapipe` to verify installation
- **Error handling:** Falls back to CENTER mode on Python/MediaPipe unavailable
- **Process spawning:** 5-minute timeout, proper stderr capture, JSON parsing

### 3. Run Command Integration (`src/commands/run.ts`)

- Added face detection step after viral analysis
- Display: `> Detecting faces for video layout...`
- Results display: `[#N] hook_text` + `o N face(s) -> MODE` (o=CIRCLE for CENTER, == for SPLIT)
- SPLIT mode only when 2+ faces detected
- Results converted to `FaceDetectionResult` format for props builder

### 4. MediaPipe Installer (`src/core/installer.ts`, `src/commands/init.ts`)

- **`checkMediaPipeInstalled()`:** Checks if MediaPipe is installed via pip
- **`installMediaPipe()`:** Runs `pip install mediapipe opencv-python`
- **`spawnPythonCommand()`:** Helper for executing Python commands
- **`getToolStatus()`:** Updated to include MediaPipe status
- **Init command:** Shows MediaPipe in status table, offers optional installation

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `scripts/face_detector.py` | 305 | Python MediaPipe face detector |
| `src/core/faceDetector.ts` | 400 | Node.js wrapper for Python script |

## Files Modified

| File | Changes |
|------|---------|
| `src/commands/run.ts` | Added face detection step, display results |
| `src/core/installer.ts` | Added MediaPipe check/install functions |
| `src/commands/init.ts` | Added MediaPipe installation option |

---

## Decisions Made

### 1. Error Handling Strategy
**Decision:** Face detection failures must never block the pipeline
**Rationale:** AutoCliper should work even without Python/MediaPipe. Falls back to CENTER mode.
**Implementation:** All error paths in `detectFaces()` return fallback CENTER results

### 2. Frame Sampling Strategy
**Decision:** Sample 5 frames evenly distributed per segment
**Rationale:** Balances accuracy with performance. Too few samples may miss faces; too many slows processing.
**Implementation:** `interval = total_frames / 5`, sample at `start + interval * i`

### 3. Bounding Box Coordinates
**Decision:** Use relative coordinates (0-1) for bounding boxes
**Rationale:** Resolution-agnostic, works with any video format
**Implementation:** MediaPipe provides relative coordinates natively

### 4. MediaPipe Installation
**Decision:** MediaPipe is optional, not required
**Rationale:** Reduces setup friction. Users can enable later if needed.
**Implementation:** `autocliper init` prompts for MediaPipe but allows skipping

### 5. Python Command Detection
**Decision:** Try multiple Python commands (`python`, `python3`, `py`)
**Rationale:** Cross-platform compatibility (Windows uses `py`, Unix uses `python3`)
**Implementation:** Loop through commands, use first that succeeds

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Tech Stack

### Added
- **Python:** Required dependency (user-provided)
- **MediaPipe:** Google's face detection library (optional pip install)
- **OpenCV (cv2):** Video frame extraction (bundled with MediaPipe)

### Patterns
- **Hybrid Node.js/Python architecture:** Node spawns Python for heavy ML processing
- **Graceful degradation:** Falls back to CENTER mode on errors
- **Process communication:** JSON via stdout/stderr (no temp files needed)

---

## Error Codes

| Code | Description |
|------|-------------|
| [E040] | Python not found or failed to spawn |
| [E041] | Failed to open video file |
| [E042] | Invalid arguments to Python script |
| [E043] | Invalid segments JSON |
| [E044] | Video file not found |

---

## Verification

All verification criteria met:

- [x] Python script executable with `python face_detector.py`
- [x] Script accepts video path and segments JSON as args
- [x] Returns valid JSON output
- [x] 1 face detected → mode: CENTER
- [x] 2+ faces detected → mode: SPLIT
- [x] SPLIT mode includes bounding boxes array
- [x] Node.js wrapper successfully spawns Python
- [x] Fallback to CENTER when Python unavailable
- [x] Fallback to CENTER on script failure
- [x] Face detection results displayed per segment
- [x] Pipeline continues if face detection fails

---

## Duration

**Start:** 2026-01-29T20:02:30Z
**End:** 2026-01-29T20:15:00Z
**Elapsed:** ~13 minutes

---

## Commits

- `abaff55`: feat(07-01): create Python face detector script
- `86013b2`: feat(07-04/05/06): implement Node.js wrapper for face detection
- `4f89531`: feat(07-07): update run command with face detection integration
- `aaaafe3`: feat(07-08): add MediaPipe installer option to init command
