#!/usr/bin/env python3
"""
AutoCliper Face Detector

Detects faces in video segments using MediaPipe FaceDetection.
Determines display mode (CENTER vs SPLIT) based on face count.
Extracts bounding boxes for split-screen layout.

Usage:
    python face_detector.py <video_path> <segments_json>

Args:
    video_path: Path to video file
    segments_json: JSON string containing array of segments with 'start' and 'end' times

Output:
    JSON object with face detection results for each segment
"""

import sys
import json
import cv2
import mediapipe as mp
from pathlib import Path
from typing import List, Dict, Tuple


# ============================================================================
# Type Definitions
# ============================================================================

BoundingBox = Dict[str, float]  # {x, y, width, height} in relative coordinates (0-1)
FaceResult = Dict[str, any]     # {face_count, mode, boxes}


# ============================================================================
# Constants
# ============================================================================

MODEL_SELECTION = 1  # 0=short-range, 1=full-range (better for full-face videos)
MIN_DETECTION_CONFIDENCE = 0.5
SAMPLE_FRAMES_PER_SEGMENT = 5


# ============================================================================
# Face Detection Functions
# ============================================================================

def detect_faces_in_segment(
    video_path: str,
    start_time: float,
    end_time: float
) -> int:
    """
    Detect faces in a video segment by sampling frames.

    Samples 5 frames evenly distributed across the segment,
    processes each with MediaPipe FaceDetection, and returns
    the mode (most common) face count.

    Args:
        video_path: Path to video file
        start_time: Segment start time in seconds
        end_time: Segment end time in seconds

    Returns:
        Mode of face counts detected (1-2+), fallback to 1 if no faces detected
    """
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"[E040] Failed to open video: {video_path}", file=sys.stderr)
        return 1

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30  # Default fallback

        duration = end_time - start_time
        total_frames = int(duration * fps)

        # Calculate sample interval to get 5 frames
        if total_frames <= SAMPLE_FRAMES_PER_SEGMENT:
            sample_frames = list(range(total_frames))
        else:
            interval = total_frames / SAMPLE_FRAMES_PER_SEGMENT
            sample_frames = [int(i * interval) for i in range(SAMPLE_FRAMES_PER_SEGMENT)]

        # Start position for this segment
        start_frame = int(start_time * fps)

        face_counts = []

        # Initialize MediaPipe Face Detection
        mp_face_detection = mp.solutions.face_detection
        face_detection = mp_face_detection.FaceDetection(
            model_selection=MODEL_SELECTION,
            min_detection_confidence=MIN_DETECTION_CONFIDENCE
        )

        for frame_offset in sample_frames:
            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame + frame_offset)
            ret, frame = cap.read()

            if not ret:
                continue

            # Convert BGR to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb_frame.flags.writeable = False

            # Detect faces
            results = face_detection.process(rgb_frame)

            # Count faces
            if results.detections:
                face_counts.append(len(results.detections))
            else:
                face_counts.append(0)

        face_detection.close()

        # Find mode of face counts
        if not face_counts:
            return 1  # Fallback to CENTER

        # Count frequency of each face count
        count_frequency = {}
        for count in face_counts:
            count_frequency[count] = count_frequency.get(count, 0) + 1

        # Find most common count
        most_common = max(count_frequency.items(), key=lambda x: x[1])[0]

        # Fallback to 1 if no faces detected
        if most_common == 0:
            return 1

        return most_common

    finally:
        cap.release()


def get_face_boxes(
    video_path: str,
    start_time: float,
    end_time: float,
    max_faces: int = 2
) -> List[BoundingBox]:
    """
    Extract bounding boxes for the top N faces in a segment.

    Captures frame at segment midpoint and runs MediaPipe detection
    to extract relative bounding boxes.

    Args:
        video_path: Path to video file
        start_time: Segment start time in seconds
        end_time: Segment end time in seconds
        max_faces: Maximum number of face boxes to return

    Returns:
        Array of bounding boxes: [{x, y, width, height}]
        Empty array if detection fails
    """
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"[E041] Failed to open video: {video_path}", file=sys.stderr)
        return []

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30  # Default fallback

        # Capture frame at segment midpoint
        midpoint = (start_time + end_time) / 2
        midpoint_frame = int(midpoint * fps)

        cap.set(cv2.CAP_PROP_POS_FRAMES, midpoint_frame)
        ret, frame = cap.read()

        if not ret:
            return []

        # Get frame dimensions
        height, width = frame.shape[:2]

        # Initialize MediaPipe Face Detection
        mp_face_detection = mp.solutions.face_detection
        face_detection = mp_face_detection.FaceDetection(
            model_selection=MODEL_SELECTION,
            min_detection_confidence=MIN_DETECTION_CONFIDENCE
        )

        # Convert BGR to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False

        # Detect faces
        results = face_detection.process(rgb_frame)
        face_detection.close()

        if not results.detections:
            return []

        # Extract bounding boxes for top N faces
        boxes = []

        for i, detection in enumerate(results.detections[:max_faces]):
            # MediaPipe provides relative coordinates
            # location_data.relative_bounding_box contains: xmin, ymin, width, height
            bbox = detection.location_data.relative_bounding_box

            boxes.append({
                'x': max(0, bbox.xmin),
                'y': max(0, bbox.ymin),
                'width': min(1 - bbox.xmin, bbox.width),
                'height': min(1 - bbox.ymin, bbox.height)
            })

        return boxes

    finally:
        cap.release()


# ============================================================================
# Main Function
# ============================================================================

def main():
    """Main entry point for face detection."""
    if len(sys.argv) != 3:
        print(json.dumps({
            'error': '[E042] Invalid arguments. Usage: python face_detector.py <video_path> <segments_json>'
        }))
        sys.exit(1)

    video_path = sys.argv[1]
    segments_json = sys.argv[2]

    # Parse segments
    try:
        segments = json.loads(segments_json)
    except json.JSONDecodeError as e:
        print(json.dumps({
            'error': f'[E043] Invalid segments JSON: {str(e)}'
        }))
        sys.exit(1)

    # Validate video file exists
    if not Path(video_path).exists():
        print(json.dumps({
            'error': f'[E044] Video file not found: {video_path}'
        }))
        sys.exit(1)

    # Process each segment
    results = []

    for i, segment in enumerate(segments):
        start = segment.get('start', 0)
        end = segment.get('end', start + 30)

        # Convert timestamp strings (HH:MM:SS) to seconds if needed
        if isinstance(start, str) and ':' in start:
            parts = start.split(':')
            start = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        if isinstance(end, str) and ':' in end:
            parts = end.split(':')
            end = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])

        # Detect face count
        face_count = detect_faces_in_segment(video_path, start, end)

        # Determine display mode
        if face_count >= 2:
            mode = 'SPLIT'
            # Get bounding boxes for split screen
            boxes = get_face_boxes(video_path, start, end, max_faces=2)
        else:
            mode = 'CENTER'
            boxes = []

        segment_result = {
            'segment_index': i,
            'start': segment.get('start', start),
            'end': segment.get('end', end),
            'face_count': face_count,
            'mode': mode,
            'boxes': boxes
        }

        results.append(segment_result)

    # Output results as JSON
    print(json.dumps({'results': results}))


if __name__ == '__main__':
    main()
