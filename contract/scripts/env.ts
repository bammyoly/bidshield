import * as fs from 'node:fs';
import * as path from 'node:path';

export function loadDotEnv(cwd = process.cwd()): void {
  const file = path.join(cwd, '.env');
  if (!fs.existsSync(file)) return;
  // Existing process.env wins so CI / shell secrets are not overwritten.
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
