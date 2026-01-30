// Setup all API keys - ES module version
import fs from 'fs';
import os from 'os';
import path from 'path';

// API Keys
const DEEPGRAM_KEY = '874ea2ec9793dbcf3d5d6cde3cec836042aefe5b';
const GEMINI_KEY = 'AIzaSyBFKIJZD9DKnWfjo5Lh_tmG6aG7OP81xcs';
const GITHUB_TOKEN = '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';
const GITHUB_OWNER = 'keymodirans';
const GITHUB_REPO = 'renderer-clips';

// Test each API key before setting
async function testAPIs() {
  console.log('=== Testing API Keys ===\n');

  // Test Deepgram
  console.log('> Testing Deepgram...');
  const dgResponse = await fetch('https://api.deepgram.com/v1/projects', {
    headers: { 'Authorization': 'Token ' + DEEPGRAM_KEY }
  });

  if (dgResponse.ok) {
    console.log('+ Deepgram key: Valid');
  } else if (dgResponse.status === 401) {
    console.log('x Deepgram key: INVALID (401)');
    return false;
  } else {
    console.log(`x Deepgram: HTTP ${dgResponse.status}`);
    return false;
  }

  // Test Gemini
  console.log('> Testing Gemini...');
  const gemResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'test' }] }] })
  });
  if (gemResponse.ok) {
    console.log('+ Gemini key: Valid');
  } else {
    console.log(`x Gemini: HTTP ${gemResponse.status}`);
    return false;
  }

  // Test GitHub
  console.log('> Testing GitHub token...');
  const ghResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': 'Bearer ' + GITHUB_TOKEN,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (ghResponse.ok) {
    const data = await ghResponse.json();
    console.log(`+ GitHub token: Valid (${data.login})`);
  } else {
    console.log(`x GitHub: HTTP ${ghResponse.status}`);
    return false;
  }

  return true;
}

// Save config
async function saveConfig() {
  // Find/create config directory
  const configDir = path.join(os.homedir(), '.autocliper');
  fs.mkdirSync(configDir, { recursive: true });

  const configPath = path.join(configDir, 'config.json');

  const config = {
    api: {
      deepgram: DEEPGRAM_KEY,
      gemini: GEMINI_KEY,
      github: {
        token: GITHUB_TOKEN,
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO
      }
    },
    preferences: {
      language: 'id'
    }
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\n+ Config saved to: ${configPath}`);

  // Verify
  const verify = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  console.log(`+ Deepgram: ${verify.api.deepgram.substring(0,20)}...`);
  console.log(`+ Gemini: ${verify.api.gemini.substring(0,20)}...`);
  console.log(`+ GitHub: ${verify.api.github.token.substring(0,20)}...`);
}

async function main() {
  const valid = await testAPIs();
  if (valid) {
    await saveConfig();
    console.log('\n=== All API keys verified & saved! ===');
  } else {
    console.log('\n=== Some API keys invalid ===');
    process.exit(1);
  }
}

main();
