import React, { useState, useEffect, useRef } from 'react';
import { Activity, Users, Thermometer, Car, Cpu, Droplets, Zap, Camera, Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const ICON_MAP = {
  Activity,
  Users,
  Thermometer,
  Car,
  Cpu,
  Droplets,
  Zap,
  Camera,
  Eye,
};

export default function MetricWidget({ title, value, unit, config = {}, icon: DefaultIcon = Activity }) {
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);

  // Dynamic icon
  const SelectedIcon = config.iconName && ICON_MAP[config.iconName] ? ICON_MAP[config.iconName] : DefaultIcon;

  const valScale = config.valueFontSize || 1;
  const unitScale = config.unitFontSize || 1;

  // Track trend / delta
  const prevValRef = useRef(null);
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    if (value === undefined || value === null || typeof value === 'boolean' || isObject) {
      return;
    }
    const currentNum = parseFloat(value);
    if (isNaN(currentNum)) return;

    if (prevValRef.current !== null && prevValRef.current !== currentNum) {
      const prev = prevValRef.current;
      const diff = currentNum - prev;
      const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : 0;
      setTrend({
        diff,
        pct,
        direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral'
      });
    }
    prevValRef.current = currentNum;
  }, [value, isObject]);

  let isAlert = false;
  
  if (value !== undefined && value !== null) {
    let valNum;
    if (typeof value === 'boolean') {
      valNum = value ? 1 : 0;
    } else {
      valNum = parseFloat(value);
    }

    if (!isNaN(valNum)) {
      // Check Upper Threshold
      if (config.enableUpperLimit && config.threshold !== undefined && config.threshold !== '') {
        const thresholdNum = parseFloat(config.threshold);
        if (!isNaN(thresholdNum)) {
          const condition = config.thresholdCondition || '>';
          if (condition === '>') {
            if (valNum > thresholdNum) isAlert = true;
          } else if (condition === '<') {
            if (valNum < thresholdNum) isAlert = true;
          } else if (condition === '==') {
            if (valNum === thresholdNum) isAlert = true;
          }
        }
      }

      // Check Lower Threshold (Always `<`)
      if (config.enableLowerLimit && config.thresholdMin !== undefined && config.thresholdMin !== '') {
        const thresholdMinNum = parseFloat(config.thresholdMin);
        if (!isNaN(thresholdMinNum) && valNum < thresholdMinNum) {
          isAlert = true;
        }
      }
    }
  }

  // Compact notation formatter (K, M, B)
  const formatCompact = (num, decimals) => {
    if (num === null || num === undefined || isNaN(num)) return '';
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    const d = decimals !== undefined && decimals !== '' ? parseInt(decimals, 10) : (absNum >= 1000 && absNum % 1000 !== 0 ? 1 : 0);
    
    if (absNum >= 1e9) {
      return sign + (absNum / 1e9).toFixed(d) + 'B';
    }
    if (absNum >= 1e6) {
      return sign + (absNum / 1e6).toFixed(d) + 'M';
    }
    if (absNum >= 1e3) {
      return sign + (absNum / 1e3).toFixed(d) + 'K';
    }
    return sign + (decimals !== undefined && decimals !== '' ? absNum.toFixed(parseInt(decimals, 10)) : absNum.toString());
  };

  // Comma formatting function for numbers
  const formatWithCommas = (str) => {
    if (!str) return str;
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Value formatting
  let displayValue = String(value);
  if (!isObject && typeof value !== 'boolean' && value !== undefined && value !== null) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      if (config.compactNotation) {
        displayValue = formatCompact(num, config.decimals);
      } else {
        if (config.decimals !== undefined && config.decimals !== '') {
          displayValue = num.toFixed(parseInt(config.decimals, 10));
        }
        displayValue = formatWithCommas(displayValue);
      }
    }
  }

  const isBelow = config.unitPosition === 'below';
  const alertGlowEnabled = config.alertGlow !== false;

  // Active trend: real trend or mock preview if in settings modal
  const activeTrend = trend || (config.__isPreview && config.showTrend ? { diff: 12.5, pct: 4.8, direction: 'up' } : null);

  const renderTrendBadge = () => {
    if (!config.showTrend || !activeTrend) return null;

    const isUp = activeTrend.direction === 'up';
    const isDown = activeTrend.direction === 'down';

    const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
    const isGoodGreen = config.trendPositiveColor !== 'red';

    let colorClasses = 'bg-surface-2 text-fg-subtle border-line';
    if (isUp) {
      colorClasses = isGoodGreen 
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' 
        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25';
    } else if (isDown) {
      colorClasses = isGoodGreen 
        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25' 
        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25';
    }

    let text = '';
    if (config.trendMode === 'value') {
      const sign = isUp ? '+' : isDown ? '-' : '';
      const absDiff = Math.abs(activeTrend.diff);
      const diffFormatted = config.compactNotation 
        ? formatCompact(absDiff, config.decimals) 
        : formatWithCommas(absDiff % 1 !== 0 ? absDiff.toFixed(1) : absDiff.toString());
      text = `${sign}${diffFormatted}`;
    } else {
      const sign = isUp ? '+' : isDown ? '-' : '';
      text = `${sign}${Math.abs(activeTrend.pct).toFixed(1)}%`;
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClasses}`}>
        <TrendIcon size={12} className="shrink-0 stroke-[2.5]" />
        <span>{text}</span>
      </span>
    );
  };

  const containerAlertClasses = isAlert
    ? (alertGlowEnabled
        ? 'border-2 border-red-500 bg-gradient-to-b from-red-500/15 via-red-950/20 to-surface dark:from-red-950/40 dark:to-surface shadow-[0_0_30px_rgba(239,68,68,0.45)] dark:shadow-[0_0_35px_rgba(239,68,68,0.6)] animate-pulse'
        : 'bg-red-50 dark:bg-red-950/40 border-2 border-red-500 animate-pulse')
    : 'bg-surface border border-line';

  return (
    <div className={`flex flex-col h-full w-full rounded-xl overflow-hidden shadow-xl transition-all duration-300 ${containerAlertClasses}`} style={{ containerType: 'size' }}>
      {config.showTitle !== false && (
        <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <SelectedIcon size={16} className={`shrink-0 ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`} />
            <span className={`text-xs sm:text-sm font-semibold truncate ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-fg'}`}>
              {title || config?.title || 'Number'}
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {value !== undefined && value !== null ? (
          typeof value === 'boolean' ? (
            <div className="font-black tracking-tighter flex items-baseline" style={{ fontSize: `calc(clamp(2rem, 15cqw, 6rem) * ${valScale})` }}>
              <span className={value ? 'text-green-500' : 'text-red-500'}>{value ? 'TRUE' : 'FALSE'}</span>
              {unit && <span className="text-fg-subtle ml-2.5 font-semibold tracking-wider" style={{ fontSize: `calc(clamp(1rem, 6cqw, 2.5rem) * ${unitScale})` }}>{unit}</span>}
            </div>
          ) : isObject ? (
            <div className="flex flex-col gap-1.5 w-full max-h-full overflow-y-auto px-1 py-1 custom-scrollbar">
              {Object.entries(value).length > 0 ? (
                Object.entries(value).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-surface-2/70 border border-line-strong/50 text-xs">
                    <span className="text-fg-secondary font-medium truncate max-w-[120px]" title={k}>{k}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono font-bold text-sm">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))
              ) : (
                <span className="text-fg-subtle text-xs italic text-center">Empty Object</span>
              )}
            </div>
          ) : isBelow ? (
            <div className="flex flex-col items-center justify-center text-center">
              <div 
                className="font-black tracking-tighter leading-none" 
                style={{ fontSize: `calc(clamp(2rem, ${displayValue.length > 5 ? '12cqw' : '16cqw'}, 6rem) * ${valScale})` }}
              >
                <span className={isAlert ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-fg'}>{displayValue}</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                {unit && (
                  <span 
                    className={`font-semibold uppercase tracking-wider ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-fg-muted'}`} 
                    style={{ fontSize: `calc(clamp(0.75rem, 4cqw, 1.5rem) * ${unitScale})` }}
                  >
                    {unit}
                  </span>
                )}
                {renderTrendBadge()}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              <div className="font-black tracking-tighter flex items-baseline justify-center" style={{ fontSize: `calc(clamp(2rem, ${displayValue.length > 5 ? '12cqw' : '16cqw'}, 6rem) * ${valScale})` }}>
                <span className={isAlert ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-fg'}>{displayValue}</span>
                {unit && (
                  <span 
                    className={`ml-2.5 font-semibold tracking-wider ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-fg-subtle'}`} 
                    style={{ fontSize: `calc(clamp(0.875rem, 5cqw, 2rem) * ${unitScale})` }}
                  >
                    {unit}
                  </span>
                )}
              </div>
              {config.showTrend && activeTrend && (
                <div className="mt-1.5">
                  {renderTrendBadge()}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="font-black tracking-tighter flex items-baseline justify-center" style={{ fontSize: `calc(clamp(2rem, 15cqw, 6rem) * ${valScale})` }}>
            <span className="text-fg-faint">--</span>
            {unit && <span className="text-fg-subtle ml-2.5 font-semibold tracking-wider" style={{ fontSize: `calc(clamp(1rem, 6cqw, 2.5rem) * ${unitScale})` }}>{unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
