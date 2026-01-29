---
wave: 7
depends_on: [06]
files_modified:
  - scripts/face_detector.py
  - src/core/faceDetector.ts
  - src/commands/run.ts
autonomous: true
---

# PLAN: Phase 07 - Face Detection

## Phase Goal

Determine video display mode (CENTER vs SPLIT) by detecting faces using Python + MediaPipe.

---

## must_haves

1. Python script with MediaPipe integration
2. Node.js wrapper spawning Python process
3. Face count per segment (1 = CENTER, 2+ = SPLIT)
4. Bounding box extraction for split screen
5. Graceful fallback to CENTER on Python unavailable
6. Temporary JSON file for communication

---

## Tasks

<task>
<id>07-01</id>
<name>Create Python face detector script</name>
Create scripts/face_detector.py:
- Imports: sys, json, cv2, mediapipe, pathlib
- detect_faces_in_segment(): Sample 5 frames, count faces
- get_face_boxes(): Extract bounding boxes for 2 faces
- main(): Parse CLI args, process all segments
- Output: JSON with face_count, mode, boxes (if SPLIT)
</task>

<task>
<id>07-02</id>
<name>Implement face sampling logic</name>
In detect_faces_in_segment():
- Open video with cv2.VideoCapture
- Calculate sample interval (duration / 5)
- Extract 5 frames evenly distributed
- Process each with MediaPipe FaceDetection
- Return mode of face counts (most common)
- Fallback to 1 if no faces detected
</task>

<task>
<id>07-03</id>
<name>Implement bounding box extraction</name>
In get_face_boxes():
- Capture frame at segment midpoint
- Run MediaPipe detection
- Extract relative bounding boxes for top 2 faces
- Return array: [{x, y, width, height}]
- Empty array if detection fails
</task>

<task>
<id>07-04</id>
<name>Create Node.js wrapper module</name>
Create src/core/faceDetector.ts:
- Interfaces: Segment, BoundingBox, FaceResult
- detectFaces(): Main function calling Python
- checkPythonAvailable(): Test python --version
- checkMediaPipeInstalled(): Test import mediapipe
</task>

<task>
<id>07-05</id>
<name>Implement Python process spawning</name>
In detectFaces():
- Create temp JSON file with segments data
- Spawn python process with script path
- Pass video path and segments JSON as args
- Capture stdout for JSON result
- Clean up temp file on completion
</task>

<task>
<id>07-06</id>
<name>Implement error handling and fallback</name>
In detectFaces():
- Handle Python not found: Return CENTER for all
- Handle script failure: Return CENTER for all
- Handle JSON parse error: Return CENTER for all
- Log warning with ASCII symbol
- Never fail the pipeline on face detection error
</task>

<task>
<id>07-07</id>
<name>Update run command - face detection step</name>
Update src/commands/run.ts:
- Display "> Detecting faces..."
- Check Python availability first
- Call detectFaces() with segments
- Display results: "#N: N face(s) -> MODE"
- SPLIT mode only if 2+ faces detected
</task>

<task>
<id>07-08</id>
<name>Add MediaPipe installer option</name>
Update src/commands/init.ts:
- Add optional MediaPipe installation
- Run: pip install mediapipe opencv-python
- Display info about face detection feature
</task>

---

## Verification Criteria

- [ ] Python script executable with python face_detector.py
- [ ] Script accepts video path and segments JSON as args
- [ ] Returns valid JSON output
- [ ] 1 face detected → mode: CENTER
- [ ] 2+ faces detected → mode: SPLIT
- [ ] SPLIT mode includes bounding boxes array
- [ ] Node.js wrapper successfully spawns Python
- [ ] Fallback to CENTER when Python unavailable
- [ ] Fallback to CENTER on script failure
- [ ] Face detection results displayed per segment
- [ ] Pipeline continues if face detection fails

---

## Notes

- Python + MediaPipe is optional feature
- Primary requirement: Don't block pipeline if unavailable
- MediaPipe FaceDetection: model_selection=1, min_detection_confidence=0.5
- Bounding boxes are relative coordinates (0-1)
- Temp file cleanup is mandatory (security/cleanup)
- Video sampling: 5 frames per segment evenly distributed
