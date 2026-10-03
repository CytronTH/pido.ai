import React from 'react';
import { Activity, Users, Thermometer, Car, Cpu, Droplets, Zap, Camera, Eye, BarChart2, PieChart } from 'lucide-react';

const ICON_MAP = {
  Activity, Users, Thermometer, Car, Cpu, Droplets, Zap, Camera, Eye, BarChart2, PieChart
};

export default function GaugeWidget({ title, value, unit, config = {} }) {
  const max = config.max !== undefined && config.max !== '' ? parseFloat(config.max) : 100;
  const min = config.min !== undefined && config.min !== '' ? parseFloat(config.min) : 0;
  
  const valScale = config.valueFontSize || 1;
  const unitScale = config.unitFontSize || 1;
  
  // Treat thickness as a percentage of the width (default 16%)
  const thickness = config.thickness || 16;
  
  let numValue = 0;
  if (value !== undefined && value !== null) {
    numValue = parseFloat(value) || 0;
  }
  let displayValue = numValue.toString();
  if (config.decimals !== undefined && config.decimals !== '') {
    displayValue = numValue.toFixed(parseInt(config.decimals, 10));
  }
  
  const range = max - min;
  const percentage = range === 0 ? 0 : Math.min(Math.max((numValue - min) / range, 0), 1);
  const percentage100 = percentage * 100;
  const sortedStops = config.enableDynamicColors ? [...(config.colorStops || [])].sort((a, b) => a.limit - b.limit) : [];

  let isAlert = false;
  if (!isNaN(numValue)) {
    if (config.enableUpperLimit && config.threshold !== undefined && config.threshold !== '') {
      const thresholdNum = parseFloat(config.threshold);
      if (!isNaN(thresholdNum)) {
        const condition = config.thresholdCondition || '>';
        if (condition === '>') {
          if (numValue > thresholdNum) isAlert = true;
        } else if (condition === '<') {
          if (numValue < thresholdNum) isAlert = true;
        } else if (condition === '==') {
          if (numValue === thresholdNum) isAlert = true;
        }
      }
    }
    if (config.enableLowerLimit && config.thresholdMin !== undefined && config.thresholdMin !== '') {
      const thresholdMinNum = parseFloat(config.thresholdMin);
      if (!isNaN(thresholdMinNum) && numValue < thresholdMinNum) {
        isAlert = true;
      }
    }
  }
  
  const getActiveColor = (valPercent, stops) => {
    if (!stops || stops.length === 0) return config.color || (config.gaugeStyle?.includes('donut') ? '#a855f7' : '#00f2fe');
    for (let stop of stops) {
      if (valPercent * 100 <= parseFloat(stop.limit)) {
        return stop.color;
      }
    }
    return stops[stops.length - 1].color;
  };

  const activeColor = getActiveColor(percentage, sortedStops);
  const displayColor = activeColor;
  
  const defaultIcon = (config.gaugeStyle === 'radial-donut' || config.gaugeStyle === 'radialDonut') ? PieChart : Activity;
  const SelectedIcon = (config.iconName && ICON_MAP[config.iconName]) ? ICON_MAP[config.iconName] : defaultIcon;

  const styleType = config.gaugeStyle || 'half-circle';

  // 1. ================= HORSESHOE WITH NEEDLE =================
  if (styleType === 'horseshoe') {
    const C = 2 * Math.PI * 40; // 251.327
    const arcLength = C * 0.75; // 188.495
    
    let segments = [];
    if (config.colorMode === 'solid' || sortedStops.length === 0) {
      segments = [{ color: activeColor, length: arcLength, rotation: 135 }];
    } else {
      let previousLimit = 0;
      segments = sortedStops.map((stop) => {
        const limit = Math.min(Math.max(parseFloat(stop.limit), 0), 100);
        const fraction = Math.max(limit - previousLimit, 0) / 100;
        const length = fraction * arcLength;
        const rotation = 135 + (previousLimit / 100) * 270;
        previousLimit = limit;
        return { color: stop.color, length, rotation };
      });
    }
    
    // Needle rotation: 0% -> -135deg, 100% -> +135deg
    const needleRotation = percentage * 270 - 135;
    
    return (
      <div className={`flex flex-col h-full w-full rounded-xl overflow-hidden shadow-xl transition-colors duration-300 relative ${isAlert ? 'bg-red-50 dark:bg-red-950/40 border-2 border-red-500 animate-pulse' : 'bg-surface border border-line'}`} style={{ containerType: 'size' }}>
        {config?.showTitle !== false && (
          <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0 w-full z-10">
            <div className="flex items-center gap-2 min-w-0">
              {SelectedIcon && <SelectedIcon size={16} className={`shrink-0 ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`} />}
              <span className={`text-xs sm:text-sm font-semibold truncate ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-fg'}`}>
                {title || config?.title || 'Gauge'}
              </span>
            </div>
          </div>
        )}
        <div className="relative flex-1 w-full min-h-0 flex items-center justify-center p-3">
          <div 
            className="relative flex items-center justify-center shrink-0 w-full h-full max-w-[100cqh] max-h-[100cqw]"
            style={{ width: 'min(100cqw, 100cqh - 10px)', height: 'min(100cqw, 100cqh - 10px)' }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-md">
              <circle cx="50" cy="50" r="40" fill="none" className="stroke-surface-3" strokeWidth="14" strokeDasharray={`${arcLength} ${C}`} transform="rotate(135 50 50)" />
              {segments.map((seg, i) => (
                <circle key={i} cx="50" cy="50" r="40" fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={`${seg.length + 0.5} ${C}`} transform={`rotate(${seg.rotation} 50 50)`} />
              ))}
              <g 
                style={{
                  transform: `rotate(${needleRotation}deg)`,
                  transformOrigin: '50px 50px',
                  transition: 'transform 0.5s ease-out'
                }}
              >
                <circle cx="50" cy="50" r="4" className="fill-surface-4" />
                <circle cx="50" cy="50" r="2" className="fill-fg-muted" />
                <polygon points="48,50 52,50 50,15" fill={config.colorMode === 'solid' ? activeColor : 'var(--fg-faint)'} className="transition-colors duration-300" />
              </g>
            </svg>
            
            <div className="absolute top-[60%] flex flex-col items-center justify-center pointer-events-none">
              <span className="font-black drop-shadow-md tracking-tighter transition-colors duration-300 leading-none" style={{ color: displayColor, fontSize: `calc(clamp(1.2rem, ${displayValue.length > 4 ? '10cqw' : '15cqw'}, 3.5rem) * ${valScale})` }}>
                {displayValue}
              </span>
              {unit && <span className="text-fg-muted font-medium mt-1 uppercase tracking-widest leading-none" style={{ fontSize: `calc(clamp(0.5rem, 4cqw, 0.875rem) * ${unitScale})` }}>{unit}</span>}
            </div>
            {config.enableDisplayScale !== false && (
              <>
                <div className="absolute bottom-[10%] left-[5%] text-fg-subtle font-medium" style={{ fontSize: `calc(clamp(0.4rem, 4cqw, 0.75rem) * ${unitScale})` }}>{min}</div>
                <div className="absolute bottom-[10%] right-[5%] text-fg-subtle font-medium" style={{ fontSize: `calc(clamp(0.4rem, 4cqw, 0.75rem) * ${unitScale})` }}>{max}</div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. ================= RADIAL DONUT =================
  if (styleType === 'radial-donut' || styleType === 'radialDonut') {
    const donutColor = activeColor || config.color || '#a855f7';
    return (
      <div className={`flex flex-col h-full w-full rounded-xl overflow-hidden shadow-xl transition-colors duration-300 relative ${isAlert ? 'bg-red-50 dark:bg-red-950/40 border-2 border-red-500 animate-pulse' : 'bg-surface border border-line'}`} style={{ containerType: 'size' }}>
        {config?.showTitle !== false && (
          <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0 w-full z-10">
            <div className="flex items-center gap-2 min-w-0">
              {SelectedIcon && <SelectedIcon size={16} className={`shrink-0 ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-purple-600 dark:text-purple-400'}`} />}
              <span className={`text-xs sm:text-sm font-semibold truncate ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-fg'}`}>
                {title || config?.title || 'Radial Donut'}
              </span>
            </div>
          </div>
        )}
        
        <div className="flex-1 flex items-center justify-center p-3 min-h-0 w-full relative">
          <div className="relative w-[min(80cqw,80cqh)] h-[min(80cqw,80cqh)] max-w-[220px] max-h-[220px] flex items-center justify-center">
            <div className="absolute inset-[-10%] rounded-full border-[3px] border-line border-dashed opacity-70"></div>
            <div className="absolute inset-[-3%] rounded-full border border-line-strong"></div>
            <div className="absolute inset-[5%] rounded-full" style={{ boxShadow: `0 0 30px ${donutColor}50` }}></div>
            
            <div 
              className="absolute inset-0 rounded-full transition-all duration-500"
              style={{
                background: `conic-gradient(${donutColor} ${percentage100}%, transparent 0)`,
                maskImage: 'radial-gradient(transparent 58%, black 59%)',
                WebkitMaskImage: 'radial-gradient(transparent 58%, black 59%)',
                filter: `drop-shadow(0 0 6px ${donutColor})`
              }}
            ></div>
            
            <div 
              className="absolute inset-0 rounded-full bg-white/5 pointer-events-none" 
              style={{ 
                maskImage: 'radial-gradient(transparent 58%, black 59%)', 
                WebkitMaskImage: 'radial-gradient(transparent 58%, black 59%)'
              }}>
            </div>

            <div className="z-10 flex flex-col items-center mt-1">
              <span 
                className="font-black text-fg drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] tracking-tighter" 
                style={{ fontSize: `calc(clamp(1rem, ${percentage100.toFixed(0).length > 3 ? '12cqw' : '16cqw'}, 3rem) * ${valScale})` }}
              >
                {percentage100.toFixed(0)}<span className="text-[0.6em] text-purple-600 dark:text-purple-400 ml-0.5">%</span>
              </span>
              <div className="text-fg-subtle tracking-wider mt-0.5 uppercase flex items-center gap-1" style={{ fontSize: `calc(clamp(0.5rem, 5cqw, 0.75rem) * ${unitScale})` }}>
                <span>{displayValue}</span>
                {unit && <span>{unit}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. ================= CAPACITY BAR =================
  if (styleType === 'capacity-bar' || styleType === 'capacityBar') {
    const isHorizontal = config.orientation === 'horizontal';
    let bgStyle = activeColor;
    let shadowStyle = `0 0 15px ${activeColor}80`;

    if (sortedStops.length > 0) {
      if (config.colorMode === 'solid') {
        bgStyle = activeColor;
        shadowStyle = `0 0 15px ${activeColor}80`;
      } else {
        let gradientStr = '';
        let prevLimit = 0;
        sortedStops.forEach((stop, i) => {
          const limit = Math.min(Math.max(parseFloat(stop.limit), 0), 100);
          gradientStr += `${stop.color} ${prevLimit}%, ${stop.color} ${limit}%${i < sortedStops.length - 1 ? ', ' : ''}`;
          prevLimit = limit;
        });
        bgStyle = `linear-gradient(${isHorizontal ? 'to right' : 'to top'}, ${gradientStr})`;
        shadowStyle = `0 0 15px ${activeColor}80`;
      }
    }

    return (
      <div className={`flex flex-col h-full w-full rounded-xl overflow-hidden shadow-xl transition-colors duration-300 relative ${isAlert ? 'bg-red-50 dark:bg-red-950/40 border-2 border-red-500 animate-pulse' : 'bg-surface border border-line'}`} style={{ containerType: 'size' }}>
        {config?.showTitle !== false && (
          <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0 w-full z-10">
            <div className="flex items-center gap-2 min-w-0">
              {SelectedIcon && <SelectedIcon size={16} className={`shrink-0 ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`} />}
              <span className={`text-xs sm:text-sm font-semibold truncate ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-fg'}`}>
                {title || config?.title || 'Capacity Bar'}
              </span>
            </div>
          </div>
        )}
        
        <div className={`flex-1 flex items-center justify-center gap-[6cqw] p-4 ${isHorizontal ? 'flex-col' : 'flex-row'}`}>
          <div className={`relative p-[2cqw] bg-surface-2 rounded-3xl border-[max(1px,0.2cqw)] border-line-strong/50 shadow-xl ${isHorizontal ? 'rounded-l-none' : 'rounded-t-none'}`}>
            <div className={`relative bg-canvas rounded-full border border-fg/10 shadow-well-deep overflow-hidden flex ${
              isHorizontal ? 'rounded-l-sm flex-row justify-start' : 'rounded-t-sm flex-col justify-end'
            }`} style={{
              width: isHorizontal ? 'min(70cqw, 200cqh)' : 'min(20cqw, 30cqh)',
              height: isHorizontal ? 'min(15cqw, 30cqh)' : 'min(60cqh, 200cqw)',
              minWidth: isHorizontal ? '100px' : '30px',
              minHeight: isHorizontal ? '25px' : '80px',
            }}>
              <div className={`absolute z-20 bg-white/20 rounded-sm ${
                isHorizontal
                ? 'left-0 top-[-2px] bottom-[-2px] w-[3cqw] min-w-[4px] max-w-[8px]'
                : 'top-0 left-[-2px] right-[-2px] h-[3cqw] min-h-[4px] max-h-[8px]'
              }`}></div>
              
              <div 
                className="absolute inset-0 transition-all duration-700 ease-out z-10"
                style={{ 
                  background: bgStyle,
                  boxShadow: shadowStyle,
                  clipPath: isHorizontal ? `inset(0 ${100 - percentage100}% 0 0)` : `inset(${100 - percentage100}% 0 0 0)`
                }}
              ></div>

              <div 
                className={`absolute z-10 bg-white/40 rounded-full blur-[1px] transition-all duration-700 ease-out ${
                  isHorizontal
                  ? 'w-[3cqw] min-w-[4px] max-w-[8px] h-full top-0'
                  : 'h-[3cqw] min-h-[4px] max-h-[8px] w-full left-0'
                }`}
                style={{
                  [isHorizontal ? 'left' : 'bottom']: `calc(${percentage100}% - 4px)` 
                }}
              ></div>
              
              <div className={`absolute from-white/20 to-transparent rounded-full z-20 pointer-events-none bg-gradient-to-b ${
                isHorizontal
                ? 'top-[15%] left-[5%] right-[5%] h-[20%]'
                : 'top-[5%] bottom-[5%] left-[15%] w-[20%]'
              }`}></div>
            </div>
          </div>
          
          <div className={`flex ${isHorizontal ? 'flex-row items-baseline gap-4 mt-2' : 'flex-col'}`}>
            <div className="font-black drop-shadow-md tracking-tight transition-colors duration-300" style={{ color: displayColor, fontSize: `calc(clamp(1.5rem, 12cqw, 3.5rem) * ${valScale})` }}>
              {percentage100.toFixed(0)}%
            </div>
            <div className="font-medium tracking-wider transition-colors duration-300" style={{ color: displayColor, opacity: 0.8, fontSize: `calc(clamp(0.6rem, 4cqw, 1rem) * ${unitScale})` }}>
              {displayValue} {config.enableDisplayScale !== false ? `/ ${max}` : ''} {unit}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. ================= MODERN HALF-CIRCLE (DEFAULT) =================
  const rotation = percentage * 180 - 180; // -180 to 0
  const innerSize = 100 - (thickness * 2);
  const innerPos = thickness; 
  
  let bgStyle = `conic-gradient(from 270deg, ${activeColor} 0deg, ${activeColor} 180deg, transparent 180deg)`;
  if (sortedStops.length > 0) {
    if (config.colorMode === 'solid') {
      bgStyle = `conic-gradient(from 270deg, ${activeColor} 0deg, ${activeColor} 180deg, transparent 180deg)`;
    } else {
      let gradientStr = '';
      let prevDeg = 0;
      sortedStops.forEach((stop, i) => {
        const limit = Math.min(Math.max(parseFloat(stop.limit), 0), 100);
        const deg = (limit / 100) * 180;
        gradientStr += `${stop.color} ${prevDeg}deg ${deg}deg${i < sortedStops.length - 1 ? ', ' : ''}`;
        prevDeg = deg;
      });
      bgStyle = `conic-gradient(from 270deg, ${gradientStr}, transparent 180deg)`;
    }
  }
  
  return (
    <div className={`flex flex-col h-full w-full rounded-xl overflow-hidden shadow-xl transition-colors duration-300 relative ${isAlert ? 'bg-red-50 dark:bg-red-950/40 border-2 border-red-500 animate-pulse' : 'bg-surface border border-line'}`} style={{ containerType: 'size' }}>
      {config?.showTitle !== false && (
        <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0 w-full z-10">
          <div className="flex items-center gap-2 min-w-0">
            {SelectedIcon && <SelectedIcon size={16} className={`shrink-0 ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`} />}
            <span className={`text-xs sm:text-sm font-semibold truncate ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-fg'}`}>
              {title || config?.title || 'Gauge'}
            </span>
          </div>
        </div>
      )}
      
      <div className="relative w-full flex-1 flex flex-col justify-center items-center p-3 mb-2 min-h-0">
        <div 
          className="relative flex flex-col items-center w-full"
          style={{ maxWidth: 'min(90cqw, calc((100cqh - 60px) * 2))' }}
        >
          <div className="relative w-full aspect-[2/1] overflow-hidden flex justify-center shrink-0">
            <div className="absolute top-0 left-0 w-full aspect-square">
              <div className="absolute inset-0 rounded-full bg-surface-2 border-[max(1px,0.2cqw)] border-line-subtle/50 box-border"></div>
              
              <div 
                 className="absolute inset-0 rounded-full origin-center box-border transition-colors duration-300" 
                 style={{
                   background: bgStyle,
                   transform: `rotate(${rotation}deg)`,
                   transition: 'transform 0.5s ease-out, background 0.3s'
                 }}>
              </div>
              
              <div 
                className="absolute bg-surface rounded-full z-10 shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] border-[max(1px,0.2cqw)] border-line box-border"
                style={{
                  width: `${innerSize}%`,
                  height: `${innerSize}%`,
                  top: `${innerPos}%`,
                  left: `${innerPos}%`,
                }}
              ></div>
            </div>
            
            <div className="absolute bottom-[2%] left-0 right-0 z-20 flex flex-col items-center justify-end pointer-events-none px-4">
              <div 
                className="font-bold drop-shadow-[0_0_8px_rgba(0,0,0,0.5)] tracking-tight flex flex-col items-center justify-center leading-none transition-colors duration-300"
                style={{ color: displayColor, fontSize: `calc(clamp(1rem, ${displayValue.length > 4 ? '10cqw' : '14cqw'}, 3rem) * ${valScale})` }}
              >
                <span>{displayValue}</span>
                {unit && <span className="opacity-80 font-medium mt-1 leading-none uppercase" style={{ fontSize: `calc(clamp(0.5rem, 4cqw, 0.875rem) * ${unitScale})` }}>{unit}</span>}
              </div>
            </div>
          </div>
          {config.enableDisplayScale !== false && (
            <div className="flex justify-between w-full pointer-events-none text-fg-subtle font-medium mt-1 shrink-0 px-[2%]" style={{ fontSize: `calc(clamp(0.4rem, 4cqw, 0.75rem) * ${unitScale})` }}>
              <span>{min}</span>
              <span>{max}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
