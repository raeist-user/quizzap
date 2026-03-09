#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

// Load .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

const token = process.env.GITHUB_TOKEN || '';
if (!token) console.warn('[build] WARNING: GITHUB_TOKEN not set');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
  .replace("'%%GITHUB_TOKEN%%'", JSON.stringify(token));

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html, 'utf8');
console.log('[build] dist/index.html ready');
