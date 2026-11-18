#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = __dirname;
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const pgDataDir = path.join(backendDir, 'data', 'postgres');

console.log('\n=============================================================');
console.log('Starting Gemini Full-Stack App (Backend + Frontend + DB)...');
console.log('=============================================================\n');

// Ensure PostgreSQL is running if local pg data exists
try {
  execSync('pg_isready -h localhost -p 5432', { stdio: 'ignore' });
  console.log('PostgreSQL is connected on localhost:5432');
} catch (e) {
  if (fs.existsSync(pgDataDir)) {
    console.log('Starting local PostgreSQL database...');
    try {
      execSync(`pg_ctl -D "${pgDataDir}" -l "${path.join(pgDataDir, 'server.log')}" start`, { stdio: 'inherit' });
    } catch (startErr) {
      console.warn('Could not auto-start local postgresql:', startErr.message);
    }
  }
}

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
