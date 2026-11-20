import React from 'react';
import { Lock } from 'lucide-react';
import { useSlidingIndicator } from '../utils/useSlidingIndicator';

/** Tabs with a pill that glides from one tab to the next. */
export default function TabStrip({ tabs, active, onChange, className = '' }) {
  const { containerRef, indicatorStyle } = useSlidingIndicator(active);

  return (
    <div ref={containerRef} className={`tab-strip has-indicator ${className}`} role="tablist">
      <span className="slide-indicator tab-strip-indicator" style={indicatorStyle} aria-hidden="true" />
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? 'true' : undefined}
            onClick={() => onChange(tab.id)}
            className={`tab-strip-tab ${isActive ? 'is-active' : ''}`}
          >
            {Icon && <Icon size={16} strokeWidth={2} className={tab.anim} />}
            <span>{tab.label}</span>
            {tab.count > 0 && <span className="bk-count-badge">{tab.count}</span>}
            {tab.locked && <Lock size={12} style={{ opacity: 0.6 }} />}
          </button>
        );
      })}
    </div>
  );
}
