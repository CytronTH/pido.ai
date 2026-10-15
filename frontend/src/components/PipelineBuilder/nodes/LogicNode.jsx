import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Filter, Settings, ChevronDown, ChevronUp, Zap, Radio, Sliders } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeTelemetryBadge from './NodeTelemetryBadge';
import NodeHeader from './NodeHeader';
import LogicNodeSettings from '../settings/LogicNodeSettings';
import { getHumanReadableSummary } from '../settings/logicNodeUtils';

export default function LogicNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const setActiveSidebarNodeId = usePipelineStore((state) => state.setActiveSidebarNodeId);
  const debugState = usePipelineStore((state) => state.debugData?.[id]);

  const [isInlineExpanded, setIsInlineExpanded] = useState(false);
  const [liveMatched, setLiveMatched] = useState(false);

  // Sync from debugState (Zustand)
  useEffect(() => {
    if (debugState && typeof debugState.value === 'boolean') {
      setLiveMatched(debugState.value);
    }
  }, [debugState]);

  // Zero-latency direct push from window custom event
  useEffect(() => {
    const handleWs = (e) => {
      const msg = e.detail;
      if (msg?.type === 'logic_state' && msg.node_id === id) {
        setLiveMatched(Boolean(msg.value));
      }
    };
    window.addEventListener('pido_ws_message', handleWs);
    return () => {
      window.removeEventListener('pido_ws_message', handleWs);
    };
  }, [id]);

  const handleSettingsChange = useCallback((updates) => {
    updateNodeData(id, updates);
  }, [id, updateNodeData]);

  const handleOpenSidebar = (e) => {
    e.stopPropagation();
    setActiveSidebarNodeId(id);
  };

  const toggleInlineExpand = (e) => {
    e.stopPropagation();
    setIsInlineExpanded(prev => !prev);
  };

  const summaryText = useMemo(() => {
    return getHumanReadableSummary(data);
  }, [data]);

  const activeMode = data?.rulesMode ?? (data?.isAdvancedMode ? 'code' : 'visual');
  const outputMode = data?.outputMode ?? 'on_change';
  const debounceMs = data?.debounceMs ?? 0;

  return (
    <div 
      className={`bg-surface border-2 rounded-xl shadow-lg transition-all duration-200 ${
        liveMatched 
          ? 'border-emerald-400 shadow-emerald-500/20' 
          : selected 
          ? 'border-orange-500 shadow-orange-500/20' 
          : 'border-orange-600 shadow-orange-900/20'
      } ${isCompact ? 'w-48' : (isInlineExpanded ? 'w-80' : 'w-72')} text-fg flex flex-col overflow-hidden`}
    >
      <NodeHeader
        id={id}
        icon={Filter}
        iconBg="bg-orange-600"
        headerBg="bg-orange-600/20 border-orange-900/50"
        defaultName="Logic Filter"
        defaultSubtitle={summaryText}
        data={data}
      >
        <div className="flex items-center gap-1 nodrag">
          {/* Live ACT LED Pill */}
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-all duration-300 ${
              liveMatched
                ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                : 'bg-black/40 border-line/60'
            }`}
            title={liveMatched ? 'สถานะปัจจุบัน: เงื่อนไขตรง (TRUE)' : 'สถานะปัจจุบัน: รอเงื่อนไข (FALSE)'}
          >
            <span className="relative flex h-2 w-2">
              {liveMatched && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 transition-all duration-200 ${
                  liveMatched
                    ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                    : 'bg-emerald-950/80 border border-emerald-800/40'
                }`}
              ></span>
            </span>
            <span
              className={`text-[8px] font-mono font-bold tracking-wider select-none ${
                liveMatched ? 'text-emerald-400' : 'text-fg-subtle'
              }`}
            >
              {liveMatched ? 'TRUE' : 'FALSE'}
            </span>
          </div>
        </div>
      </NodeHeader>

      {!isCompact && (
        <div className="p-3 flex flex-col gap-2.5">
          {/* Inline Expanded Mode: renders full settings */}
          {isInlineExpanded ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1 border-b border-line">
                <span className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                  <Sliders size={11} /> Inline Settings
                </span>
                <button
                  type="button"
                  onClick={toggleInlineExpand}
                  className="text-[10px] text-fg-subtle hover:text-fg flex items-center gap-0.5 nodrag"
                >
                  ย่อ <ChevronUp size={12} />
                </button>
              </div>

              <LogicNodeSettings 
                nodeId={id} 
                data={data} 
                onChange={handleSettingsChange} 
                isSidebar={false} 
              />
            </div>
          ) : (
            /* Standard Compact Card View: clean and informative */
            <div className="flex flex-col gap-2">
              {/* Summary Box */}
              <div className="bg-canvas/70 border border-line rounded-lg p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted flex items-center gap-1">
                    {activeMode === 'visual' && '🎯 Rule Conditions'}
                    {activeMode === 'presets' && '⚡ Factory Preset'}
                    {activeMode === 'code' && '💻 Python Expression'}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface border border-line-strong font-mono text-fg-subtle">
                    {activeMode}
                  </span>
                </div>

                <div className="text-xs font-medium text-fg-secondary leading-snug line-clamp-2">
                  {summaryText}
                </div>

                {/* Subtitle / Expression preview */}
                <div className="text-[10px] font-mono text-orange-600/80 dark:text-orange-300/80 truncate border-t border-line/60 pt-1 mt-0.5">
                  {data?.expression || 'count > 0'}
                </div>
              </div>

              {/* Mode & Trigger Footer Badges */}
              <div className="flex items-center justify-between text-[10px] px-1 text-fg-subtle">
                <span className="flex items-center gap-1">
                  <Radio size={10} className="text-orange-500" />
                  {outputMode === 'on_change' && 'On Change'}
                  {outputMode === 'rising_edge' && 'Rising Edge'}
                  {outputMode === 'continuous' && 'Continuous'}
                </span>
                {debounceMs > 0 && (
                  <span className="font-mono">
                    Debounce {debounceMs}ms
                  </span>
                )}
              </div>

              {/* Actions row */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-line/60">
                <button
                  type="button"
                  onClick={handleOpenSidebar}
                  className="flex items-center justify-center gap-1 py-1 px-2 rounded-md bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[11px] font-semibold transition-colors nodrag"
                  title="เปิดแถบตั้งค่าด้านข้างเพื่อปรับแต่ง Rule Builder อย่างละเอียด"
                >
                  <Settings size={12} /> ตั้งค่าละเอียด
                </button>

                <button
                  type="button"
                  onClick={toggleInlineExpand}
                  className="flex items-center justify-center gap-1 py-1 px-2 rounded-md bg-surface-2 hover:bg-surface border border-line text-[11px] font-medium text-fg-secondary transition-colors nodrag"
                  title="ขยายการตั้งค่าบนตัวโหนด"
                >
                  ขยาย <ChevronDown size={12} />
                </button>
              </div>
            </div>
          )}

          <NodeTelemetryBadge nodeId={id} />
        </div>
      )}

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-orange-500 border-2 border-line-subtle" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-orange-500 border-2 border-line-subtle" />
    </div>
  );
}
