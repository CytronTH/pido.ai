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
            <option value="manual">Human Trigger (Manual)</option>
            <option value="time">Scheduled Time</option>
            <option value="sensor">Hardware Sensor</option>
          </select>
          
          {startTrigger === 'time' && (
            <input 
              type="time" 
              className="mt-1 bg-surface border border-line-strong rounded-md p-2 text-sm focus:border-indigo-500 text-fg"
              value={data?.startTimeConfig || ''}
              onChange={(e) => onChange({ startTimeConfig: e.target.value })}
              placeholder="08:00"
            />
          )}
          {startTrigger === 'sensor' && (
            <input 
              type="text" 
              className="mt-1 bg-surface border border-line-strong rounded-md p-2 text-sm focus:border-indigo-500 text-fg"
              value={data?.startSensorId || ''}
              onChange={(e) => onChange({ startSensorId: e.target.value })}
              placeholder="e.g. GPIO_4_IN"
            />
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
            <option value="manual">Human Trigger (Manual)</option>
            <option value="time">Scheduled Time</option>
            <option value="sensor">Hardware Sensor</option>
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
              <span className="text-xs text-fg-muted">seconds</span>
            </div>
          )}
          {pauseTrigger === 'time' && (
            <input 
              type="time" 
              className="mt-1 bg-surface border border-line-strong rounded-md p-2 text-sm focus:border-indigo-500 text-fg"
              value={data?.pauseTimeConfig || ''}
              onChange={(e) => onChange({ pauseTimeConfig: e.target.value })}
              placeholder="17:00"
            />
          )}
          {pauseTrigger === 'sensor' && (
            <input 
              type="text" 
              className="mt-1 bg-surface border border-line-strong rounded-md p-2 text-sm focus:border-indigo-500 text-fg"
              value={data?.pauseSensorId || ''}
              onChange={(e) => onChange({ pauseSensorId: e.target.value })}
              placeholder="e.g. GPIO_5_IN"
            />
          )}
        </div>

        {/* Sliding Window for Current Rate */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-fg-secondary">Sliding Window</label>
          <div className="flex items-center gap-2">
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
              {Number(liveRate).toFixed(data?.decimalPlaces ?? 2)} <span className="text-xs font-sans font-normal text-fg-subtle">/{data?.rateUnit || 'min'}</span>
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
              {Number(liveAvgRate).toFixed(data?.decimalPlaces ?? 2)} <span className="text-xs font-sans font-normal text-fg-subtle">/{data?.rateUnit || 'min'}</span>
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
