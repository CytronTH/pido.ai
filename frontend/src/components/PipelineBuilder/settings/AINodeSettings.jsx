import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, BrainCircuit, ExternalLink, Cpu, 
  Sparkles, Target, Eye 
} from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import { useShallow } from 'zustand/react/shallow';
import ROIEditorModal from '../nodes/ROIEditorModal';
import AINodeSettingsModal from '../nodes/AINodeSettingsModal';
import AINodeAdvancedSettingsContent from './AINodeAdvancedSettingsContent';
import FeatureSection from './FeatureSection';

function CategoryHeader({ icon: Icon, title, badge }) {
  return (
    <div className="flex items-center justify-between pb-1 pt-1 border-b border-line-strong/30">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
        {Icon && <Icon size={12} className="text-purple-600 dark:text-purple-400" />}
        <span>{title}</span>
      </div>
      {badge && (
        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-surface-3 text-fg-muted border border-line">
          {badge}
        </span>
      )}
    </div>
  );
}

export default function AINodeSettings({ nodeId, data, onChange, isSidebar }) {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'model' | 'detection' | 'display'
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

  const [hailoDevice, setHailoDevice] = useState('Hailo NPU');

  useEffect(() => {
    fetch('/api/system/hailo')
      .then(res => res.json())
      .then(info => {
        if (info?.board_name) {
          setHailoDevice(`${info.board_name} NPU`);
        } else if (info?.device_arch === 'HAILO8') {
          setHailoDevice('Hailo-8 NPU');
        } else if (info?.device_arch === 'HAILO8L') {
          setHailoDevice('Hailo-8L NPU');
        }
      })
      .catch(() => {});
  }, []);

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
    const selectedId = e.target.value;
    const model = models.find(m => m.id === selectedId);
    onChange({ 
      entityId: selectedId,
      modelName: model ? model.name : '',
      modelVersion: model ? (model.version || '') : '',
      classFilter: null 
    });
  };

  const handleGoToModelManager = (e) => {
    if (e?.metaKey || e?.ctrlKey) {
      window.open('/settings', '_blank');
    } else {
      navigate('/settings', { state: { tab: 'models' } });
    }
  };

  const selectedModel = models.find(m => m.id === data?.entityId);
  const modelClasses = selectedModel?.classes || [];

  // Active status counts for badges
  const confEnabled = data?.confidenceThresholdEnabled ?? true;
  const isClassFilterActive = data?.classFilterEnabled ?? (data?.classFilter !== null && data?.classFilter !== undefined);
  const roiActive = Boolean(data?.roiEnabled);
  const detectionActiveCount = [confEnabled, isClassFilterActive, roiActive].filter(Boolean).length;
  const bboxEnabled = data?.bboxEnabled ?? (data?.bboxDrawMode !== 'none');

  const CATEGORY_TABS = [
    { id: 'all', label: 'All', icon: Sparkles },
    { id: 'model', label: 'Model', icon: Cpu, badge: selectedModel ? '✓' : null },
    { id: 'detection', label: 'Detection', icon: Target, badge: `${detectionActiveCount}/3` },
    { id: 'display', label: 'Display', icon: Eye, badge: bboxEnabled ? 'ON' : 'OFF' },
  ];

  const showModelSection = activeCategory === 'all' || activeCategory === 'model';
  const showAdvancedSection = activeCategory === 'all' || activeCategory === 'detection' || activeCategory === 'display';

  return (
    <div className="flex flex-col gap-3">
      {/* ── Category Navigation Tabs ── */}
      <div className="flex items-center gap-1 bg-surface-2/70 p-1 rounded-xl border border-line select-none">
        {CATEGORY_TABS.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                isActive
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-fg-muted hover:text-fg hover:bg-surface-3'
              }`}
              title={`View ${tab.label} settings`}
            >
              <TabIcon size={12} className={isActive ? 'text-white' : 'text-fg-subtle'} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[9px] font-mono px-1 py-0.2 rounded-full font-bold leading-none ${
                  isActive 
                    ? 'bg-white/25 text-white' 
                    : 'bg-surface text-fg-subtle border border-line'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          CATEGORY 1: MODEL & RUNTIME (โมเดลและฮาร์ดแวร์)
          ═════════════════════════════════════════════════════════════════════════ */}
      {showModelSection && (
        <div className="flex flex-col gap-2.5">
          <CategoryHeader 
            icon={Cpu} 
            title="Model & Runtime" 
            badge={selectedModel ? selectedModel.name : 'Select Model'} 
          />

          {/* Model Entity Picker Header & Button */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
                <span>Model Entity</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-surface-3 text-fg-muted border border-line">
                  {models.length}
                </span>
              </label>

              <button
                type="button"
                onClick={handleGoToModelManager}
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-lg bg-surface-2 hover:bg-purple-600 hover:text-white text-fg-secondary border border-line hover:border-purple-600 transition-all shadow-xs active:scale-95 group shrink-0"
                title="Open Model Manager (in Settings)"
              >
                <BrainCircuit size={12} className="text-purple-600 dark:text-purple-400 group-hover:text-white transition-colors" />
                <span>Model Manager</span>
                <ExternalLink size={10} className="opacity-70 group-hover:opacity-100" />
              </button>
            </div>

            {loading ? (
              <div className="text-xs py-2 text-fg-subtle">Loading models...</div>
            ) : models.length === 0 ? (
              <div className="text-xs p-3 rounded-lg border border-dashed border-line bg-surface-2/40 text-center flex flex-col items-center gap-2">
                <span className="text-fg-muted">No models uploaded yet</span>
                <button
                  type="button"
                  onClick={handleGoToModelManager}
                  className="text-xs text-purple-600 dark:text-purple-400 font-semibold underline hover:text-purple-500 flex items-center gap-1"
                >
                  Upload HEF Model in Model Manager <ExternalLink size={11} />
                </button>
              </div>
            ) : (
              <select 
                className="bg-surface-2 border border-line-strong rounded-lg p-2 text-xs focus:outline-none focus:border-purple-500 w-full text-fg cursor-pointer"
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
          
          {/* Hardware Engine Status Chip */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface-2/60 border border-line text-xs">
            <span className="text-fg-subtle font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Hardware Engine
            </span>
            <span className="font-mono font-semibold text-fg text-[11px] bg-surface px-2 py-0.5 rounded border border-line">
              {hailoDevice}
            </span>
          </div>

          {/* Model Specs & Details (Collapsible Feature) */}
          {selectedModel && (
            <FeatureSection
              icon={Cpu}
              title="Model Specs & Details"
              badge={selectedModel.version || 'v1.0'}
              badgeColor="purple"
              enabled={data?.showModelDetails ?? true}
              onToggle={(val) => onChange({ showModelDetails: val })}
            >
              <div className="text-xs space-y-2 text-fg-muted">
                <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 font-bold">
                  <span className="truncate max-w-[200px]" title={selectedModel.name}>{selectedModel.name}</span>
                  <span className="bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px] px-2 py-0.5 rounded font-mono border border-purple-700/50">
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
                    <span className="text-purple-600 dark:text-purple-400 font-mono text-[10px]" title={selectedModel.file_hash}>
                      #{selectedModel.file_hash.substring(0, 8)}
                    </span>
                  </div>
                )}
                {selectedModel.classes && selectedModel.classes.length > 0 && (
                  <div className="text-[11px] pt-1.5 flex items-center justify-between border-t border-line/80 mt-1.5 text-fg-muted">
                    <span>Classes ({selectedModel.classes.length}):</span>
                    <span className="text-purple-700 dark:text-purple-300 font-mono truncate max-w-[150px]">
                      {selectedModel.classes.slice(0, 3).join(', ')}{selectedModel.classes.length > 3 ? '...' : ''}
                    </span>
                  </div>
                )}
              </div>
            </FeatureSection>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          CATEGORIES 2 & 3: DETECTION & FILTERING + VISUALIZATION & OVERLAYS
          ═════════════════════════════════════════════════════════════════════════ */}
      {showAdvancedSection && (
        <AINodeAdvancedSettingsContent
          id={nodeId}
          data={data}
          updateNodeData={(id, updates) => onChange(updates)}
          modelClasses={modelClasses}
          isInputNode={isInputNode}
          onOpenROI={() => setShowROIEditor(true)}
          activeCategory={activeCategory}
        />
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
