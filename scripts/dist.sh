#!/bin/bash
# AutoCliper Distribution Build Script
# Creates distribution packages for all platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "  AutoCliper Distribution Build Script"
echo "=========================================="
echo ""

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "Building version: ${VERSION}"
echo ""

# Clean previous builds
echo "> Cleaning previous builds..."
rm -rf dist/
rm -rf dist-cjs/
rm -rf release/

# Build ESM for Node.js distribution
echo "> Building ESM distribution..."
npm run build

# Build CJS for potential packaging
echo "> Building CJS distribution..."
npm run build:cjs

# Create release directory
RELEASE_DIR="release/v${VERSION}"
mkdir -p "${RELEASE_DIR}"

echo ""
echo "=========================================="
echo "  Build Complete"
echo "=========================================="
echo ""

# Copy ESM build (for npm/Node.js distribution)
echo "Created files:"
echo "  + dist/index.js (ESM, for Node.js >=20)"
echo "  + dist-cjs/index.cjs (CommonJS, for Node.js >=16)"
echo ""

# Check if pkg can work (it has limitations)
echo "Packaging Status:"
echo "  ! Standalone binary packaging has limitations:"
echo "    - pkg has issues with ESM modules and import.meta"
echo "    - pkg fails with native modules (node:sqlite in 'conf' dependency)"
echo "    - For distribution: Use 'npm install -g .' from source"
echo ""

# Generate SHA256 checksums for the built files
echo "> Generating SHA256 checksums..."
cd dist
if command -v sha256sum &> /dev/null; then
    sha256sum index.js > ../${RELEASE_DIR}/checksums.txt
    echo "  + checksums.txt created"
elif command -v shasum &> /dev/null; then
    shasum -a 256 index.js > ../${RELEASE_DIR}/checksums.txt
    echo "  + checksums.txt created"
fi
cd ..

# Copy files to release directory
echo "> Copying files to ${RELEASE_DIR}/..."
cp dist/index.js "${RELEASE_DIR}/"
cp -r scripts/ "${RELEASE_DIR}/"
cp package.json "${RELEASE_DIR}/"
cp README.md "${RELEASE_DIR}/" 2>/dev/null || echo "  ! README.md not found"

# Create release notes template
cat > "${RELEASE_DIR}/RELEASE_NOTES.md" << EOF
# AutoCliper v${VERSION}

## Installation

### Via npm (recommended)
\`\`\`bash
npm install -g autocliper
\`\`\`

### From source
\`\`\`bash
git clone <repository-url>
cd cli-cliper
npm install
npm run build
npm link
\`\`\`

## What's New

(Add release notes here)

## Files

- \`dist/index.js\` - Main CLI entry point (ESM)
- \`scripts/face_detector.py\` - Python MediaPipe face detector
- \`package.json\` - Package configuration

## System Requirements

- Node.js >= 20.0.0
- FFmpeg 7.1 (auto-installed via \`autocliper init\`)
- yt-dlp (auto-installed via \`autocliper init\`)
- Python + MediaPipe (optional, for face detection)

## Usage

\`\`\`bash
autocliper init          # Install dependencies
autocliper config        # Setup API keys
autocliper run <url>     # Process video
\`\`\`

## Checksums

See \`checksums.txt\` for SHA256 checksums of all files.
EOF

echo "  + RELEASE_NOTES.md created"

echo ""
echo "=========================================="
echo "  Distribution Ready"
echo "=========================================="
echo ""
echo "Location: ${RELEASE_DIR}/"
echo ""
echo "Files:"
ls -lh "${RELEASE_DIR}/" | tail -n +2
echo ""
echo "${GREEN}Build successful!${NC}"
echo ""
echo "To publish to npm:"
echo "  npm publish"
echo ""
echo "To create GitHub Release:"
echo "  1. Tag: git tag v${VERSION}"
echo "  2. Push: git push --tags"
echo "  3. Upload contents of ${RELEASE_DIR}/ to GitHub Releases"
echo ""
