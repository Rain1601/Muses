#!/usr/bin/env node
// Verifies HS256 JWT interop between python-jose (backend/app/utils/security.py)
// and jose (frontend/lib/auth/jwt.ts).

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const backendDir = resolve(repoRoot, 'backend');
const envPath = resolve(backendDir, '.env');
const pythonBin = resolve(backendDir, 'venv', 'bin', 'python');

function loadDotenv(path) {
  const raw = readFileSync(path, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const dotenv = loadDotenv(envPath);
process.env.JWT_SECRET = dotenv.JWT_SECRET;
process.env.JWT_EXPIRE_HOURS = dotenv.JWT_EXPIRE_HOURS ?? '168';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET missing from backend/.env');
  process.exit(1);
}

const { createAccessToken, verifyAccessToken } = await import('../lib/auth/jwt.ts');

const pyEnv = { ...process.env, ...dotenv };

function pySign(payload) {
  const code = `
import os, sys, json
sys.path.insert(0, '${backendDir}')
from app.utils.security import create_access_token
data = json.loads(sys.stdin.read())
sys.stdout.write(create_access_token(data))
`;
  const res = spawnSync(pythonBin, ['-c', code], { input: JSON.stringify(payload), env: pyEnv, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`python sign failed: ${res.stderr.split('\n').slice(-3).join(' ')}`);
  return res.stdout;
}

function pyVerify(token) {
  const code = `
import os, sys, json
sys.path.insert(0, '${backendDir}')
from app.utils.security import verify_token
sys.stdout.write(json.dumps(verify_token(sys.stdin.read())))
`;
  const res = spawnSync(pythonBin, ['-c', code], { input: token, env: pyEnv, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`python verify failed: ${res.stderr.split('\n').slice(-3).join(' ')}`);
  return JSON.parse(res.stdout);
}

const samples = [
  { user_id: 'abc-123' },
  { user_id: '550e8400-e29b-41d4-a716-446655440000' },
  { user_id: 'u1', role: 'admin' },
  { user_id: '', note: 'edge: empty id' },
];

let passed = 0, failed = 0;
const results = [];

for (const payload of samples) {
  const label = JSON.stringify(payload);

  try {
    const pyToken = pySign(payload);
    const tsPayload = await verifyAccessToken(pyToken);
    if (tsPayload.user_id !== payload.user_id) throw new Error(`user_id mismatch: ${tsPayload.user_id}`);
    if (typeof tsPayload.exp !== 'number') throw new Error('exp missing in TS-verified payload');
    results.push(`✓ py-sign→ts-verify  ${label}`);
    passed++;
  } catch (e) {
    results.push(`✗ py-sign→ts-verify  ${label}: ${e.message}`);
    failed++;
  }

  try {
    const tsToken = await createAccessToken(payload);
    const pyPayload = pyVerify(tsToken);
    if (pyPayload.user_id !== payload.user_id) throw new Error(`user_id mismatch: ${pyPayload.user_id}`);
    if (typeof pyPayload.exp !== 'number') throw new Error('exp missing in Python-verified payload');
    results.push(`✓ ts-sign→py-verify  ${label}`);
    passed++;
  } catch (e) {
    results.push(`✗ ts-sign→py-verify  ${label}: ${e.message}`);
    failed++;
  }
}

for (const line of results) console.log(line);
console.log('---');
console.log(`passed: ${passed}   failed: ${failed}   (${samples.length} payloads × 2 directions)`);
if (failed > 0) process.exit(1);
