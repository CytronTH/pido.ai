import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Video } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import NodeTelemetryBadge from './NodeTelemetryBadge';
import DashboardVideoNodeSettings from '../settings/DashboardVideoNodeSettings';

export default function DashboardVideoNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 ${selected ? 'border-pink-400 shadow-pink-500/20' : 'border-pink-600'} rounded-xl shadow-lg shadow-pink-900/20 ${isCompact ? 'w-48' : 'w-72'} text-fg overflow-hidden`}>
      <NodeHeader
        id={id}
        icon={Video}
        iconBg="bg-pink-600"
        headerBg="bg-pink-600/20 border-pink-900/50"
        defaultName="Video Stream"
        defaultSubtitle="Dashboard Feed"
        data={data}
      />
      
      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          <DashboardVideoNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
          <NodeTelemetryBadge nodeId={id} />
        </div>
      )}

      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-pink-500 border-2 border-line-subtle"
      />
    </div>
  );
}
