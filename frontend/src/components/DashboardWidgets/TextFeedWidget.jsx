import React from 'react';
import { AlignLeft } from 'lucide-react';

export default function TextFeedWidget({ title, feedData = [], config = {}, icon: Icon = AlignLeft }) {
  const renderValue = (val) => {
    if (val === undefined || val === null) return <span className="text-fg-muted italic">-</span>;
    if (typeof val === 'boolean') {
      return <span className={val ? 'text-green-600 dark:text-green-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>{val ? 'TRUE' : 'FALSE'}</span>;
    }
    if (typeof val === 'number') {
      return <span className="text-blue-700 dark:text-blue-300">{Number.isInteger(val) ? val : val.toFixed(4)}</span>;
    }
    if (Array.isArray(val)) {
      if (val.length > 0 && typeof val[0] === 'object') {
         const counts = val.reduce((acc, obj) => {
            const l = obj.label || 'item';
            acc[l] = (acc[l] || 0) + 1;
            return acc;
         }, {});
         const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ');
         return <span className="text-yellow-700 dark:text-yellow-300">Found: {summary || '0 items'}</span>;
      }
      return <span className="text-indigo-700 dark:text-indigo-300">[{val.join(', ')}]</span>;
    }
    if (typeof val === 'object') {
       if (val.label !== undefined) {
           return <span className="text-yellow-700 dark:text-yellow-300">{val.label} {val.confidence ? `(${(val.confidence*100).toFixed(0)}%)` : ''}</span>;
       }
       return <span className="text-fg-muted text-xs">{JSON.stringify(val)}</span>;
    }
    return <span className="text-fg-secondary">{String(val)}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
      {config?.showTitle !== false && (
        <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-fg truncate">
              {title || config?.title || 'Text Feed'}
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {feedData.length > 0 ? (
          feedData.map((item, index) => {
            const isWrapped = item && typeof item === 'object' && ('timestamp' in item) && ('value' in item || 'text' in item || 'message' in item);
            const ts = isWrapped ? item.timestamp : new Date().toLocaleTimeString();
            const val = isWrapped ? (item.value !== undefined ? item.value : (item.text || item.message)) : item;
            
            return (
              <div key={index} className="text-sm text-fg-secondary bg-surface-2/50 p-2 rounded border border-line-strong/50 font-mono flex items-start gap-2">
                <span className="text-xs text-fg-muted mt-0.5 shrink-0">[{ts}]</span>
                <div className="flex-1 overflow-hidden break-words">{renderValue(val)}</div>
              </div>
            );
          })
        ) : (
          <div className="text-fg-muted text-sm italic flex items-center justify-center h-full">
            No data
          </div>
        )}
      </div>
    </div>
  );
}
