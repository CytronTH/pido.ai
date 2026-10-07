import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Filter } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeTelemetryBadge from './NodeTelemetryBadge';
import NodeHeader from './NodeHeader';
import LogicNodeSettings from '../settings/LogicNodeSettings';

export default function LogicNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 ${selected ? 'border-orange-500 shadow-orange-500/20' : 'border-orange-600'} rounded-xl shadow-lg shadow-orange-900/20 ${isCompact ? 'w-48' : 'w-80'} text-fg flex flex-col overflow-hidden`}>
      <NodeHeader
        id={id}
        icon={Filter}
        iconBg="bg-orange-600"
        headerBg="bg-orange-600/20 border-orange-900/50"
        defaultName="Logic Filter"
        defaultSubtitle="Equation Builder"
        data={data}
      />

      {!isCompact && (
        <div className="p-3.5 flex flex-col gap-3">
          <LogicNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
          <NodeTelemetryBadge nodeId={id} />
        </div>
      )}

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-orange-500 border-2 border-line-subtle" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-orange-500 border-2 border-line-subtle" />
    </div>
  );
}
