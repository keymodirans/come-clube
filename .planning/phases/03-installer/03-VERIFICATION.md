---
phase: 03-installer
verified: 2026-01-30T02:45:00Z
status: passed
score: 8/8 must-haves verified
---

# Phase 03: External Tools Installer Verification Report

**Phase Goal:** Auto-install FFmpeg and yt-dlp to ~/.autocliper/bin/ across all platforms.
**Verified:** 2026-01-30T02:45:00Z
**Status:** PASSED
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | FFmpeg 7.1 can be downloaded and installed | VERIFIED | installFFmpeg() in installer.ts (line 204) downloads from platform-specific URLs (BtbN for Windows, evermeet.cx for macOS, johnvansickle.com for Linux) |
| 2 | yt-dlp can be downloaded and installed | VERIFIED | installYtDlp() in installer.ts (line 332) downloads from GitHub releases with version selection |
| 3 | Deno can be detected and optionally installed | VERIFIED | detectDenoInstalled() (line 271) checks system; installDeno() (line 305) downloads from dl.deno.land |
| 4 | Platform-specific URLs are handled correctly | VERIFIED | URLs object (line 39) has win32/darwin/linux keys for FFmpeg, yt-dlp, and Deno |
| 5 | Progress is displayed during downloads | VERIFIED | ProgressCallback type (line 63) used with ora spinner in init.ts (line 31-48) |
| 6 | Unix permissions are set correctly | VERIFIED | setExecutable() (line 126) uses fs.chmod with 0o755 on non-Windows |
| 7 | System binaries can be used as fallback | VERIFIED | getToolPath() (line 397) returns local bin if exists, otherwise returns tool name for system PATH |
| 8 | User can choose yt-dlp version/Deno option | VERIFIED | init.ts (line 167-183) presents 3 choices via p.select: install Deno+latest, use old yt-dlp, or skip |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/installer.ts` | Tool installation module | VERIFIED | 517 lines, substantive implementation with all required functions |
| `src/commands/init.ts` | Interactive init command | VERIFIED | 266 lines, complete user flow with status display, prompts, progress bars |
| FFmpeg download URLs | Platform-specific URLs | VERIFIED | win32/darwin/linux defined at line 40-44 |
| yt-dlp download URLs | Version-specific URLs | VERIFIED | versionNoDeno: 2025.10.22, versionLatest: 2025.11.12 |
| Deno download URLs | Platform-specific URLs | VERIFIED | win32/darwin/linux defined at line 53-57 |
| Progress tracking | ProgressCallback + ora | VERIFIED | download() accepts callback; createProgress() uses ora spinner |
| Error handling | E010-E019 codes | VERIFIED | All error codes defined and used appropriately |
| Cross-platform paths | path.join/os.homedir | VERIFIED | All paths use path.join() and os.homedir() |
| ASCII output | > + x ! - symbols | VERIFIED | logger.ts and internal log functions use ASCII only |
| `package.json` dependencies | extract-zip present | VERIFIED | extract-zip: ^2.0.1 at line 40 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|----|--------|
| `init.ts` | `installer.ts` | ESM imports | WIRED | Line 14-24 imports all installer functions |
| `installer.ts` | `utils/config.ts` | get/set functions | WIRED | Line 17 imports getConfig, setConfig |
| `installer.ts` | FFmpeg URLs | URLs.ffmpeg object | WIRED | installFFmpeg() reads platform-specific URL (line 212) |
| `installer.ts` | yt-dlp URLs | URLs.ytdlp object | WIRED | installYtDlp() constructs URL from baseUrl + version (line 344-348) |
| `installer.ts` | Deno URLs | URLs.deno object | WIRED | installDeno() reads platform-specific URL (line 313) |
| `download()` | Progress callback | onProgress parameter | WIRED | Calls callback with percent (line 118) |
| User choice | yt-dlp version | p.select result | WIRED | Choice sets installLatestYtDlp flag (line 187-189) |
| `index.ts` | `init.ts` | initCommand import | WIRED | Line 10 imports initCommand, line 87 registers it |

### Requirements Coverage

N/A - No REQUIREMENTS.md file mapped to this phase.

### Anti-Patterns Found

| File | Severity | Pattern | Status |
|------|----------|---------|--------|
| None | - | No TODO/FIXME/placeholder patterns found | CLEAN |
| installer.ts | INFO | return null at line 197 | LEGITIMATE (findFFmpegBinary returns null when not found) |
| installer.ts | INFO | console.log for internal logging | LEGITIMATE (internal log functions use ASCII symbols) |

### Human Verification Required

### 1. Functional Test: Run autocliper init

**Test:** Execute `autocliper init` on each platform (Windows, macOS, Linux)
**Expected:** 
- Status table shows current installation state
- FFmpeg downloads with progress bar
- yt-dlp version selection prompt appears if Deno not installed
- Binaries install to ~/.autocliper/bin/
- Executable permissions work on Unix
- Re-running init detects existing tools

**Why human:** Cannot programmatically verify actual downloads, file permissions, or interactive prompts

### 2. Verify Binary Execution

**Test:** Run installed binaries directly
**Expected:**
- `~/.autocliper/bin/ffmpeg -version` outputs version info
- `~/.autocliper/bin/yt-dlp --version` outputs version
- `~/.autocliper/bin/deno --version` outputs version (if installed)

**Why human:** Requires actual file system and execution environment

### 3. Test Platform-Specific Extraction

**Test:** Run init on each platform
**Expected:**
- Windows: .zip extraction works, binary has .exe extension
- macOS: .zip extraction works, binary has +x permission
- Linux: .tar.xz extraction works, binary has +x permission

**Why human:** Requires actual platform testing with archive extraction

### 4. Verify User Choice Flow

**Test:** Run init without Deno installed
**Expected:**
- Prompt shows 3 options
- Selecting "deno" installs Deno then yt-dlp 2025.11.12+
- Selecting "ytdlp-old" installs yt-dlp 2025.10.22 without Deno
- Selecting "skip" continues without yt-dlp

**Why human:** Requires interactive terminal testing with clack prompts

### Gaps Summary

**No gaps found.** All must-haves verified through code analysis:

1. **FFmpeg 7.1 download** - Platform-specific URLs defined (BtbN, evermeet.cx, johnvansickle.com)
2. **yt-dlp 2025.10.22/2025.11.12** - Version selection logic based on Deno availability
3. **Deno detection/installation** - detectDenoInstalled() spawns `deno --version`, installDeno() downloads from dl.deno.land
4. **Platform-specific URLs** - URLs object has win32/darwin/linux for all tools
5. **Progress display** - ProgressCallback type + ora spinner in createProgress()
6. **Unix permissions** - setExecutable() uses chmod 0o755 on non-Windows platforms
7. **Fallback to system binaries** - getToolPath() returns local bin if exists, otherwise tool name for PATH
8. **User choice** - p.select presents 3 options: install Deno+latest, use old yt-dlp, or skip

**Additional verification points:**
- Error codes E010-E019 properly defined and used
- Retry logic in download() with 3 retries and 1s delay
- Cross-platform paths using path.join() and os.homedir()
- ASCII-only output (logger.ts uses > + x ! - symbols)
- extract-zip dependency present in package.json
- init.ts properly imports and uses installer functions
- No stub patterns or TODO comments found

---

**Verification Summary:** Phase 03 is COMPLETE and READY for Phase 04 (Video Pipeline). All required functionality exists, is substantive, and is properly wired.

_Verified: 2026-01-30T02:45:00Z_
_Verifier: Claude (gsd-verifier)_
