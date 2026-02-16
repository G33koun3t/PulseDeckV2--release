import React, { useEffect, useRef, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DOMAIN_COLORS } from './constants';
import { getSensorIconComponent, formatSensorValue } from './helpers';

export default function SensorDetailModal({ entity, detailedHistory, loading, onClose, t, dateLocale }) {
  const modalRef = useRef(null);

  // Fermer au clic extérieur
  useEffect(() => {
    const handleClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  if (!entity) return null;

  const domain = entity.entity_id.split('.')[0];
  const name = entity.attributes?.friendly_name || entity.entity_id.split('.')[1];
  const unit = entity.attributes?.unit_of_measurement || '';
  const colors = DOMAIN_COLORS[domain] || DOMAIN_COLORS.default;
  const SensorIcon = getSensorIconComponent(entity);

  // Transformer les données pour Recharts
  const { chartData, stats } = useMemo(() => {
    if (!detailedHistory?.points || detailedHistory.points.length < 2) {
      return { chartData: [], stats: null };
    }

    const { points, timestamps } = detailedHistory;
    const data = points.map((value, i) => ({
      time: timestamps[i]
        ? new Date(timestamps[i]).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
        : '',
      value,
    }));

    const min = Math.min(...points);
    const max = Math.max(...points);
    const avg = points.reduce((a, b) => a + b, 0) / points.length;

    return {
      chartData: data,
      stats: { min, max, avg },
    };
  }, [detailedHistory, dateLocale]);

  const gradientId = `sensorGrad-${entity.entity_id.replace(/\./g, '-')}`;

  return (
    <div className="ha-sensor-modal-backdrop">
      <div ref={modalRef} className="ha-sensor-modal">
        {/* Header */}
        <div className="ha-sensor-modal-header">
          <div className="ha-sensor-modal-icon" style={{ background: `${colors.on}22`, color: colors.on }}>
            <SensorIcon size={20} />
          </div>
          <div className="ha-sensor-modal-title">
            <span className="ha-sensor-modal-name">{name}</span>
            <span className="ha-sensor-modal-id">{entity.entity_id}</span>
          </div>
          <button className="ha-sensor-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Valeur actuelle */}
        <div className="ha-sensor-modal-current">
          <span className="ha-sensor-modal-value">{formatSensorValue(entity, t, dateLocale)}</span>
          <span className="ha-sensor-modal-label">{t('homeassistant.detail.current')}</span>
        </div>

        {/* Graphique */}
        <div className="ha-sensor-modal-chart">
          {loading ? (
            <div className="ha-sensor-modal-loading">
              <Loader2 size={24} className="spinning" />
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.on} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={colors.on} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(18, 18, 26, 0.9)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)}${unit ? ' ' + unit : ''}`, name]}
                  labelStyle={{ color: 'var(--text-muted)' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={colors.on}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="ha-sensor-modal-no-data">
              {t('homeassistant.detail.noHistory')}
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="ha-sensor-modal-stats">
            <div className="ha-sensor-modal-stat">
              <span className="ha-sensor-modal-stat-value">{stats.min.toFixed(1)}{unit ? ' ' + unit : ''}</span>
              <span className="ha-sensor-modal-stat-label">{t('homeassistant.detail.min')}</span>
            </div>
            <div className="ha-sensor-modal-stat">
              <span className="ha-sensor-modal-stat-value">{stats.avg.toFixed(1)}{unit ? ' ' + unit : ''}</span>
              <span className="ha-sensor-modal-stat-label">{t('homeassistant.detail.average')}</span>
            </div>
            <div className="ha-sensor-modal-stat">
              <span className="ha-sensor-modal-stat-value">{stats.max.toFixed(1)}{unit ? ' ' + unit : ''}</span>
              <span className="ha-sensor-modal-stat-label">{t('homeassistant.detail.max')}</span>
            </div>
          </div>
        )}

        <div className="ha-sensor-modal-footer">
          {t('homeassistant.detail.last24h')}
        </div>
      </div>
    </div>
  );
}
