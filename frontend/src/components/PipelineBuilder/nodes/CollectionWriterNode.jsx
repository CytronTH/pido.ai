import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BookOpen } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import CollectionWriterSettings from '../settings/CollectionWriterSettings';

export default function CollectionWriterNode({ id, data, selected }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const isCompact = data?.viewMode === 'compact';
  
  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 rounded-xl shadow-xl overflow-hidden transition-all duration-300 ${isCompact ? 'w-48' : 'w-72'} ${selected ? 'border-orange-400 shadow-orange-500/20' : 'border-orange-600'}`}>
      <NodeHeader
        id={id}
        icon={BookOpen}
        iconBg="bg-orange-600"
        headerBg="bg-orange-600/20 border-orange-900/50"
        defaultName="Collection Writer"
        defaultSubtitle="Structured Database"
        data={data}
      />
      
      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          <CollectionWriterSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-orange-500 border-2 border-line-subtle" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-orange-500 border-2 border-line-subtle" />
    </div>
  );
}
