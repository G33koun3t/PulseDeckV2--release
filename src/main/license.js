const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { machineId } = require('node-machine-id');

// ============================================================
// LEMONSQUEEZY - API de licence
// Aucune config nécessaire côté code, tout se gère sur le dashboard
// ============================================================
const LEMONSQUEEZY_API = 'https://api.lemonsqueezy.com/v1/licenses';

const LICENSE_FILE = 'license.json';
const GRACE_PERIOD_DAYS = 7;

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

// Valider une licence existante (avec instance_id)
async function validateLicense(key, instanceId) {
  const response = await fetch(`${LEMONSQUEEZY_API}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      license_key: key,
      instance_id: instanceId
    })
  });
  return await response.json();
}

// Activer une licence sur cette machine
async function activateOnApi(key) {
  const fingerprint = await generateFingerprint();

  const response = await fetch(`${LEMONSQUEEZY_API}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      license_key: key,
      instance_name: fingerprint
    })
  });

  return { result: await response.json(), fingerprint };
}

// Désactiver une licence
async function deactivateOnApi(key, instanceId) {
  const response = await fetch(`${LEMONSQUEEZY_API}/deactivate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      license_key: key,
      instance_id: instanceId
    })
  });

  return await response.json();
}

// Vérifier la licence au démarrage
async function checkLicense() {
  const license = loadLicense();

  if (!license || !license.key || !license.instanceId) {
    return { valid: false, reason: 'no_license' };
  }

  // Vérifier que le fingerprint correspond à cette machine
  const currentFingerprint = await generateFingerprint();
  if (license.fingerprint !== currentFingerprint) {
    return { valid: false, reason: 'wrong_machine' };
  }

  // Tenter la validation en ligne
  try {
    const result = await validateLicense(license.key, license.instanceId);

    if (result.valid) {
      saveLicense({ ...license, lastValidated: new Date().toISOString() });
      return { valid: true, license };
    }

    // Licence invalide
    const status = result.license_key?.status;
    if (status === 'expired') return { valid: false, reason: 'expired' };
    if (status === 'disabled') return { valid: false, reason: 'suspended' };
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
  let result, fingerprint;
  try {
    ({ result, fingerprint } = await activateOnApi(key));
  } catch {
    return { success: false, error: 'network_error' };
  }

  // Activation réussie
  if (result.activated) {
    const license = {
      key,
      instanceId: result.instance.id,
      fingerprint,
      lastValidated: new Date().toISOString(),
      activatedAt: new Date().toISOString()
    };
    saveLicense(license);
    return { success: true };
  }

  // Erreur
  const errorMsg = result.error || '';

  if (errorMsg.includes('limit')) {
    return { success: false, error: 'already_activated' };
  }
  if (errorMsg.includes('not found') || errorMsg.includes('invalid')) {
    return { success: false, error: 'invalid_key' };
  }
  if (errorMsg.includes('expired')) {
    return { success: false, error: 'expired' };
  }
  if (errorMsg.includes('disabled')) {
    return { success: false, error: 'suspended' };
  }

  return { success: false, error: 'invalid_key' };
}

// Désactiver la licence
async function deactivate() {
  const license = loadLicense();
  if (!license) return { success: false };

  try {
    if (license.instanceId && license.key) {
      await deactivateOnApi(license.key, license.instanceId);
    }
  } catch {
    // Même si l'API échoue, supprimer le fichier local
  }

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
