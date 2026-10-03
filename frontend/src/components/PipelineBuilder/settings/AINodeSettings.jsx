import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import { useShallow } from 'zustand/react/shallow';
import ROIEditorModal from '../nodes/ROIEditorModal';
import AINodeSettingsModal from '../nodes/AINodeSettingsModal';
import AINodeAdvancedSettingsContent from './AINodeAdvancedSettingsContent';

export default function AINodeSettings({ nodeId, data, onChange, isSidebar }) {
  const [models, setModels] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showROIEditor, setShowROIEditor] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // We need direct updateNodeData for modals in Phase 1 since they modify the store directly
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const { edges, nodes } = usePipelineStore(useShallow((state) => ({
    edges: state.edges,
    nodes: state.nodes
  })));

  const upstreamEdge = edges.find(e => e.target === nodeId);
  const upstreamNode = upstreamEdge ? nodes.find(n => n.id === upstreamEdge.source) : null;
  const isInputNode = upstreamNode?.type === 'inputNode';

  useEffect(() => {
    fetch('/api/entities', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        setModels(json.models || []);
        setCameras(json.cameras || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch entities", err);
        setLoading(false);
      });
  }, []);

  const upstreamCameraEntityId = isInputNode ? upstreamNode?.data?.entityId : null;
  const upstreamCamera = cameras.find(c => c.id === upstreamCameraEntityId);
  const upstreamSourceType = upstreamCamera?.type ?? null;
  const upstreamVideoPath = upstreamCamera?.path ?? null;

  const handleEntityChange = (e) => {
    onChange({ entityId: e.target.value, classFilter: null });
  };

  const selectedModel = models.find(m => m.id === data?.entityId);
  const modelClasses = selectedModel?.classes || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-fg-secondary">Model Entity</label>
        {loading ? (
          <div className="text-sm py-1 text-fg-subtle">Loading models...</div>
        ) : (
          <select 
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 w-full text-fg"
            value={data?.entityId || ''}
            onChange={handleEntityChange}
          >
            <option value="" disabled>Select Model</option>
            {models.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} {model.version ? `(${model.version})` : ''} • [{model.original_filename || model.hef_path}]
              </option>
            ))}
          </select>
        )}
      </div>
      
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-fg-secondary">Hardware</label>
        <select className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 w-full text-fg-muted" disabled>
          <option>Hailo-8L NPU</option>
        </select>
      </div>
      
      {isSidebar ? (
        <div className="mt-4 border-t border-line pt-4">
          <AINodeAdvancedSettingsContent
            id={nodeId}
            data={data}
            updateNodeData={(id, updates) => onChange(updates)}
            modelClasses={modelClasses}
            isInputNode={isInputNode}
            onOpenROI={() => setShowROIEditor(true)}
          />
        </div>
      ) : (
        <button 
          onClick={() => setShowSettingsModal(true)}
          className="bg-surface-2 hover:bg-surface-3 text-purple-300 border border-purple-500/50 rounded-lg py-2.5 px-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors mt-2 shadow-sm"
        >
          <Settings size={16} /> Advanced Settings
        </button>
      )}

      {selectedModel && (
        <div className="text-xs bg-canvas/80 border border-line p-3.5 rounded-xl space-y-2 mt-2 shadow-inner text-fg-muted">
          <div className="flex items-center justify-between text-purple-300 font-bold">
            <span className="truncate max-w-[200px]" title={selectedModel.name}>{selectedModel.name}</span>
            <span className="bg-purple-900/60 text-purple-300 text-[10px] px-2 py-0.5 rounded font-mono border border-purple-700/50">
              {selectedModel.version || 'v1.0'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-fg-muted">
            <span>Task:</span>
            <span className="capitalize font-medium text-fg">{selectedModel.task || 'detection'}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-fg-muted">
            <span>File:</span>
            <span className="font-mono truncate max-w-[180px] text-fg" title={selectedModel.original_filename || selectedModel.hef_path}>
              {selectedModel.original_filename || selectedModel.hef_path}
            </span>
          </div>
          {selectedModel.file_hash && (
            <div className="flex items-center justify-between text-[11px] text-fg-muted">
              <span>SHA-256:</span>
              <span className="text-purple-400 font-mono text-[10px]" title={selectedModel.file_hash}>
                #{selectedModel.file_hash.substring(0, 8)}
              </span>
            </div>
          )}
          {selectedModel.classes && selectedModel.classes.length > 0 && (
            <div className="text-[11px] pt-1.5 flex items-center justify-between border-t border-line/80 mt-1.5 text-fg-muted">
              <span>Classes ({selectedModel.classes.length}):</span>
              <span className="text-purple-300 font-mono truncate max-w-[150px]">
                {selectedModel.classes.slice(0, 3).join(', ')}{selectedModel.classes.length > 3 ? '...' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {showROIEditor && (
        <ROIEditorModal
          sourceType={upstreamSourceType}
          cameraId={upstreamCameraEntityId}
          videoPath={upstreamVideoPath}
          currentRoi={data?.roi || { x: 0, y: 0, w: 1, h: 1 }}
          onApply={(newRoi) => isSidebar ? onChange({ roi: newRoi }) : updateNodeData(nodeId, { roi: newRoi })}
          onClose={() => setShowROIEditor(false)}
        />
      )}

      {showSettingsModal && (
        <AINodeSettingsModal
          id={nodeId}
          data={data}
          updateNodeData={updateNodeData}
          modelClasses={modelClasses}
          isInputNode={isInputNode}
          onClose={() => setShowSettingsModal(false)}
          onOpenROI={() => setShowROIEditor(true)}
        />
      )}
    </div>
  );
}
