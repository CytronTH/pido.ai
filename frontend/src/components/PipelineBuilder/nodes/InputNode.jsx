import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Camera } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeTelemetryBadge from './NodeTelemetryBadge';
import NodeHeader from './NodeHeader';
import InputNodeSettings from '../settings/InputNodeSettings';

export default function InputNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 ${selected ? 'border-blue-500 shadow-blue-500/20' : 'border-blue-600'} rounded-xl shadow-lg ${isCompact ? 'w-48' : 'w-72'} text-fg overflow-hidden`}>
      <NodeHeader
        id={id}
        icon={Camera}
        iconBg="bg-blue-600"
        headerBg="bg-blue-600/20 border-blue-900/50"
        defaultName="Input Source"
        defaultSubtitle="RTSP / Video / USB"
        data={data}
      />
      
      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          <InputNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} isSidebar={false} />
          <NodeTelemetryBadge nodeId={id} />
        </div>
      )}

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-blue-500 border-2 border-line-subtle"
      />
    </div>
  );
}
