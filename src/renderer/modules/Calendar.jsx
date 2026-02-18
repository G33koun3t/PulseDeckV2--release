import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Clock, Plus, X, Trash2, Settings, RefreshCw,
} from 'lucide-react';
import './Calendar.css';
import { useTranslation } from '../i18n';

// Couleurs prédéfinies pour les calendriers
const CALENDAR_COLORS = [
  '#4285f4', '#ea4335', '#fbbc04', '#34a853',
  '#ff6d01', '#46bdc6', '#7986cb', '#e67c73',
  '#f06292', '#a1887f', '#8e24aa', '#039be5',
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

const getTimeFromISO = (isoString) => {
  if (!isoString) return '00:00';
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

function CalendarModule() {
  const { t, dateLocale } = useTranslation();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);

  // Événements locaux (chaque événement a un accountId)
  const [localEvents, setLocalEvents] = useState(() => {
    const saved = localStorage.getItem('calendar_events');
    return saved ? JSON.parse(saved) : {};
  });

  // Comptes locaux (tableau)
  const [localAccounts, setLocalAccounts] = useState(() => {
    // Nouveau format (tableau)
    const saved = localStorage.getItem('calendar_local_accounts');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    // Migration depuis le format single account
    const single = localStorage.getItem('calendar_local_account');
    if (single && single !== 'null') {
      try {
        const acc = JSON.parse(single);
        return [{ id: 'local-default', name: acc.name || 'Personnel', color: acc.color || '#4285f4' }];
      } catch {}
    }
    // Migration depuis l'ancien calendar_list (défaut sans URL)
    const oldList = localStorage.getItem('calendar_list');
    if (oldList) {
      try {
        const parsed = JSON.parse(oldList);
        const def = parsed.find(c => !c.url || !c.url.trim());
        if (def) return [{ id: 'local-default', name: def.name || 'Personnel', color: def.color || '#4285f4' }];
      } catch {}
    }
    return [{ id: 'local-default', name: 'Personnel', color: '#4285f4' }];
  });

  // Calendriers ICS (avec URL)
  const [calendars, setCalendars] = useState(() => {
    const saved = localStorage.getItem('calendar_list');
    if (saved) {
      try {
        return JSON.parse(saved).filter(c => c.url && c.url.trim());
      } catch { return []; }
    }
    return [];
  });

  // Événements ICS par calendrier
  const [calendarEvents, setCalendarEvents] = useState({});
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [calendarError, setCalendarError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  // UI
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('12:00');
  const [newEventEndTime, setNewEventEndTime] = useState('13:00');
  const [selectedAccountId, setSelectedAccountId] = useState(() => 'local-default');

  // Settings state
  const [tempLocalAccounts, setTempLocalAccounts] = useState(localAccounts);
  const [tempCalendars, setTempCalendars] = useState(calendars);
  const [newCalName, setNewCalName] = useState('');
  const [newCalUrl, setNewCalUrl] = useState('');
  const [newCalColor, setNewCalColor] = useState('#ea4335');
  const [newLocalName, setNewLocalName] = useState('');
  const [newLocalColor, setNewLocalColor] = useState('#ea4335');

  // Sauvegarder
  useEffect(() => {
    localStorage.setItem('calendar_events', JSON.stringify(localEvents));
  }, [localEvents]);

  useEffect(() => {
    localStorage.setItem('calendar_local_accounts', JSON.stringify(localAccounts));
  }, [localAccounts]);

  useEffect(() => {
    localStorage.setItem('calendar_list', JSON.stringify(calendars));
  }, [calendars]);

  // Récupérer tous les calendriers ICS
  const fetchAllCalendars = useCallback(async () => {
    if (!window.electronAPI?.fetchGoogleCalendar) return;

    const enabledCalendars = calendars.filter(c => c.enabled && c.url);
    if (enabledCalendars.length === 0) {
      setCalendarEvents({});
      return;
    }

    setIsLoadingCalendars(true);
    setCalendarError(null);

    const allEvents = {};

    try {
      const results = await Promise.allSettled(
        enabledCalendars.map(async (cal) => {
          const result = await window.electronAPI.fetchGoogleCalendar(cal.url);
          return { cal, result };
        })
      );

      let hasError = false;

      results.forEach(({ status, value }) => {
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
              title: event.summary || t('calendar.untitled'),
              time: getTimeFromISO(event.start),
              endTime: event.end ? getTimeFromISO(event.end) : null,
              location: event.location,
              description: event.description,
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
        setCalendarError(t('calendar.syncError'));
      }
    } catch (error) {
      console.error('Erreur synchronisation:', error);
      setCalendarError(error.message);
    } finally {
      setIsLoadingCalendars(false);
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

  const addEvent = () => {
    if (!newEventTitle.trim() || localAccounts.length === 0) return;
    const accountId = localAccounts.length === 1 ? localAccounts[0].id : selectedAccountId;
    const key = dateToKey(selectedDate);
    setLocalEvents(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), {
        id: Date.now(),
        title: newEventTitle,
        time: newEventTime,
        accountId,
      }]
    }));
    setNewEventTitle('');
    setNewEventTime('12:00');
    setNewEventEndTime('13:00');
    setShowEventModal(false);
  };

  const deleteEvent = (eventId) => {
    const key = dateToKey(selectedDate);
    setLocalEvents(prev => ({
      ...prev,
      [key]: prev[key].filter(e => e.id !== eventId)
    }));
  };

  // Combiner événements locaux et ICS
  const getEventsForDate = (date) => {
    const key = dateToKey(date);
    const local = (localEvents[key] || []).map(e => {
      // Trouver le compte associé (ou fallback sur le premier)
      const account = localAccounts.find(a => a.id === e.accountId) || localAccounts[0];
      if (!account) return null;
      return {
        ...e,
        calendarColor: account.color,
        calendarName: account.name,
        isLocal: true,
      };
    }).filter(Boolean);

    const calEvts = [];
    Object.values(calendarEvents).forEach(calData => {
      if (calData[key]) {
        calEvts.push(...calData[key]);
      }
    });

    return [...local, ...calEvts];
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  // Settings: couleurs utilisées (exclure un ID pour permettre sa propre couleur)
  const getUsedColors = (excludeId = null) => {
    const used = new Set();
    tempLocalAccounts.forEach(acc => {
      if (acc.id !== excludeId) used.add(acc.color);
    });
    tempCalendars.forEach(cal => {
      if (cal.id !== excludeId) used.add(cal.color);
    });
    return used;
  };

  // Comptes locaux dans settings
  const changeTempLocalName = (accId, name) => {
    setTempLocalAccounts(prev => prev.map(a => a.id === accId ? { ...a, name } : a));
  };

  const changeTempLocalColor = (accId, color) => {
    if (getUsedColors(accId).has(color)) return;
    setTempLocalAccounts(prev => prev.map(a => a.id === accId ? { ...a, color } : a));
  };

  const addTempLocalAccount = () => {
    if (!newLocalName.trim()) return;
    const used = getUsedColors();
    if (used.has(newLocalColor)) return;
    setTempLocalAccounts(prev => [...prev, {
      id: `local-${Date.now()}`,
      name: newLocalName.trim(),
      color: newLocalColor,
    }]);
    setNewLocalName('');
    const allUsed = new Set([...used, newLocalColor]);
    setNewLocalColor(CALENDAR_COLORS.find(c => !allUsed.has(c)) || CALENDAR_COLORS[0]);
  };

  // Calendriers ICS dans settings
  const addCalendar = () => {
    if (!newCalName.trim() || !newCalUrl.trim()) return;
    setTempCalendars(prev => [...prev, {
      id: `cal-${Date.now()}`,
      name: newCalName.trim(),
      url: newCalUrl.trim(),
      color: newCalColor,
      enabled: true,
    }]);
    setNewCalName('');
    setNewCalUrl('');
    const allUsed = new Set([...getUsedColors(), newCalColor]);
    setNewCalColor(CALENDAR_COLORS.find(c => !allUsed.has(c)) || CALENDAR_COLORS[0]);
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
    if (getUsedColors(calId).has(color)) return;
    setTempCalendars(prev =>
      prev.map(c => c.id === calId ? { ...c, color } : c)
    );
  };

  const saveSettings = () => {
    setLocalAccounts(tempLocalAccounts);
    setCalendars(tempCalendars);
    setShowSettings(false);
    setTimeout(fetchAllCalendars, 100);
  };

  const openSettings = () => {
    setTempLocalAccounts(localAccounts);
    setTempCalendars(calendars);
    const used = new Set([...localAccounts.map(a => a.color), ...calendars.map(c => c.color)]);
    setNewCalColor(CALENDAR_COLORS.find(c => !used.has(c)) || CALENDAR_COLORS[0]);
    setNewLocalColor(CALENDAR_COLORS.find(c => !used.has(c)) || CALENDAR_COLORS[0]);
    setNewCalName('');
    setNewCalUrl('');
    setNewLocalName('');
    setShowSettings(true);
  };

  // Rendu Settings
  if (showSettings) {
    return (
      <div className="calendar-module">
        <div className="calendar-settings">
          <div className="settings-header">
            <Settings size={20} />
            <span>{t('calendar.configTitle')}</span>
            <button className="close-btn" onClick={() => setShowSettings(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="settings-form">
            {/* Comptes locaux */}
            <div className="form-group">
              <label>{t('calendar.localAccounts')} ({tempLocalAccounts.length})</label>
              <div className="calendars-list">
                {tempLocalAccounts.map(acc => {
                  const usedExcludingSelf = getUsedColors(acc.id);
                  return (
                    <div key={acc.id} className="calendar-item">
                      <span className="cal-color-indicator" style={{ background: acc.color }} />
                      <div className="cal-info">
                        <input
                          type="text"
                          value={acc.name}
                          onChange={(e) => changeTempLocalName(acc.id, e.target.value)}
                          className="cal-name-input"
                        />
                      </div>
                      <div className="cal-actions">
                        <div className="color-picker-mini">
                          {CALENDAR_COLORS.slice(0, 6).map(color => {
                            const isUsed = usedExcludingSelf.has(color);
                            return (
                              <button
                                key={color}
                                className={`color-dot ${acc.color === color ? 'active' : ''}`}
                                style={{ background: color, opacity: isUsed ? 0.3 : 1 }}
                                onClick={() => changeTempLocalColor(acc.id, color)}
                                disabled={isUsed}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Ajouter un compte local */}
              <div className="add-local-form">
                <input
                  type="text"
                  value={newLocalName}
                  onChange={(e) => setNewLocalName(e.target.value)}
                  placeholder={t('calendar.accountName')}
                  className="add-cal-input"
                  onKeyDown={(e) => e.key === 'Enter' && addTempLocalAccount()}
                />
                <div className="add-cal-bottom">
                  <div className="color-picker-mini">
                    {CALENDAR_COLORS.map(color => {
                      const isUsed = getUsedColors().has(color);
                      return (
                        <button
                          key={color}
                          className={`color-dot ${newLocalColor === color ? 'active' : ''}`}
                          style={{ background: color, opacity: isUsed ? 0.3 : 1 }}
                          onClick={() => !isUsed && setNewLocalColor(color)}
                          disabled={isUsed}
                        />
                      );
                    })}
                  </div>
                  <button
                    className="add-cal-btn"
                    onClick={addTempLocalAccount}
                    disabled={!newLocalName.trim()}
                  >
                    <Plus size={14} /> {t('common.add')}
                  </button>
                </div>
              </div>
            </div>

            {/* Calendriers ICS */}
            {tempCalendars.length > 0 && (
              <div className="form-group">
                <label>{t('calendar.icsCalendars')} ({tempCalendars.length})</label>
                <div className="calendars-list">
                  {tempCalendars.map(cal => {
                    const usedExcludingSelf = getUsedColors(cal.id);
                    return (
                      <div key={cal.id} className="calendar-item">
                        <button
                          className={`cal-toggle ${cal.enabled ? 'enabled' : ''}`}
                          onClick={() => toggleCalendar(cal.id)}
                          style={{ borderColor: cal.color, background: cal.enabled ? cal.color : 'transparent' }}
                        />
                        <div className="cal-info">
                          <span className="cal-name">{cal.name}</span>
                          <span className="cal-url">{cal.url.length > 50 ? cal.url.substring(0, 50) + '...' : cal.url}</span>
                        </div>
                        <div className="cal-actions">
                          <div className="color-picker-mini">
                            {CALENDAR_COLORS.slice(0, 6).map(color => {
                              const isUsed = usedExcludingSelf.has(color);
                              return (
                                <button
                                  key={color}
                                  className={`color-dot ${cal.color === color ? 'active' : ''}`}
                                  style={{ background: color, opacity: isUsed ? 0.3 : 1 }}
                                  onClick={() => changeCalendarColor(cal.id, color)}
                                  disabled={isUsed}
                                />
                              );
                            })}
                          </div>
                          <button className="cal-remove" onClick={() => removeCalendar(cal.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ajouter un calendrier ICS */}
            <div className="form-group add-calendar-section">
              <label>{t('calendar.addCalendar')}</label>
              <div className="add-cal-form">
                <input
                  type="text"
                  value={newCalName}
                  onChange={(e) => setNewCalName(e.target.value)}
                  placeholder={t('calendar.calendarNamePlaceholder')}
                  className="add-cal-input"
                />
                <textarea
                  value={newCalUrl}
                  onChange={(e) => setNewCalUrl(e.target.value)}
                  placeholder={t('calendar.calendarUrlPlaceholder')}
                  rows={2}
                />
                <div className="add-cal-bottom">
                  <div className="color-picker-mini">
                    {CALENDAR_COLORS.map(color => {
                      const isUsed = getUsedColors().has(color);
                      return (
                        <button
                          key={color}
                          className={`color-dot ${newCalColor === color ? 'active' : ''}`}
                          style={{ background: color, opacity: isUsed ? 0.3 : 1 }}
                          onClick={() => !isUsed && setNewCalColor(color)}
                          disabled={isUsed}
                        />
                      );
                    })}
                  </div>
                  <button
                    className="add-cal-btn"
                    onClick={addCalendar}
                    disabled={!newCalName.trim() || !newCalUrl.trim()}
                  >
                    <Plus size={14} /> {t('common.add')}
                  </button>
                </div>
              </div>
              <small>
                {t('calendar.icsHelp')}
              </small>
            </div>

            {lastSync && (
              <div className="sync-info">
                <span>{t('calendar.lastSync')}: {lastSync.toLocaleTimeString(dateLocale)}</span>
              </div>
            )}
            {calendarError && (
              <div className="error-message">
                {calendarError}
              </div>
            )}
            <button className="save-btn" onClick={saveSettings}>
              {t('common.save')}
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
            <button
              className={`sync-btn ${isLoadingCalendars ? 'loading' : ''}`}
              onClick={fetchAllCalendars}
              title={t('calendar.syncCalendars')}
            >
              <RefreshCw size={16} className={isLoadingCalendars ? 'spinning' : ''} />
            </button>
            <button className="settings-btn" onClick={openSettings} title={t('common.settings')}>
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
                  <div className="event-dots">
                    {dayEvents.slice(0, 5).map((evt, i) => (
                      <span
                        key={i}
                        className="event-dot"
                        style={{ background: isToday ? 'rgba(255,255,255,0.85)' : (evt.calendarColor || 'var(--accent-primary)') }}
                      />
                    ))}
                    {dayEvents.length > 5 && (
                      <span className="event-dots-more">+{dayEvents.length - 5}</span>
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
          {localAccounts.length > 0 && (
            <button className="add-event-btn" onClick={() => setShowEventModal(true)}>
              <Plus size={18} />
            </button>
          )}
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
                    style={{ background: event.calendarColor || 'var(--accent-primary)' }}
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
                  {event.isLocal && (
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
          {localAccounts.map(acc => (
            <span key={acc.id} className="legend-item">
              <span className="legend-dot" style={{ background: acc.color }} /> {acc.name}
            </span>
          ))}
          {calendars.filter(c => c.enabled).map(cal => (
            <span key={cal.id} className="legend-item">
              <span className="legend-dot" style={{ background: cal.color }} /> {cal.name}
            </span>
          ))}
        </div>
      </div>

      {/* Modal ajout événement */}
      {showEventModal && (
        <div className="event-modal-overlay" onClick={() => setShowEventModal(false)}>
          <div className="event-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('calendar.newEvent')}</h3>
              <button className="close-modal" onClick={() => setShowEventModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content">
              {/* Sélecteur de compte (si plusieurs) */}
              {localAccounts.length > 1 && (
                <div className="form-group">
                  <label>{t('calendar.account')}</label>
                  <div className="account-selector">
                    {localAccounts.map(acc => (
                      <button
                        key={acc.id}
                        className={`account-chip ${selectedAccountId === acc.id ? 'active' : ''}`}
                        onClick={() => setSelectedAccountId(acc.id)}
                      >
                        <span className="account-chip-dot" style={{ background: acc.color }} />
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>{t('calendar.title')}</label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder={t('calendar.eventNamePlaceholder')}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && addEvent()}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('calendar.start')}</label>
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
                  <label>{t('calendar.end')}</label>
                  <input
                    type="time"
                    value={newEventEndTime}
                    onChange={(e) => setNewEventEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>{t('calendar.date')}</label>
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
                {t('common.cancel')}
              </button>
              <button
                className="save-btn"
                onClick={addEvent}
                disabled={!newEventTitle.trim()}
              >
                {t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarModule;
