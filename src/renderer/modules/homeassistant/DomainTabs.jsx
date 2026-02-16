import React, { memo } from 'react';
import { DOMAIN_ICONS } from './constants';

const DomainTabs = memo(function DomainTabs({ availableDomains, activeDomainFilter, onFilterChange, t }) {
  if (availableDomains.length === 0) return null;

  return (
    <div className="ha-domain-tabs">
      <button
        className={`ha-domain-tab ${activeDomainFilter === null ? 'active' : ''}`}
        onClick={() => onFilterChange(null)}
      >
        {t('homeassistant.allDomains')}
      </button>
      {availableDomains.map(domain => {
        const DIcon = DOMAIN_ICONS[domain] || DOMAIN_ICONS.default;
        return (
          <button
            key={domain}
            className={`ha-domain-tab ${activeDomainFilter === domain ? 'active' : ''}`}
            onClick={() => onFilterChange(activeDomainFilter === domain ? null : domain)}
          >
            <DIcon size={14} />
            <span>{t('homeassistant.domains.' + domain)}</span>
          </button>
        );
      })}
    </div>
  );
});

export default DomainTabs;
