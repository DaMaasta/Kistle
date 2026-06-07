import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const parts = pkg.version.split('.');
const major = parts[0];
const minor = Number(parts[1] ?? '0') + 1;
pkg.version = `${major}.${String(minor).padStart(2, '0')}`;

writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`Version bumped to ${pkg.version}`);
