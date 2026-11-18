#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const rootDir = __dirname;
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

console.log('\n=============================================================');
console.log('🚀 Starting Gemini Full-Stack App (Backend + Frontend)...');
console.log('=============================================================\n');

// 1. Start Backend Express Server
const backend = spawn('npm', ['start'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true
});

// 2. Start Frontend Vite Server
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true
});

// Handle termination cleanly
function shutdown() {
  console.log('\nStopping servers...');
  backend.kill();
  frontend.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
