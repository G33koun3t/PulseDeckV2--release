// Script pour lancer Electron sans ELECTRON_RUN_AS_NODE
const { spawn } = require('child_process');
const path = require('path');

// Supprimer ELECTRON_RUN_AS_NODE de l'environnement
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// Chemin vers l'exécutable Electron
const electronPath = require('electron');

// Lancer Electron
const child = spawn(electronPath, ['.'], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
});

child.on('close', (code) => {
  process.exit(code);
});
