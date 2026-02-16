import {
  Lightbulb, Power, Gauge, AlertCircle, Thermometer, Droplets,
  Wind, Zap, Sun, ToggleRight, Home, Activity, Battery, Clock,
} from 'lucide-react';

// Icônes par domaine
export const DOMAIN_ICONS = {
  light: Lightbulb,
  switch: Power,
  sensor: Gauge,
  binary_sensor: AlertCircle,
  climate: Thermometer,
  fan: Wind,
  cover: Home,
  media_player: Activity,
  automation: Zap,
  scene: Sun,
  script: Zap,
  input_boolean: ToggleRight,
  default: Home,
};

// Icônes pour les capteurs selon leur classe
export const SENSOR_ICONS = {
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  power: Zap,
  energy: Zap,
  battery: Battery,
  illuminance: Sun,
  timestamp: Clock,
  default: Gauge,
};

// Couleurs par domaine et état
export const DOMAIN_COLORS = {
  light:         { on: '#FFC107', off: '#555' },
  switch:        { on: '#3b82f6', off: '#555' },
  input_boolean: { on: '#3b82f6', off: '#555' },
  fan:           { on: '#06b6d4', off: '#555' },
  cover:         { on: '#8b5cf6', off: '#555' },
  climate:       { on: '#ef4444', off: '#555' },
  sensor:        { on: '#10b981', off: '#555' },
  binary_sensor: { on: '#f97316', off: '#555' },
  automation:    { on: '#eab308', off: '#555' },
  scene:         { on: '#eab308', off: '#555' },
  script:        { on: '#eab308', off: '#555' },
  media_player:  { on: '#3b82f6', off: '#555' },
  default:       { on: '#6366f1', off: '#555' },
};

// Tous les domaines configurables
export const ALL_DOMAINS = [
  'light', 'switch', 'sensor', 'binary_sensor', 'climate',
  'fan', 'cover', 'media_player', 'automation', 'scene', 'script', 'input_boolean',
];
