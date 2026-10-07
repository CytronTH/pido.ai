import React, { useState, useEffect } from 'react';
import { List, Edit3, Layers } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import { useShallow } from 'zustand/react/shallow';
import PayloadPathSelector from './PayloadPathSelector';

export default function DashboardWidgetSettings({ nodeId, data, onChange, isSidebar }) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [models, setModels] = useState([]);

  const { edges, nodes } = usePipelineStore(useShallow((state) => ({
    edges: state.edges,
    nodes: state.nodes
  })));

  const upstreamEdge = edges.find(e => e.target === nodeId);
  const upstreamNode = upstreamEdge ? nodes.find(n => n.id === upstreamEdge.source) : null;

  useEffect(() => {
    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => setModels(json.models || []))
      .catch(() => {});
  }, []);

  const getAvailableProperties = () => {
    if (!upstreamNode) return [];

    if (upstreamNode.type === 'flowCounterNode') {
      const classes = new Set();
      if (upstreamNode.data?.classFilter && Array.isArray(upstreamNode.data.classFilter)) {
        upstreamNode.data.classFilter.forEach(c => c && classes.add(c));
      }
      if (classes.size === 0) {
        const anyAiNode = nodes.find(n => n.type === 'aiNode');
        if (anyAiNode?.data?.entityId) {
          const aiModel = models.find(m => m.id === anyAiNode.data.entityId);
          if (aiModel?.classes && Array.isArray(aiModel.classes)) {
            aiModel.classes.forEach(c => c && classes.add(c));
          }
        }
      }

      const classProps = Array.from(classes).map(cls => ({
        value: `msg.payload.counts.${cls}`,
        label: `msg.payload.counts.${cls} (${cls} Count)`
      }));

      return [
        { value: 'msg.payload.total', label: 'msg.payload.total (Total Count)' },
        { value: 'msg.payload.newly_counted', label: 'msg.payload.newly_counted (Delta)' },
        ...classProps,
        { value: 'msg.payload.counts', label: 'msg.payload.counts (All Classes Object)' }
      ];
    }

    if (upstreamNode.type === 'counterNode') {
      return [
        { value: 'msg.payload.count', label: 'msg.payload.count (Current Count)' },
        { value: 'msg.payload', label: 'msg.payload (Raw Count Number)' }
      ];
    }

    if (upstreamNode.type === 'unitThroughputNode') {
      return [
        { value: 'msg.payload.throughput', label: 'msg.payload.throughput (Throughput Rate)' },
        { value: 'msg.payload.current_rate_per_minute', label: 'msg.payload.current_rate_per_minute (Rate/min)' },
        { value: 'msg.payload.current_unit', label: 'msg.payload.current_unit (Current Units)' },
        { value: 'msg.payload.total_units', label: 'msg.payload.total_units (Total Units)' },
        { value: 'msg.payload.is_running', label: 'msg.payload.is_running (Running Status)' }
      ];
    }

    if (upstreamNode.type === 'targetTrackerNode') {
      return [
        { value: 'msg.payload.progress_percent', label: 'msg.payload.progress_percent (Progress %)' },
        { value: 'msg.payload.current_count', label: 'msg.payload.current_count (Count)' },
        { value: 'msg.payload.target_count', label: 'msg.payload.target_count (Target)' }
      ];
    }
    
    return [
      { value: 'msg.payload.value', label: 'msg.payload.value (Value)' },
      { value: 'msg.payload', label: 'msg.payload (Full Payload)' }
    ];
  };

  const availableProperties = getAvailableProperties();
  const isKnownProperty = availableProperties.some(p => p.value === data?.sourcePath);
  const showCustomInput = isCustomMode || (!isKnownProperty && Boolean(data?.sourcePath));

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      onChange({ sourcePath: val });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Property Selector */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
            Property / Payload Path
          </label>
          {upstreamNode && (
            <button
              type="button"
              onClick={() => setIsCustomMode(!showCustomInput)}
              className="text-[10px] text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 flex items-center gap-1 transition-colors nodrag cursor-pointer"
              title={showCustomInput ? "Choose from property list" : "Enter custom path manually"}
            >
              {showCustomInput ? (
                <>
                  <List size={10} />
                  <span>Select from list</span>
                </>
              ) : (
                <>
                  <Edit3 size={10} />
                  <span>Custom path</span>
                </>
              )}
            </button>
          )}
        </div>

        {!upstreamNode ? (
          <input
            type="text"
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm text-fg-subtle nodrag disabled:opacity-50 cursor-not-allowed"
            value=""
            placeholder="Connect an upstream node first..."
            disabled
          />
        ) : showCustomInput ? (
          <input
            type="text"
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-pink-500 nodrag text-fg font-mono text-xs"
            value={data?.sourcePath || ''}
            onChange={(e) => onChange({ sourcePath: e.target.value })}
            placeholder="e.g. msg.payload.counts.person"
          />
        ) : (
          <select
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-pink-500 nodrag text-fg cursor-pointer"
            value={data?.sourcePath || ''}
            onChange={handleSelectChange}
          >
            <option value="" disabled>-- Select Property --</option>
            {availableProperties.map(prop => (
              <option key={prop.value} value={prop.value} className="bg-surface text-fg">
                {prop.label}
              </option>
            ))}
            <option value="__custom__" className="bg-surface text-pink-600 dark:text-pink-400">
              ✏️ Custom Path...
            </option>
          </select>
        )}
      </div>

      {/* Visual Payload Tree Picker */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-fg-secondary">
          <Layers size={13} className="text-pink-500" />
          <span>Payload Explorer</span>
        </div>
        <PayloadPathSelector 
          nodeId={nodeId} 
          selectedPath={data?.sourcePath} 
          onSelect={(path) => onChange({ sourcePath: path })} 
        />
      </div>

      <div className="text-[10px] text-fg-subtle leading-relaxed">
        Specifies which property field from the incoming message stream will be bound to Dashboard widgets.
      </div>
    </div>
  );
}
