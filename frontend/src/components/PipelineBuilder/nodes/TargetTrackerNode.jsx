import React, { useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Target, CheckCircle2, TrendingUp } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import TargetTrackerNodeSettings from '../settings/TargetTrackerNodeSettings';

export default function TargetTrackerNode({ id, data, selected }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const debugData = usePipelineStore(s => s.debugData || {});
  const debugState = debugData[id] || {};

  const targetCount = data?.targetCount ?? 100;
  const liveCount = debugState?.actual ?? data?.count ?? 0;
  const progressPercent = debugState?.progress_percent ?? (targetCount > 0 ? (liveCount / targetCount) * 100 : 0);
  const etaSeconds = debugState?.eta_seconds ?? null;
  const isComplete = debugState?.is_complete ?? (liveCount >= targetCount);
  const isIdle = debugState?.is_idle ?? false;
  const isOverTarget = liveCount > targetCount;
  const overTargetCount = isOverTarget ? liveCount - targetCount : 0;

  const isCompact = data?.viewMode === 'compact';

  useEffect(() => {
    if (data?.label === undefined) {
      updateNodeData(id, { 
        label: 'Target Tracker', 
        targetCount: 100,
        unitName: 'items',
        inputMode: 'auto',
        edgeType: 'rising',
        allowOverTarget: true,
        outputMode: 'on_complete',
        retainCountOnRestart: true
      });
    }
  }, [id, data?.label, updateNodeData]);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  const formatETA = (seconds) => {
    if (isComplete) return 'Done';
    if (isIdle) return 'Idle';
    if (seconds === null || seconds === undefined) return '--:--';
    if (seconds === Infinity) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className={`bg-surface border-2 ${isComplete ? 'border-amber-400' : selected ? 'border-amber-500 shadow-amber-500/20' : 'border-amber-600'} rounded-xl shadow-lg shadow-amber-900/20 text-fg flex flex-col overflow-hidden transition-all duration-300 ${isCompact ? 'w-52' : 'w-72'}`}>
      <NodeHeader
        id={id}
        icon={Target}
        iconBg="bg-amber-600"
        headerBg="bg-amber-600/20 border-amber-900/50"
        defaultName="Target Tracker"
        defaultSubtitle={isOverTarget ? `Over Target (+${overTargetCount})` : isComplete ? 'Target Reached' : 'Tracking'}
        data={data}
      >
        {!isCompact && (
          <div className="text-[10px] flex items-center gap-1 bg-surface-2 px-1.5 py-0.5 rounded border border-line-strong">
            <span className={`w-2 h-2 rounded-full ${isComplete ? 'bg-amber-400 shadow-[0_0_5px_#fbbf24]' : isIdle ? 'bg-amber-600/50' : 'bg-emerald-500'}`}></span>
            <span className="text-fg-muted font-medium">
              {isOverTarget ? `+${overTargetCount} Over` : isComplete ? 'Target Reached' : isIdle ? 'Idle' : 'Active'}
            </span>
          </div>
        )}
      </NodeHeader>

      {isCompact ? (
        <div className="p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-mono font-bold text-fg">{liveCount} / {targetCount}</span>
            <span className="text-amber-500 font-mono text-[11px] font-bold">{progressPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${isComplete ? 'bg-amber-400' : 'bg-amber-600'}`} 
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            ></div>
          </div>
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-3">
          {/* Progress Section */}
          <div className="flex flex-col gap-1 mb-1">
            <div className="flex justify-between text-xs text-fg-muted">
              <span className="font-medium">
                {liveCount} / {targetCount} {data?.unitName || 'items'}
                {isOverTarget && (
                  <span className="ml-1 text-[10px] text-emerald-500 font-mono font-bold">(+{overTargetCount})</span>
                )}
              </span>
              <span className="text-amber-700 dark:text-amber-400 font-mono font-bold">{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-surface-2 rounded-full h-2.5 overflow-hidden border border-line">
              <div 
                className={`h-2.5 rounded-full transition-all duration-300 ${isComplete ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-amber-600'}`} 
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              ></div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2 mb-1">
            <div className="bg-canvas p-2 rounded border border-line text-center">
              <div className="text-[10px] uppercase text-fg-subtle flex items-center justify-center gap-1">
                <TrendingUp size={11} /> Rate
              </div>
              <div className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                {Number(debugState?.current_rate_per_minute || 0).toFixed(1)} <span className="text-[9px] font-normal text-fg-muted">/m</span>
              </div>
            </div>
            <div className="bg-canvas p-2 rounded border border-line text-center">
              <div className="text-[10px] uppercase text-fg-subtle flex items-center justify-center gap-1">
                <CheckCircle2 size={11} /> ETA
              </div>
              <div className={`text-sm font-mono font-bold ${isComplete ? 'text-amber-400' : isIdle ? 'text-fg-muted' : 'text-blue-500'}`}>
                {formatETA(etaSeconds)}
              </div>
            </div>
          </div>

          <TargetTrackerNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      {/* Input from upstream */}
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-amber-500 border-2 border-line-subtle" />
      {/* Output downstream when reached */}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-amber-500 border-2 border-line-subtle" />
    </div>
  );
}
