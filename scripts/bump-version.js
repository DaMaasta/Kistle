import { readFileSync, writeFileSync } from 'fs';

// Version "MAJOR.MM": Minor zweistellig, nach .99 steigt die Hauptversion (8.99 → 9.00)
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const parts = pkg.version.split('.');
let major = Number(parts[0]);
let minor = Number(parts[1] ?? '0') + 1;
if (minor > 99) {
  major += 1;
  minor = 0;
}
pkg.version = `${major}.${String(minor).padStart(2, '0')}`;

writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`Version bumped to ${pkg.version}`);
