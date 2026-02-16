import React, { memo } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import EntityTile from './EntityTile';

const RoomCard = memo(function RoomCard({
  area, entities, collapsed, onToggleCollapse,
  onToggle, onControlCover, onShowColorPopover, onHide, onSensorClick,
  getHistory, minTileWidth, t, dateLocale,
}) {
  const roomName = area ? area.name : t('homeassistant.otherRoom');
  const count = entities.length;

  if (count === 0) return null;

  return (
    <div className="ha-room-card">
      <div className="ha-room-header" onClick={onToggleCollapse}>
        <Home size={16} className="ha-room-icon" />
        <span className="ha-room-name">{roomName}</span>
        <span className="ha-room-count">{count}</span>
        <ChevronRight size={16} className={`ha-room-chevron ${collapsed ? '' : 'expanded'}`} />
      </div>

      {!collapsed && (
        <div
          className="ha-room-grid"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minTileWidth}px, 1fr))` }}
        >
          {entities.map(entity => (
            <EntityTile
              key={entity.entity_id}
              entity={entity}
              onToggle={onToggle}
              onControlCover={onControlCover}
              onShowColorPopover={onShowColorPopover}
              onHide={onHide}
              onSensorClick={onSensorClick}
              historyData={getHistory(entity.entity_id)}
              t={t}
              dateLocale={dateLocale}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default RoomCard;
