// Deploy: React-Build per scp auf den Server kopieren
// Voraussetzung: SSH-Key auf dem Server eingerichtet (ssh-copy-id)
// Konfiguration in .env.local oder als Umgebungsvariablen:
//   DEPLOY_HOST=192.168.0.100
//   DEPLOY_USER=daniel
//   DEPLOY_PATH=/var/www/kistle

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// .env.local einlesen (falls vorhanden)
let env = {};
try {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && !key.startsWith('#')) env[key.trim()] = rest.join('=').trim();
  }
} catch {}

const HOST = process.env.DEPLOY_HOST ?? env['DEPLOY_HOST'] ?? '192.168.0.100';
const USER = process.env.DEPLOY_USER ?? env['DEPLOY_USER'] ?? 'daniel';
const PATH = process.env.DEPLOY_PATH ?? env['DEPLOY_PATH'] ?? '/var/www/kistle';

console.log(`Deploye nach ${USER}@${HOST}:${PATH} …`);

try {
  // Zielverzeichnis leeren und Build hochladen
  execSync(`ssh ${USER}@${HOST} "mkdir -p ${PATH} && rm -rf ${PATH}/*"`, { stdio: 'inherit' });
  execSync(`scp -r dist/* ${USER}@${HOST}:${PATH}/`, { stdio: 'inherit' });
  console.log('✓ Deploy erfolgreich');
} catch (err) {
  console.error('Deploy fehlgeschlagen:', err.message);
  process.exit(1);
}
