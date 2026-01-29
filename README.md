# AutoCliper

CLI tool for automatically generating viral short-form video clips (9:16 vertical) from YouTube videos.

## Overview

AutoCliper uses a hybrid local-cloud architecture:

- **Local Processing**: Download videos, transcribe with Deepgram, analyze viral segments with Gemini
- **Cloud Rendering**: GitHub Actions + Remotion for high-quality video output

## Prerequisites

- Node.js 20.0.0 or higher
- FFmpeg 7.1 (auto-installed via `autocliper init`)
- yt-dlp 2025.01.x (auto-installed via `autocliper init`)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd cli-cliper

# Install dependencies
npm install

# Install FFmpeg and yt-dlp
autocliper init

# Configure API keys
autocliper config
```

## Usage

```bash
# Generate clips from a YouTube video
autocliper run <youtube-url>

# Limit number of clips
autocliper run <youtube-url> --max 3

# Specify language
autocliper run <youtube-url> --language id

# Show device hardware ID
autocliper hwid
```

## Configuration

AutoCliper stores configuration in `~/.autocliper/`:

- `config.json` - API keys and preferences
- `device.lock` - Encrypted hardware ID for license verification
- `bin/` - FFmpeg and yt-dlp binaries

## Commands

| Command | Description |
|---------|-------------|
| `init` | Install FFmpeg, yt-dlp dependencies |
| `config` | Set up Deepgram and Gemini API keys |
| `run <url>` | Process video and generate clips |
| `hwid` | Show device hardware ID |

## License

MIT

---

**Note**: This is the CLI application. Video rendering is handled by a separate Remotion project deployed via GitHub Actions.
