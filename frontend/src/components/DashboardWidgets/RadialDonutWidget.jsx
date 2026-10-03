import React from 'react';
import { PieChart } from 'lucide-react';

export default function RadialDonutWidget({ title, value, unit, config = {} }) {
  const max = config.max || 100;
  let numValue = parseFloat(value) || 0;
  let percentageRaw = Math.min((numValue / max) * 100, 100);
  
  let decimals = 0;
  if (config.decimals !== undefined && config.decimals !== '') {
      decimals = parseInt(config.decimals, 10);
  }
  const percentage = percentageRaw.toFixed(decimals);
  
  const color = config.color || '#a855f7'; // Default to purple to match mockup

  return (
    <div className="flex flex-col h-full w-full rounded-xl overflow-hidden bg-surface border border-line shadow-xl transition-colors duration-300 relative" style={{ containerType: 'size' }}>
      {config?.showTitle !== false && (
        <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0 w-full z-10">
          <div className="flex items-center gap-2 min-w-0">
            <PieChart size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-fg truncate">
              {title || config?.title || 'Radial Donut'}
            </span>
          </div>
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-center p-3 min-h-0 w-full relative">
        <div className="relative w-[min(80cqw,80cqh)] h-[min(80cqw,80cqh)] max-w-[200px] max-h-[200px] flex items-center justify-center">
        {/* Outer segmented ring (fake it with a dashed border) */}
        <div className="absolute inset-[-10%] rounded-full border-[3px] border-line border-dashed opacity-70"></div>
        <div className="absolute inset-[-3%] rounded-full border border-line-strong"></div>
        
        {/* Glow backdrop */}
        <div className="absolute inset-[5%] rounded-full" style={{ boxShadow: `0 0 30px ${color}50` }}></div>
        
        {/* Main Donut - Using CSS Masking */}
        <div 
          className="absolute inset-0 rounded-full transition-all duration-500"
          style={{
            background: `conic-gradient(${color} ${percentageRaw}%, transparent 0)`,
            maskImage: 'radial-gradient(transparent 58%, black 59%)',
            WebkitMaskImage: 'radial-gradient(transparent 58%, black 59%)',
            filter: `drop-shadow(0 0 6px ${color})`
          }}
        ></div>
        
        {/* Track inner base */}
        <div 
          className="absolute inset-0 rounded-full bg-white/5 pointer-events-none" 
          style={{ 
            maskImage: 'radial-gradient(transparent 58%, black 59%)', 
            WebkitMaskImage: 'radial-gradient(transparent 58%, black 59%)'
          }}>
        </div>

        {/* Center Text */}
        <div className="z-10 flex flex-col items-center mt-1">
          <span 
            className="font-black text-fg drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] tracking-tighter" 
            style={{ fontSize: `clamp(1rem, ${percentage.length > 3 ? '12cqw' : '16cqw'}, 3rem)` }}
          >
             {percentage}<span className="text-[0.6em] text-purple-600 dark:text-purple-400 ml-0.5">%</span>
          </span>
          {unit && <span className="text-fg-subtle tracking-widest mt-1 uppercase" style={{ fontSize: 'clamp(0.5rem, 5cqw, 0.75rem)' }}>{unit}</span>}
        </div>
      </div>
    </div>
  </div>
  );
}
