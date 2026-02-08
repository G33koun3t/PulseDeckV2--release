import React, { useState, useEffect } from 'react';
import { Shield, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from '../i18n';
import './LicenseGate.css';

function LicenseGate({ children }) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(true);
  const [licensed, setLicensed] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [activating, setActivating] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    checkLicense();
  }, []);

  const checkLicense = async () => {
    try {
      const result = await window.electronAPI.checkLicense();
      if (result.valid) {
        setLicensed(true);
      }
    } catch {
      // No license
    }
    setChecking(false);
  };

  const handleActivate = async () => {
    if (!key.trim()) return;
    setError('');
    setActivating(true);

    try {
      const result = await window.electronAPI.activateLicense(key.trim());
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setLicensed(true), 1200);
      } else {
        const errorKey = {
          invalid_key: 'license.invalidKey',
          already_activated: 'license.alreadyActivated',
          network_error: 'license.networkError',
          expired: 'license.expired',
          suspended: 'license.suspended',
          activation_failed: 'license.activationFailed',
        }[result.error] || 'license.invalidKey';
        setError(t(errorKey));
      }
    } catch {
      setError(t('license.networkError'));
    }

    setActivating(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleActivate();
  };

  if (checking) {
    return (
      <div className="license-gate">
        <div className="license-loading">
          <Loader size={32} className="license-spinner" />
        </div>
      </div>
    );
  }

  if (licensed) {
    return children;
  }

  return (
    <div className="license-gate">
      <div className="license-card">
        <div className="license-icon">
          <Shield size={48} />
        </div>
        <h1 className="license-title">Monitoring Dashboard</h1>
        <p className="license-subtitle">{t('license.enterKey')}</p>

        <div className="license-form">
          <input
            type="text"
            className="license-input"
            placeholder={t('license.placeholder')}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={activating}
            autoFocus
          />
          <button
            className="license-btn"
            onClick={handleActivate}
            disabled={activating || !key.trim()}
          >
            {activating ? (
              <>
                <Loader size={18} className="license-spinner" />
                {t('license.activating')}
              </>
            ) : success ? (
              <>
                <CheckCircle size={18} />
                {t('license.success')}
              </>
            ) : (
              t('license.activate')
            )}
          </button>
        </div>

        {error && (
          <div className="license-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default LicenseGate;
