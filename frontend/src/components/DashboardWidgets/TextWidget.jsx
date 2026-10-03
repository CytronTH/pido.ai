import React from 'react';
import { AlignLeft } from 'lucide-react';

export default function TextWidget({ title, value, unit, config = {}, icon: Icon = AlignLeft }) {
  const isBoolean = typeof value === 'boolean';
  
  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
      {config?.showTitle !== false && (
        <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={16} className="text-pink-600 dark:text-pink-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-fg truncate">
              {title || config?.title || 'Text'}
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center p-4 text-center">
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
