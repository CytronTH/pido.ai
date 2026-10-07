import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { LineChart } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import DashboardWidgetSettings from '../settings/DashboardWidgetSettings';

export default function DashboardChartNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  return (
    <div className={`bg-surface border-2 ${selected ? 'border-indigo-400 shadow-indigo-500/20' : 'border-indigo-600'} rounded-xl shadow-lg shadow-indigo-900/20 ${isCompact ? 'w-48' : 'w-72'} text-fg overflow-hidden`}>
      <NodeHeader
        id={id}
        icon={LineChart}
        iconBg="bg-indigo-600"
        headerBg="bg-indigo-600/20 border-indigo-900/50"
        defaultName="Chart"
        defaultSubtitle="Time-Series Output"
        data={data}
      />
      
      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          <DashboardWidgetSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-indigo-500 border-2 border-line-subtle"
      />
    </div>
  );
}
