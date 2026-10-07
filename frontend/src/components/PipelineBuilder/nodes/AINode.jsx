import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { BrainCircuit, Cpu } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeTelemetryBadge from './NodeTelemetryBadge';
import NodeHeader from './NodeHeader';
import AINodeSettings from '../settings/AINodeSettings';

export default function AINode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const [modelDetails, setModelDetails] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (data?.entityId) {
      fetch('/api/entities', { cache: 'no-store' })
        .then(res => res.json())
        .then(json => {
          if (!isMounted) return;
          const found = (json.models || []).find(m => m.id === data.entityId);
          if (found) {
            setModelDetails(found);
            if (!data.modelName || data.modelName !== found.name) {
              updateNodeData(id, { modelName: found.name, modelVersion: found.version || '' });
            }
          }
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, [id, data?.entityId, data?.modelName, updateNodeData]);

  const activeModelName = data?.modelName || modelDetails?.name || '';
  const activeModelVersion = data?.modelVersion || modelDetails?.version || '';

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 ${selected ? 'border-purple-500 shadow-purple-500/20' : 'border-purple-600'} rounded-xl shadow-lg ${isCompact ? 'w-48' : 'w-84'} text-fg overflow-hidden`}>
      <NodeHeader
        id={id}
        icon={BrainCircuit}
        iconBg="bg-purple-600"
        headerBg="bg-purple-600/20 border-purple-900/50"
        defaultName="AI Model"
        defaultSubtitle="Hailo-8L NPU"
        data={data}
      />

      {/* Special dedicated Model line on canvas */}
      <div className="bg-purple-50 dark:bg-purple-950/40 border-b border-purple-500/20 px-3 py-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Cpu size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-700 dark:text-purple-300 shrink-0">Model:</span>
          <span className="text-xs font-semibold text-fg truncate" title={activeModelName || 'No model selected'}>
            {activeModelName || <span className="text-fg-subtle italic font-normal text-[11px]">No model selected</span>}
          </span>
        </div>
        {activeModelVersion && (
          <span className="bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[9px] font-mono px-1.5 py-0.5 rounded border border-purple-500/30 shrink-0">
            {activeModelVersion}
          </span>
        )}
      </div>
      
      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          <AINodeSettings nodeId={id} data={data} onChange={handleSettingsChange} isSidebar={false} />
          <NodeTelemetryBadge nodeId={id} />
        </div>
      )}

      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-purple-500 border-2 border-line-subtle"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-purple-500 border-2 border-line-subtle"
      />
    </div>
  );
}
