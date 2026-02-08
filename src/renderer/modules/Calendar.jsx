import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Clock, Plus, X, Trash2, Settings, RefreshCw,
  LogIn, LogOut, Loader, CheckCircle
} from 'lucide-react';
import './Calendar.css';
import { useTranslation } from '../i18n';

// Couleurs prédéfinies pour les calendriers
const CALENDAR_COLORS = [
  '#4285f4', '#ea4335', '#fbbc04', '#34a853',
  '#ff6d01', '#46bdc6', '#7986cb', '#e67c73',
  '#f06292', '#a1887f', '#8e24aa', '#039be5',
];

// Calendrier par défaut
const DEFAULT_CALENDARS = [
  {
    id: 'cal-default',
    name: 'Personnel',
    url: '',
    color: '#4285f4',
    enabled: true,
  }
];

// Obtenir les jours du mois
const getDaysInMonth = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const days = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({
      day: prevMonthLastDay - i,
      currentMonth: false,
      date: new Date(year, month - 1, prevMonthLastDay - i)
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      day: i,
      currentMonth: true,
      date: new Date(year, month, i)
    });
  }

  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      day: i,
      currentMonth: false,
      date: new Date(year, month + 1, i)
    });
  }

  return days;
};

const dateToKey = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const isSameDay = (date1, date2) => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

// Extraire l'heure d'une date ISO
const getTimeFromISO = (isoString) => {
  if (!isoString) return '00:00';
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

function CalendarModule() {
  const { t, dateLocale, formatDate } = useTranslation();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);

  // Événements locaux
  const [localEvents, setLocalEvents] = useState(() => {
    const saved = localStorage.getItem('calendar_events');
    return saved ? JSON.parse(saved) : {};
  });

  // Multi-calendriers
  const [calendars, setCalendars] = useState(() => {
    const saved = localStorage.getItem('calendar_list');
    if (saved) {
      try { return JSON.parse(saved); } catch { return DEFAULT_CALENDARS; }
    }
    // Migration depuis l'ancien format (single URL)
    const oldUrl = localStorage.getItem('google_calendar_ics');
    if (oldUrl) {
      return [{ id: 'cal-default', name: 'Personnel', url: oldUrl, color: '#4285f4', enabled: true }];
    }
    return DEFAULT_CALENDARS;
  });

  // Événements par calendrier { calId: { dateKey: [events] } }
  const [calendarEvents, setCalendarEvents] = useState({});
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  // Google Auth
  const [googleConnected, setGoogleConnected] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // UI
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('12:00');
  const [newEventEndTime, setNewEventEndTime] = useState('13:00');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // Settings state
  const [tempCalendars, setTempCalendars] = useState(calendars);
  const [newCalName, setNewCalName] = useState('');
  const [newCalUrl, setNewCalUrl] = useState('');
  const [newCalColor, setNewCalColor] = useState('#ea4335');

  // Sauvegarder les événements locaux
  useEffect(() => {
    localStorage.setItem('calendar_events', JSON.stringify(localEvents));
  }, [localEvents]);

  // Sauvegarder la liste des calendriers
  useEffect(() => {
    localStorage.setItem('calendar_list', JSON.stringify(calendars));
  }, [calendars]);

  // Vérifier le statut Google Auth au démarrage
  useEffect(() => {
    checkGoogleAuth();
  }, []);

  const checkGoogleAuth = async () => {
    if (!window.electronAPI?.googleAuthStatus) return;
    try {
      const result = await window.electronAPI.googleAuthStatus();
      setGoogleConnected(result.connected);
    } catch (e) {
      console.error('Erreur vérification auth Google:', e);
    }
  };

  const handleGoogleLogin = async () => {
    if (!window.electronAPI?.googleAuthStart) return;
    setIsAuthLoading(true);
    try {
      const result = await window.electronAPI.googleAuthStart();
      if (result.success) {
        setGoogleConnected(true);
        fetchAllCalendars();
      } else {
        setGoogleError(result.error || 'Échec de la connexion');
      }
    } catch (e) {
      setGoogleError(e.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    if (!window.electronAPI?.googleAuthLogout) return;
    await window.electronAPI.googleAuthLogout();
    setGoogleConnected(false);
  };

  // Récupérer tous les calendriers
  const fetchAllCalendars = useCallback(async () => {
    if (!window.electronAPI?.fetchGoogleCalendar) return;

    const enabledCalendars = calendars.filter(c => c.enabled && c.url);
    if (enabledCalendars.length === 0) return;

    setIsLoadingGoogle(true);
    setGoogleError(null);

    const allEvents = {};

    try {
      const results = await Promise.allSettled(
        enabledCalendars.map(async (cal) => {
          const result = await window.electronAPI.fetchGoogleCalendar(cal.url);
          return { cal, result };
        })
      );

      let hasError = false;

      results.forEach(({ status, value, reason }) => {
        if (status === 'rejected') {
          hasError = true;
          return;
        }

        const { cal, result } = value;

        if (result.success) {
          const eventsByDate = {};

          result.events.forEach(event => {
            if (!event.start) return;

            const startDate = new Date(event.start);
            const key = dateToKey(startDate);

            if (!eventsByDate[key]) {
              eventsByDate[key] = [];
            }

            eventsByDate[key].push({
              id: event.uid || `cal-${cal.id}-${Date.now()}-${Math.random()}`,
              title: event.summary || 'Sans titre',
              time: getTimeFromISO(event.start),
              endTime: event.end ? getTimeFromISO(event.end) : null,
              location: event.location,
              description: event.description,
              isGoogle: true,
              calendarId: cal.id,
              calendarName: cal.name,
              calendarColor: cal.color,
            });
          });

          allEvents[cal.id] = eventsByDate;
        } else {
          hasError = true;
        }
      });

      setCalendarEvents(allEvents);
      setLastSync(new Date());

      if (hasError) {
        setGoogleError('Certains calendriers n\'ont pas pu être synchronisés');
      }
    } catch (error) {
      console.error('Erreur synchronisation:', error);
      setGoogleError(error.message);
    } finally {
      setIsLoadingGoogle(false);
    }
  }, [calendars]);

  // Charger les calendriers au démarrage et toutes les 5 minutes
  useEffect(() => {
    fetchAllCalendars();
    const interval = setInterval(fetchAllCalendars, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllCalendars]);

  const days = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  const handleDayClick = (dayInfo) => {
    setSelectedDate(dayInfo.date);
  };

  const addEvent = async () => {
    if (!newEventTitle.trim()) return;

    // Si connecté à Google, créer via API
    if (googleConnected && window.electronAPI?.googleCreateEvent) {
      setIsCreatingEvent(true);

      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');

      const startDateTime = `${year}-${month}-${day}T${newEventTime}:00`;
      const endDateTime = `${year}-${month}-${day}T${newEventEndTime}:00`;

      try {
        const result = await window.electronAPI.googleCreateEvent({
          title: newEventTitle,
          startDateTime,
          endDateTime,
        });

        if (result.success) {
          console.log('Événement créé sur Google Calendar');
          setTimeout(fetchAllCalendars, 3000);
        } else {
          console.error('Erreur création:', result.error);
          addLocalEvent();
        }
      } catch (e) {
        console.error('Erreur:', e);
        addLocalEvent();
      } finally {
        setIsCreatingEvent(false);
      }
    } else {
      addLocalEvent();
    }

    setNewEventTitle('');
    setNewEventTime('12:00');
    setNewEventEndTime('13:00');
    setShowEventModal(false);
  };

  const addLocalEvent = () => {
    const key = dateToKey(selectedDate);
    const newEvent = {
      id: Date.now(),
      title: newEventTitle,
      time: newEventTime,
      isGoogle: false
    };

    setLocalEvents(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), newEvent]
    }));
  };

  const deleteEvent = (eventId) => {
    const key = dateToKey(selectedDate);
    setLocalEvents(prev => ({
      ...prev,
      [key]: prev[key].filter(e => e.id !== eventId)
    }));
  };

  // Combiner événements locaux et tous les calendriers
  const getEventsForDate = (date) => {
    const key = dateToKey(date);
    const local = (localEvents[key] || []).map(e => ({ ...e, calendarColor: 'var(--accent-secondary)' }));

    const calEvts = [];
    Object.values(calendarEvents).forEach(calData => {
      if (calData[key]) {
        calEvts.push(...calData[key]);
      }
    });

    return [...local, ...calEvts];
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  // Settings: ajouter un calendrier
  const addCalendar = () => {
    if (!newCalName.trim() || !newCalUrl.trim()) return;
    const newCal = {
      id: `cal-${Date.now()}`,
      name: newCalName.trim(),
      url: newCalUrl.trim(),
      color: newCalColor,
      enabled: true,
    };
    setTempCalendars(prev => [...prev, newCal]);
    setNewCalName('');
    setNewCalUrl('');
    setNewCalColor(CALENDAR_COLORS[Math.floor(Math.random() * CALENDAR_COLORS.length)]);
  };

  const removeCalendar = (calId) => {
    setTempCalendars(prev => prev.filter(c => c.id !== calId));
  };

  const toggleCalendar = (calId) => {
    setTempCalendars(prev =>
      prev.map(c => c.id === calId ? { ...c, enabled: !c.enabled } : c)
    );
  };

  const changeCalendarColor = (calId, color) => {
    setTempCalendars(prev =>
      prev.map(c => c.id === calId ? { ...c, color } : c)
    );
  };

  const saveSettings = () => {
    setCalendars(tempCalendars);
    setShowSettings(false);
    setTimeout(fetchAllCalendars, 100);
  };

  // Rendu Settings
  if (showSettings) {
    return (
      <div className="calendar-module">
        <div className="calendar-settings">
          <div className="settings-header">
            <Settings size={20} />
            <span>Configuration Calendrier</span>
            <button className="close-btn" onClick={() => setShowSettings(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="settings-form">
            {/* Google Auth Section */}
            <div className="form-group google-auth-section">
              <label>Compte Google (création d'événements)</label>
              {googleConnected ? (
                <div className="google-auth-status connected">
                  <CheckCircle size={18} />
                  <span>Connecté à Google Calendar</span>
                  <button className="logout-btn" onClick={handleGoogleLogout}>
                    <LogOut size={14} /> Déconnecter
                  </button>
                </div>
              ) : (
                <div className="google-auth-status disconnected">
                  <button
                    className="google-login-btn"
                    onClick={handleGoogleLogin}
                    disabled={isAuthLoading}
                  >
                    {isAuthLoading ? (
                      <><Loader size={16} className="spinning" /> Connexion en cours...</>
                    ) : (
                      <><LogIn size={16} /> Connecter Google Calendar</>
                    )}
                  </button>
                  <small>Permet de créer des événements directement sur Google Calendar</small>
                </div>
              )}
            </div>

            {/* Liste des calendriers */}
            <div className="form-group">
              <label>Calendriers ICS ({tempCalendars.length})</label>
              <div className="calendars-list">
                {tempCalendars.map(cal => (
                  <div key={cal.id} className="calendar-item">
                    <button
                      className={`cal-toggle ${cal.enabled ? 'enabled' : ''}`}
                      onClick={() => toggleCalendar(cal.id)}
                      style={{ borderColor: cal.color, background: cal.enabled ? cal.color : 'transparent' }}
                    />
                    <div className="cal-info">
                      <span className="cal-name">{cal.name}</span>
                      <span className="cal-url">{cal.url.substring(0, 50)}...</span>
                    </div>
                    <div className="cal-actions">
                      <div className="color-picker-mini">
                        {CALENDAR_COLORS.slice(0, 6).map(color => (
                          <button
                            key={color}
                            className={`color-dot ${cal.color === color ? 'active' : ''}`}
                            style={{ background: color }}
                            onClick={() => changeCalendarColor(cal.id, color)}
                          />
                        ))}
                      </div>
                      <button className="cal-remove" onClick={() => removeCalendar(cal.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ajouter un calendrier */}
            <div className="form-group add-calendar-section">
              <label>Ajouter un calendrier</label>
              <div className="add-cal-form">
                <input
                  type="text"
                  value={newCalName}
                  onChange={(e) => setNewCalName(e.target.value)}
                  placeholder="Nom (ex: Travail, Sport...)"
                  className="add-cal-input"
                />
                <textarea
                  value={newCalUrl}
                  onChange={(e) => setNewCalUrl(e.target.value)}
                  placeholder="URL iCal (https://calendar.google.com/calendar/ical/...)"
                  rows={2}
                />
                <div className="add-cal-bottom">
                  <div className="color-picker-mini">
                    {CALENDAR_COLORS.map(color => (
                      <button
                        key={color}
                        className={`color-dot ${newCalColor === color ? 'active' : ''}`}
                        style={{ background: color }}
                        onClick={() => setNewCalColor(color)}
                      />
                    ))}
                  </div>
                  <button
                    className="add-cal-btn"
                    onClick={addCalendar}
                    disabled={!newCalName.trim() || !newCalUrl.trim()}
                  >
                    <Plus size={14} /> Ajouter
                  </button>
                </div>
              </div>
              <small>
                Google Calendar → Paramètres du calendrier → Adresse secrète au format iCal
              </small>
            </div>

            {lastSync && (
              <div className="sync-info">
                <span>{t('calendar.lastSync')}: {lastSync.toLocaleTimeString(dateLocale)}</span>
              </div>
            )}
            {googleError && (
              <div className="error-message">
                {googleError}
              </div>
            )}
            <button className="save-btn" onClick={saveSettings}>
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-module">
      <div className="calendar-container">
        {/* Header du calendrier */}
        <div className="calendar-header">
          <div className="calendar-nav">
            <button className="nav-btn" onClick={prevMonth}>
              <ChevronLeft size={20} />
            </button>
            <h2 className="calendar-title">
              {t('calendar.months')[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button className="nav-btn" onClick={nextMonth}>
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="calendar-actions">
            {googleConnected && (
              <span className="google-badge" title="Connecté à Google Calendar">
                <CheckCircle size={14} />
              </span>
            )}
            <button
              className={`sync-btn ${isLoadingGoogle ? 'loading' : ''}`}
              onClick={fetchAllCalendars}
              title="Synchroniser les calendriers"
            >
              <RefreshCw size={16} className={isLoadingGoogle ? 'spinning' : ''} />
            </button>
            <button className="settings-btn" onClick={() => {
              setTempCalendars(calendars);
              setShowSettings(true);
            }} title="Paramètres">
              <Settings size={16} />
            </button>
            <button className="today-btn" onClick={goToToday}>
              {t('calendar.today')}
            </button>
          </div>
        </div>

        {/* Jours de la semaine */}
        <div className="calendar-weekdays">
          {t('calendar.days').map((day, i) => (
            <div key={i} className="weekday">{day}</div>
          ))}
        </div>

        {/* Grille des jours */}
        <div className="calendar-grid">
          {days.map((dayInfo, index) => {
            const isToday = isSameDay(dayInfo.date, today);
            const isSelected = isSameDay(dayInfo.date, selectedDate);
            const dayEvents = getEventsForDate(dayInfo.date);

            return (
              <div
                key={index}
                className={`calendar-day ${!dayInfo.currentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleDayClick(dayInfo)}
              >
                <span className="day-number">{dayInfo.day}</span>
                {dayEvents.length > 0 && (
                  <div className="event-bars">
                    {(() => {
                      const sorted = dayEvents
                        .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'))
                        .slice(0, 8);
                      const minBarWidth = 4;
                      const bars = sorted.map(evt => {
                        const [h, m] = (evt.time || '00:00').split(':').map(Number);
                        const startMin = h * 60 + m;
                        const startPct = (startMin / 1440) * 100;
                        // Calculate duration in minutes
                        let durationMin = 60; // default 1h
                        if (evt.endTime && evt.time) {
                          const [eh, em] = evt.endTime.split(':').map(Number);
                          durationMin = (eh * 60 + em) - startMin;
                          if (durationMin <= 0) durationMin = 60;
                        }
                        // Width: proportional to duration, min 4px for < 1h
                        const durationPct = (durationMin / 1440) * 100;
                        return { ...evt, startPct, durationPct, durationMin };
                      });
                      return bars.map((bar, i) => {
                        // < 1h: thin bar (fixed px), >= 1h: percentage width
                        const usePercentWidth = bar.durationMin >= 60;
                        const style = {
                          left: `${bar.startPct}%`,
                          background: isToday ? 'rgba(255,255,255,0.85)' : (bar.calendarColor || 'var(--accent-secondary)')
                        };
                        if (usePercentWidth) {
                          style.width = `${bar.durationPct}%`;
                        } else {
                          style.width = `${minBarWidth}px`;
                        }
                        return (
                          <span
                            key={i}
                            className="event-bar-v"
                            style={style}
                          />
                        );
                      });
                    })()}
                    {dayEvents.length > 8 && (
                      <span className="event-count-v">+{dayEvents.length - 8}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panneau des événements */}
      <div className="events-panel">
        <div className="events-header">
          <div className="selected-date">
            <CalendarIcon size={18} />
            <span>
              {selectedDate.toLocaleDateString(dateLocale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </span>
          </div>
          <button className="add-event-btn" onClick={() => setShowEventModal(true)}>
            <Plus size={18} />
          </button>
        </div>

        <div className="events-list">
          {selectedDateEvents.length === 0 ? (
            <div className="no-events">
              <p>{t('calendar.noEvents')}</p>
            </div>
          ) : (
            selectedDateEvents
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((event, idx) => (
                <div key={`${event.id}-${idx}`} className="event-item">
                  <div
                    className="event-indicator"
                    style={{ background: event.calendarColor || 'var(--accent-secondary)' }}
                  />
                  <div className="event-content">
                    <div className="event-time">
                      <Clock size={14} />
                      <span>{event.time}{event.endTime ? ` - ${event.endTime}` : ''}</span>
                      {event.calendarName && (
                        <span className="event-cal-label" style={{ color: event.calendarColor }}>
                          {event.calendarName}
                        </span>
                      )}
                    </div>
                    <div className="event-title">{event.title}</div>
                    {event.location && (
                      <div className="event-location">{event.location}</div>
                    )}
                  </div>
                  {!event.isGoogle && (
                    <button className="delete-event-btn" onClick={() => deleteEvent(event.id)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))
          )}
        </div>

        {/* Légende dynamique */}
        <div className="events-legend">
          {calendars.filter(c => c.enabled).map(cal => (
            <span key={cal.id} className="legend-item">
              <span className="legend-dot" style={{ background: cal.color }} /> {cal.name}
            </span>
          ))}
          <span className="legend-item">
            <span className="legend-dot" style={{ background: 'var(--accent-secondary)' }} /> Local
          </span>
        </div>
      </div>

      {/* Modal ajout événement */}
      {showEventModal && (
        <div className="event-modal-overlay" onClick={() => setShowEventModal(false)}>
          <div className="event-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nouvel événement</h3>
              {googleConnected && (
                <span className="modal-google-badge">
                  <CheckCircle size={14} /> Google
                </span>
              )}
              <button className="close-modal" onClick={() => setShowEventModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Titre</label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Nom de l'événement"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && addEvent()}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Début</label>
                  <input
                    type="time"
                    value={newEventTime}
                    onChange={(e) => {
                      setNewEventTime(e.target.value);
                      const [h, m] = e.target.value.split(':');
                      const endH = String(Math.min(parseInt(h) + 1, 23)).padStart(2, '0');
                      setNewEventEndTime(`${endH}:${m}`);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Fin</label>
                  <input
                    type="time"
                    value={newEventEndTime}
                    onChange={(e) => setNewEventEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Date</label>
                <div className="selected-date-display">
                  {selectedDate.toLocaleDateString(dateLocale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowEventModal(false)}>
                Annuler
              </button>
              <button
                className={`save-btn ${googleConnected ? 'google' : ''}`}
                onClick={addEvent}
                disabled={isCreatingEvent || !newEventTitle.trim()}
              >
                {isCreatingEvent ? (
                  <><Loader size={16} className="spinning" /> Création...</>
                ) : googleConnected ? (
                  <>Ajouter sur Google</>
                ) : (
                  <>Ajouter (local)</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarModule;
