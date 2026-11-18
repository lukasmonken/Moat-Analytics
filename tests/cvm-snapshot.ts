import { readFileSync } from 'node:fs';

export function readCvmSample(): unknown {
  return JSON.parse(readFileSync('data/public/cvm-sample.json', 'utf8'));
}

export function readCvmIdentity(): unknown {
  return JSON.parse(readFileSync('data/public/cvm-identity.json', 'utf8'));
}
