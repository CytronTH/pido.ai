import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Timer } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import RateLimitNodeSettings from '../settings/RateLimitNodeSettings';

export default function RateLimitNode({ id, data, isConnectable, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 ${selected ? 'border-teal-400 shadow-teal-500/20' : 'border-teal-600'} rounded-xl shadow-lg shadow-teal-900/20 ${isCompact ? 'w-48' : 'w-64'} text-fg flex flex-col overflow-hidden`}>
      <NodeHeader
        id={id}
        icon={Timer}
        iconBg="bg-teal-600"
        headerBg="bg-teal-600/20 border-teal-900/50"
        defaultName="Rate Limit"
        defaultSubtitle="Traffic Throttle"
        data={data}
      />
      
      {!isCompact && (
        <div className="p-3.5 flex flex-col gap-3">
          <RateLimitNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable={isConnectable}
        className="w-3 h-3 bg-teal-500 border-2 border-line-subtle"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        isConnectable={isConnectable}
        className="w-3 h-3 bg-teal-500 border-2 border-line-subtle"
      />
    </div>
  );
}
