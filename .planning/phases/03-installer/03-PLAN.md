---
wave: 3
depends_on: [02]
files_modified:
  - src/core/installer.ts
  - src/commands/init.ts
autonomous: true
---

# PLAN: Phase 03 - External Tools Installer

## Phase Goal

Auto-install FFmpeg and yt-dlp to ~/.autocliper/bin/ across all platforms.

---

## must_haves

1. FFmpeg 7.1 downloaded and executable
2. yt-dlp 2025.01.x downloaded and executable
3. Deno detection and optional installation (for yt-dlp 2025.11.12+)
4. Platform-specific URL handling (win32, darwin, linux)
5. Progress display during download
6. Proper file permissions on Unix
7. Fallback to system binaries if available
8. User choice: Install Deno, use yt-dlp 2025.10.22, or skip

---

## Tasks

<task>
<id>03-01</id>
<name>Create installer module structure</name>
Create src/core/installer.ts:
- Constants: AUTOCLIPER_DIR, BIN_DIR
- Platform-specific URLs object
- ensureDirs() function
</task>

<task>
<id>03-02</id>
<name>Implement download utility</name>
Add to installer.ts:
- download() function with progress callback
- Uses native fetch (Node 18+)
- Handles redirects
- Shows percentage progress
</task>

<task>
<id>03-03</id>
<name>Implement FFmpeg installation</name>
Add installFFmpeg() to installer.ts:
- Detect platform (win32/darwin/linux)
- Download from appropriate URL:
  - win32: github.com/BtbN/FFmpeg-Builds
  - darwin: evermeet.cx/ffmpeg
  - linux: johnvansickle.com/ffmpeg
- Extract .zip or .tar.xz
- Find binary in extracted files
- Copy to ~/.autocliper/bin/ffmpeg[.exe]
- Set executable permission on Unix
</task>

<task>
<id>03-04</id>
<name>Implement yt-dlp installation</name>
Add installYtDlp() to installer.ts:
- Platform-specific download URLs
- Direct binary download (no extraction for win32)
- Copy to ~/.autocliper/bin/yt-dlp[.exe]
- Set executable permission on Unix
- Default to yt-dlp 2025.10.22 (last version without Deno requirement)
- Optionally install 2025.11.12+ if Deno detected
</task>

<task>
<id>03-04a</id>
<name>Implement Deno detection and installation</name>
Add installDeno() to installer.ts:
- Check if Deno installed: `deno --version`
- If not present, offer to install via @clack/prompts:
  - Install Deno (recommended for full YouTube support)
  - Use yt-dlp 2025.10.22 (no Deno required, limited YouTube)
  - Skip Deno installation
- Download Deno from deno.land/install.sh or deno.land/install.ps1
- Copy to ~/.autocliper/bin/deno[.exe]
</task>

<task>
<id>03-04b</id>
<name>Add yt-dlp version selection logic</name>
Add to installer.ts:
- detectDenoInstalled(): boolean
- getYtDlpVersion(denoInstalled: boolean): string
- Returns: '2025.11.12' if Deno present, '2025.10.22' otherwise
- User can override via config.set('tools.ytdlp_version')
</task>

<task>
<id>03-05</id>
<name>Implement tool detection</name>
Add to installer.ts:
- isToolInstalled(tool): Check bin path and system PATH
- getBinPath(tool): Return path to binary
- getToolPath(tool): Return bin path or tool name for system
</task>

<task>
<id>03-06</id>
<name>Implement init command</name>
Update src/commands/init.ts:
- Check if tools already installed
- Offer to install missing tools
- Run installFFmpeg() with progress bar
- Check for Deno before yt-dlp installation
- Prompt user: Install Deno? / Use older yt-dlp? / Skip?
- Run installDeno() if user accepts
- Run installYtDlp() with progress bar
- Display summary of installed versions
- Display success/failure with ASCII symbols
</task>

<task>
<id>03-07</id>
<name>Add extract-zip dependency handling</name>
- Already in package.json from Phase 01
- Use for FFmpeg extraction on Windows/macOS
- Use tar for Linux .tar.xz
</task>

---

## Verification Criteria

- [ ] `autocliper init` downloads FFmpeg to ~/.autocliper/bin/
- [ ] `autocliper init` downloads yt-dlp to ~/.autocliper/bin/
- [ ] FFmpeg executable works: `~/.autocliper/bin/ffmpeg -version`
- [ ] yt-dlp executable works: `~/.autocliper/bin/yt-dlp --version`
- [ ] Deno detection prompts user if not installed
- [ ] Deno installs to ~/.autocliper/bin/deno if accepted
- [ ] yt-dlp version selection based on Deno availability
- [ ] User can choose: Install Deno / Use older yt-dlp / Skip
- [ ] Download progress shown during installation
- [ ] Installation works on Windows (creates .exe)
- [ ] Installation works on macOS (sets +x permission)
- [ ] Installation works on Linux (sets +x permission)
- [ ] Re-running init detects existing tools
- [ ] Fallback to system tools if local not found

---

## Notes

- Download URLs must match CLAUDE.md spec
- FFmpeg version: 7.1 from BtbN builds
- yt-dlp version: 2025.01.x from official releases
  - **CRITICAL:** yt-dlp 2025.11.12+ requires Deno for YouTube
  - Default: install yt-dlp 2025.10.22 (no Deno required)
  - Offer: Install Deno for full YouTube support
- Deno installation:
  - Download from deno.land/install.sh (Unix) or install.ps1 (Windows)
  - Install to ~/.autocliper/bin/deno
  - Version: latest stable (check via API)
- Use cross-platform paths (path.join, os.homedir())
- Handle download failures gracefully with retry suggestion

## yt-dlp + Deno Decision Flow

```
User runs: autocliper init
  |
  v
Check existing tools
  |
  v
yt-dlp not installed?
  |
  v
Deno installed?
  |-- YES --> Offer: Install yt-dlp 2025.11.12+ (full support)
  |-- NO --> Offer choices:
                | A. Install Deno + yt-dlp latest
                | B. Install yt-dlp 2025.10.22 (no Deno)
                | C. Skip yt-dlp
```
