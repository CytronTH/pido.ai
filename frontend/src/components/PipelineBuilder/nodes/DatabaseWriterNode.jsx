import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import DatabaseWriterNodeSettings from '../settings/DatabaseWriterNodeSettings';

export default function DatabaseWriterNode({ id, data, selected }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const isCompact = data?.viewMode === 'compact';
  
  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 rounded-xl shadow-xl overflow-hidden transition-all duration-300 ${isCompact ? 'w-48' : 'w-72'} ${selected ? 'border-teal-400 shadow-teal-500/20' : 'border-teal-600'}`}>
      <NodeHeader
        id={id}
        icon={Database}
        iconBg="bg-blue-600"
        headerBg="bg-blue-600/20 border-blue-900/50"
        defaultName="Database Writer"
        defaultSubtitle="SQLite Timeseries"
        data={data}
      />
      
      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          <DatabaseWriterNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-teal-500 border-2 border-line-subtle" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-teal-500 border-2 border-line-subtle" />
    </div>
  );
}
