import React from 'react';
import { Terminal } from 'lucide-react';

export default function LogWidget({ metadata }) {
  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
      <div className="bg-surface-2/80 px-3 py-2 flex items-center gap-2 border-b border-line-strong shrink-0">
        <Terminal size={16} className="text-green-600 dark:text-green-400" />
        <span className="text-sm font-semibold text-fg">Raw AI Metadata</span>
      </div>
      <div className="flex-1 p-3 overflow-y-auto text-xs font-mono scrollbar-thin scrollbar-thumb-gray-700">
        {metadata ? (
          <pre className="text-green-600 dark:text-green-400 whitespace-pre-wrap">{JSON.stringify(metadata, null, 2)}</pre>
        ) : (
          <span className="text-fg-muted italic">Waiting for AI inference data...</span>
        )}
      </div>
    </div>
  );
}
