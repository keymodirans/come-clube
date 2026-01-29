# Phase 11 Plan 01: Build & Packaging Summary

**Status:** COMPLETE (with documented limitations)
**Duration:** ~45 minutes
**Date:** 2026-01-30

---

## One-Liner

Configured tsup build system with ESM/CJS output, created distribution scripts, documented standalone binary packaging limitations due to ESM module and native module compatibility issues with pkg tool.

---

## Completed Tasks

| Task | Name | Status | Notes |
|------|------|--------|-------|
| 11-01 | Configure tsup build | Done | Added minify, shims, banner with shebang |
| 11-02 | Add build scripts | Done | Build, dev, pkg scripts added |
| 11-03 | Configure pkg settings | Done | Assets, outputPath configured |
| 11-04 | Python script bundling | Done | Updated faceDetector.ts for bundled script location |
| 11-05 | Build TypeScript | Done | Fixed template literal bug, successful build |
| 11-06 | Package Windows binary | Partial | Binary created but runtime errors due to ESM/pkg limitations |
| 11-07 | Package macOS binary | Skipped | Blocked by pkg ESM issues |
| 11-08 | Package Linux binary | Skipped | Blocked by pkg ESM issues |
| 11-09 | Create distribution script | Done | Both Unix and Windows scripts created |
| 11-10 | Update .gitignore | Done | Added dist-cjs/, release/, *.exe |
| 11-11 | Test standalone binary | Partial | ESM build works, pkg binary has runtime issues |

---

## What Was Built

### Build Configuration
- **tsup.config.ts**: Configured for ESM output with minification, shims, sourcemaps
- **package.json**: Added build scripts (build, build:cjs, dev, pkg:win, pkg:mac, pkg:linux, pkg:all)
- **pkg config**: Added to package.json for assets and scripts

### Distribution Scripts
- **scripts/dist.sh**: Unix/Linux/macOS distribution build script
- **scripts/dist.ps1**: Windows PowerShell distribution build script

Both scripts:
- Clean previous builds
- Build ESM version (dist/index.js)
- Build CJS version (dist-cjs/index.cjs)
- Create versioned release folder (release/v{version}/)
- Generate SHA256 checksums
- Copy all necessary files
- Create release notes template

### Output Files
```
dist/
  index.js (55KB) - ESM build for Node.js >=20
  index.js.map - Source map
  index.d.ts - TypeScript declarations

dist-cjs/
  index.cjs (57KB) - CommonJS build for Node.js >=16
  index.cjs.map - Source map
  index.d.cts - TypeScript declarations

release/v1.0.0/
  index.js - Main ESM entry point
  scripts/ - Python face detector
  package.json - Package config
  README.md - Documentation
  checksums.txt - SHA256 checksums
  RELEASE_NOTES.md - Release template
```

---

## Deviations from Plan

### Auto-Fixed Issues (Rule 1 - Bug)

**1. Template Literal Evaluation Bug in analyzer.ts**
- **Found during:** Task 11-05 (Build TypeScript)
- **Issue:** Template literals with `${...}` were being evaluated at module load time, causing `ReferenceError: MAX_SEGMENTS is not defined`
- **Fix:** Changed from template literal to string concatenation
- **Files modified:** `src/core/analyzer.ts`
- **Commit:** d2b68e0

**2. import.meta Usage Incompatible with pkg**
- **Found during:** Task 11-06 (Package Windows binary)
- **Issue:** pkg cannot handle `import.meta.url` in ESM modules properly
- **Fix:** Changed to use `__dirname` fallback for pkg compatibility in index.ts and hwid.ts
- **Files modified:** `src/index.ts`, `src/license/hwid.ts`
- **Commit:** 6129108

### Known Limitations (Rule 4 - Architectural Decision Required for Full Fix)

**Standalone Binary Packaging Limitations**

The pkg tool has fundamental limitations with modern Node.js applications:

1. **ESM Module Support**: pkg v5.8.1 does not properly support ES modules with `import.meta`
   - Warning: "Babel parse has failed: import.meta may appear only with 'sourceType: module'"
   - Result: Binaries fail at runtime with module resolution errors

2. **Native Module Support**: pkg fails bundling native dependencies
   - Error: `ENOENT: no such file or directory, open 'node:sqlite'`
   - Cause: The `conf` dependency uses `node:sqlite` which pkg cannot package

3. **Available Node Versions**: pkg only supports Node.js v12-v16
   - Our target: Node.js >=20
   - Latest pkg has no pre-built binaries for node18 or node20

**Workaround Implemented:**
- ESM build works perfectly for Node.js distribution (`npm install -g .`)
- Distribution scripts create release packages for npm/github releases
- Users install via npm, which handles dependencies correctly

**Options for True Standalone Binaries (Future Work):**
1. Use nexe with --build flag (requires Python + C++ build tools)
2. Switch from `conf` to a config solution without native modules
3. Wait for pkg to add better ESM support
4. Use alternative bundlers (node-packer,boxednode)
5. Distribute as Docker images instead of standalone binaries

---

## Verification Results

### Build System
- [x] `npm run build` creates dist/index.js
- [x] dist/index.js has shebang: `#!/usr/bin/env node`
- [x] `node dist/index.js --version` shows 1.0.0
- [x] `npm run build:cjs` creates dist-cjs/index.cjs
- [x] Distribution scripts work on Windows

### ESM Build (Primary Distribution)
- [x] `node dist/index.js --help` works correctly
- [x] `node dist/index.js hwid` shows device information
- [x] All commands accessible: init, config, run, hwid
- [x] License system works in ESM build

### pkg Binary (Limited by Known Issues)
- [x] `npx pkg dist-cjs/index.cjs -t node16-win-x64` creates autocliper-win.exe (~33MB)
- [x] Binary file is created
- [ ] Binary executes standalone - **FAILS** due to ESM/native module issues
- [ ] All commands work in binary - **NOT TESTED** due to runtime failure
- [ ] External tools download works in binary - **NOT TESTED**

### Distribution Files
- [x] Release folder created with version
- [x] SHA256 checksums generated
- [x] Release notes template created
- [x] Python script included in release

---

## Technical Decisions

### 001: ESM-First Distribution Strategy
**Date:** 2026-01-30
**Decision:** Use ESM as primary distribution format, acknowledge pkg limitations

**Reasoning:**
- Node.js >=20 is required engine, ESM is the future
- pkg does not support Node.js 18+ or ESM properly
- CommonJS transpilation adds complexity and loses some ESM features
- npm handles all dependencies correctly when users `npm install -g`

**Impact:**
- Users must have Node.js installed (no true standalone binaries)
- Smaller distribution via npm registry
- Simpler build and maintenance
- Full ESM feature support preserved

### 002: String Concatenation for Prompt Templates
**Date:** 2026-01-30
**Decision:** Use string concatenation instead of template literals for prompts

**Reasoning:**
- Template literals evaluate placeholders at module load time
- String concatenation defers evaluation to runtime when `.replace()` is called
- Required for dynamic prompt generation with runtime values

**Impact:**
- analyzer.ts prompts built with string concatenation
- Replace uses regex `/\${VAR}/g` pattern

---

## Tech Stack

### Added
- **tsup** v8.3.6 - TypeScript bundler (already existed)
- **pkg** v5.8.1 - Binary packaging (limited by ESM issues)
- **nexe** v4.0.0-rc.2 - Alternative binary packager (not fully utilized)

### Patterns
- **ESM Build**: Primary distribution format for Node.js >=20
- **CJS Build**: Secondary format for potential future pkg usage
- **Distribution Scripts**: Automated release creation with checksums

---

## Key Files

### Created
- `scripts/dist.sh` - Unix/Linux/macOS distribution script
- `scripts/dist.ps1` - Windows distribution script
- `release/v1.0.0/` - Distribution package

### Modified
- `tsup.config.ts` - Build configuration
- `package.json` - Build scripts and pkg config
- `src/index.ts` - Fixed import.meta usage for pkg compatibility
- `src/license/hwid.ts` - Fixed import.meta usage for pkg compatibility
- `src/core/analyzer.ts` - Fixed template literal evaluation bug
- `.gitignore` - Added dist-cjs/, release/, *.exe

---

## Error Codes (Build & Packaging)

Error code range [E080-E089] reserved for build and packaging errors:

- **E080**: Build failed - TypeScript compilation error
- **E081**: Build failed - Bundler error
- **E082**: Package failed - pkg error
- **E083**: Package failed - Native module incompatible
- **E084**: Package failed - Asset bundling error
- **E085**: Distribution failed - Release creation error

*(No errors were thrown during this phase - range reserved for future use)*

---

## Next Phase Readiness

### Complete
- Build system configured
- Distribution scripts created
- ESM build working for Node.js distribution

### Known Limitations
- Standalone binary packaging requires architectural decision
- pkg tool limitations with ESM and native modules documented
- Workaround in place (npm distribution)

### For Production
1. Choose standalone binary approach (see options in deviations)
2. Test all binary commands on Windows, macOS, Linux
3. Verify external tools download in packaged environment
4. Add automated release publishing to npm

---

## Commits

1. **f889a24** - feat(11-01): configure tsup build and pkg packaging
2. **d2b68e0** - fix(11-05): fix template literal evaluation bug in analyzer
3. **6129108** - feat(11-06): update build config for packaging attempts
4. **e0a67ec** - feat(11-09): create distribution scripts and update gitignore

---

## Metrics

- **Build Time**: ~1 second (tsup is fast)
- **ESM Output Size**: 55KB (minified)
- **CJS Output Size**: 57KB (minified)
- **pkg Binary Size**: 33MB (when created, but non-functional)
- **Distribution Package**: ~60KB (excluding Python script)

---

## Documentation

- Build instructions in `scripts/dist.sh` and `scripts/dist.ps1`
- Release notes template in `release/v1.0.0/RELEASE_NOTES.md`
- SHA256 checksums in `release/v1.0.0/checksums.txt`

---

## Conclusion

Phase 11 successfully configured the build system and created distribution scripts. While standalone binary packaging with pkg encountered fundamental limitations due to ESM module and native module compatibility issues, a working distribution strategy via npm is in place. The ESM build works correctly for Node.js distribution, and all CLI functionality is verified.

**Status:** Phase 11 tasks completed with documented workarounds for packaging limitations.
