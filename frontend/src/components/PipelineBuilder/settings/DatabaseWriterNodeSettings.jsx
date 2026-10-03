import React from 'react';
import PayloadPathSelector from './PayloadPathSelector';

export default function DatabaseWriterNodeSettings({ nodeId, data, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium mb-1 text-fg-muted">Variable Name</label>
        <input
          type="text"
          className="w-full bg-canvas border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-teal-500 transition-colors text-fg"
          value={data?.variableName || ''}
          onChange={(e) => onChange({ variableName: e.target.value })}
          placeholder="e.g. daily_revenue"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="block text-xs font-medium text-fg-muted">Payload Property</label>
        <input
          type="text"
          className="w-full bg-canvas border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono text-fg"
          value={data?.propertyPath || ''}
          onChange={(e) => onChange({ propertyPath: e.target.value })}
          placeholder="e.g. counts.person or total"
        />
        <p className="text-[10px] text-fg-subtle">If the incoming data is an object (like from Flow Counter), specify which field to save.</p>
        
        <div className="mt-2">
          <PayloadPathSelector 
            nodeId={nodeId}
            selectedPath={data?.propertyPath}
            onSelect={(path) => onChange({ propertyPath: path })}
            maxHeight="200px"
          />
        </div>
      </div>
      <div className="border-t border-line pt-4 mt-2">
        <label className="block text-xs font-medium mb-2 text-fg-muted">Write Strategy</label>
        <select
          className="w-full bg-canvas border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-teal-500 mb-3 text-fg"
          value={data?.writeStrategy || 'on_change'}
          onChange={(e) => onChange({ writeStrategy: e.target.value })}
        >
          <option value="on_change">On Change Only (Recommended for discrete)</option>
          <option value="aggregation">Time-Window Aggregation (Recommended for continuous)</option>
          <option value="raw">Raw (Write Every Message)</option>
        </select>
        
        {data?.writeStrategy === 'raw' && (
          <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold mb-3">⚠️ Warning: May cause high CPU and DB bloat at high FPS.</p>
        )}

        {(data?.writeStrategy === 'on_change' || !data?.writeStrategy) && (
          <div className="flex flex-col gap-3 bg-canvas/50 p-3 rounded-lg border border-line/80 mb-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-fg-muted">Deadband Threshold</label>
              <input
                type="number"
                className="w-full bg-surface border border-line-strong rounded-md p-1.5 text-sm focus:outline-none focus:border-teal-500 text-fg"
                value={data?.deadband !== undefined ? data.deadband : 0}
                onChange={(e) => onChange({ deadband: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 0.5"
                step="0.1"
              />
              <p className="text-[9px] mt-1 text-fg-subtle">Ignore changes smaller than this value (0 = disabled).</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-fg-muted">Heartbeat Interval (sec)</label>
              <input
                type="number"
                className="w-full bg-surface border border-line-strong rounded-md p-1.5 text-sm focus:outline-none focus:border-teal-500 text-fg"
                value={data?.heartbeatInterval !== undefined ? data.heartbeatInterval : 60}
                onChange={(e) => onChange({ heartbeatInterval: parseInt(e.target.value, 10) || 0 })}
                placeholder="e.g. 60"
              />
              <p className="text-[9px] mt-1 text-fg-subtle">Force write if value stays constant for this long.</p>
            </div>
          </div>
        )}

        {data?.writeStrategy === 'aggregation' && (
          <div className="flex flex-col gap-3 bg-canvas/50 p-3 rounded-lg border border-line/80 mb-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-fg-muted">Window Size (sec)</label>
              <input
                type="number"
                className="w-full bg-surface border border-line-strong rounded-md p-1.5 text-sm focus:outline-none focus:border-teal-500 text-fg"
                value={data?.windowSize || 5}
                onChange={(e) => onChange({ windowSize: parseInt(e.target.value, 10) || 5 })}
                placeholder="e.g. 5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-fg-muted">Aggregation Math</label>
              <select
                className="w-full bg-surface border border-line-strong rounded-md p-1.5 text-sm focus:outline-none focus:border-teal-500 text-fg"
                value={data?.aggregationMethod || 'average'}
                onChange={(e) => onChange({ aggregationMethod: e.target.value })}
              >
                <option value="average">Average (Mean)</option>
                <option value="max">Maximum</option>
                <option value="min">Minimum</option>
                <option value="latest">Latest Value</option>
              </select>
            </div>
          </div>
        )}
      </div>
      
      <div className="text-[10px] leading-relaxed bg-canvas/80 p-3 rounded-lg border border-line text-fg-subtle">
        Saves incoming numeric payloads to the database under the specified variable name. Useful for custom analytics.
      </div>
    </div>
  );
}
