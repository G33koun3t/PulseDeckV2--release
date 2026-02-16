import { SENSOR_ICONS } from './constants';

// Helpers couleur lumières
export const supportsColor = (entity) => {
  const modes = entity.attributes?.supported_color_modes || [];
  return modes.some(m => ['rgb', 'hs', 'xy', 'rgbw', 'rgbww'].includes(m));
};

export const supportsBrightness = (entity) => {
  const modes = entity.attributes?.supported_color_modes || [];
  return modes.some(m => m !== 'onoff');
};

export const rgbToHex = (rgb) => {
  if (!rgb || rgb.length < 3) return '#ffffff';
  return '#' + rgb.slice(0, 3).map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
};

export const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

// Formater une valeur de capteur
export const formatSensorValue = (entity, t, dateLocale) => {
  const state = entity.state;
  const unit = entity.attributes?.unit_of_measurement || '';
  const deviceClass = entity.attributes?.device_class;

  if (state === 'unavailable' || state === 'unknown') {
    return t('homeassistant.na');
  }

  if (deviceClass === 'timestamp' || state.match(/^\d{4}-\d{2}-\d{2}T/)) {
    try {
      const date = new Date(state);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(dateLocale, {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });
      }
    } catch { /* fallback to raw */ }
  }

  const num = parseFloat(state);
  if (!isNaN(num) && state.includes('.')) {
    return `${num.toFixed(1)}${unit ? ' ' + unit : ''}`;
  }

  return `${state}${unit ? ' ' + unit : ''}`;
};

// Obtenir le composant icône d'un capteur
export const getSensorIconComponent = (entity) => {
  const deviceClass = entity.attributes?.device_class;
  return SENSOR_ICONS[deviceClass] || SENSOR_ICONS.default;
};

// Traduire l'état d'une entité
export const getEntityStateText = (entity, t, dateLocale) => {
  const state = entity.state;
  const domain = entity.entity_id.split('.')[0];
  if (domain === 'sensor' || domain === 'binary_sensor') {
    return formatSensorValue(entity, t, dateLocale);
  }
  const key = `homeassistant.states.${state}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return state ? state.charAt(0).toUpperCase() + state.slice(1) : t('homeassistant.na');
};

// Trier les entités : ON/OPEN en premier, puis par nom
export const sortEntities = (a, b) => {
  const isOnA = a.state === 'on' || a.state === 'open' || a.state === 'opening';
  const isOnB = b.state === 'on' || b.state === 'open' || b.state === 'opening';
  if (isOnA && !isOnB) return -1;
  if (!isOnA && isOnB) return 1;
  const nameA = a.attributes?.friendly_name || a.entity_id;
  const nameB = b.attributes?.friendly_name || b.entity_id;
  return nameA.localeCompare(nameB);
};
