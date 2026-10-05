import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Image } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import SnapshotNodeSettings from '../settings/SnapshotNodeSettings';

export default function SnapshotNode({ id, data, selected }) {
  const updateNodeData = usePipelineStore(s => s.updateNodeData);
  const isCompact = data?.viewMode === 'compact';

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 rounded-xl shadow-xl ${isCompact ? 'w-48' : 'w-72'} overflow-hidden transition-all duration-300 ${selected ? 'border-pink-400 shadow-pink-500/20' : 'border-pink-600'}`}>
      <NodeHeader
        id={id}
        icon={Image}
        iconBg="bg-pink-600"
        headerBg="bg-pink-600/20 border-pink-900/50"
        defaultName="Snapshot"
        defaultSubtitle="Frame Capture"
        data={data}
      />
      
      {isCompact && Array.isArray(data?.tags) && data.tags.length > 0 && (
        <div className="px-3 py-2 border-t border-line/60 bg-canvas/40 flex flex-wrap gap-1">
          {data.tags.slice(0, 3).map((t, i) => (
            <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 truncate max-w-[80px]">
              #{t}
            </span>
          ))}
          {data.tags.length > 3 && (
            <span className="text-[9px] text-fg-subtle font-mono self-center">
              +{data.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          <SnapshotNodeSettings data={data} onChange={handleSettingsChange} />
        </div>
      )}

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-pink-500 border-2 border-line-subtle" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-pink-500 border-2 border-line-subtle" />
    </div>
  );
}
