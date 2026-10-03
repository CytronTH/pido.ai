import React from 'react';
import { AlignLeft } from 'lucide-react';

export default function TextWidget({ title, value, unit, icon: Icon = AlignLeft }) {
  const isBoolean = typeof value === 'boolean';
  
  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-xl overflow-hidden shadow-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={20} className="text-pink-600 dark:text-pink-400" />
        <h3 className="text-fg-muted font-semibold text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <div className="flex-1 flex items-center justify-center p-2 text-center">
        <div className={`font-black tracking-tight break-words ${isBoolean ? 'text-5xl' : 'text-3xl'}`}>
          {value !== undefined && value !== null ? (
            isBoolean ? (
              <span className={value ? 'text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]'}>
                {value ? 'TRUE' : 'FALSE'}
                <div className="text-[10px] text-fg-subtle mt-2 font-normal">
                  Updated: {new Date().toLocaleTimeString()}
                </div>
              </span>
            ) : (
              <span className="text-fg">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            )
          ) : (
            <span className="text-fg-faint">--</span>
          )}
          {unit && <span className="text-xl text-fg-subtle ml-2">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
