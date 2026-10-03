import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bell } from 'lucide-react';
import NodeMenu from './NodeMenu';
import usePipelineStore from '../../../store/usePipelineStore';

export default function ActionNode({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch integration entities from backend
    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        setIntegrations(json.integrations || []);
        setLoading(false);
        
        // Auto-select first integration if not set
        if (!data?.entityId && json.integrations && json.integrations.length > 0) {
          updateNodeData(id, { entityId: json.integrations[0].id });
        }
      })
      .catch(err => {
        console.error("Failed to fetch entities", err);
        setLoading(false);
      });
  }, [id, data?.entityId, updateNodeData]);

  const handleEntityChange = (e) => {
    updateNodeData(id, { entityId: e.target.value });
  };

  const selectedIntegration = integrations.find(i => i.id === data?.entityId);

  return (
    <div className={`bg-surface border-2 border-green-600 rounded-xl shadow-lg shadow-green-900/20 ${isCompact ? 'w-48' : 'w-64'} text-fg overflow-hidden`}>
      <div className="bg-green-600/20 p-3 flex items-center justify-between border-b border-green-900/50">
        <div className="flex items-center gap-3">
          <div className="bg-green-600 p-1.5 rounded-lg">
            <Bell size={16} className="text-fg" />
          </div>
          <div className="font-semibold text-sm">Action / Alert</div>
        </div>
        {!isCompact && <NodeMenu id={id} />}
      </div>
      
      <div className={`p-4 flex flex-col gap-3 ${isCompact ? 'hidden' : ''}`}>
        <label className="text-xs text-fg-muted flex flex-col gap-1">
          Integration Entity
          {loading ? (
            <div className="text-sm text-fg-subtle py-1">Loading...</div>
          ) : (
            <select 
              className="bg-surface-2 border border-line-strong rounded-md p-1.5 text-sm focus:outline-none focus:border-green-500 nodrag"
              value={data?.entityId || ''}
              onChange={handleEntityChange}
            >
              <option value="" disabled>Select Integration</option>
              {integrations.map(int => (
                <option key={int.id} value={int.id}>
                  {int.name}
                </option>
              ))}
            </select>
          )}
        </label>
        
        
        <label className="text-xs text-fg-muted flex flex-col gap-1">
          Trigger On (Payload)
          <select 
            className="bg-surface-2 border border-line-strong rounded-md p-1.5 text-sm focus:outline-none focus:border-green-500 nodrag"
            value={data?.triggerOn !== undefined ? String(data.triggerOn) : "true"}
            onChange={(e) => updateNodeData(id, { triggerOn: e.target.value === 'true' })}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </label>
{/* Preview of the selected entity's target */}
        {selectedIntegration && (
          <div className="text-[10px] text-fg-subtle bg-surface-2 p-2 rounded-md break-all">
            <span className="text-green-400 uppercase font-semibold mr-1">{selectedIntegration.type}:</span>
            {selectedIntegration.target || "N/A"}
          </div>
        )}
      </div>

      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-green-500 border-2 border-line-subtle"
      />
      <div className="px-4 pb-4 mt-1 border-t border-line text-[10px] text-fg-subtle">
        Triggers when <code className="text-indigo-400 bg-canvas px-1 py-0.5 rounded">payload == {data?.triggerOn !== false ? "True" : "False"}</code>
      </div>
    </div>
  );
}
