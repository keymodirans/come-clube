---
wave: 11
depends_on: [10]
files_modified:
  - tsup.config.ts
  - package.json
  - .gitignore
  - dist/
autonomous: true
---

# PLAN: Phase 11 - Build & Packaging

## Phase Goal

Create standalone binaries for Windows, macOS, and Linux distribution.

---

## must_haves

1. tsup build configuration
2. pkg packaging for all platforms
3. Executable binaries
4. Python script bundling
5. Distribution-ready output

---

## Tasks

<task>
<id>11-01</id>
<name>Configure tsup build</name>
Update/create tsup.config.ts:
- Entry: ['src/index.ts']
- Format: ['esm']
- Target: 'node20'
- Platform: 'node'
- OutDir: 'dist'
- Clean: true
- Minify: true
- Shims: true
- Banner: {js: '#!/usr/bin/env node'}
- Sourcemap: true (for debugging)
</task>

<task>
<id>11-02</id>
<name>Add build scripts to package.json</name>
Update package.json scripts:
- "build": "tsup"
- "dev": "tsup --watch"
- "pkg:win": "pkg dist/cli.js -t node22-win-x64 -o dist/autocliper-win.exe"
- "pkg:mac": "pkg dist/cli.js -t node22-macos-x64 -o dist/autocliper-macos"
- "pkg:linux": "pkg dist/cli.js -t node22-linux-x64 -o dist/autocliper-linux"
- "pkg:all": "npm run pkg:win && npm run pkg:mac && npm run pkg:linux"
</task>

<task>
<id>11-03</id>
<name>Configure pkg settings</name>
Add to package.json:
- "pkg": {
    "assets": ["scripts/**/*"],
    "outputPath": "dist",
    "scripts": ["dist/**/*.js"]
  }
</task>

<task>
<id>11-04</id>
<name>Ensure Python script bundling</name>
- Verify scripts/face_detector.py is included
- Add to pkg assets if needed
- Script will be extracted next to binary
- Update faceDetector.ts to locate bundled script
</task>

<task>
<id>11-05</id>
<name>Build TypeScript first</name>
- Run `npm run build`
- Verify dist/cli.js exists
- Check shebang in output
- Test with `node dist/cli.js --version`
</task>

<task>
<id>11-06</id>
<name>Package Windows binary</name>
- Run `npm run pkg:win`
- Verify autocliper-win.exe created
- Test execution on Windows (or WSL)
- Check size (should be ~60-80MB)
</task>

<task>
<id>11-07</id>
<name>Package macOS binary</name>
- Run `npm run pkg:mac`
- Verify autocliper-macos created
- Set executable permission: chmod +x
- Test on macOS if available
</task>

<task>
<id>11-08</id>
<name>Package Linux binary</name>
- Run `npm run pkg:linux`
- Verify autocliper-linux created
- Set executable permission: chmod +x
- Test on Linux if available
</task>

<task>
<id>11-09</id>
<name>Create distribution script</name>
Create scripts/dist.sh:
- Run all builds
- Create release folder
- Copy binaries with version names
- Generate SHA256 checksums
- Create release notes template
</task>

<task>
<id>11-10</id>
<name>Update .gitignore</name>
Add to .gitignore:
- dist/ (build output)
- *.exe (binaries)
- autocliper-* (standalone binaries)
- Keep src/, scripts/, package.json, tsconfig.json
</task>

<task>
<id>11-11</id>
<name>Test standalone binary</name>
- Run binary without Node.js installation
- Test all commands: --version, --help, hwid, config
- Verify Python script located correctly
- Verify external tool download works
- Test with real YouTube URL (end-to-end)
</task>

---

## Verification Criteria

- [ ] `npm run build` creates dist/cli.js
- [ ] dist/cli.js has shebang: #!/usr/bin/env node
- [ ] `node dist/cli.js --version` shows 1.0.0
- [ ] `npm run pkg:win` creates autocliper-win.exe
- [ ] `npm run pkg:mac` creates autocliper-macos
- [ ] `npm run pkg:linux` creates autocliper-linux
- [ ] Windows binary executes standalone
- [ ] macOS binary executes standalone
- [ ] Linux binary executes standalone
- [ ] Python script bundled/included
- [ ] Binary size under 100MB each
- [ ] All commands work in binary
- [ ] External tools download works
- [ ] Config saved to correct location
- [ ] HWID system works in binary

---

## Notes

- pkg targets: node22-win-x64, node22-macos-x64, node22-linux-x64
- Binary size estimate: 60-80MB per platform
- Python script bundled as asset alongside binary
- Scripts location: relative to binary path
- First run of binary will download FFmpeg/yt-dlp
- Distribution: Upload binaries to GitHub Releases
