---
wave: 1
depends_on: []
files_modified:
  - package.json
  - tsconfig.json
  - bin/cli.js
  - src/index.ts
  - src/commands/init.ts
  - src/commands/config.ts
  - src/commands/run.ts
  - src/utils/logger.ts
  - .gitignore
  - README.md
autonomous: true
---

# PLAN: Phase 01 - Project Foundation

## Phase Goal

Establish project scaffolding with TypeScript, build tools, and basic CLI structure.

---

## must_haves

1. Working TypeScript build with tsup
2. Executable CLI via node bin entry
3. Commander-based command structure
4. All dependencies installed and type-safe
5. ESM module system working
6. Directory structure matching CLAUDE.md spec

---

## Tasks

<task>
<id>01-01</id>
<name>Initialize package.json</name>
Create package.json with:
- "name": "autocliper", "version": "1.0.0"
- "type": "module", "engines": { "node": ">=20.0.0" }
- All dependencies from CLAUDE.md (updated 2025-01-30):
  - commander: ^14.0.0
  - chalk: ^5.6.0
  - ora: ^9.1.0
  - @clack/prompts: ^0.10.0
  - @deepgram/sdk: ^4.11.3
  - @google/genai: ^1.38.0
  - (rest from CLAUDE.md)
- "bin": { "autocliper": "./bin/cli.js" }
- "scripts": build, dev, hwid
</task>

<task>
<id>01-02</id>
<name>Create TypeScript configuration</name>
Create tsconfig.json with:
- target: ES2022
- module: NodeNext
- moduleResolution: NodeNext
- strict: true
- outDir: ./dist
- esModuleInterop: true
- skipLibCheck: true
</task>

<task>
<id>01-03</id>
<name>Create directory structure</name>
Create folders:
- bin/
- src/commands/
- src/core/
- src/services/
- src/license/
- src/utils/
- scripts/
</task>

<task>
<id>01-04</id>
<name>Create CLI entry point</name>
Create bin/cli.js with:
- Shebang: #!/usr/bin/env node
- ESM import from ../src/index.js
</task>

<task>
<id>01-05</id>
<name>Initialize logger utility</name>
Create src/utils/logger.ts with:
- ASCII output symbols (>, +, x, !, -)
- log(), success(), error(), warn(), info() functions
- No emoji, cross-platform compatible
</task>

<task>
<id>01-06</id>
<name>Create main CLI with commander</name>
Create src/index.ts with:
- Commander program setup
- Version: 1.0.0
- Commands: init, config, run, hwid
- Parse and execute
</task>

<task>
<id>01-07</id>
<name>Create stub commands</name>
Create src/commands/{init,config,run}.ts with:
- Placeholder implementations
- "Not yet implemented" message using logger
- Proper exports for commander registration
</task>

<task>
<id>01-08</id>
<name>Configure tsup build</name>
Create tsup.config.ts:
- Entry: src/index.ts
- Format: esm
- Target: node20
- Platform: node
- OutDir: dist
- Clean: true
- Banner with shebang
</task>

<task>
<id>01-09</id>
<name>Create .gitignore</name>
Add:
- node_modules/
- dist/
- .autocliper/
- *.lock
- *.mp4, *.wav, *.mp3
- .env
</task>

<task>
<id>01-10</id>
<name>Create README.md</name>
Basic project README with:
- Project description
- Prerequisites (Node 20+)
- Installation instructions
- Usage overview
</task>

<task>
<id>01-11</id>
<name>Verify build and execution</name>
Test:
- npm run build completes
- node bin/cli.js --version shows 1.0.0
- node bin/cli.js --help shows all commands
- Stub commands display placeholder messages
</task>

---

## Verification Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run build` creates dist/ with compiled JS
- [ ] `node bin/cli.js --version` outputs "1.0.0"
- [ ] `node bin/cli.js --help` shows init, config, run, hwid commands
- [ ] `node bin/cli.js init` shows "Not yet implemented"
- [ ] TypeScript strict mode catches intentional errors
- [ ] ESM imports work (no require() usage)
- [ ] All files follow directory structure from CLAUDE.md

---

## Notes

- This phase establishes the foundation; later phases will implement actual functionality
- Ensure ESM is used throughout - no CommonJS require/module.exports
- Locked versions must match CLAUDE.md exactly (updated 2025-01-30):
  - commander ^14.0.0 (ESM only)
  - chalk ^5.6.0 (ESM only)
  - ora ^9.1.0
  - @deepgram/sdk ^4.11.3 (stay on v4, v5 is beta)
  - @google/genai ^1.38.0 (correct package - NOT @google/generative-ai)
