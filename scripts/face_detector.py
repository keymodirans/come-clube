#!/usr/bin/env python3
"""
Face Detector for AutoCliper
Uses OpenCV Haar Cascade (no MediaPipe needed)
"""

import sys
import json
import cv2
import os

# Configuration
SAMPLE_INTERVAL = 1.0
MIN_FACE_SIZE = (50, 50)
SCALE_FACTOR = 1.1
MIN_NEIGHBORS = 5

def get_face_cascade():
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    if not os.path.exists(cascade_path):
        return None
    return cv2.CascadeClassifier(cascade_path)

def detect_faces_in_frame(frame, face_cascade):
    if frame is None:
        return []
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=SCALE_FACTOR,
        minNeighbors=MIN_NEIGHBORS,
        minSize=MIN_FACE_SIZE,
        flags=cv2.CASCADE_SCALE_IMAGE
    )
    return faces

def detect_faces_in_segment(video_path, start_time, end_time):
    face_cascade = get_face_cascade()
    if face_cascade is None:
        return 0, []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0, []

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30.0

    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    all_faces = []
    face_counts = []

    current_time = start_time
    while current_time < end_time:
        frame_pos = int(current_time * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_pos)

        ret, frame = cap.read()
        if not ret:
            break

        faces = detect_faces_in_frame(frame, face_cascade)

        if len(faces) > 0:
            face_counts.append(len(faces))
            for (x, y, w, h) in faces:
                rel_box = {
                    "x": (x + w/2) / frame_width,
                    "y": (y + h/2) / frame_height,
                    "width": w / frame_width,
                    "height": h / frame_height
                }
                all_faces.append(rel_box)

        current_time += SAMPLE_INTERVAL

    cap.release()

    if not face_counts:
        return 0, []

    face_count = max(set(face_counts), key=face_counts.count)

    unique_boxes = []
    if all_faces:
        seen_positions = set()
        for box in all_faces:
            pos_key = (round(box["x"], 1), round(box["y"], 1))
            if pos_key not in seen_positions:
                seen_positions.add(pos_key)
                unique_boxes.append(box)
                if len(unique_boxes) >= face_count:
                    break

    return face_count, unique_boxes

def determine_crop_mode(face_count, boxes):
    if face_count == 0:
        return "CENTER", []
    elif face_count == 1:
        return "CENTER", boxes[:1]
    else:
        return "SPLIT", boxes[:2]

def parse_timestamp(value):
    """Convert timestamp string (HH:MM:SS or MM:SS) to float seconds."""
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str) or ':' not in value:
        return float(value)
    parts = value.split(':')
    if len(parts) == 3:  # HH:MM:SS
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    elif len(parts) == 2:  # MM:SS
        return int(parts[0]) * 60 + float(parts[1])
    return float(value)

def main():
    if len(sys.argv) < 3:
        print("Usage: python face_detector.py <video_path> <segments_json>", file=sys.stderr)
        sys.exit(1)

    video_path = sys.argv[1]
    segments_json = sys.argv[2]

    try:
        segments = json.loads(segments_json)
    except json.JSONDecodeError as e:
        print(f"Error parsing segments JSON: {e}", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(video_path):
        print(f"Error: Video file not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    results = []
    for segment in segments:
        start = parse_timestamp(segment.get("start", 0))
        end = parse_timestamp(segment.get("end", start + 30))

        try:
            face_count, boxes = detect_faces_in_segment(video_path, start, end)
            crop_mode, crop_boxes = determine_crop_mode(face_count, boxes)

            results.append({
                "face_count": face_count,
                "crop_mode": crop_mode,
                "boxes": crop_boxes
            })
        except Exception as e:
            print(f"Warning: Face detection failed for segment {start}-{end}: {e}", file=sys.stderr)
            results.append({
                "face_count": 1,
                "crop_mode": "CENTER",
                "boxes": []
            })

    print(json.dumps(results))

if __name__ == "__main__":
    main()
