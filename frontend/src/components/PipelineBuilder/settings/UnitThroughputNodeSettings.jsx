import React from 'react';
import { RotateCcw, Activity, Clock, Timer, Settings2 } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export default function UnitThroughputNodeSettings({ nodeId, data, onChange, isSidebar }) {
  const debugState = usePipelineStore((state) => state.debugData?.[nodeId]) || {};
  const liveRate = debugState?.throughput ?? debugState?.current_rate_per_minute ?? data?.throughput ?? 0;
  const liveAvgRate = debugState?.average_rate ?? debugState?.average_rate_per_minute ?? 0;
  const liveCount = debugState?.current_unit ?? debugState?.total_units ?? data?.current_unit ?? 0;
  const isRunning = debugState?.is_running ?? data?.is_running ?? false;

  const startTrigger = data?.startTrigger || 'first_object';
  const pauseTrigger = data?.pauseTrigger || 'timeout';

  const handleReset = async () => {
    try {
      await fetch('/api/analytics/throughput/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: 'default', node_id: nodeId })
      });
    } catch (err) {
      console.error("Failed to reset throughput counter:", err);
    }
  };

  const handleManualToggle = async () => {
    try {
      await fetch('/api/analytics/throughput/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: 'default', node_id: nodeId, state: !isRunning })
      });
    } catch (err) {
      console.error("Failed to toggle throughput state:", err);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      
      {/* Settings section */}
      <div className="flex flex-col gap-3">
        {/* Start Trigger */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-fg-secondary">Start Trigger</label>
          <select 
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-indigo-500 w-full text-fg"
            value={startTrigger}
            onChange={(e) => onChange({ startTrigger: e.target.value })}
          >
            <option value="first_object">1st Object Detected</option>
            <option value="time">Scheduled Time</option>
            <option value="manual" disabled>Human Trigger (Coming Soon)</option>
            <option value="sensor" disabled>Hardware Sensor (Coming Soon)</option>
          </select>
          
          {startTrigger === 'time' && (
            <div className="flex flex-col gap-2 mt-1 bg-surface-2/60 p-2.5 rounded-md border border-line">
              <div className="flex items-center justify-between">
                <span className="text-xs text-fg-muted font-medium">Shift Start Time:</span>
                <input 
                  type="time" 
                  className="bg-surface border border-line-strong rounded px-2 py-1 text-sm focus:border-indigo-500 text-fg"
                  value={data?.startTimeConfig || '08:00'}
                  onChange={(e) => onChange({ startTimeConfig: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer hover:text-fg">
                <input 
                  type="checkbox"
                  className="rounded border-line-strong text-indigo-600 focus:ring-indigo-500"
                  checked={data?.autoResetDaily ?? false}
                  onChange={(e) => onChange({ autoResetDaily: e.target.checked })}
                />
                <span>Auto-reset count daily on shift start</span>
              </label>
            </div>
          )}
        </div>

        {/* Pause Trigger */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-fg-secondary">Pause Trigger</label>
          <select 
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-indigo-500 w-full text-fg"
            value={pauseTrigger}
            onChange={(e) => onChange({ pauseTrigger: e.target.value })}
          >
            <option value="timeout">Time After Last Object (Timeout)</option>
            <option value="time">Scheduled Time</option>
            <option value="manual" disabled>Human Trigger (Coming Soon)</option>
            <option value="sensor" disabled>Hardware Sensor (Coming Soon)</option>
          </select>
          
          {pauseTrigger === 'timeout' && (
            <div className="flex items-center gap-2 mt-1">
              <input 
                type="number" 
                min="1"
                className="bg-surface border border-line-strong rounded-md p-2 text-sm focus:border-indigo-500 w-24 text-fg"
                value={data?.pauseTimeoutSeconds ?? 60}
                onChange={(e) => onChange({ pauseTimeoutSeconds: parseInt(e.target.value, 10) || 1 })}
              />
              <span className="text-xs text-fg-muted">seconds of inactivity</span>
            </div>
          )}
          {pauseTrigger === 'time' && (
            <div className="flex items-center justify-between mt-1 bg-surface-2/60 p-2.5 rounded-md border border-line">
              <span className="text-xs text-fg-muted font-medium">Shift Pause Time:</span>
              <input 
                type="time" 
                className="bg-surface border border-line-strong rounded px-2 py-1 text-sm focus:border-indigo-500 text-fg"
                value={data?.pauseTimeConfig || '17:00'}
                onChange={(e) => onChange({ pauseTimeConfig: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Sliding Window Mode & Duration/Samples */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-fg-secondary">Window Mode</label>
          <select 
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-indigo-500 w-full text-fg"
            value={data?.windowMode || 'time'}
            onChange={(e) => onChange({ windowMode: e.target.value })}
          >
            <option value="time">Time-based Window (Seconds)</option>
            <option value="count">Count-based Window (Recent Units)</option>
          </select>

          {data?.windowMode === 'count' ? (
            <div className="flex items-center gap-2 mt-1">
              <input 
                type="number" 
                min="2"
                max="500"
                className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-indigo-500 w-24 text-fg"
                value={data?.windowSamples ?? 10}
                onChange={(e) => onChange({ windowSamples: parseInt(e.target.value, 10) || 10 })}
              />
              <span className="text-xs text-fg-muted">recent units (for Slow Cycle Lines)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <input 
                type="number" 
                min="5"
                max="3600"
                className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-indigo-500 w-24 text-fg"
                value={data?.windowSeconds ?? 60}
                onChange={(e) => onChange({ windowSeconds: parseInt(e.target.value, 10) || 60 })}
              />
              <span className="text-xs text-fg-muted">sec (for Current Rate)</span>
            </div>
          )}
        </div>
        
        {/* Mode Selector for rate calculation */}
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-fg-secondary">Rate Unit</label>
            <select 
              className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-indigo-500 w-full text-fg"
              value={data?.rateUnit || 'minute'}
              onChange={(e) => onChange({ rateUnit: e.target.value })}
            >
              <option value="second">Units / Second</option>
              <option value="minute">Units / Minute</option>
              <option value="hour">Units / Hour</option>
            </select>
        </div>
        
        {/* Decimal Places */}
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-fg-secondary">Decimal Places</label>
            <input 
              type="number"
              min="0"
              max="5"
              className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-indigo-500 w-full text-fg"
              value={data?.decimalPlaces ?? 2}
              onChange={(e) => onChange({ decimalPlaces: parseInt(e.target.value, 10) || 0 })}
            />
        </div>
      </div>

      <hr className="border-line" />

      {/* Live Telemetry Display */}
      <div className="bg-canvas p-3 rounded-lg border border-line flex flex-col gap-3">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Status:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isRunning ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-surface-3 text-fg-muted'}`}>
              {isRunning ? 'RUNNING' : 'PAUSED'}
            </span>
            {(startTrigger === 'manual' || pauseTrigger === 'manual') && (
              <button 
                type="button"
                onClick={handleManualToggle}
                className="px-2 py-1 bg-surface-2 hover:bg-surface-3 border border-line-strong text-xs rounded transition-colors text-fg"
              >
                {isRunning ? 'Pause' : 'Start'}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Current Rate:</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {Number(liveRate).toFixed(data?.decimalPlaces ?? (data?.rateUnit === 'second' ? 2 : 1))} <span className="text-xs font-sans font-normal text-fg-subtle">/{data?.rateUnit === 'second' ? 'sec' : (data?.rateUnit === 'hour' ? 'hr' : 'min')}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Avg Rate:</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold font-mono text-cyan-600 dark:text-cyan-400">
              {Number(liveAvgRate).toFixed(data?.decimalPlaces ?? (data?.rateUnit === 'second' ? 2 : 1))} <span className="text-xs font-sans font-normal text-fg-subtle">/{data?.rateUnit === 'second' ? 'sec' : (data?.rateUnit === 'hour' ? 'hr' : 'min')}</span>
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Total Units:</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">{liveCount}</span>
            <button
              type="button"
              onClick={handleReset}
              className="hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition-colors text-fg-muted"
              title="Reset Counter"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
