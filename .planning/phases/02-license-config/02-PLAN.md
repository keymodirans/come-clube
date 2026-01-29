---
wave: 2
depends_on: [01]
files_modified:
  - src/license/hwid.ts
  - src/license/validator.ts
  - src/utils/config.ts
  - src/commands/init.ts
  - src/commands/config.ts
  - src/commands/hwid.ts
  - src/index.ts
autonomous: true
---

# PLAN: Phase 02 - License & Config System

## Phase Goal

Implement HWID-based licensing and secure API key storage.

---

## must_haves

1. HWID generation consistent across runs
2. AES-256-CBC encryption for device.lock
3. Config stored in ~/.autocliper/config.json
4. Interactive config setup with @clack/prompts
5. Device validation on every CLI run
6. hwid command displays device ID

---

## Tasks

<task>
<id>02-01</id>
<name>Implement HWID generation</name>
Create src/license/hwid.ts:
- Use node-machine-id for machine ID
- Hash with sha256 + secret
- Format as XXXX-XXXX-XXXX-XXXX
- NEVER log HWID to console
</task>

<task>
<id>02-02</id>
<name>Implement encryption/decryption</name>
Add to hwid.ts:
- encrypt(): AES-256-CBC with crypto.randomBytes IV
- decrypt(): Reverse of encrypt
- Secret: 'autocliper-hwid-secret-2026'
- Key derived with scryptSync
</task>

<task>
<id>02-03</id>
<name>Implement device validation</name>
Create src/license/validator.ts:
- verifyDevice(): Returns { valid, firstRun, error? }
- Create ~/.autocliper/ if missing
- Auto-lock on first run
- Compare current vs stored HWID
- Error code [E001] for device mismatch
</task>

<task>
<id>02-04</id>
<name>Implement config management</name>
Create src/utils/config.ts:
- Use conf package with project name 'autocliper'
- Schema: api.deepgram, api.gemini, api.github.token/owner/repo
- preferences: outputFolder, maxSegments, minDuration, maxDuration
- subtitle: fontFamily, fontSize, highlightColor
- get(), set(), has(), clear()
</task>

<task>
<id>02-05</id>
<name>Implement config command</name>
Update src/commands/config.ts:
- Interactive prompts with @clack/prompts
- Collect: Deepgram API key, Gemini API key
- Collect: GitHub token, owner, repo
- Validate each input before saving
- Success message with ASCII symbols
</task>

<task>
<id>02-06</id>
<name>Implement hwid command</name>
Create src/commands/hwid.ts:
- Display current device ID
- Show license status (locked/unlocked)
- Show config directory path
- Use logger for output
</task>

<task>
<id>02-07</id>
<name>Create init stub</name>
Update src/commands/init.ts:
- Display "Coming soon: External tools installation"
- Reference Phase 03
</task>

<task>
<id>02-08</id>
<name>Add license check to main CLI</name>
Update src/index.ts:
- Run verifyDevice() on startup
- Block execution if invalid
- Display [E001] error with guidance
- Skip validation for 'config' and 'hwid' commands
</task>

<task>
<id>02-09</id>
<name>Create run command stub</name>
Update src/commands/run.ts:
- Check if config exists
- Display [E002] if missing with guidance to run config
- Placeholder for main pipeline
</task>

---

## Verification Criteria

- [ ] First run creates ~/.autocliper/device.lock
- [ ] device.lock contains encrypted HWID (not plaintext)
- [ ] Subsequent runs validate successfully on same device
- [ ] Different device shows [E001] error
- [ ] `autocliper hwid` displays consistent device ID
- [ ] `autocliper config` prompts for all API keys
- [ ] Config saved to ~/.autocliper/config.json
- [ ] Config values retrievable via config.get()
- [ ] CLI blocks on device mismatch
- [ ] Config and hwid commands bypass device check

---

## Notes

- HWID must NEVER be logged or displayed in error messages
- Encryption is mandatory - no plaintext storage
- Config directory: ~/.autocliper/ (use os.homedir())
- Error codes: E001-E009 for license/HWID domain
