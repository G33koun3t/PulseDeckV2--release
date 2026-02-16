import React, { memo } from 'react';
import { EyeOff, ChevronUp, ChevronDown, Square, Palette, Sun } from 'lucide-react';
import { Sparkline } from '../monitoring/shared';
import { DOMAIN_ICONS, DOMAIN_COLORS } from './constants';
import { supportsColor, supportsBrightness, rgbToHex, getSensorIconComponent, getEntityStateText } from './helpers';

const EntityTile = memo(function EntityTile({
  entity, onToggle, onControlCover, onShowColorPopover, onHide, onSensorClick, historyData, t, dateLocale,
}) {
  const domain = entity.entity_id.split('.')[0];
  const isToggleable = ['light', 'switch', 'input_boolean', 'fan'].includes(domain);
  const isCover = domain === 'cover';
  const isSensor = domain === 'sensor' || domain === 'binary_sensor';
  const isOn = entity.state === 'on' || entity.state === 'open' || entity.state === 'opening';
  const name = entity.attributes?.friendly_name || entity.entity_id.split('.')[1];

  const DomainIcon = isSensor ? getSensorIconComponent(entity) : (DOMAIN_ICONS[domain] || DOMAIN_ICONS.default);
  const colors = DOMAIN_COLORS[domain] || DOMAIN_COLORS.default;

  const hasLightColor = domain === 'light' && isOn && entity.attributes?.rgb_color;
  const lightHex = hasLightColor ? rgbToHex(entity.attributes.rgb_color) : null;
  const iconColor = hasLightColor ? lightHex : ((isSensor || isOn) ? colors.on : colors.off);
  const iconBg = hasLightColor ? `${lightHex}22` : ((isSensor || isOn) ? `${colors.on}22` : `${colors.off}22`);

  const isLight = domain === 'light';
  const lightHasControls = isLight && isOn && (supportsColor(entity) || supportsBrightness(entity));

  return (
    <div
      className={`ha-tile ${isToggleable ? 'toggleable' : ''} ${isSensor && historyData ? 'clickable' : ''} ${isOn ? 'on' : 'off'}`}
      onClick={isToggleable ? () => onToggle(entity.entity_id) : (isSensor && onSensorClick ? () => onSensorClick(entity.entity_id) : undefined)}
    >
      <button
        className="ha-tile-hide"
        onClick={(e) => { e.stopPropagation(); onHide(entity.entity_id); }}
        title={t('common.hide')}
      >
        <EyeOff size={12} />
      </button>

      <div className="ha-tile-icon" style={{ background: iconBg, color: iconColor }}>
        <DomainIcon size={20} />
      </div>

      <div className="ha-tile-name" title={name}>{name}</div>

      {isCover ? (
        <div className="ha-tile-cover-controls">
          <button onClick={(e) => { e.stopPropagation(); onControlCover(entity.entity_id, 'open'); }} title={t('homeassistant.open')}>
            <ChevronUp size={16} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onControlCover(entity.entity_id, 'stop'); }} title={t('homeassistant.stop')}>
            <Square size={12} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onControlCover(entity.entity_id, 'close'); }} title={t('homeassistant.closeCover')}>
            <ChevronDown size={16} />
          </button>
        </div>
      ) : (
        <div className={`ha-tile-state ${isOn ? 'on' : 'off'}`}>
          {getEntityStateText(entity, t, dateLocale)}
        </div>
      )}

      {/* Sparkline pour capteurs numériques */}
      {isSensor && historyData && historyData.length >= 2 && (
        <div className="ha-tile-sparkline">
          <Sparkline data={historyData} color={colors.on} fillOpacity={0.2} />
        </div>
      )}

      {lightHasControls && (
        <button
          className="ha-tile-color-btn"
          onClick={(e) => {
            e.stopPropagation();
            onShowColorPopover(entity.entity_id, e);
          }}
          style={{ background: supportsColor(entity) ? (lightHex || colors.on) : 'var(--bg-tertiary)' }}
          title={supportsColor(entity) ? t('homeassistant.color') : t('homeassistant.brightness')}
        >
          {supportsColor(entity) ? <Palette size={12} /> : <Sun size={12} />}
        </button>
      )}
    </div>
  );
}, (prev, next) => {
  // Custom comparison pour éviter les re-renders inutiles
  return (
    prev.entity.state === next.entity.state &&
    prev.entity.last_changed === next.entity.last_changed &&
    prev.entity.attributes?.brightness === next.entity.attributes?.brightness &&
    prev.entity.attributes?.rgb_color === next.entity.attributes?.rgb_color &&
    prev.historyData === next.historyData
  );
});

export default EntityTile;
