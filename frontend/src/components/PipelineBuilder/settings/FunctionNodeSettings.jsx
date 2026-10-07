import React from 'react';
import { Code, Terminal } from 'lucide-react';

export default function FunctionNodeSettings({ nodeId, data, onChange }) {
  const code = data?.code ?? 'def process(msg):\n    # Modify msg.payload here\n    return msg';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
            Python Script (def process)
          </label>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Python 3</span>
        </div>
        <textarea
          className="nodrag bg-canvas border border-line-strong rounded-lg p-3 text-xs font-mono text-emerald-700 dark:text-emerald-300 focus:outline-none focus:border-emerald-500 resize-y leading-relaxed w-full min-h-[140px]"
          rows={8}
          value={code}
          onChange={(e) => onChange({ code: e.target.value })}
          spellCheck={false}
          placeholder="def process(msg):&#10;    return msg"
        />
      </div>

      <div className="bg-canvas/80 border border-line rounded-lg p-3 text-[11px] text-fg-subtle flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-fg-secondary">
          <Terminal size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span>Message Interface</span>
        </div>
        <p className="font-mono text-[10px] text-fg-muted bg-surface-2 p-1.5 rounded border border-line-strong/50">
          msg = {"{ 'payload': ..., 'metadata': ... }"}
        </p>
        <p className="text-[10px] text-fg-subtle">
          Function must return the modified <code className="text-emerald-600 dark:text-emerald-400">msg</code> object or <code className="text-emerald-600 dark:text-emerald-400">None</code> to drop the message.
        </p>
      </div>
    </div>
  );
}
