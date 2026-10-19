import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

const targetDirectories = [
  path.join(projectRoot, 'src', 'contracts'),
  path.join(projectRoot, 'node_modules', '@midnight-ntwrk'),
];

const jsExtensions = new Set(['.js', '.mjs', '.cjs']);

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const extension = path.extname(entry.name);

    // Remove sourcemap files themselves.
    if (extension === '.map') {
      fs.unlinkSync(fullPath);
      continue;
    }

    // Remove sourceMappingURL comments from JavaScript module files.
    if (!jsExtensions.has(extension)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    const cleaned = content
      .replace(/\r?\n?\/\/# sourceMappingURL=.*$/gm, '')
      .replace(/\r?\n?\/\*# sourceMappingURL=.*?\*\//gm, '');

    if (cleaned !== content) {
      fs.writeFileSync(fullPath, cleaned, 'utf8');
    }
  }
}

for (const directory of targetDirectories) {
  walk(directory);
}

console.log('Removed broken Midnight/Compact sourcemap references.');