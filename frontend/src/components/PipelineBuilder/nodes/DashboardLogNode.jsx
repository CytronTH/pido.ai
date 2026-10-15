import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { List } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import DashboardLogNodeSettings from '../settings/DashboardLogNodeSettings';

const COLOR_THEMES = {
  rose: { border: 'border-rose-600', selectedBorder: 'border-rose-400 shadow-rose-500/20', iconBg: 'bg-rose-600', headerBg: 'bg-rose-600/20 border-rose-900/50', handle: 'bg-rose-500', text: 'text-rose-400' },
  amber: { border: 'border-amber-600', selectedBorder: 'border-amber-400 shadow-amber-500/20', iconBg: 'bg-amber-600', headerBg: 'bg-amber-600/20 border-amber-900/50', handle: 'bg-amber-500', text: 'text-amber-400' },
  emerald: { border: 'border-emerald-600', selectedBorder: 'border-emerald-400 shadow-emerald-500/20', iconBg: 'bg-emerald-600', headerBg: 'bg-emerald-600/20 border-emerald-900/50', handle: 'bg-emerald-500', text: 'text-emerald-400' },
  sky: { border: 'border-sky-600', selectedBorder: 'border-sky-400 shadow-sky-500/20', iconBg: 'bg-sky-600', headerBg: 'bg-sky-600/20 border-sky-900/50', handle: 'bg-sky-500', text: 'text-sky-400' },
  purple: { border: 'border-purple-600', selectedBorder: 'border-purple-400 shadow-purple-500/20', iconBg: 'bg-purple-600', headerBg: 'bg-purple-600/20 border-purple-900/50', handle: 'bg-purple-500', text: 'text-purple-400' },
  indigo: { border: 'border-indigo-600', selectedBorder: 'border-indigo-400 shadow-indigo-500/20', iconBg: 'bg-indigo-600', headerBg: 'bg-indigo-600/20 border-indigo-900/50', handle: 'bg-indigo-500', text: 'text-indigo-400' },
};

export default function DashboardLogNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  const logMode = data?.logMode || (data?.messageTemplate ? 'custom' : 'property');
  const theme = COLOR_THEMES[data?.logColor] || COLOR_THEMES.indigo;

  return (
    <div className={`bg-surface border-2 ${selected ? theme.selectedBorder : theme.border} rounded-xl shadow-lg shadow-indigo-900/10 ${isCompact ? 'w-48' : 'w-72'} text-fg overflow-hidden transition-all duration-200`}>
      <NodeHeader
        id={id}
        icon={List}
        iconBg={theme.iconBg}
        headerBg={theme.headerBg}
        defaultName="Dashboard Log"
        defaultSubtitle="Historical Feed Output"
        data={data}
      />
      
      {isCompact ? (
        <div className="p-3 text-[11px] text-fg-subtle flex flex-col gap-1">
          <div className="font-semibold text-fg truncate">
            {data?.label || 'Dashboard Log'}
          </div>
          <div className={`text-[10px] ${theme.text} font-mono truncate`}>
            {logMode === 'custom' ? `Msg: "${data?.messageTemplate || 'Alert'}"` : `Path: ${data?.sourcePath || 'msg.payload'}`}
          </div>
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-3">
          <DashboardLogNodeSettings nodeId={id} data={data} onChange={handleSettingsChange} />
        </div>
      )}

      <Handle 
        type="target" 
        position={Position.Left} 
        className={`w-3 h-3 ${theme.handle} border-2 border-line-subtle`}
      />
    </div>
  );
}
