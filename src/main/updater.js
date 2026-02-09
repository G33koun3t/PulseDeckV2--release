const { autoUpdater } = require('electron-updater');
const { app, ipcMain } = require('electron');

let mainWindow = null;

function initUpdater(win) {
  mainWindow = win;

  // Config
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.forceCodeSigning = false;

  // En dev, ne pas vérifier les mises à jour
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  // Événements → forwarded au renderer via IPC
  autoUpdater.on('checking-for-update', () => {
    send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    send('update-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    send('update-status', { status: 'up-to-date' });
  });

  autoUpdater.on('download-progress', (progress) => {
    send('update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send('update-status', { status: 'ready', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    send('update-status', { status: 'error', error: err?.message });
  });

  // Vérifier au démarrage (délai de 5s pour laisser l'app charger)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);
}

function registerUpdaterIpc() {
  ipcMain.handle('check-for-updates', async () => {
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    try {
      return await autoUpdater.checkForUpdates();
    } catch {
      return null;
    }
  });

  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
}

function send(channel, data) {
  if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

module.exports = { initUpdater, registerUpdaterIpc };
