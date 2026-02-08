import React, { useState, useEffect } from 'react';
import {
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind,
  Droplets, Thermometer, MapPin, RefreshCw, Settings, X, CloudFog, CloudDrizzle,
  Sunrise, Sunset, Gauge, Umbrella, Eye, EyeOff, ChevronUp, ChevronDown, Calendar, RotateCcw
} from 'lucide-react';
import useModuleConfig from '../hooks/useModuleConfig';
import { useTranslation } from '../i18n';
import appIcon from '../assets/app-icon.ico';
import './Weather.css';

const DEFAULT_WIDGETS = [
  { id: 'current' },
  { id: 'details' },
  { id: 'forecast' },
];

const WIDGET_DEFS = {
  current: { labelKey: 'weather.currentWeather', icon: Sun },
  details: { labelKey: 'weather.details', icon: Gauge },
  forecast: { labelKey: 'weather.forecastWidget', icon: Calendar },
};

// Icônes météo selon le code WMO (Open-Meteo)
const getWeatherIcon = (code, size = 48) => {
  if (code === 0) return <Sun size={size} />;
  if (code === 1 || code === 2) return <Sun size={size} />;
  if (code === 3) return <Cloud size={size} />;
  if (code >= 45 && code <= 48) return <CloudFog size={size} />;
  if (code >= 51 && code <= 55) return <CloudDrizzle size={size} />;
  if (code >= 56 && code <= 57) return <CloudDrizzle size={size} />;
  if (code >= 61 && code <= 65) return <CloudRain size={size} />;
  if (code >= 66 && code <= 67) return <CloudRain size={size} />;
  if (code >= 71 && code <= 77) return <CloudSnow size={size} />;
  if (code >= 80 && code <= 82) return <CloudRain size={size} />;
  if (code >= 85 && code <= 86) return <CloudSnow size={size} />;
  if (code >= 95 && code <= 99) return <CloudLightning size={size} />;
  return <Sun size={size} />;
};

function WeatherModule() {
  const { t, dateLocale, formatTime } = useTranslation();
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [city, setCity] = useState(() => localStorage.getItem('weather_city') || 'Paris');
  const [cityInfo, setCityInfo] = useState(null);
  const [tempCity, setTempCity] = useState(city);
  const { widgets, toggleWidget, moveWidget, resetConfig } = useModuleConfig('weather', DEFAULT_WIDGETS);

  // Résoudre les labels i18n des widgets
  const resolvedWidgetDefs = Object.fromEntries(
    Object.entries(WIDGET_DEFS).map(([id, def]) => [id, { ...def, label: t(def.labelKey) }])
  );

  // Traduction des codes WMO
  const getConditionText = (code) => {
    const key = `weather.condition_${code}`;
    const val = t(key);
    return val !== key ? val : t('weather.conditionUnknown');
  };

  // Jour de la semaine
  const getDayName = (dateStr) => {
    const days = t('weather.days');
    return days[new Date(dateStr).getDay()];
  };

  // Niveau UV
  const getUVLevel = (uv) => {
    if (uv <= 2) return { label: t('weather.uvLow'), color: 'success' };
    if (uv <= 5) return { label: t('weather.uvModerate'), color: 'warning' };
    if (uv <= 7) return { label: t('weather.uvHigh'), color: 'danger' };
    return { label: t('weather.uvVeryHigh'), color: 'danger' };
  };

  // Formater l'heure
  const fmtTime = (isoString) => {
    if (!isoString) return '--:--';
    return formatTime(isoString);
  };

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);

    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=${dateLocale.split('-')[0]}&format=json`
      );

      if (!geoRes.ok) {
        throw new Error(`${t('weather.geocodingError')}: ${geoRes.status}`);
      }

      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(t('weather.cityNotFound'));
      }

      const location = geoData.results[0];
      setCityInfo({
        name: location.name,
        country: location.country_code,
        admin: location.admin1
      });

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,uv_index,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max&timezone=auto&forecast_days=6`;

      const weatherRes = await fetch(weatherUrl);

      if (!weatherRes.ok) {
        throw new Error(`${t('weather.weatherError')}: ${weatherRes.status}`);
      }

      const weatherData = await weatherRes.json();

      setWeather({
        temp: Math.round(weatherData.current.temperature_2m),
        feels_like: Math.round(weatherData.current.apparent_temperature),
        humidity: weatherData.current.relative_humidity_2m,
        wind_speed: Math.round(weatherData.current.wind_speed_10m),
        weather_code: weatherData.current.weather_code,
        temp_min: Math.round(weatherData.daily.temperature_2m_min[0]),
        temp_max: Math.round(weatherData.daily.temperature_2m_max[0]),
        pressure: Math.round(weatherData.current.surface_pressure),
        uv_index: weatherData.current.uv_index || weatherData.daily.uv_index_max?.[0] || 0,
        visibility: weatherData.current.visibility ? Math.round(weatherData.current.visibility / 1000) : null,
        sunrise: weatherData.daily.sunrise?.[0],
        sunset: weatherData.daily.sunset?.[0],
        precipitation_prob: weatherData.daily.precipitation_probability_max?.[0] || 0,
      });

      const dailyForecasts = weatherData.daily.time.slice(1, 6).map((date, index) => ({
        date,
        weather_code: weatherData.daily.weather_code[index + 1],
        temp_max: Math.round(weatherData.daily.temperature_2m_max[index + 1]),
        temp_min: Math.round(weatherData.daily.temperature_2m_min[index + 1]),
        precipitation_prob: weatherData.daily.precipitation_probability_max?.[index + 1] || 0,
      }));
      setForecast(dailyForecasts);

    } catch (err) {
      console.error('Weather fetch error:', err);
      setError(err.message || t('weather.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [city]);

  const handleSaveSettings = () => {
    localStorage.setItem('weather_city', tempCity);
    setCity(tempCity);
    setShowSettings(false);
  };

  if (showSettings) {
    return (
      <div className="weather-module">
        <div className="weather-settings">
          <div className="settings-header">
            <Settings size={20} />
            <span>{t('weather.configTitle')}</span>
            <button className="close-btn" onClick={() => setShowSettings(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="settings-form">
            <div className="form-group">
              <label>{t('weather.city')}</label>
              <input
                type="text"
                value={tempCity}
                onChange={(e) => setTempCity(e.target.value)}
                placeholder="Paris"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveSettings()}
              />
              <small>
                {t('weather.apiNote')}
              </small>
            </div>
            <button className="save-btn" onClick={handleSaveSettings}>
              {t('common.save')}
            </button>

            {/* Widget visibility */}
            <div className="form-group widget-toggles-section">
              <label>{t('weather.displaySections')}</label>
              <div className="widget-toggle-list">
                {widgets.map((widget, index) => {
                  const def = resolvedWidgetDefs[widget.id];
                  if (!def) return null;
                  const IconComp = def.icon;
                  return (
                    <div key={widget.id} className={`widget-toggle-item ${!widget.visible ? 'hidden-widget' : ''}`}>
                      <button
                        className={`widget-toggle-btn ${!widget.visible ? 'off' : ''}`}
                        onClick={() => toggleWidget(widget.id)}
                      >
                        {widget.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <IconComp size={14} className="widget-toggle-icon" />
                      <span className="widget-toggle-label">{def.label}</span>
                      <div className="widget-toggle-arrows">
                        <button className="widget-arrow-btn" onClick={() => moveWidget(widget.id, -1)} disabled={index === 0}>
                          <ChevronUp size={12} />
                        </button>
                        <button className="widget-arrow-btn" onClick={() => moveWidget(widget.id, 1)} disabled={index === widgets.length - 1}>
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="widget-reset-btn" onClick={resetConfig}>
                <RotateCcw size={12} />
                <span>{t('common.resetWidgets')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="weather-module">
        <div className="weather-loading">
          <img src={appIcon} alt="" className="loading-app-icon" />
          <p>{t('weather.loadingWeather')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="weather-module">
        <div className="weather-error">
          <Cloud size={48} />
          <p>{error}</p>
          <button onClick={() => setShowSettings(true)}>{t('common.configure')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="weather-module">
      {/* Header avec ville et actions */}
      <div className="weather-header">
        <div className="location">
          <MapPin size={16} />
          <span>{cityInfo?.name}, {cityInfo?.country}</span>
        </div>
        <div className="weather-actions">
          <button className="action-btn" onClick={fetchWeather} title={t('common.refresh')}>
            <RefreshCw size={16} />
          </button>
          <button className="action-btn" onClick={() => {
            setTempCity(city);
            setShowSettings(true);
          }} title={t('common.settings')}>
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Sections ordonnées et conditionnelles */}
      {widgets.filter(w => w.visible).map(w => {
        if (w.id === 'current') return (
          <div key="current" className="current-weather">
            <div className="weather-main-icon">
              {getWeatherIcon(weather?.weather_code, 100)}
            </div>
            <div className="weather-info">
              <div className="temperature">
                {weather?.temp}°C
              </div>
              <div className="condition">
                {getConditionText(weather?.weather_code)}
              </div>
              <div className="feels-like">
                {t('weather.feelsLike')} {weather?.feels_like}°C
              </div>
            </div>
            <div className="weather-sun-times">
              <div className="sun-time">
                <Sunrise size={20} />
                <span>{fmtTime(weather?.sunrise)}</span>
              </div>
              <div className="sun-time">
                <Sunset size={20} />
                <span>{fmtTime(weather?.sunset)}</span>
              </div>
            </div>
          </div>
        );

        if (w.id === 'details') return (
          <div key="details" className="weather-details-grid">
            <div className="detail-item">
              <Droplets size={22} />
              <div className="detail-content">
                <span className="detail-value">{weather?.humidity}%</span>
                <small>{t('weather.humidity')}</small>
              </div>
            </div>
            <div className="detail-item">
              <Wind size={22} />
              <div className="detail-content">
                <span className="detail-value">{weather?.wind_speed} km/h</span>
                <small>{t('weather.wind')}</small>
              </div>
            </div>
            <div className="detail-item">
              <Umbrella size={22} />
              <div className="detail-content">
                <span className="detail-value">{weather?.precipitation_prob}%</span>
                <small>{t('weather.precipitation')}</small>
              </div>
            </div>
            <div className="detail-item">
              <Gauge size={22} />
              <div className="detail-content">
                <span className="detail-value">{weather?.pressure} hPa</span>
                <small>{t('weather.pressure')}</small>
              </div>
            </div>
            <div className="detail-item">
              <Sun size={22} />
              <div className="detail-content">
                <span className={`detail-value uv-${getUVLevel(weather?.uv_index).color}`}>
                  {weather?.uv_index?.toFixed(1)} <small>({getUVLevel(weather?.uv_index).label})</small>
                </span>
                <small>{t('weather.uvIndex')}</small>
              </div>
            </div>
            <div className="detail-item">
              <Thermometer size={22} />
              <div className="detail-content">
                <span className="detail-value">{weather?.temp_min}° / {weather?.temp_max}°</span>
                <small>{t('weather.minMax')}</small>
              </div>
            </div>
          </div>
        );

        if (w.id === 'forecast' && forecast.length > 0) return (
          <div key="forecast" className="forecast">
            <div className="forecast-title">{t('weather.forecast')}</div>
            <div className="forecast-list">
              {forecast.map((day, index) => (
                <div key={index} className="forecast-item">
                  <span className="forecast-day">{getDayName(day.date)}</span>
                  <div className="forecast-icon">
                    {getWeatherIcon(day.weather_code, 36)}
                  </div>
                  <div className="forecast-temps">
                    <span className="forecast-temp-max">{day.temp_max}°</span>
                    <span className="forecast-temp-min">{day.temp_min}°</span>
                  </div>
                  {day.precipitation_prob > 0 && (
                    <span className="forecast-rain">
                      <Droplets size={12} /> {day.precipitation_prob}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

        return null;
      })}
    </div>
  );
}

export default WeatherModule;
