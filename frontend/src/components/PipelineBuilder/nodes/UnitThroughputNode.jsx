import React, { useEffect, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Activity, AlertTriangle, RotateCcw } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import UnitThroughputNodeSettings from '../settings/UnitThroughputNodeSettings';

export default function UnitThroughputNode({ id, data, selected }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const debugData = usePipelineStore(s => s.debugData || {});
  const edges = usePipelineStore(s => s.edges);
  const nodes = usePipelineStore(s => s.nodes);
  const debugState = debugData[id] || {};
  
  const liveRate = debugState?.throughput ?? debugState?.current_rate_per_minute ?? data?.throughput ?? 0;
  const liveAvgRate = debugState?.average_rate ?? debugState?.average_rate_per_minute ?? 0;
  const liveCount = debugState?.current_unit ?? debugState?.total_units ?? data?.current_unit ?? 0;
  const isRunning = debugState?.is_running ?? data?.is_running ?? false;
  
  const isCompact = data?.viewMode === 'compact';

  // Detect conflict: incoming edge connected directly from aiNode
  const hasConflict = useMemo(() => {
    return edges.some(edge => {
      if (edge.target !== id) return false;
      const sourceNode = nodes.find(n => n.id === edge.source);
      return sourceNode?.type === 'aiNode';
    });
  }, [edges, nodes, id]);

  useEffect(() => {
    if (data?.label === undefined) {
      updateNodeData(id, { 
        label: 'Unit Throughput',
        startTrigger: 'first_object',
        pauseTrigger: 'timeout',
        pauseTimeoutSeconds: 60,
        windowMode: 'time',
        windowSeconds: 60,
        windowSamples: 10,
        startTimeConfig: '08:00',
        pauseTimeConfig: '17:00',
        autoResetDaily: false,
        rateUnit: 'minute'
      });
    }
  }, [id, data?.label, updateNodeData]);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  const containerClasses = hasConflict
    ? 'border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.7)] animate-pulse'
    : selected
      ? 'border-indigo-400 shadow-indigo-500/20'
      : 'border-indigo-600 shadow-indigo-900/20';

  return (
    <div className={`bg-surface border-2 ${containerClasses} rounded-xl shadow-lg text-fg flex flex-col overflow-hidden transition-all duration-300 ${isCompact ? 'w-48' : 'w-72'}`}>
      <NodeHeader
        id={id}
        icon={Activity}
        iconBg={hasConflict ? "bg-rose-600" : "bg-indigo-600"}
        headerBg={hasConflict ? "bg-rose-600/20 border-rose-900/50" : "bg-indigo-600/20 border-indigo-900/50"}
        defaultName="Unit Throughput"
        defaultSubtitle={hasConflict ? '⚠️ Conflict (ไม่นับชิ้นงาน)' : (isRunning ? '● Running' : '○ Paused')}
        data={data}
      >
        {!isCompact && (
          <div className="text-[10px] flex items-center gap-1 bg-surface-2 px-1.5 py-0.5 rounded border border-line-strong">
            <span className={`w-2 h-2 rounded-full ${hasConflict ? 'bg-rose-500 shadow-[0_0_5px_#f43f5e]' : (isRunning ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-fg-subtle')}`}></span>
            <span className={`font-medium ${hasConflict ? 'text-rose-400' : 'text-fg-muted'}`}>
              {hasConflict ? 'Conflict' : (isRunning ? 'Running' : 'Paused')}
            </span>
          </div>
        )}
      </NodeHeader>

      {/* Conflict notice bar inside node */}
      {hasConflict && (
        <div className="bg-rose-500/20 border-b border-rose-500/40 px-3 py-1.5 text-[11px] text-rose-300 flex items-center gap-1.5 font-medium">
          <AlertTriangle size={13} className="shrink-0 text-rose-400" />
          <span>ต่อตรงกับ AI Model — โหนดจะไม่นับข้อมูล</span>
        </div>
      )}

      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          {/* Node mode badges */}
          <div className="flex items-center justify-between text-[10px] text-fg-subtle px-0.5">
            <span className="font-mono bg-surface-2 px-1.5 py-0.5 rounded border border-line-strong text-fg-muted">
              {data?.windowMode === 'count' ? `Window: ${data?.windowSamples ?? 10} pcs` : `Window: ${data?.windowSeconds ?? 60}s`}
            </span>
            <span className="text-fg-muted">
              {data?.startTrigger === 'time' ? `⏰ ${data?.startTimeConfig || '08:00'}` : (data?.startTrigger === 'first_object' ? '🎯 1st Obj' : '✋ Manual')}
            </span>
          </div>

          {/* Quick Stats on the Node itself */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-canvas p-2 rounded border border-line text-center">
              <div className="text-[10px] uppercase text-fg-subtle">Current Rate</div>
              <div className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                {hasConflict ? '0.0' : Number(liveRate).toFixed(data?.decimalPlaces ?? (data?.rateUnit === 'second' ? 2 : 1))} <span className="text-[9px]">/{data?.rateUnit === 'second' ? 's' : (data?.rateUnit === 'hour' ? 'h' : 'm')}</span>
              </div>
              <div className="text-[9px] text-fg-muted font-mono mt-0.5" title="All-time average rate">
                Avg: {hasConflict ? '0.0' : Number(liveAvgRate).toFixed(data?.decimalPlaces ?? (data?.rateUnit === 'second' ? 2 : 1))}
              </div>
            </div>
            <div className="bg-canvas p-2 rounded border border-line text-center relative group">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] uppercase text-fg-subtle">Total Units</span>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const pid = usePipelineStore.getState().projectId || 'default';
                    try {
                      await fetch('/api/analytics/throughput/reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ project_id: pid, node_id: id })
                      });
                      const setDebugData = usePipelineStore.getState().setDebugData;
                      if (setDebugData) {
                        setDebugData(id, {
                          ...debugState,
                          current_unit: 0,
                          total_units: 0,
                          throughput: 0,
                          current_rate: 0,
                          average_rate: 0,
                          current_rate_per_sec: 0,
                          average_rate_per_sec: 0,
                          current_rate_per_min: 0,
                          average_rate_per_min: 0,
                          current_rate_per_hour: 0,
                          average_rate_per_hour: 0
                        });
                      }
                      updateNodeData(id, { current_unit: 0, total_units: 0, throughput: 0 });
                    } catch (err) {
                      console.error("Failed to reset throughput counter:", err);
                    }
                  }}
                  className="text-fg-faint hover:text-red-500 hover:bg-surface-2 p-0.5 rounded transition-colors"
                  title="Reset Counter to 0"
                >
                  <RotateCcw size={11} />
                </button>
              </div>
              <div className="text-sm font-mono text-blue-600 dark:text-blue-400 font-bold">
                {hasConflict ? '0' : liveCount}
              </div>
              <div className="text-[9px] text-fg-muted mt-0.5">
                {isRunning ? '● Running' : '○ Paused'}
              </div>
            </div>
          </div>

          <UnitThroughputNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      {/* Input from AI Model / upstream */}
      <Handle type="target" position={Position.Left} className={`w-3 h-3 ${hasConflict ? 'bg-rose-500' : 'bg-indigo-500'} border-2 border-line-subtle`} />
      {/* Output downstream if needed */}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500 border-2 border-line-subtle" />
    </div>
  );
}
