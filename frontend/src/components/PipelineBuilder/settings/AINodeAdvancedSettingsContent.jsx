import React from 'react';
import { Filter, Crosshair, Layers, Sliders, Target, Eye } from 'lucide-react';
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

export default function AINodeAdvancedSettingsContent({
  id,
  data,
  updateNodeData,
  modelClasses = [],
  isInputNode,
  onOpenROI,
  activeCategory = 'all', // 'all' | 'detection' | 'display'
}) {
  const confidenceThreshold = data?.confidenceThreshold ?? 0.5;
  const confEnabled = data?.confidenceThresholdEnabled ?? true;
  const classFilter = data?.classFilter ?? null;
  const isClassFilterActive = data?.classFilterEnabled ?? (classFilter !== null && classFilter !== undefined);
  const bboxEnabled = data?.bboxEnabled ?? (data?.bboxDrawMode !== 'none');
  const roiActive = Boolean(data?.roiEnabled);

  const handleConfidenceChange = (e) => {
    updateNodeData(id, { confidenceThreshold: parseFloat(e.target.value) });
  };

  const handleClassConfidenceChange = (cls, val) => {
    if (isNaN(val)) return;
    const currentConfs = data?.classConfidences || {};
    updateNodeData(id, { classConfidences: { ...currentConfs, [cls]: val } });
  };

  const handleClassToggle = (cls) => {
    let current = classFilter ? [...classFilter] : [...modelClasses];
    if (current.includes(cls)) {
      current = current.filter(c => c !== cls);
    } else {
      current = [...current, cls];
    }
    if (current.length === modelClasses.length) {
      updateNodeData(id, { classFilter: null });
    } else {
      updateNodeData(id, { classFilter: current });
    }
  };

  const handleAllToggle = () => {
    if (classFilter === null) {
      updateNodeData(id, { classFilter: [] });
    } else {
      updateNodeData(id, { classFilter: null });
    }
  };

  const isClassSelected = (cls) => {
    if (classFilter === null) return true;
    return classFilter.includes(cls);
  };

  const allSelected = classFilter === null;
  const activeClassCount = classFilter === null ? modelClasses.length : classFilter.length;

  const showDetection = activeCategory === 'all' || activeCategory === 'detection';
  const showDisplay = activeCategory === 'all' || activeCategory === 'display';

  const detectionActiveCount = [confEnabled, isClassFilterActive, roiActive].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3.5">
      {/* ═════════════════════════════════════════════════════════════════════════
          CATEGORY 2: DETECTION & FILTERING (การตรวจจับและการคัดกรอง)
          ═════════════════════════════════════════════════════════════════════════ */}
      {showDetection && (
        <div className="flex flex-col gap-2.5">
          <CategoryHeader 
            icon={Target} 
            title="Detection & Filtering" 
            badge={`${detectionActiveCount}/3 active`} 
          />

          {/* 1. Confidence Threshold */}
          <FeatureSection
            icon={Sliders}
            title="Confidence Threshold"
            badge={confEnabled ? `${(confidenceThreshold * 100).toFixed(0)}% (${confidenceThreshold.toFixed(2)})` : 'Bypassed'}
            badgeColor={confEnabled ? 'purple' : 'gray'}
            enabled={confEnabled}
            onToggle={(val) => updateNodeData(id, { confidenceThresholdEnabled: val })}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0" max="1" step="0.05"
                  value={confidenceThreshold}
                  onChange={handleConfidenceChange}
                  className="flex-1 accent-purple-500 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300 w-12 text-right">
                  {confidenceThreshold.toFixed(2)}
                </span>
              </div>
              <span className="text-[10px] text-fg-faint">
                Filter out detections with confidence score below {confidenceThreshold.toFixed(2)}
              </span>
            </div>
          </FeatureSection>

          {/* 2. Class Filter */}
          <FeatureSection
            icon={Filter}
            title="Class Filter"
            badge={
              !isClassFilterActive 
                ? 'All Classes' 
                : `${activeClassCount}/${modelClasses.length} Selected`
            }
            badgeColor={isClassFilterActive ? 'purple' : 'gray'}
            enabled={isClassFilterActive}
            onToggle={(val) => {
              if (val) {
                updateNodeData(id, {
                  classFilterEnabled: true,
                  classFilter: data?.classFilter || null
                });
              } else {
                updateNodeData(id, {
                  classFilterEnabled: false,
                  classFilter: null
                });
              }
            }}
          >
            {modelClasses.length > 0 ? (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer py-1 border-b border-line-strong/40 pb-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleAllToggle}
                    className="accent-purple-500 w-3.5 h-3.5 rounded"
                  />
                  <span className="text-xs font-semibold text-fg">Select All Classes</span>
                </label>
                
                <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                  {modelClasses.map(cls => (
                    <div key={cls} className="flex items-center justify-between py-1 group hover:bg-surface-2/50 rounded px-1 -mx-1">
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isClassSelected(cls)}
                          onChange={() => handleClassToggle(cls)}
                          className="accent-purple-500 w-3.5 h-3.5 rounded"
                        />
                        <span className="text-xs truncate text-fg-secondary">{cls}</span>
                      </label>
                      {isClassSelected(cls) && (
                        <div className="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-fg-subtle">conf</span>
                          <input
                            type="number" min="0" max="1" step="0.05"
                            value={data?.classConfidences?.[cls] ?? confidenceThreshold}
                            onChange={e => handleClassConfidenceChange(cls, parseFloat(e.target.value))}
                            className="bg-surface border border-line-strong rounded px-1.5 py-0.5 text-xs w-13 text-center text-purple-700 dark:text-purple-300 outline-none focus:border-purple-500 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-center py-3 border border-dashed border-line-strong rounded-lg text-fg-faint">
                No class names defined for this model.
              </div>
            )}
          </FeatureSection>

          {/* 3. Processing Mask (ROI) */}
          <FeatureSection
            icon={Crosshair}
            title="Inspection Zone (ROI)"
            badge={roiActive ? 'Active' : 'Disabled'}
            badgeColor={roiActive ? 'purple' : 'gray'}
            enabled={roiActive}
            onToggle={(val) => updateNodeData(id, { roiEnabled: val })}
            headerAction={
              isInputNode ? (
                <button
                  type="button"
                  onClick={onOpenROI}
                  className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-200 dark:hover:bg-purple-900/50 border border-purple-700/40 hover:border-purple-600 px-2 py-0.5 rounded-md transition-all shadow-xs active:scale-95"
                  title="Open visual ROI zone editor"
                >
                  <Crosshair size={11} />
                  <span>Draw Zone</span>
                </button>
              ) : (
                <span className="text-[10px] italic text-fg-faint">connect Input</span>
              )
            }
          >
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-4 gap-2">
                {['x', 'y', 'w', 'h'].map((key) => (
                  <label key={key} className="text-xs flex flex-col items-center gap-1 text-fg-muted font-medium">
                    {key.toUpperCase()}
                    <input
                      type="number" min="0" max="1" step="0.01"
                      className="bg-surface border border-line-strong rounded p-1 w-full text-center focus:border-purple-500 outline-none text-xs text-fg font-mono"
                      value={data?.roi?.[key] ?? (key === 'w' || key === 'h' ? 1.0 : 0.0)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val)) return;
                        const base = { x: 0, y: 0, w: 1, h: 1, ...(data?.roi || {}) };
                        updateNodeData(id, { roi: { ...base, [key]: val } });
                      }}
                    />
                  </label>
                ))}
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-line-strong/40">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors text-fg-secondary">
                    Show Mask Box on Stream
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={data?.showRoi ?? false}
                      onChange={(e) => updateNodeData(id, { showRoi: e.target.checked })}
                    />
                    <div className={`block w-7 h-4 rounded-full transition-colors ${data?.showRoi ? 'bg-purple-600' : 'bg-surface-3'}`}></div>
                    <div className={`dot absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform ${data?.showRoi ? 'transform translate-x-3' : ''}`}></div>
                  </div>
                </label>
              </div>

              {data?.roi && (data.roi.x !== 0 || data.roi.y !== 0 || data.roi.w !== 1 || data.roi.h !== 1) && (
                <div className="text-[11px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/20 rounded px-2 py-1 border border-purple-800/40 text-center font-mono">
                  Zone: ({(data.roi.x * 100).toFixed(0)}%, {(data.roi.y * 100).toFixed(0)}%) &nbsp;
                  {(data.roi.w * 100).toFixed(0)}% × {(data.roi.h * 100).toFixed(0)}%
                </div>
              )}
            </div>
          </FeatureSection>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          CATEGORY 3: VISUALIZATION & OVERLAYS (การแสดงผลและโอเวอร์เลย์)
          ═════════════════════════════════════════════════════════════════════════ */}
      {showDisplay && (
        <div className="flex flex-col gap-2.5">
          <CategoryHeader 
            icon={Eye} 
            title="Visualization & Overlays" 
            badge={bboxEnabled ? '1 active' : 'Hidden'} 
          />

          <FeatureSection
            icon={Layers}
            title="Bounding Box Overlay"
            badge={bboxEnabled ? (data?.bboxDrawMode === 'backend' ? 'Backend' : 'Frontend') : 'Hidden'}
            badgeColor={bboxEnabled ? 'purple' : 'gray'}
            enabled={bboxEnabled}
            onToggle={(val) => {
              if (val) {
                updateNodeData(id, {
                  bboxEnabled: true,
                  bboxDrawMode: (data?.prevBboxDrawMode && data?.prevBboxDrawMode !== 'none') ? data.prevBboxDrawMode : 'frontend'
                });
              } else {
                updateNodeData(id, {
                  bboxEnabled: false,
                  prevBboxDrawMode: data?.bboxDrawMode || 'frontend',
                  bboxDrawMode: 'none'
                });
              }
            }}
          >
            <label className="text-xs flex flex-col gap-1.5 text-fg-muted font-medium">
              Draw Mode
              <select
                className="bg-surface border border-line-strong rounded p-1.5 text-xs focus:outline-none focus:border-purple-500 text-fg"
                value={data?.bboxDrawMode || 'frontend'}
                onChange={(e) => updateNodeData(id, { bboxDrawMode: e.target.value })}
              >
                <option value="frontend">Frontend (HTML Canvas)</option>
                <option value="backend">Backend (Burn into Video)</option>
              </select>
            </label>

            {data?.bboxDrawMode === 'backend' && (
              <label className="text-xs flex flex-col gap-1.5 text-fg-muted font-medium">
                Video Resolution <span className="text-[10px] text-amber-500/90">(High resolutions increase CPU load)</span>
                <select
                  className="bg-surface border border-line-strong rounded p-1.5 text-xs focus:outline-none focus:border-purple-500 text-fg"
                  value={data?.backendResolution || 'auto'}
                  onChange={(e) => updateNodeData(id, { backendResolution: e.target.value })}
                >
                  <option value="auto">Auto (Adaptive based on CPU)</option>
                  <option value="360p">360p (640x360)</option>
                  <option value="480p">480p (854x480)</option>
                  <option value="720p">720p (1280x720) - Heavy</option>
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs flex flex-col gap-1 text-fg-muted font-medium">
                Line Thickness
                <input
                  type="number" min="1" max="10" step="1"
                  className="bg-surface border border-line-strong rounded p-1.5 text-center focus:border-purple-500 outline-none text-xs text-fg"
                  value={data?.bboxLineThickness ?? 2}
                  onChange={(e) => updateNodeData(id, { bboxLineThickness: parseInt(e.target.value) || 2 })}
                />
              </label>
              <label className="text-xs flex flex-col gap-1 text-fg-muted font-medium">
                Font Thickness
                <input
                  type="number" min="1" max="10" step="1"
                  className="bg-surface border border-line-strong rounded p-1.5 text-center focus:border-purple-500 outline-none text-xs text-fg"
                  value={data?.bboxFontThickness ?? 1}
                  onChange={(e) => updateNodeData(id, { bboxFontThickness: parseInt(e.target.value) || 1 })}
                />
              </label>
            </div>
          </FeatureSection>
        </div>
      )}
    </div>
  );
}
