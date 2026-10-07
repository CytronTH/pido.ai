import React from 'react';
import { Timer } from 'lucide-react';

export default function RateLimitNodeSettings({ nodeId, data, onChange }) {
  const rate = data?.rate ?? 1;
  const period = data?.period || 'second';

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs text-fg-muted leading-relaxed">
        Limits the rate of messages passing through. Excess messages are dropped to prevent downstream overload.
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Rate Limit Rule</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-secondary">Allow</span>
          <input 
            type="number"
            min="0.1"
            step="0.1"
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-teal-500 nodrag w-20 text-center font-mono text-fg"
            value={rate}
            onChange={(e) => onChange({ rate: parseFloat(e.target.value) || 1 })}
          />
          <span className="text-xs text-fg-secondary">msg(s) per</span>
          <select
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-teal-500 nodrag flex-1 text-fg"
            value={period}
            onChange={(e) => onChange({ period: e.target.value })}
          >
            <option value="second">Second</option>
            <option value="minute">Minute</option>
            <option value="hour">Hour</option>
          </select>
        </div>
      </div>

      <div className="bg-canvas/80 border border-line rounded-lg p-3 text-[11px] text-fg-subtle flex items-start gap-2">
        <Timer size={15} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
        <span>
          Current limit: maximum <strong>{rate}</strong> payload{rate > 1 ? 's' : ''} allowed per <strong>{period}</strong>.
        </span>
      </div>
    </div>
  );
}
