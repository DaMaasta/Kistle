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

// Erst vollständig in ein Staging-Verzeichnis hochladen, dann auf dem Server lokal
// abgleichen. Bricht der Upload ab (z.B. Tunnel-Aussetzer), bleibt die Live-Seite
// unverändert – vorher wurde sie zuerst geleert und blieb bei einem Abbruch leer.
// PATH selbst wird nicht ausgetauscht, weil nginx das Verzeichnis per Bind-Mount einbindet.
const STAGING = `${PATH}-staging`;

try {
  execSync(`ssh ${USER}@${HOST} "rm -rf ${STAGING} && mkdir -p ${STAGING} ${PATH}"`, { stdio: 'inherit' });
  execSync(`scp -r dist/* ${USER}@${HOST}:${STAGING}/`, { stdio: 'inherit' });
  // --delay-updates: alle neuen Dateien erst am Ende an ihren Platz; --delete-after: alte erst danach entfernen
  execSync(
    `ssh ${USER}@${HOST} "rsync -a --delay-updates --delete-after ${STAGING}/ ${PATH}/ && rm -rf ${STAGING}"`,
    { stdio: 'inherit' }
  );
  console.log('✓ Deploy erfolgreich');
} catch (err) {
  console.error('Deploy fehlgeschlagen:', err.message);
  process.exit(1);
}
