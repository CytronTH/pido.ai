import React, { useMemo } from 'react';
import { Focus } from 'lucide-react';

export default function DetectionCounterWidget({ metadata, config = {} }) {
  
  const counts = useMemo(() => {
    if (!metadata || !metadata.detections) return {};
    const c = {};
    metadata.detections.forEach(det => {
      c[det.label] = (c[det.label] || 0) + 1;
    });
    return c;
  }, [metadata]);

  const total = useMemo(() => {
    return Object.values(counts).reduce((a, b) => a + b, 0);
  }, [counts]);

  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
      {config?.showTitle !== false && (
        <div className="bg-surface-2/80 px-3 py-2 flex items-center gap-2 border-b border-line-strong shrink-0">
          <Focus size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-fg truncate">{config?.title || 'Live Detections'}</span>
        </div>
      )}
      <div className="flex-1 p-4 flex flex-col items-center justify-center">
        <div className="text-6xl font-bold text-fg mb-2 tracking-tighter shadow-sm">
          {total}
        </div>
        <div className="text-fg-muted text-sm font-medium mb-4 uppercase tracking-wider">
          Total Objects
        </div>
        
        <div className="w-full space-y-2 mt-auto">
          {Object.entries(counts).map(([label, count]) => (
            <div key={label} className="flex items-center justify-between bg-surface/50 px-3 py-1.5 rounded-lg border border-line">
              <span className="text-fg-secondary capitalize text-sm">{label}</span>
              <span className="text-fg font-bold text-sm bg-blue-600 px-2 py-0.5 rounded-md">{count}</span>
            </div>
          ))}
          {total === 0 && (
            <div className="text-center text-fg-muted text-sm italic py-2">
              No objects detected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
