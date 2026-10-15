import React from 'react';
import { Target, RotateCcw, Info } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export default function TargetTrackerNodeSettings({ nodeId, data, onChange, isSidebar }) {
  const debugState = usePipelineStore((state) => state.debugData?.[nodeId]);
  const liveCount = debugState?.actual ?? data?.count ?? 0;
  const targetCount = data?.targetCount ?? 100;
  const isOverTarget = liveCount > targetCount;
  const inputMode = data?.inputMode || 'auto';

  const handleReset = async () => {
    try {
      await fetch('/api/analytics/counts/reset', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: 'default', node_id: nodeId })
      });
    } catch (err) {
      console.error("Failed to reset target tracker:", err);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Concept Info Card */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-[11px] text-fg-muted flex flex-col gap-1">
        <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Info size={13} /> Target Tracker (Pace & ETA)
        </span>
        <span className="leading-relaxed">
          โหนดนี้คำนวณ <b>Current Pace (Rolling 60s)</b> อิงตามจังหวะรอบผลิตจริง เพื่อพยากรณ์เวลาเสร็จสิ้น (ETA) ของล็อตการผลิต หากต้องการวิเคราะห์กำลังผลิตเฉลี่ยของเครื่องจักร (OEE) แนะนำให้ใช้ <b>Unit Throughput Node</b>
        </span>
      </div>

      {/* Target Count */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-fg-secondary">Target Count</label>
        <input 
          type="number"
          className="bg-surface-2 border border-line-strong rounded-md p-1.5 text-xs focus:outline-none focus:border-amber-500 w-full text-fg"
          value={data?.targetCount ?? 100}
          onChange={(e) => onChange({ targetCount: parseInt(e.target.value) || 1 })}
          min="1"
        />
      </div>

      {/* Unit Name */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-fg-secondary">Unit Name</label>
        <input 
          type="text"
          className="bg-surface-2 border border-line-strong rounded-md p-1.5 text-xs focus:outline-none focus:border-amber-500 w-full text-fg"
          value={data?.unitName || 'items'}
          onChange={(e) => onChange({ unitName: e.target.value })}
          placeholder="e.g. items, pcs, boxes"
        />
      </div>

      {/* Input Mode */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-fg-secondary">Input Mode</label>
        <select 
          className="bg-surface-2 border border-line-strong rounded-md p-1.5 text-xs focus:outline-none focus:border-amber-500 w-full text-fg cursor-pointer"
          value={inputMode}
          onChange={(e) => onChange({ inputMode: e.target.value })}
        >
          <option value="auto">Auto Detect (Pulse or Counter)</option>
          <option value="pulse">Pulse Mode (Digital Edge)</option>
          <option value="numeric">Numeric Stream (Counter/Total)</option>
        </select>
      </div>
      
      {/* Trigger Edge Condition (for Pulse / Auto mode) */}
      {inputMode !== 'numeric' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-fg-secondary">Counting Edge</label>
          <select 
            className="bg-surface-2 border border-line-strong rounded-md p-1.5 text-xs focus:outline-none focus:border-amber-500 w-full text-fg cursor-pointer"
            value={data?.edgeType || 'rising'}
            onChange={(e) => onChange({ edgeType: e.target.value })}
          >
            <option value="rising">Rising Edge (False ➔ True)</option>
            <option value="falling">Falling Edge (True ➔ False)</option>
          </select>
        </div>
      )}

      {/* Downstream Output Trigger Mode */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-fg-secondary">Downstream Output</label>
        <select 
          className="bg-surface-2 border border-line-strong rounded-md p-1.5 text-xs focus:outline-none focus:border-amber-500 w-full text-fg cursor-pointer"
          value={data?.outputMode || 'on_complete'}
          onChange={(e) => onChange({ outputMode: e.target.value })}
        >
          <option value="on_complete">Pulse Once on Target Reached</option>
          <option value="continuous">Continuous State (True while ≥ Target)</option>
        </select>
      </div>

      {/* Checkbox Options */}
      <div className="flex flex-col gap-1.5 pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-fg-secondary">
          <input 
            type="checkbox"
            checked={data?.allowOverTarget ?? true}
            onChange={(e) => onChange({ allowOverTarget: e.target.checked })}
            className="rounded border-line-strong text-amber-500 focus:ring-amber-500"
          />
          <span>Track Over-Target counts (&gt; 100%)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-xs text-fg-secondary">
          <input 
            type="checkbox"
            checked={data?.retainCountOnRestart ?? true}
            onChange={(e) => onChange({ retainCountOnRestart: e.target.checked })}
            className="rounded border-line-strong text-amber-500 focus:ring-amber-500"
          />
          <span>Retain count across restarts</span>
        </label>
      </div>

      {/* Reset Controls */}
      <div className="bg-canvas p-2.5 rounded-lg border border-line flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          <Target size={15} className="text-amber-700 dark:text-amber-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Current:</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold font-mono text-amber-700 dark:text-amber-400">{liveCount}</span>
            {isOverTarget && (
              <span className="text-[10px] text-emerald-500 font-mono font-medium">(+{liveCount - targetCount})</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition-colors text-fg-muted"
            title="Reset Tracker to 0"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
