import React, { useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ArrowRightLeft } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import FlowCounterNodeSettings from '../settings/FlowCounterNodeSettings';

export default function FlowCounterNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const updateNodeData = usePipelineStore(s => s.updateNodeData);

  useEffect(() => {
    if (data?.label === undefined) {
      updateNodeData(id, { 
        label: 'Flow Counter',
        mode: 'roi',
        direction: 'both',
        line: [0.1, 0.5, 0.9, 0.5],
        autoLog: true,
        flushIntervalSec: 60
      });
    }
  }, [id, data?.label, updateNodeData]);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 ${selected ? 'border-teal-400 shadow-teal-500/20' : 'border-teal-500'} rounded-xl shadow-lg shadow-teal-900/20 ${isCompact ? 'w-48' : 'w-72'} text-fg flex flex-col overflow-hidden`}>
      <NodeHeader
        id={id}
        icon={ArrowRightLeft}
        iconBg="bg-teal-600"
        headerBg="bg-teal-500/20 border-teal-800/50"
        defaultName="Flow Counter"
        defaultSubtitle="Line & Zone Object Counter"
        data={data}
      />

      {!isCompact && (
        <div className="p-3.5 flex flex-col gap-2.5">
          <FlowCounterNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} isSidebar={false} />
        </div>
      )}

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-teal-500 border-2 border-line-subtle" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-teal-500 border-2 border-line-subtle" />
    </div>
  );
}
