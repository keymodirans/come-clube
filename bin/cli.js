#!/usr/bin/env node

import { runCli } from '../dist/index.js';

runCli().catch((error) => {
  console.error('x Fatal error:', error.message);
  process.exit(1);
});
