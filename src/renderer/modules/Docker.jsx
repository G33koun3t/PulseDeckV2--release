import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container, Server, Plus, Settings, X, RefreshCw, Play, Square, RotateCcw,
  FileText, ChevronRight, ChevronDown, Wifi, WifiOff, Trash2, Key,
  AlertCircle, Check, Loader, Eye, EyeOff, Copy, Activity, Download,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import './Docker.css';

const STATUS_COLORS = {
  running: 'var(--success, #22c55e)',
  exited: 'var(--danger, #ef4444)',
  restarting: '#eab308',
  paused: '#f97316',
  dead: 'var(--danger, #ef4444)',
  created: '#6b7280',
};

const STATUS_BG = {
  exited: 'rgba(239, 68, 68, 0.08)',
  dead: 'rgba(239, 68, 68, 0.08)',
  restarting: 'rgba(234, 179, 8, 0.08)',
  paused: 'rgba(249, 115, 22, 0.08)',
};

function formatUptime(startedAt) {
  if (!startedAt) return '';
  const start = new Date(startedAt);
  const now = new Date();
  const diff = now - start;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatPorts(ports) {
  if (!ports || typeof ports !== 'object') return ports || '-';
  if (typeof ports === 'string') return ports || '-';
  return Object.entries(ports)
    .filter(([, bindings]) => bindings && bindings.length > 0)
    .map(([containerPort, bindings]) => {
      const b = bindings[0];
      return `${b.HostPort}:${containerPort}`;
    })
    .join(', ') || '-';
}

// ========== Sub-components ==========

function HostGroup({ host, containers, stats, isConnected, isConnecting, isExpanded, selectedContainer, onToggleExpand, onSelectContainer, onConnect, onEditHost, error, t }) {
  const statsMap = new Map((stats || []).map(s => [s.id, s]));
  const runningCount = containers.filter(c => c.state === 'running').length;
  const totalCount = containers.length;
  const stoppedCount = containers.filter(c => c.state === 'exited' || c.state === 'dead').length;

  return (
    <div className="docker-host-group">
      <div className="docker-host-header" onClick={onToggleExpand}>
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Server size={16} style={{ color: host.color || 'var(--accent-primary)' }} />
        <span className="docker-host-name">{host.name}</span>
        {/* Indicateur global machine */}
        {isConnected && totalCount > 0 && (
          <span className="docker-host-summary">
            <span className="docker-host-summary-running">{runningCount}</span>
            /{totalCount}
            {stoppedCount > 0 && <span className="docker-host-summary-stopped"> ({stoppedCount} off)</span>}
          </span>
        )}
        <span className={`docker-host-status ${isConnected ? 'connected' : ''}`}>
          {isConnecting ? <Loader size={12} className="spin" /> :
           isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
        </span>
        {!isConnected && !isConnecting && (
          <button className="docker-host-connect-btn" onClick={(e) => { e.stopPropagation(); onConnect(); }} title={t('docker.connect')}>
            {t('docker.connect')}
          </button>
        )}
        <button className="docker-host-edit-btn" onClick={(e) => { e.stopPropagation(); onEditHost(); }} title={t('docker.editHost')}>
          <Settings size={12} />
        </button>
      </div>
      {error && <div className="docker-host-error"><AlertCircle size={12} /> {error}</div>}
      {isExpanded && isConnected && (
        <div className="docker-container-list">
          {containers.length === 0 ? (
            <div className="docker-no-containers">{t('docker.noContainers')}</div>
          ) : (
            containers.map(c => {
              const s = statsMap.get(c.id);
              const isSelected = selectedContainer?.containerId === c.id && selectedContainer?.hostId === host.id;
              const bgColor = STATUS_BG[c.state] || undefined;
              return (
                <div
                  key={c.id}
                  className={`docker-container-item ${isSelected ? 'selected' : ''} state-${c.state}`}
                  style={bgColor && !isSelected ? { background: bgColor } : undefined}
                  onClick={() => onSelectContainer(c.id)}
                >
                  <span className="docker-status-dot" style={{ background: STATUS_COLORS[c.state] || '#6b7280' }} />
                  <span className="docker-container-name">{c.name}</span>
                  {s && c.state === 'running' && (
                    <span className="docker-container-mini-stats">
                      {s.cpuPerc} | {s.memPerc}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function ContainerDetail({ details, stats, logs, showLogs, logsAutoRefresh, onFetchLogs, onToggleAutoRefresh, onAction, onUpdate, actionLoading, t }) {
  return (
    <div className="docker-detail-content">
      {/* Header avec nom + actions rapides */}
      <div className="docker-detail-header">
        <div className="docker-detail-title">
          <h3>{details.name}</h3>
          <div className="docker-detail-status">
            <span className="docker-status-badge" style={{ background: STATUS_COLORS[details.state] || '#6b7280' }}>
              {t(`docker.state.${details.state}`) || details.state}
            </span>
            {details.startedAt && details.state === 'running' && (
              <span className="docker-detail-uptime">{formatUptime(details.startedAt)}</span>
            )}
          </div>
        </div>
        {/* Boutons actions rapides toujours visibles */}
        <div className="docker-quick-actions">
          <button
            className="docker-quick-btn docker-quick-start"
            onClick={() => onAction('start')}
            disabled={details.state === 'running' || actionLoading}
            title={t('docker.start')}
          >
            <Play size={18} />
          </button>
          <button
            className="docker-quick-btn docker-quick-stop"
            onClick={() => onAction('stop')}
            disabled={details.state !== 'running' || actionLoading}
            title={t('docker.stop')}
          >
            <Square size={18} />
          </button>
          <button
            className="docker-quick-btn docker-quick-restart"
            onClick={() => onAction('restart')}
            disabled={actionLoading}
            title={t('docker.restart')}
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="docker-quick-btn docker-quick-update"
            onClick={onUpdate}
            disabled={actionLoading}
            title={t('docker.update')}
          >
            <Download size={18} />
          </button>
          <button
            className="docker-quick-btn docker-quick-logs"
            onClick={onFetchLogs}
            title={t('docker.logs')}
          >
            <FileText size={18} />
          </button>
        </div>
      </div>

      {stats && (
        <div className="docker-detail-stats">
          <div className="docker-stat-item">
            <span className="docker-stat-label">CPU</span>
            <span className="docker-stat-value">{stats.cpuPerc}</span>
          </div>
          <div className="docker-stat-item">
            <span className="docker-stat-label">RAM</span>
            <span className="docker-stat-value">{stats.memUsage}</span>
          </div>
          <div className="docker-stat-item">
            <span className="docker-stat-label">Net I/O</span>
            <span className="docker-stat-value">{stats.netIO}</span>
          </div>
          <div className="docker-stat-item">
            <span className="docker-stat-label">Block I/O</span>
            <span className="docker-stat-value">{stats.blockIO}</span>
          </div>
        </div>
      )}

      <div className="docker-detail-grid">
        <div className="docker-detail-row">
          <span>{t('docker.image')}</span>
          <span>{details.image}</span>
        </div>
        <div className="docker-detail-row">
          <span>{t('docker.ports')}</span>
          <span>{formatPorts(details.ports)}</span>
        </div>
        <div className="docker-detail-row">
          <span>{t('docker.volumes')}</span>
          <span>{details.volumes.length > 0 ? details.volumes.map(v => `${v.source} → ${v.destination}`).join(', ') : '-'}</span>
        </div>
        <div className="docker-detail-row">
          <span>{t('docker.restartPolicy')}</span>
          <span>{details.restartPolicy}</span>
        </div>
        <div className="docker-detail-row docker-env-row">
          <span>{t('docker.env')}</span>
          <div className="docker-env-list">
            {details.env.length > 0 ? (
              <>
                {details.env.slice(0, 10).map((e, i) => <code key={i}>{e}</code>)}
                {details.env.length > 10 && <span className="docker-env-more">+{details.env.length - 10}</span>}
              </>
            ) : '-'}
          </div>
        </div>
      </div>

      {/* Mini logs intégrés */}
      {showLogs && (
        <div className="docker-logs">
          <div className="docker-logs-header">
            <h4>{t('docker.logsTitle')}</h4>
            <div className="docker-logs-controls">
              <button
                className={`docker-logs-auto-btn ${logsAutoRefresh ? 'active' : ''}`}
                onClick={onToggleAutoRefresh}
                title="Auto-refresh"
              >
                <RefreshCw size={12} />
                Auto
              </button>
              <button className="docker-logs-refresh-btn" onClick={onFetchLogs} title={t('docker.refreshLogs')}>
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
          <pre className="docker-logs-content">{logs || t('docker.noLogs')}</pre>
        </div>
      )}
    </div>
  );
}

function InfraSynthesis({ containersByHost, statsByHost, hosts, connectedHosts, t }) {
  let totalContainers = 0;
  let running = 0;
  let stopped = 0;
  let restarting = 0;

  Object.values(containersByHost).forEach(arr => {
    totalContainers += arr.length;
    arr.forEach(c => {
      if (c.state === 'running') running++;
      else if (c.state === 'exited' || c.state === 'dead') stopped++;
      else if (c.state === 'restarting') restarting++;
    });
  });

  const connectedCount = connectedHosts.size;
  const totalHosts = hosts.length;

  if (totalHosts === 0) return null;

  return (
    <div className="docker-infra-bar">
      <div className="docker-infra-item">
        <Server size={14} />
        <span>{connectedCount}/{totalHosts} {t('docker.infraHosts')}</span>
      </div>
      <div className="docker-infra-sep" />
      <div className="docker-infra-item">
        <Container size={14} />
        <span>{totalContainers} containers</span>
      </div>
      <div className="docker-infra-sep" />
      <div className="docker-infra-item docker-infra-running">
        <span className="docker-infra-dot" style={{ background: 'var(--success, #22c55e)' }} />
        <span>{running} running</span>
      </div>
      {stopped > 0 && (
        <>
          <div className="docker-infra-sep" />
          <div className="docker-infra-item docker-infra-stopped">
            <span className="docker-infra-dot" style={{ background: 'var(--danger, #ef4444)' }} />
            <span>{stopped} stopped</span>
          </div>
        </>
      )}
      {restarting > 0 && (
        <>
          <div className="docker-infra-sep" />
          <div className="docker-infra-item docker-infra-restarting">
            <span className="docker-infra-dot" style={{ background: '#eab308' }} />
            <span>{restarting} restarting</span>
          </div>
        </>
      )}
    </div>
  );
}

function HostConfigOverlay({ host, onSave, onDelete, onClose, t }) {
  const [form, setForm] = useState(host || {
    name: '',
    hostname: '',
    port: 22,
    username: 'root',
    authType: 'password',
    password: '',
    privateKeyPath: '',
    passphrase: '',
    color: '#6366f1',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const updateField = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.dockerTestConnection(form);
      setTestResult(result);
    } catch {
      setTestResult({ success: false, error: 'Test failed' });
    }
    setTesting(false);
  };

  const handleSelectKey = async () => {
    const result = await window.electronAPI.dockerSelectSshKey();
    if (result.success) {
      updateField('privateKeyPath', result.path);
    }
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.hostname.trim() || !form.username.trim()) return;
    onSave(form);
  };

  return (
    <div className="docker-overlay" onClick={onClose}>
      <div className="docker-overlay-content" onClick={(e) => e.stopPropagation()}>
        <div className="docker-overlay-header">
          <h3>{host ? t('docker.editHost') : t('docker.addHost')}</h3>
          <button className="docker-overlay-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="docker-config-form">
          <div className="docker-config-field">
            <label>{t('docker.hostName')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={t('docker.hostNamePlaceholder')}
            />
          </div>

          <div className="docker-config-row">
            <div className="docker-config-field" style={{ flex: 1 }}>
              <label>{t('docker.hostname')}</label>
              <input
                type="text"
                value={form.hostname}
                onChange={(e) => updateField('hostname', e.target.value)}
                placeholder={t('docker.hostnamePlaceholder')}
              />
            </div>
            <div className="docker-config-field" style={{ width: 80 }}>
              <label>{t('docker.port')}</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => updateField('port', parseInt(e.target.value, 10) || 22)}
              />
            </div>
          </div>

          <div className="docker-config-field">
            <label>{t('docker.username')}</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => updateField('username', e.target.value)}
            />
          </div>

          <div className="docker-config-field">
            <label>{t('docker.authType')}</label>
            <div className="docker-auth-toggle">
              <button
                className={form.authType === 'password' ? 'active' : ''}
                onClick={() => updateField('authType', 'password')}
              >
                {t('docker.authPassword')}
              </button>
              <button
                className={form.authType === 'key' ? 'active' : ''}
                onClick={() => updateField('authType', 'key')}
              >
                <Key size={14} /> {t('docker.authKey')}
              </button>
            </div>
          </div>

          {form.authType === 'password' ? (
            <div className="docker-config-field">
              <label>{t('docker.password')}</label>
              <div className="docker-password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                />
                <button className="docker-password-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="docker-config-field">
                <label>{t('docker.privateKey')}</label>
                <div className="docker-key-field">
                  <input
                    type="text"
                    value={form.privateKeyPath}
                    onChange={(e) => updateField('privateKeyPath', e.target.value)}
                    readOnly
                  />
                  <button onClick={handleSelectKey}>{t('docker.selectKey')}</button>
                </div>
              </div>
              <div className="docker-config-field">
                <label>{t('docker.passphrase')}</label>
                <input
                  type="password"
                  value={form.passphrase}
                  onChange={(e) => updateField('passphrase', e.target.value)}
                  placeholder={t('docker.passphrase')}
                />
              </div>
            </>
          )}

          <div className="docker-config-field">
            <label>{t('docker.hostColor')}</label>
            <input
              type="color"
              value={form.color}
              onChange={(e) => updateField('color', e.target.value)}
              className="docker-color-input"
            />
          </div>

          <div className="docker-config-actions">
            <button className="docker-test-btn" onClick={handleTest} disabled={testing}>
              {testing ? <Loader size={14} className="spin" /> : <Wifi size={14} />}
              {t('docker.testConnection')}
            </button>
            {testResult && (
              <span className={`docker-test-result ${testResult.success ? 'success' : 'fail'}`}>
                {testResult.success ? (
                  <><Check size={14} /> {t('docker.testSuccess')}{testResult.dockerVersion ? ` (${testResult.dockerVersion})` : ''}</>
                ) : (
                  <><AlertCircle size={14} /> {testResult.error}</>
                )}
              </span>
            )}
          </div>

          <div className="docker-config-footer">
            {host && onDelete && !confirmingDelete && (
              <button className="docker-delete-btn" onClick={() => setConfirmingDelete(true)}>
                <Trash2 size={14} /> {t('docker.deleteHost')}
              </button>
            )}
            {confirmingDelete && (
              <div className="docker-delete-confirm">
                <span>{t('docker.confirmDelete')}</span>
                <button className="docker-delete-btn docker-delete-confirm-yes" onClick={() => { setConfirmingDelete(false); onDelete(); }}>
                  {t('common.yes') || 'Oui'}
                </button>
                <button className="docker-cancel-btn" onClick={() => setConfirmingDelete(false)}>
                  {t('common.no') || 'Non'}
                </button>
              </div>
            )}
            <div style={{ flex: 1 }} />
            <button className="docker-cancel-btn" onClick={onClose}>{t('common.cancel') || 'Annuler'}</button>
            <button className="docker-save-btn" onClick={handleSave}>
              <Check size={14} /> {t('common.save') || 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Main Component ==========

function DockerModule({ isActive }) {
  const { t } = useTranslation();

  // Hosts config
  const [hosts, setHosts] = useState([]);
  const [connectedHosts, setConnectedHosts] = useState(new Set());
  const [connectingHosts, setConnectingHosts] = useState(new Set());

  // Container data per host
  const [containersByHost, setContainersByHost] = useState({});
  const [statsByHost, setStatsByHost] = useState({});

  // UI state
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [containerDetails, setContainerDetails] = useState(null);
  const [containerLogs, setContainerLogs] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [editingHost, setEditingHost] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(false);
  const [expandedHosts, setExpandedHosts] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(null);
  const [errors, setErrors] = useState({});

  const pollRef = useRef(null);
  const statsRef = useRef(null);
  const logsRef = useRef(null);
  const connectedRef = useRef(connectedHosts);
  const containersByHostRef = useRef(containersByHost);

  // Keep refs in sync
  useEffect(() => { connectedRef.current = connectedHosts; }, [connectedHosts]);
  useEffect(() => { containersByHostRef.current = containersByHost; }, [containersByHost]);

  // Load hosts on mount
  useEffect(() => {
    if (!window.electronAPI?.dockerGetHosts) return;
    window.electronAPI.dockerGetHosts().then((h) => {
      setHosts(h || []);
      // Auto-expand all hosts
      setExpandedHosts(new Set((h || []).map(host => host.id)));
    });
  }, []);

  // Auto-connect when hosts load
  useEffect(() => {
    hosts.forEach(host => {
      if (!connectedHosts.has(host.id) && !connectingHosts.has(host.id)) {
        connectHost(host.id);
      }
    });
  }, [hosts]);

  const connectHost = useCallback(async (hostId) => {
    setConnectingHosts(prev => new Set([...prev, hostId]));
    setErrors(prev => { const n = { ...prev }; delete n[hostId]; return n; });
    try {
      const result = await window.electronAPI.dockerConnect(hostId);
      if (result.success) {
        setConnectedHosts(prev => new Set([...prev, hostId]));
        fetchContainers(hostId);
      } else {
        setErrors(prev => ({ ...prev, [hostId]: result.error }));
      }
    } catch (err) {
      setErrors(prev => ({ ...prev, [hostId]: err.message }));
    }
    setConnectingHosts(prev => {
      const n = new Set(prev);
      n.delete(hostId);
      return n;
    });
  }, []);

  const fetchContainers = useCallback(async (hostId) => {
    try {
      const result = await window.electronAPI.dockerListContainers(hostId);
      if (result.success) {
        setContainersByHost(prev => ({ ...prev, [hostId]: result.data }));
      }
    } catch {}
  }, []);

  const fetchStats = useCallback(async (hostId) => {
    try {
      const result = await window.electronAPI.dockerGetStats(hostId);
      if (result.success) {
        setStatsByHost(prev => ({ ...prev, [hostId]: result.data }));
      }
    } catch {}
  }, []);

  // Container list polling: every 30s (only when visible)
  useEffect(() => {
    if (!isActive || connectedHosts.size === 0) return;

    const fetchAll = () => {
      for (const hostId of connectedRef.current) {
        fetchContainers(hostId);
      }
    };

    pollRef.current = setInterval(fetchAll, 30000);
    return () => clearInterval(pollRef.current);
  }, [isActive, connectedHosts.size, fetchContainers]);

  // Stats polling: every 10s (only when visible)
  useEffect(() => {
    if (!isActive || connectedHosts.size === 0) return;

    const fetchAllStats = () => {
      for (const hostId of connectedRef.current) {
        const containers = containersByHostRef.current[hostId] || [];
        if (containers.some(c => c.state === 'running')) {
          fetchStats(hostId);
        }
      }
    };

    fetchAllStats();
    statsRef.current = setInterval(fetchAllStats, 10000);
    return () => clearInterval(statsRef.current);
  }, [isActive, connectedHosts.size, fetchStats]);

  // Logs auto-refresh: every 5s (only when visible)
  useEffect(() => {
    if (!isActive || !logsAutoRefresh || !selectedContainer) {
      clearInterval(logsRef.current);
      return;
    }

    const refreshLogs = async () => {
      const { hostId, containerId } = selectedContainer;
      try {
        const result = await window.electronAPI.dockerLogs(hostId, containerId, 50);
        if (result.success) {
          setContainerLogs(result.data);
        }
      } catch {}
    };

    logsRef.current = setInterval(refreshLogs, 5000);
    return () => clearInterval(logsRef.current);
  }, [logsAutoRefresh, selectedContainer]);

  const selectContainer = useCallback(async (hostId, containerId) => {
    setSelectedContainer({ hostId, containerId });
    setShowLogs(false);
    setLogsAutoRefresh(false);
    setContainerLogs('');
    setContainerDetails(null);

    try {
      const result = await window.electronAPI.dockerInspect(hostId, containerId);
      if (result.success) {
        setContainerDetails(result.data);
      }
    } catch {}
  }, []);

  const handleAction = useCallback(async (action) => {
    if (!selectedContainer) return;
    const { hostId, containerId } = selectedContainer;
    setActionLoading(action);
    try {
      await window.electronAPI.dockerAction(hostId, containerId, action);
      // Refresh after action
      setTimeout(() => {
        fetchContainers(hostId);
        fetchStats(hostId);
        // Refresh details
        selectContainer(hostId, containerId);
      }, 1500);
    } catch {}
    setActionLoading(null);
  }, [selectedContainer, fetchContainers, fetchStats, selectContainer]);

  const handleUpdate = useCallback(async () => {
    if (!selectedContainer) return;
    const { hostId, containerId } = selectedContainer;
    setActionLoading('update');
    try {
      await window.electronAPI.dockerUpdateContainer(hostId, containerId);
      // Refresh after update (délai plus long car pull peut prendre du temps)
      setTimeout(() => {
        fetchContainers(hostId);
        fetchStats(hostId);
        selectContainer(hostId, containerId);
      }, 2000);
    } catch {}
    setActionLoading(null);
  }, [selectedContainer, fetchContainers, fetchStats, selectContainer]);

  const fetchLogs = useCallback(async () => {
    if (!selectedContainer) return;
    const { hostId, containerId } = selectedContainer;
    try {
      const result = await window.electronAPI.dockerLogs(hostId, containerId, 50);
      if (result.success) {
        setContainerLogs(result.data);
        setShowLogs(true);
      }
    } catch {}
  }, [selectedContainer]);

  const toggleExpandHost = useCallback((hostId) => {
    setExpandedHosts(prev => {
      const n = new Set(prev);
      if (n.has(hostId)) n.delete(hostId);
      else n.add(hostId);
      return n;
    });
  }, []);

  const saveHost = useCallback(async (formData) => {
    const isNew = !formData.id;
    const hostData = {
      ...formData,
      id: formData.id || crypto.randomUUID(),
    };

    const updatedHosts = isNew
      ? [...hosts, hostData]
      : hosts.map(h => h.id === hostData.id ? hostData : h);

    setHosts(updatedHosts);
    await window.electronAPI.dockerSaveHosts(updatedHosts);
    setShowConfig(false);
    setEditingHost(null);
    setExpandedHosts(prev => new Set([...prev, hostData.id]));

    // Auto-connect new host
    if (isNew) {
      connectHost(hostData.id);
    }
  }, [hosts, connectHost]);

  const deleteHost = useCallback(async (hostId) => {
    // Disconnect first
    await window.electronAPI.dockerDisconnect(hostId);
    setConnectedHosts(prev => {
      const n = new Set(prev);
      n.delete(hostId);
      return n;
    });

    const updatedHosts = hosts.filter(h => h.id !== hostId);
    setHosts(updatedHosts);
    await window.electronAPI.dockerSaveHosts(updatedHosts);
    setEditingHost(null);
    setShowConfig(false);

    // Clear selection if it was on this host
    if (selectedContainer?.hostId === hostId) {
      setSelectedContainer(null);
      setContainerDetails(null);
    }
  }, [hosts, selectedContainer]);

  const findStats = useCallback(() => {
    if (!selectedContainer) return null;
    const hostStats = statsByHost[selectedContainer.hostId] || [];
    return hostStats.find(s => s.id === selectedContainer.containerId);
  }, [selectedContainer, statsByHost]);

  return (
    <div className="docker-container" style={{ position: 'relative' }}>
      {/* Header */}
      <div className="docker-header">
        <h2>
          <Container size={20} />
          {t('docker.title')}
        </h2>
        <button className="docker-add-btn" onClick={() => setShowConfig(true)}>
          <Plus size={16} /> {t('docker.addHost')}
        </button>
      </div>

      {/* Infrastructure synthesis bar */}
      <InfraSynthesis
        containersByHost={containersByHost}
        statsByHost={statsByHost}
        hosts={hosts}
        connectedHosts={connectedHosts}
        t={t}
      />

      <div className="docker-body">
        {/* Left panel: Host tree */}
        <div className="docker-sidebar">
          {hosts.length === 0 ? (
            <div className="docker-empty">
              <Server size={48} />
              <p>{t('docker.noHosts')}</p>
              <p className="docker-empty-hint">{t('docker.noHostsHint')}</p>
              <button className="docker-empty-btn" onClick={() => setShowConfig(true)}>
                <Plus size={16} /> {t('docker.addHost')}
              </button>
            </div>
          ) : (
            hosts.map(host => (
              <HostGroup
                key={host.id}
                host={host}
                containers={containersByHost[host.id] || []}
                stats={statsByHost[host.id] || []}
                isConnected={connectedHosts.has(host.id)}
                isConnecting={connectingHosts.has(host.id)}
                isExpanded={expandedHosts.has(host.id)}
                selectedContainer={selectedContainer}
                onToggleExpand={() => toggleExpandHost(host.id)}
                onSelectContainer={(cId) => selectContainer(host.id, cId)}
                onConnect={() => connectHost(host.id)}
                onEditHost={() => setEditingHost(host)}
                error={errors[host.id]}
                t={t}
              />
            ))
          )}
        </div>

        {/* Right panel: Container detail */}
        <div className="docker-detail">
          {selectedContainer && containerDetails ? (
            <ContainerDetail
              details={containerDetails}
              stats={findStats()}
              logs={containerLogs}
              showLogs={showLogs}
              logsAutoRefresh={logsAutoRefresh}
              onFetchLogs={fetchLogs}
              onToggleAutoRefresh={() => setLogsAutoRefresh(prev => !prev)}
              onAction={handleAction}
              onUpdate={handleUpdate}
              actionLoading={actionLoading}
              t={t}
            />
          ) : (
            <div className="docker-detail-empty">
              <Container size={48} />
              <p>{t('docker.selectContainer')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Config overlay */}
      {(showConfig || editingHost) && (
        <HostConfigOverlay
          host={editingHost}
          onSave={saveHost}
          onDelete={editingHost ? () => deleteHost(editingHost.id) : null}
          onClose={() => { setShowConfig(false); setEditingHost(null); }}
          t={t}
        />
      )}
    </div>
  );
}

export default DockerModule;
