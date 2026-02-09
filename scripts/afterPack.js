const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function (context) {
  if (process.platform !== 'win32') return;

  const exePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`
  );
  const iconPath = path.join(context.packager.projectDir, 'monitoring.ico');

  if (!fs.existsSync(iconPath)) {
    console.warn('[afterPack] monitoring.ico introuvable, icône non modifiée');
    return;
  }

  // Chercher rcedit dans le cache electron-builder
  const cacheDir = path.join(
    process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local'),
    'electron-builder', 'Cache', 'winCodeSign'
  );

  let rceditPath = null;

  if (fs.existsSync(cacheDir)) {
    for (const entry of fs.readdirSync(cacheDir)) {
      const candidate = path.join(cacheDir, entry, 'rcedit-x64.exe');
      if (fs.existsSync(candidate)) {
        rceditPath = candidate;
        break;
      }
    }
  }

  // Fallback : chercher dans node_modules
  if (!rceditPath) {
    const nmCandidate = path.join(context.packager.projectDir, 'node_modules', '@electron', 'rcedit', 'bin', 'rcedit-x64.exe');
    if (fs.existsSync(nmCandidate)) {
      rceditPath = nmCandidate;
    }
  }

  if (!rceditPath) {
    console.warn('[afterPack] rcedit introuvable, icône non modifiée');
    return;
  }

  console.log(`[afterPack] Application de l'icône sur ${path.basename(exePath)}`);
  try {
    execFileSync(rceditPath, [exePath, '--set-icon', iconPath]);
    console.log('[afterPack] Icône appliquée avec succès');
  } catch (err) {
    console.error('[afterPack] Erreur rcedit:', err.message);
  }
};
