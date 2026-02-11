import React, { memo } from 'react';

// Formater les vitesses réseau
export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024 / 1024 / 1024).toFixed(2)} GB/s`;
}

// Couleur dynamique selon seuil (la couleur custom remplace la couleur normale <50%)
export function thresholdColor(value, customColor = '#6366f1') {
  if (value > 80) return '#ef4444';
  if (value > 50) return '#f59e0b';
  return customColor;
}

// Mini jauge circulaire (existante, extraite)
export const MiniGauge = memo(function MiniGauge({ value, size = 56, strokeWidth = 5, color, label }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / 100, 1);
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="mini-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--bg-tertiary)" strokeWidth={strokeWidth}
        />
        <circle
          className="mini-gauge-fill"
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
      </svg>
      <div className="mini-gauge-text">
        <span className="mini-gauge-value" style={{ color }}>{Math.round(value)}%</span>
      </div>
      {label && <span className="mini-gauge-label">{label}</span>}
    </div>
  );
});

// Grande jauge circulaire (nouveau, pour modes gauges/dashboard)
export const LargeGauge = memo(function LargeGauge({ value, size = 120, strokeWidth = 10, color, label, sublabel }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / 100, 1);
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="large-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--bg-tertiary)" strokeWidth={strokeWidth}
        />
        <circle
          className="large-gauge-fill"
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
      </svg>
      <div className="large-gauge-text">
        <span className="large-gauge-value" style={{ color }}>{Math.round(value)}%</span>
        {label && <span className="large-gauge-label">{label}</span>}
      </div>
      {sublabel && <span className="large-gauge-sublabel">{sublabel}</span>}
    </div>
  );
});

// Barre horizontale avec label et valeur
export const HBar = memo(function HBar({ value, max = 100, color, label, detail, className = '' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={`hbar-row ${className}`}>
      <div className="hbar-info">
        <span className="hbar-label">{label}</span>
        {detail && <span className="hbar-detail">{detail}</span>}
      </div>
      <div className="hbar-track">
        <div className="hbar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="hbar-value" style={{ color }}>{Math.round(pct)}%</span>
    </div>
  );
});

// Sparkline SVG - mini area chart responsive
export const Sparkline = memo(function Sparkline({ data, color = '#6366f1', fillOpacity = 0.15 }) {
  if (!data || data.length < 2) return null;

  const vw = 200;
  const vh = 50;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * vw;
    const y = vh * (1 - (v - min) / range);
    return [x, y];
  });

  const line = pts.map(p => p.join(',')).join(' ');
  const area = `0,${vh} ${line} ${vw},${vh}`;

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none" className="sparkline-svg">
      <polygon points={area} fill={color} opacity={fillOpacity} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
});

// Jauge semi-circulaire (style compteur/speedomètre)
export const SemiGauge = memo(function SemiGauge({ value, size = 120, strokeWidth = 10, color, label, displayValue, unit = '%' }) {
  const r = (size - strokeWidth) / 2;
  const halfCirc = Math.PI * r;
  const pct = Math.min(Math.max(value, 0), 100);
  const fillLen = (pct / 100) * halfCirc;
  const cx = size / 2;
  const cy = r + strokeWidth / 2;
  const viewBoxH = cy + strokeWidth / 2;

  const arcPath = `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`;
  const display = displayValue !== undefined ? displayValue : pct.toFixed(pct >= 100 ? 0 : 1);

  return (
    <div className="semi-gauge" style={{ width: size }}>
      <svg width={size} height={viewBoxH} viewBox={`0 0 ${size} ${viewBoxH}`}>
        <path d={arcPath} fill="none" stroke="var(--bg-tertiary)" strokeWidth={strokeWidth} strokeLinecap="round" />
        {pct > 0 && (
          <path d={arcPath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={`${fillLen} ${halfCirc}`}
            className="semi-gauge-fill"
          />
        )}
      </svg>
      <div className="semi-gauge-info">
        <span className="semi-gauge-value" style={{ color }}>{display}<span className="semi-gauge-unit">{unit}</span></span>
      </div>
      <span className="semi-gauge-label">{label}</span>
    </div>
  );
});

// Couleurs par défaut des widgets
export const DEFAULT_WIDGET_COLORS = {
  cpu: { primary: '#6366f1' },
  gpu: { primary: '#22c55e' },
  ram: { primary: '#8b5cf6' },
  network: { primary: '#3b82f6', secondary: '#f59e0b' },
  disks: { primary: '#6366f1' },
  networkDisks: { primary: '#6366f1' },
  perf: { primary: '#6366f1', secondary: '#22c55e' },
  speedtest: { primary: '#3b82f6' },
};

// Récupérer la couleur d'un widget (avec fallback)
export function getWidgetColor(widgetColors, widgetId, slot = 'primary') {
  return widgetColors?.[widgetId]?.[slot] || DEFAULT_WIDGET_COLORS[widgetId]?.[slot] || '#6366f1';
}
