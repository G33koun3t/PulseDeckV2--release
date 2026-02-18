const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('ssh2');

let mainWindow = null;
const connections = new Map(); // hostId -> ssh2.Client

// ========== Config Persistence ==========

function getConfigPath() {
  return path.join(app.getPath('userData'), 'docker-hosts.json');
}

function loadHosts() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
  } catch {
    return [];
  }
}

function saveHosts(hosts) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(hosts, null, 2));
}

// ========== SSH Connection Pool ==========

function connectToHost(hostConfig) {
  return new Promise((resolve, reject) => {
    // Fermer connexion existante si présente
    if (connections.has(hostConfig.id)) {
      try { connections.get(hostConfig.id).end(); } catch {}
      connections.delete(hostConfig.id);
    }

    const conn = new Client();
    const config = {
      host: hostConfig.hostname,
      port: hostConfig.port || 22,
      username: hostConfig.username,
      readyTimeout: 10000,
    };

    if (hostConfig.authType === 'key' && hostConfig.privateKeyPath) {
      try {
        config.privateKey = fs.readFileSync(hostConfig.privateKeyPath);
        if (hostConfig.passphrase) config.passphrase = hostConfig.passphrase;
      } catch (err) {
        return reject(new Error(`Cannot read SSH key: ${err.message}`));
      }
    } else {
      config.password = hostConfig.password;
    }

    conn.on('ready', () => {
      connections.set(hostConfig.id, conn);
      resolve(conn);
    });

    conn.on('error', (err) => {
      connections.delete(hostConfig.id);
      reject(err);
    });

    conn.on('close', () => {
      connections.delete(hostConfig.id);
    });

    conn.connect(config);
  });
}

function disconnectHost(hostId) {
  const conn = connections.get(hostId);
  if (conn) {
    try { conn.end(); } catch {}
    connections.delete(hostId);
  }
}

function disconnectAll() {
  for (const [, conn] of connections) {
    try { conn.end(); } catch {}
  }
  connections.clear();
}

// ========== SSH Command Execution ==========

function execSSH(conn, command, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('SSH command timeout'));
    }, timeout);

    conn.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return reject(err);
      }

      let stdout = '';
      let stderr = '';

      stream.on('data', (data) => { stdout += data.toString(); });
      stream.stderr.on('data', (data) => { stderr += data.toString(); });
      stream.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0 && !stdout) {
          reject(new Error(stderr || `Exit code ${code}`));
        } else {
          resolve({ stdout, stderr, code });
        }
      });
    });
  });
}

// ========== Security ==========

function isValidContainerId(id) {
  return /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(id);
}

// ========== Docker CLI Wrappers ==========

async function listContainers(conn) {
  const { stdout } = await execSSH(conn,
    "docker ps -a --format '{{json .}}'"
  );
  if (!stdout.trim()) return [];
  return stdout.trim().split('\n').filter(Boolean).map(line => {
    const c = JSON.parse(line);
    return {
      id: c.ID,
      name: c.Names,
      image: c.Image,
      status: c.Status,
      state: c.State,
      ports: c.Ports,
      createdAt: c.CreatedAt,
      runningFor: c.RunningFor,
    };
  });
}

async function getContainerStats(conn) {
  const { stdout } = await execSSH(conn,
    "docker stats --no-stream --format '{{json .}}'",
    30000
  );
  if (!stdout.trim()) return [];
  return stdout.trim().split('\n').filter(Boolean).map(line => {
    const s = JSON.parse(line);
    return {
      id: s.ID,
      name: s.Name,
      cpuPerc: s.CPUPerc,
      memUsage: s.MemUsage,
      memPerc: s.MemPerc,
      netIO: s.NetIO,
      blockIO: s.BlockIO,
    };
  });
}

async function inspectContainer(conn, containerId) {
  if (!isValidContainerId(containerId)) throw new Error('Invalid container ID');
  const { stdout } = await execSSH(conn, `docker inspect ${containerId}`);
  const data = JSON.parse(stdout);
  if (!data || !data[0]) throw new Error('Container not found');
  const c = data[0];
  return {
    id: c.Id,
    name: (c.Name || '').replace(/^\//, ''),
    image: c.Config?.Image || '',
    env: c.Config?.Env || [],
    ports: c.NetworkSettings?.Ports || {},
    volumes: (c.Mounts || []).map(m => ({
      source: m.Source,
      destination: m.Destination,
      mode: m.Mode,
      type: m.Type,
    })),
    restartPolicy: c.HostConfig?.RestartPolicy?.Name || 'no',
    state: c.State?.Status,
    startedAt: c.State?.StartedAt,
    finishedAt: c.State?.FinishedAt,
    created: c.Created,
    composeProject: c.Config?.Labels?.['com.docker.compose.project'] || null,
    composeService: c.Config?.Labels?.['com.docker.compose.service'] || null,
    composeWorkingDir: c.Config?.Labels?.['com.docker.compose.project.working_dir'] || null,
  };
}

async function getContainerLogs(conn, containerId, tail = 50) {
  if (!isValidContainerId(containerId)) throw new Error('Invalid container ID');
  const { stdout } = await execSSH(conn,
    `docker logs --tail ${parseInt(tail, 10)} --timestamps ${containerId} 2>&1`,
    30000
  );
  return stdout;
}

async function containerAction(conn, containerId, action) {
  const validActions = ['start', 'stop', 'restart'];
  if (!validActions.includes(action)) throw new Error('Invalid action');
  if (!isValidContainerId(containerId)) throw new Error('Invalid container ID');
  await execSSH(conn, `docker ${action} ${containerId}`, 30000);
}

async function updateContainer(conn, containerId) {
  if (!isValidContainerId(containerId)) throw new Error('Invalid container ID');

  // Récupérer les infos du conteneur (image + labels compose)
  const { stdout } = await execSSH(conn, `docker inspect ${containerId}`);
  const data = JSON.parse(stdout);
  if (!data || !data[0]) throw new Error('Container not found');
  const c = data[0];

  const image = c.Config?.Image || '';
  const composeService = c.Config?.Labels?.['com.docker.compose.service'] || null;
  const composeWorkingDir = c.Config?.Labels?.['com.docker.compose.project.working_dir'] || null;

  if (!image) throw new Error('No image found for container');

  if (composeService && composeWorkingDir) {
    // Docker Compose : pull + recreate
    await execSSH(conn,
      `cd ${composeWorkingDir} && docker compose pull ${composeService} && docker compose up -d ${composeService}`,
      120000
    );
    return { compose: true, pulled: true };
  } else {
    // Standalone : pull uniquement
    await execSSH(conn, `docker pull ${image}`, 120000);
    return { compose: false, pulled: true };
  }
}

// ========== IPC Handlers ==========

function initDocker(win) {
  mainWindow = win;
}

function registerDockerIpc() {
  // Host management
  ipcMain.handle('docker-get-hosts', () => {
    return loadHosts();
  });

  ipcMain.handle('docker-save-hosts', (_event, hosts) => {
    saveHosts(hosts);
    return { success: true };
  });

  // Connection
  ipcMain.handle('docker-connect', async (_event, hostId) => {
    const hosts = loadHosts();
    const host = hosts.find(h => h.id === hostId);
    if (!host) return { success: false, error: 'Host not found' };
    try {
      await connectToHost(host);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('docker-disconnect', (_event, hostId) => {
    disconnectHost(hostId);
    return { success: true };
  });

  ipcMain.handle('docker-test-connection', async (_event, hostConfig) => {
    const conn = new Client();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        try { conn.end(); } catch {}
        resolve({ success: false, error: 'Connection timeout' });
      }, 10000);

      const config = {
        host: hostConfig.hostname,
        port: hostConfig.port || 22,
        username: hostConfig.username,
        readyTimeout: 10000,
      };

      if (hostConfig.authType === 'key' && hostConfig.privateKeyPath) {
        try {
          config.privateKey = fs.readFileSync(hostConfig.privateKeyPath);
          if (hostConfig.passphrase) config.passphrase = hostConfig.passphrase;
        } catch (err) {
          clearTimeout(timer);
          return resolve({ success: false, error: `Cannot read SSH key: ${err.message}` });
        }
      } else {
        config.password = hostConfig.password;
      }

      conn.on('ready', () => {
        clearTimeout(timer);
        // Vérifier que Docker est installé
        conn.exec('docker --version', (err, stream) => {
          if (err) {
            conn.end();
            return resolve({ success: false, error: err.message });
          }
          let out = '';
          stream.on('data', (data) => { out += data.toString(); });
          stream.on('close', (code) => {
            conn.end();
            if (code !== 0) {
              resolve({ success: false, error: 'Docker is not installed on this host' });
            } else {
              resolve({ success: true, dockerVersion: out.trim() });
            }
          });
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timer);
        if (err.level === 'client-authentication') {
          resolve({ success: false, error: 'SSH authentication failed' });
        } else {
          resolve({ success: false, error: err.message });
        }
      });

      conn.connect(config);
    });
  });

  // Container operations
  ipcMain.handle('docker-list-containers', async (_event, hostId) => {
    const conn = connections.get(hostId);
    if (!conn) return { success: false, error: 'Not connected' };
    try {
      const containers = await listContainers(conn);
      return { success: true, data: containers };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('docker-get-stats', async (_event, hostId) => {
    const conn = connections.get(hostId);
    if (!conn) return { success: false, error: 'Not connected' };
    try {
      const stats = await getContainerStats(conn);
      return { success: true, data: stats };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('docker-inspect', async (_event, hostId, containerId) => {
    const conn = connections.get(hostId);
    if (!conn) return { success: false, error: 'Not connected' };
    try {
      const info = await inspectContainer(conn, containerId);
      return { success: true, data: info };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('docker-logs', async (_event, hostId, containerId, tail) => {
    const conn = connections.get(hostId);
    if (!conn) return { success: false, error: 'Not connected' };
    try {
      const logs = await getContainerLogs(conn, containerId, tail || 50);
      return { success: true, data: logs };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('docker-action', async (_event, hostId, containerId, action) => {
    const conn = connections.get(hostId);
    if (!conn) return { success: false, error: 'Not connected' };
    try {
      await containerAction(conn, containerId, action);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('docker-update-container', async (_event, hostId, containerId) => {
    const conn = connections.get(hostId);
    if (!conn) return { success: false, error: 'Not connected' };
    try {
      const result = await updateContainer(conn, containerId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // SSH key file picker
  ipcMain.handle('docker-select-ssh-key', async () => {
    const { dialog } = require('electron');
    const os = require('os');
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select SSH Private Key',
      properties: ['openFile'],
      filters: [{ name: 'All Files', extensions: ['*'] }],
      defaultPath: path.join(os.homedir(), '.ssh'),
    });
    if (result.canceled) return { success: false };
    return { success: true, path: result.filePaths[0] };
  });
}

function stopDocker() {
  disconnectAll();
}

module.exports = { initDocker, registerDockerIpc, stopDocker };
