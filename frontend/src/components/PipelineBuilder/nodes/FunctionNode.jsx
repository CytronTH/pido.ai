import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Code } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import FunctionNodeSettings from '../settings/FunctionNodeSettings';

export default function FunctionNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 ${selected ? 'border-emerald-400 shadow-emerald-500/20' : 'border-emerald-600'} rounded-xl shadow-lg shadow-emerald-900/20 ${isCompact ? 'w-48' : 'w-80'} text-fg flex flex-col overflow-hidden`}>
      <NodeHeader
        id={id}
        icon={Code}
        iconBg="bg-emerald-600"
        headerBg="bg-emerald-600/20 border-emerald-900/50"
        defaultName="Function"
        defaultSubtitle="Python Script"
        data={data}
      />

      {!isCompact && (
        <div className="p-3.5 flex flex-col gap-3">
          <FunctionNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-emerald-500 border-2 border-line-subtle" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-500 border-2 border-line-subtle" />
    </div>
  );
}
