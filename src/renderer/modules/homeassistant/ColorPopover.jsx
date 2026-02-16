import React, { useEffect, useRef } from 'react';
import { Sun } from 'lucide-react';
import { supportsColor, supportsBrightness, rgbToHex, hexToRgb } from './helpers';

export default function ColorPopover({ entity, position, onClose, onColorChange, onBrightnessChange }) {
  const popoverRef = useRef(null);

  // Fermer au clic extérieur
  useEffect(() => {
    const handleClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  if (!entity || entity.state !== 'on') return null;

  const hasColor = supportsColor(entity);
  const hasBrightness = supportsBrightness(entity);
  const currentRgb = entity.attributes?.rgb_color || [255, 255, 255];
  const currentBrightness = entity.attributes?.brightness || 255;
  const currentHex = rgbToHex(currentRgb);

  return (
    <div
      ref={popoverRef}
      className="ha-color-popover"
      style={{ top: position.y, left: position.x }}
    >
      {hasColor && (
        <div className="ha-color-picker-row">
          <input
            type="color"
            value={currentHex}
            onChange={(e) => onColorChange(entity.entity_id, hexToRgb(e.target.value))}
          />
          <div className="ha-color-preview" style={{ background: currentHex }} />
          <span className="ha-color-hex">{currentHex}</span>
        </div>
      )}
      {hasBrightness && (
        <div className="ha-brightness-row">
          <Sun size={14} />
          <input
            type="range"
            min="1"
            max="255"
            value={currentBrightness}
            onChange={(e) => onBrightnessChange(entity.entity_id, e.target.value)}
          />
          <span>{Math.round(currentBrightness / 255 * 100)}%</span>
        </div>
      )}
    </div>
  );
}
