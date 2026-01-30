// Setup config di lokasi yang benar (conf package location)
import fs from 'fs';
import path from 'path';

const DEEPGRAM_KEY = '874ea2ec9793dbcf3d5d6cde3cec836042aefe5b';
const GEMINI_KEY = 'AIzaSyBFKIJZD9DKnWfjo5Lh_tmG6aG7OP81xcs';
const GITHUB_TOKEN = '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';
const GITHUB_OWNER = 'keymodirans';
const GITHUB_REPO = 'renderer-clips';

// Conf package location on Windows
const configDir = 'C:/Users/Rekabit/AppData/Roaming/autocliper-nodejs/Config';
const configPath = path.join(configDir, 'config.json');

fs.mkdirSync(configDir, { recursive: true });

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
console.log('+ Config saved to:', configPath);

// Verify
const verify = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
console.log('+ Deepgram:', verify.api.deepgram.substring(0,20) + '...');
console.log('+ Gemini:', verify.api.gemini.substring(0,20) + '...');
console.log('+ GitHub owner:', verify.api.github.owner);
console.log('+ GitHub repo:', verify.api.github.repo);
