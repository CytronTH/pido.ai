import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Image, Eye, Camera } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeHeader from './NodeHeader';
import SnapshotNodeSettings from '../settings/SnapshotNodeSettings';

export default function SnapshotNode({ id, data, selected }) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const debugData = usePipelineStore((state) => state.debugData?.[id]);
  const isCompact = data?.viewMode === 'compact';
  const showPreview = Boolean(data?.showPreviewWindow);

  // Hardware ACT LED Blink State
  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimerRef = useRef(null);

  const triggerBlink = useCallback(() => {
    setIsBlinking(true);
    if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    blinkTimerRef.current = setTimeout(() => {
      setIsBlinking(false);
    }, 700);
  }, []);

  // Watch for snapshot_capture events from store
  useEffect(() => {
    if (debugData?.type === 'snapshot_capture') {
      triggerBlink();
    }
  }, [debugData, triggerBlink]);

  // Watch for zero-latency direct push events from window
  useEffect(() => {
    const handleWs = (e) => {
      const msg = e.detail;
      if (msg?.type === 'snapshot_capture' && msg.node_id === id) {
        triggerBlink();
      }
    };
    window.addEventListener('pido_ws_message', handleWs);
    return () => {
      window.removeEventListener('pido_ws_message', handleWs);
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [id, triggerBlink]);

  // Ensure label is initialized if undefined
  useEffect(() => {
    if (data?.label === undefined) {
      updateNodeData(id, { label: 'Snapshot' });
    }
  }, [id, data?.label, updateNodeData]);

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  const togglePreview = (e) => {
    e.stopPropagation();
    updateNodeData(id, { showPreviewWindow: !showPreview });
  };

  return (
    <div
      className={`bg-surface border-2 rounded-xl shadow-xl ${
        isCompact ? 'w-52' : 'w-72'
      } overflow-hidden transition-all duration-300 ${
        isBlinking
          ? 'border-emerald-400 shadow-emerald-500/30 scale-[1.01]'
          : selected
          ? 'border-pink-400 shadow-pink-500/20'
          : 'border-pink-600'
      }`}
    >
      <NodeHeader
        id={id}
        icon={Image}
        iconBg="bg-pink-600"
        headerBg="bg-pink-600/20 border-pink-900/50"
        defaultName="Snapshot"
        defaultSubtitle="Frame Capture"
        data={data}
      >
        {!isCompact && (
          <div className="flex items-center gap-1.5 nodrag">
            {/* Hardware ACT LED Indicator */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-all duration-300 ${
                isBlinking
                  ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]'
                  : 'bg-black/40 border-line/60'
              }`}
              title={isBlinking ? 'Capturing snapshot to Event Logs!' : 'Hardware ACT LED (blinks when snapshot is saved)'}
            >
              <span className="relative flex h-2 w-2">
                {isBlinking && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 transition-all duration-200 ${
                    isBlinking
                      ? 'bg-emerald-400 shadow-[0_0_8px_#34d399,0_0_2px_#fff]'
                      : 'bg-emerald-950/90 border border-emerald-800/40'
                  }`}
                ></span>
              </span>
              <span
                className={`text-[8px] font-mono font-bold tracking-wider select-none transition-colors ${
                  isBlinking ? 'text-emerald-400' : 'text-fg-subtle'
                }`}
              >
                ACT
              </span>
            </div>

            {/* Photo Preview Window Toggle Button */}
            <button
              type="button"
              onClick={togglePreview}
              className={`px-2 py-0.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all shadow-xs ${
                showPreview
                  ? 'bg-pink-600 text-white border border-pink-400 shadow-pink-600/30'
                : 'text-fg-subtle hover:text-fg hover:bg-surface-2 border border-line/60'
              }`}
              title={showPreview ? 'Close Photo Preview Window on Canvas' : 'Open Photo Preview Window on Canvas'}
            >
              <Eye size={12} className={showPreview ? 'text-white animate-pulse' : 'text-fg-subtle'} />
              <span className="text-[10px] font-mono leading-none font-bold">
                {showPreview ? 'Preview ON' : 'Preview'}
              </span>
            </button>
          </div>
        )}
      </NodeHeader>
      
      {/* Compact / Sidebar Mode Action Bar: Dedicated row so node name in header is never squished */}
      {isCompact && (
        <div className="px-3 py-1.5 border-t border-line/60 bg-canvas/40 flex items-center justify-between gap-1.5 nodrag">
          {/* Hardware ACT LED Indicator */}
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-all duration-300 ${
              isBlinking
                ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]'
                : 'bg-black/40 border-line/60'
            }`}
            title={isBlinking ? 'Capturing snapshot to Event Logs!' : 'Hardware ACT LED (blinks when snapshot is saved)'}
          >
            <span className="relative flex h-2 w-2">
              {isBlinking && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 transition-all duration-200 ${
                  isBlinking
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399,0_0_2px_#fff]'
                    : 'bg-emerald-950/90 border border-emerald-800/40'
                }`}
              ></span>
            </span>
            <span
              className={`text-[8px] font-mono font-bold tracking-wider select-none transition-colors ${
                isBlinking ? 'text-emerald-400' : 'text-fg-subtle'
              }`}
            >
              ACT
            </span>
          </div>

          {/* Photo Preview Window Toggle Button */}
          <button
            type="button"
            onClick={togglePreview}
            className={`px-2 py-0.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all shadow-xs ${
              showPreview
                ? 'bg-pink-600 text-white border border-pink-400 shadow-pink-600/30'
                : 'text-fg-subtle hover:text-fg hover:bg-surface-2 border border-line/60'
            }`}
            title={showPreview ? 'Close Photo Preview Window on Canvas' : 'Open Photo Preview Window on Canvas'}
          >
            <Eye size={12} className={showPreview ? 'text-white animate-pulse' : 'text-fg-subtle'} />
            <span className="text-[10px] font-mono leading-none font-bold">
              {showPreview ? 'Preview ON' : 'Preview'}
            </span>
          </button>
        </div>
      )}

      {isCompact && Array.isArray(data?.tags) && data.tags.length > 0 && (
        <div className="px-3 py-1.5 border-t border-line/60 bg-canvas/20 flex flex-wrap gap-1">
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
          <SnapshotNodeSettings data={data} onChange={handleSettingsChange} nodeId={id} />
        </div>
      )}

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-pink-500 border-2 border-line-subtle" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-pink-500 border-2 border-line-subtle" />
    </div>
  );
}
