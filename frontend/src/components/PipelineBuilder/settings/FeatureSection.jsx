import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Reusable collapsible feature section with an On/Off toggle switch.
 * When turned OFF, the section is minimized (collapsed) to a slim header bar.
 * When turned ON, the section expands to show its configuration controls.
 * Users can also click the chevron / header to temporarily collapse while keeping the feature enabled.
 */
export default function FeatureSection({
  icon: Icon,
  title,
  subtitle,
  badge,
  badgeColor = 'purple',
  enabled = true,
  onToggle,
  children,
  headerAction,
  allowManualCollapse = true,
  className = '',
}) {
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);

  // When enabled is false, section is ALWAYS minimized (collapsed).
  // When enabled is true, section is expanded unless the user manually collapsed it.
  const isExpanded = Boolean(enabled) && !isManuallyCollapsed;

  const handleToggle = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const nextVal = !enabled;
    if (nextVal) {
      setIsManuallyCollapsed(false); // Automatically expand when turned ON
    }
    if (onToggle) {
      onToggle(nextVal);
    }
  };

  const handleHeaderClick = (e) => {
    // If clicking a button or switch inside the header, ignore
    if (e.target.closest('button') || e.target.closest('input')) return;

    if (!enabled) {
      // If disabled and user clicks the header bar, turn it ON and expand
      handleToggle();
    } else if (allowManualCollapse) {
      setIsManuallyCollapsed(prev => !prev);
    }
  };

  return (
    <div 
      className={`border rounded-xl transition-all duration-200 overflow-hidden nodrag ${
        enabled
          ? 'border-purple-500/40 bg-surface-2/40 shadow-xs'
          : 'border-line/70 bg-surface/30 opacity-90'
      } ${className}`}
    >
      {/* Header Bar */}
      <div
        onClick={handleHeaderClick}
        className={`px-3 py-2.5 flex items-center justify-between gap-2 select-none cursor-pointer transition-colors ${
          enabled ? 'hover:bg-surface-2/70' : 'hover:bg-surface-2/40'
        }`}
        title={enabled ? (isExpanded ? 'Click to collapse' : 'Click to expand') : 'Click to turn ON and expand'}
      >
        {/* Left: Icon + Title + Status Badge */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {Icon && (
            <div className={`p-1 rounded-md shrink-0 transition-colors ${
              enabled
                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                : 'bg-surface-3 text-fg-subtle'
            }`}>
              <Icon size={14} />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-xs font-bold tracking-wide truncate ${
                enabled ? 'text-fg' : 'text-fg-muted'
              }`}>
                {title}
              </span>
              {badge && (
                <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full border shrink-0 ${
                  enabled
                    ? badgeColor === 'purple'
                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                      : 'bg-surface-3 text-fg border-line'
                    : 'bg-surface-3/60 text-fg-faint border-line/50'
                }`}>
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <span className="text-[10px] text-fg-faint truncate">{subtitle}</span>
            )}
          </div>
        </div>

        {/* Right: Actions, Toggle Switch & Collapse Indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {headerAction && enabled && (
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              {headerAction}
            </div>
          )}

          {/* iOS-style On/Off Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(enabled)}
            onClick={handleToggle}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled ? 'bg-purple-600' : 'bg-surface-3 hover:bg-surface-4'
            }`}
            title={enabled ? 'Turn OFF (Minimize)' : 'Turn ON (Expand)'}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>

          {allowManualCollapse && enabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsManuallyCollapsed(prev => !prev);
              }}
              className="p-0.5 text-fg-subtle hover:text-fg rounded transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
              aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Body Content (Rendered only when expanded) */}
      {isExpanded && (
        <div className="p-3 border-t border-line-strong/30 bg-surface/50 flex flex-col gap-3 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
}
