const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { machineId } = require('node-machine-id');

// ============================================================
// GUMROAD - API de licence
// Un seul endpoint verify, pas d'activate/deactivate séparés
// ============================================================
const GUMROAD_API = 'https://api.gumroad.com/v2/licenses/verify';
const PRODUCT_ID = 'jyhdsJJ2ecjsN1uboNatRw==';

const LICENSE_FILE = 'license.json';
const GRACE_PERIOD_DAYS = 7;
// Fingerprint machine du développeur — bypass licence
const DEV_FINGERPRINT = '8f773435aa4134de9ef18b79133a1ff30ce2bdb952458dd9b1fa75070a1db46d';

function getLicensePath() {
  return path.join(app.getPath('userData'), LICENSE_FILE);
}

async function generateFingerprint() {
  const id = await machineId();
  return crypto.createHash('sha256').update(id).digest('hex');
}

function loadLicense() {
  try {
    const filePath = getLicensePath();
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveLicense(data) {
  const filePath = getLicensePath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function deleteLicense() {
  const filePath = getLicensePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Appeler l'API Gumroad verify
async function verifyOnApi(key, incrementUses = false) {
  const params = new URLSearchParams();
  params.append('product_id', PRODUCT_ID);
  params.append('license_key', key);
  params.append('increment_uses_count', incrementUses ? 'true' : 'false');

  const response = await fetch(GUMROAD_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  return await response.json();
}

// Vérifier la licence au démarrage
async function checkLicense() {
  const license = loadLicense();

  if (!license || !license.key) {
    return { valid: false, reason: 'no_license' };
  }

  // Machine développeur — bypass API
  const currentFp = await generateFingerprint();
  if (currentFp === DEV_FINGERPRINT) {
    return { valid: true, license };
  }

  // Vérifier que le fingerprint correspond à cette machine
  const currentFingerprint = await generateFingerprint();
  if (license.fingerprint !== currentFingerprint) {
    return { valid: false, reason: 'wrong_machine' };
  }

  // Tenter la validation en ligne (sans incrémenter les uses)
  try {
    const result = await verifyOnApi(license.key, false);

    if (result.success) {
      // Vérifier si remboursé ou contesté
      if (result.purchase?.refunded) {
        return { valid: false, reason: 'refunded' };
      }
      if (result.purchase?.chargebacked) {
        return { valid: false, reason: 'chargebacked' };
      }

      saveLicense({ ...license, lastValidated: new Date().toISOString() });
      return { valid: true, license };
    }

    // Licence invalide
    return { valid: false, reason: 'invalid' };
  } catch {
    // Hors-ligne : vérifier la période de grâce
    if (license.lastValidated) {
      const lastValidated = new Date(license.lastValidated);
      const daysSince = (Date.now() - lastValidated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < GRACE_PERIOD_DAYS) {
        return { valid: true, license, offline: true };
      }
    }
    return { valid: false, reason: 'offline_expired' };
  }
}

// Activer une clé de licence
async function activate(key) {
  // Machine développeur — bypass API
  const devFp = await generateFingerprint();
  if (devFp === DEV_FINGERPRINT) {
    saveLicense({ key, fingerprint: devFp, lastValidated: new Date().toISOString(), activatedAt: new Date().toISOString() });
    return { success: true };
  }

  let result;
  try {
    // Incrémenter les uses pour compter l'activation
    result = await verifyOnApi(key, true);
  } catch {
    return { success: false, error: 'network_error' };
  }

  // Clé valide
  if (result.success) {
    // Vérifier si remboursé ou contesté
    if (result.purchase?.refunded) {
      return { success: false, error: 'refunded' };
    }
    if (result.purchase?.chargebacked) {
      return { success: false, error: 'chargebacked' };
    }

    const fingerprint = await generateFingerprint();
    const license = {
      key,
      fingerprint,
      lastValidated: new Date().toISOString(),
      activatedAt: new Date().toISOString()
    };
    saveLicense(license);
    return { success: true };
  }

  // Erreur
  const errorMsg = (result.message || '').toLowerCase();

  if (errorMsg.includes('not found') || errorMsg.includes('invalid') || errorMsg.includes('does not exist')) {
    return { success: false, error: 'invalid_key' };
  }

  return { success: false, error: 'invalid_key' };
}

// Désactiver la licence (suppression locale uniquement — Gumroad n'a pas d'API deactivate)
async function deactivate() {
  deleteLicense();
  return { success: true };
}

function getLicenseInfo() {
  const license = loadLicense();
  if (!license) return null;

  return {
    key: license.key ? license.key.slice(0, 8) + '...' + license.key.slice(-4) : null,
    fingerprint: license.fingerprint ? license.fingerprint.slice(0, 12) + '...' : null,
    activatedAt: license.activatedAt,
    lastValidated: license.lastValidated
  };
}

module.exports = {
  checkLicense,
  activate,
  deactivate,
  getLicenseInfo,
  generateFingerprint
};
