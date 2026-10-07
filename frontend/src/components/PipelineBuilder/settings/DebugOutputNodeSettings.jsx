import React from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export default function DebugOutputNodeSettings({ nodeId, data, onChange }) {
  const clearDebugMessages = usePipelineStore((state) => state.clearDebugMessages);
  const debugMessages = usePipelineStore((state) => state.debugMessages || []);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs text-fg-muted leading-relaxed">
        Debug Output window displays live streaming JSON messages from connected Debug Nodes directly on the canvas.
      </div>

      <div className="bg-canvas border border-line rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-emerald-500" />
          <span className="text-xs font-semibold text-fg">Active Log Count:</span>
          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {debugMessages.length}
          </span>
        </div>
        <button
          type="button"
          onClick={clearDebugMessages}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-surface-2 hover:bg-red-500/20 text-fg-secondary hover:text-red-500 border border-line-strong hover:border-red-500/40 shadow-sm transition-all"
        >
          <Trash2 size={12} />
          <span>Clear Logs</span>
        </button>
      </div>

      <div className="bg-canvas/80 border border-line rounded-lg p-3 text-[11px] text-fg-subtle">
        Connect wires from any <strong className="text-fg">Debug Node</strong> output to this node input to start streaming inspection records.
      </div>
    </div>
  );
}
