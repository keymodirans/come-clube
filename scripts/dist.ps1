# AutoCliper Distribution Build Script (Windows)
# Creates distribution packages for all platforms

$ErrorActionPreference = "Stop"

# Get version from package.json
$version = (node -p "require('./package.json').version")
$releaseDir = "release/v$version"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  AutoCliper Distribution Build Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Building version: $version" -ForegroundColor Green
Write-Host ""

# Clean previous builds
Write-Host "> Cleaning previous builds..." -ForegroundColor Yellow
Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "dist-cjs" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "release" -Recurse -Force -ErrorAction SilentlyContinue

# Build ESM for Node.js distribution
Write-Host "> Building ESM distribution..." -ForegroundColor Yellow
npm run build

# Build CJS for potential packaging
Write-Host "> Building CJS distribution..." -ForegroundColor Yellow
npm run build:cjs

# Create release directory
New-Item -ItemType Directory -Force -Path "$releaseDir" | Out-Null

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Build Complete" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Copy ESM build
Write-Host "Created files:" -ForegroundColor Green
Write-Host "  + dist/index.js (ESM, for Node.js >=20)"
Write-Host "  + dist-cjs/index.cjs (CommonJS, for Node.js >=16)"
Write-Host ""

# Check if pkg can work (it has limitations)
Write-Host "Packaging Status:" -ForegroundColor Yellow
Write-Host "  ! Standalone binary packaging has limitations:"
Write-Host "    - pkg has issues with ESM modules and import.meta"
Write-Host "    - pkg fails with native modules (node:sqlite in 'conf' dependency)"
Write-Host "    - For distribution: Use 'npm install -g .' from source"
Write-Host ""

# Generate SHA256 checksums
Write-Host "> Generating SHA256 checksums..." -ForegroundColor Yellow
$checksumPath = "$releaseDir/checksums.txt"
$hash = (Get-FileHash -Path "dist/index.js" -Algorithm SHA256).Hash.ToLower()
"dist/index.js $hash" | Out-File -FilePath "$checksumPath" -Encoding utf8
Write-Host "  + checksums.txt created"
Write-Host ""

# Copy files to release directory
Write-Host "> Copying files to $releaseDir/..." -ForegroundColor Yellow
Copy-Item -Path "dist/index.js" -Destination "$releaseDir/"
Copy-Item -Path "scripts" -Destination "$releaseDir/" -Recurse
Copy-Item -Path "package.json" -Destination "$releaseDir/"
if (Test-Path "README.md") {
    Copy-Item -Path "README.md" -Destination "$releaseDir/"
}

# Create release notes template
$releaseNotes = @"
# AutoCliper v$version

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
"@

$releaseNotes | Out-File -FilePath "$releaseDir/RELEASE_NOTES.md" -Encoding utf8
Write-Host "  + RELEASE_NOTES.md created"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Distribution Ready" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Location: $releaseDir/" -ForegroundColor Green
Write-Host ""
Write-Host "Files:" -ForegroundColor Green
Get-ChildItem "$releaseDir" | Format-Table Name, Length -AutoSize
Write-Host ""
Write-Host "Build successful!" -ForegroundColor Green
Write-Host ""
Write-Host "To publish to npm:"
Write-Host "  npm publish"
Write-Host ""
Write-Host "To create GitHub Release:"
Write-Host "  1. Tag: git tag v$version"
Write-Host "  2. Push: git push --tags"
Write-Host "  3. Upload contents of $releaseDir/ to GitHub Releases"
Write-Host ""
