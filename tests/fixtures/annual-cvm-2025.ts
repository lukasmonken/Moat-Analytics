import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const assets = JSON.parse(
  gunzipSync(readFileSync('tests/fixtures/annual-cvm-2025.json.gz')).toString('utf8'),
) as Record<string, unknown>;

export function readCvm2025(name: string): unknown {
  if (!Object.hasOwn(assets, name)) throw new Error(`Fixture CVM ausente: ${name}.`);
  return structuredClone(assets[name]);
}
