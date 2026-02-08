import React, { useState } from 'react';
import { Coffee, Timer as TimerIcon, Clock, StickyNote, Camera } from 'lucide-react';
import { useTranslation } from '../i18n';
import Pomodoro from './outils/Pomodoro';
import Minuteur from './outils/Minuteur';
import Chronometre from './outils/Chronometre';
import Notes from './outils/Notes';
import Screenshots from './outils/Screenshots';
import './Outils.css';

const TABS = [
  { id: 'pomodoro', icon: Coffee, labelKey: 'outils.pomodoro' },
  { id: 'timer', icon: TimerIcon, labelKey: 'outils.timer' },
  { id: 'stopwatch', icon: Clock, labelKey: 'outils.stopwatch' },
  { id: 'notes', icon: StickyNote, labelKey: 'outils.notes' },
  { id: 'screenshots', icon: Camera, labelKey: 'outils.screenshots' },
];

const TAB_COMPONENTS = {
  pomodoro: Pomodoro,
  timer: Minuteur,
  stopwatch: Chronometre,
  notes: Notes,
  screenshots: Screenshots,
};

function OutilsModule() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('pomodoro');
  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="outils-module">
      <div className="outils-header">
        <div className="outils-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`outils-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="outils-content">
        <ActiveComponent />
      </div>
    </div>
  );
}

export default OutilsModule;
