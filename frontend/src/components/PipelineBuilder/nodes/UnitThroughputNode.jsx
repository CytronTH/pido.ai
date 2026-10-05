import React, { useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Activity } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import UnitThroughputNodeSettings from '../settings/UnitThroughputNodeSettings';

export default function UnitThroughputNode({ id, data, selected }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const debugData = usePipelineStore(s => s.debugData || {});
  const debugState = debugData[id] || {};
  
  const liveRate = debugState?.throughput ?? data?.throughput ?? 0;
  const liveCount = debugState?.current_unit ?? data?.current_unit ?? 0;
  const isRunning = debugState?.is_running ?? data?.is_running ?? false;
  
  const isCompact = data?.viewMode === 'compact';

  useEffect(() => {
    if (data?.label === undefined) {
      updateNodeData(id, { 
        label: 'Unit Throughput',
        startTrigger: 'first_object',
        pauseTrigger: 'timeout',
        pauseTimeoutSeconds: 60,
        rateUnit: 'minute'
      });
    }
  }, [id, data?.label, updateNodeData]);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 ${selected ? 'border-indigo-400 shadow-indigo-500/20' : 'border-indigo-600'} rounded-xl shadow-lg shadow-indigo-900/20 text-fg flex flex-col overflow-hidden transition-all duration-300 ${isCompact ? 'w-48' : 'w-72'}`}>
      <NodeHeader
        id={id}
        icon={Activity}
        iconBg="bg-indigo-600"
        headerBg="bg-indigo-600/20 border-indigo-900/50"
        defaultName="Unit Throughput"
        defaultSubtitle={isRunning ? '● Running' : '○ Paused'}
        data={data}
      >
        {!isCompact && (
          <div className="text-[10px] flex items-center gap-1 bg-surface-2 px-1.5 py-0.5 rounded border border-line-strong">
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-fg-subtle'}`}></span>
            <span className="text-fg-muted font-medium">{isRunning ? 'Running' : 'Paused'}</span>
          </div>
        )}
      </NodeHeader>

      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          {/* Quick Stats on the Node itself */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-canvas p-2 rounded border border-line text-center">
              <div className="text-[10px] uppercase text-fg-subtle">Rate</div>
              <div className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold">{Number(liveRate).toFixed(1)} <span className="text-[9px]">/{data?.rateUnit?.substring(0,1) || 'm'}</span></div>
            </div>
            <div className="bg-canvas p-2 rounded border border-line text-center">
              <div className="text-[10px] uppercase text-fg-subtle">Units</div>
              <div className="text-sm font-mono text-blue-600 dark:text-blue-400 font-bold">{liveCount}</div>
            </div>
          </div>

          <UnitThroughputNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      {/* Input from AI Model / upstream */}
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500 border-2 border-line-subtle" />
      {/* Output downstream if needed */}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500 border-2 border-line-subtle" />
    </div>
  );
}
