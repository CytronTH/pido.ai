import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  X, 
  ExternalLink, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  GripHorizontal, 
  Clock, 
  Tag, 
  ZoomIn, 
  Eye, 
  Layers, 
  Image as ImageIcon 
} from 'lucide-react';
import usePipelineStore from '../../store/usePipelineStore';

/**
 * Floating Realtime Photo Preview Window on Pipeline Builder Canvas.
 * - Draggable freely across the canvas viewport.
 * - Displays snapshots captured in realtime with a camera shutter flash animation.
 * - Features synchronized ACT LED indicator, image zoom modal, size toggling, and log links.
 */
export default function SnapshotPreviewFloatingWindow({ 
  nodeId, 
  nodeData = {}, 
  onClose,
  defaultOffsetIndex = 0 
}) {
  const projectId = usePipelineStore((state) => state.projectId);
  const debugData = usePipelineStore((state) => state.debugData?.[nodeId]);

  // Position state (starts at safe visible coordinates near top-left of canvas)
  const [position, setPosition] = useState(() => {
    if (typeof nodeData?.previewPosition?.x === 'number' && typeof nodeData?.previewPosition?.y === 'number') {
      return nodeData.previewPosition;
    }
    return { 
      x: 32 + (defaultOffsetIndex * 24), 
      y: 68 + (defaultOffsetIndex * 32) 
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const windowRef = useRef(null);

  // Snapshot data state
  const [snapshot, setSnapshot] = useState(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isShutterFlashed, setIsShutterFlashed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLargeSize, setIsLargeSize] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  const blinkTimerRef = useRef(null);
  const shutterTimerRef = useRef(null);

  const triggerCaptureEffects = useCallback((snapData) => {
    setSnapshot(snapData);
    setCaptureCount((prev) => prev + 1);

    // Trigger Hardware LED blink
    setIsBlinking(true);
    if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    blinkTimerRef.current = setTimeout(() => {
      setIsBlinking(false);
    }, 700);

    // Trigger Camera Shutter flash
    setIsShutterFlashed(true);
    if (shutterTimerRef.current) clearTimeout(shutterTimerRef.current);
    shutterTimerRef.current = setTimeout(() => {
      setIsShutterFlashed(false);
    }, 450);
  }, []);

  // Fetch initial latest snapshot from database on mount if not already populated
  const fetchLatestSnapshot = useCallback(async () => {
    if (!nodeId) return;
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        node_id: nodeId,
        event_type: 'SNAPSHOT',
        limit: '1',
      });
      if (projectId) q.append('project_id', projectId);

      const res = await fetch(`/api/logs?${q.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.logs && json.logs.length > 0) {
          const lastLog = json.logs[0];
          const path = lastLog.snapshot_path 
            ? `/api/snapshots/${lastLog.snapshot_path.split('/').pop()}` 
            : null;
          if (path) {
            setSnapshot({
              snapshot_path: path,
              filename: path.split('/').pop(),
              timestamp: lastLog.timestamp,
              tags: lastLog.payload?.tags || nodeData?.tags || [],
              label: lastLog.payload?.label || nodeData?.label || 'Snapshot',
              trigger_payload: lastLog.payload?.trigger,
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch initial snapshot:', err);
    } finally {
      setIsLoading(false);
    }
  }, [nodeId, projectId, nodeData]);

  useEffect(() => {
    fetchLatestSnapshot();
  }, [fetchLatestSnapshot]);

  // Listen to incoming debugData updates from Zustand store
  useEffect(() => {
    if (debugData?.type === 'snapshot_capture') {
      triggerCaptureEffects(debugData);
    }
  }, [debugData, triggerCaptureEffects]);

  // Listen directly to window 'pido_ws_message' event for zero-latency direct push
  useEffect(() => {
    const handleWs = (e) => {
      const data = e.detail;
      if (data?.type === 'snapshot_capture' && data.node_id === nodeId) {
        triggerCaptureEffects(data);
      }
    };

    window.addEventListener('pido_ws_message', handleWs);
    return () => {
      window.removeEventListener('pido_ws_message', handleWs);
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
      if (shutterTimerRef.current) clearTimeout(shutterTimerRef.current);
    };
  }, [nodeId, triggerCaptureEffects]);

  // Draggable Header logic
  const handleMouseDown = (e) => {
    // Only drag with left mouse button on non-interactive elements
    if (e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      const maxX = Math.max(10, window.innerWidth - (isLargeSize ? 540 : 360));
      const maxY = Math.max(10, window.innerHeight - 80);

      const nextX = Math.min(Math.max(10, dragStartRef.current.posX + deltaX), maxX);
      const nextY = Math.min(Math.max(10, dragStartRef.current.posY + deltaY), maxY);

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isLargeSize]);

  const nodeTitle = typeof nodeData?.label === 'string' && nodeData.label.trim()
    ? nodeData.label.trim()
    : 'Snapshot';

  const formattedTime = snapshot?.timestamp
    ? new Date(typeof snapshot.timestamp === 'number' ? snapshot.timestamp * 1000 : snapshot.timestamp).toLocaleTimeString()
    : null;

  const currentTags = snapshot?.tags || nodeData?.tags || [];

  return (
    <>
      <div
        ref={windowRef}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          width: isLargeSize ? '520px' : '360px',
        }}
        className={`absolute top-0 left-0 z-40 select-none rounded-2xl border transition-shadow duration-200 backdrop-blur-xl bg-surface/95 shadow-2xl flex flex-col ${
          isBlinking 
            ? 'border-emerald-400 shadow-emerald-500/30 ring-2 ring-emerald-400/40' 
            : 'border-pink-500/50 shadow-pink-950/40'
        } nodrag nopan`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header Bar (Draggable Handle) */}
        <div
          onMouseDown={handleMouseDown}
          className={`px-3 py-2.5 rounded-t-2xl border-b border-line flex items-center justify-between cursor-grab active:cursor-grabbing transition-colors ${
            isBlinking ? 'bg-emerald-950/30' : 'bg-pink-600/10'
          }`}
          title="Drag to reposition window on canvas"
        >
          {/* Left Title & Status */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <GripHorizontal size={15} className="text-fg-subtle shrink-0 opacity-60" />
            <div className="p-1 rounded-lg bg-pink-600 text-white shrink-0 shadow-sm">
              <Camera size={13} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-fg truncate leading-tight">
                  {nodeTitle}
                </span>
                <span className="text-[10px] font-mono text-pink-600 dark:text-pink-400 font-medium px-1 rounded bg-pink-500/10 border border-pink-500/20">
                  Preview
                </span>
              </div>
            </div>
          </div>

          {/* Right Controls: Hardware ACT LED + Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {/* Synchronized Hardware ACT LED Indicator */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-all duration-300 ${
                isBlinking
                  ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                  : 'bg-black/40 border-line/60'
              }`}
              title={isBlinking ? 'Capturing snapshot right now!' : 'Hardware ACT LED (blinks when snapshot is saved)'}
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

            {/* Refresh Button */}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                fetchLatestSnapshot();
              }}
              disabled={isLoading}
              className="p-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-2 transition-colors cursor-pointer"
              title="Refresh latest snapshot"
            >
              <RefreshCw size={12} className={`pointer-events-none ${isLoading ? 'animate-spin text-pink-500' : ''}`} />
            </button>

            {/* Size Toggle (Small / Large) */}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsLargeSize(!isLargeSize);
              }}
              className="p-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-2 transition-colors hidden sm:block cursor-pointer"
              title={isLargeSize ? 'Compact size' : 'Expand size'}
            >
              {isLargeSize ? <Minimize2 size={12} className="pointer-events-none" /> : <Maximize2 size={12} className="pointer-events-none" />}
            </button>

            {/* Minimize / Collapse Window Body */}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              className="p-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-2 transition-colors font-mono text-xs leading-none cursor-pointer"
              title={isMinimized ? 'Expand photo preview' : 'Minimize preview body'}
            >
              <span className="font-bold pointer-events-none">{isMinimized ? '+' : '—'}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onClose) {
                  onClose();
                } else if (nodeId) {
                  usePipelineStore.getState().updateNodeData(nodeId, { showPreviewWindow: false });
                }
              }}
              className="p-1 rounded-lg text-fg-subtle hover:text-red-500 hover:bg-red-500/10 transition-colors ml-0.5 cursor-pointer"
              title="Close preview window"
            >
              <X size={14} className="pointer-events-none" />
            </button>
          </div>
        </div>

        {/* Window Body (Collapsible) */}
        {!isMinimized && (
          <div className="p-3 flex flex-col gap-2.5">
            {/* Photo Screen Container */}
            <div className="relative w-full rounded-xl overflow-hidden bg-black/90 border border-line flex items-center justify-center min-h-[190px] shadow-inner group">
              {snapshot?.snapshot_path ? (
                <>
                  <img
                    key={snapshot.snapshot_path}
                    src={`${snapshot.snapshot_path}?t=${snapshot.timestamp || captureCount}`}
                    alt="Captured Snapshot"
                    className="w-full h-auto max-h-[260px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                  />

                  {/* Camera Shutter Flash Effect Overlay */}
                  {isShutterFlashed && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-xs animate-out fade-out duration-300 pointer-events-none z-10 flex items-center justify-center">
                      <div className="p-2 rounded-full bg-black/40 text-white animate-ping">
                        <Camera size={24} />
                      </div>
                    </div>
                  )}

                  {/* Hover Overlay with Action Buttons */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5 pointer-events-none">
                    <div className="flex items-center justify-between pointer-events-auto">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-white/90 border border-white/10 backdrop-blur-sm">
                        {snapshot.filename || 'snapshot.jpg'}
                      </span>
                      <a
                        href={snapshot.snapshot_path}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded-md bg-black/60 hover:bg-black/90 text-white/90 hover:text-white border border-white/10 transition-colors shadow-sm"
                        title="Open full resolution in new tab"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    <div className="flex items-center justify-center pointer-events-auto">
                      <button
                        type="button"
                        onClick={() => setIsFullscreenOpen(true)}
                        className="px-2.5 py-1 rounded-full bg-black/70 hover:bg-pink-600 text-white text-[11px] font-medium flex items-center gap-1.5 border border-white/20 backdrop-blur-md transition-all shadow-md active:scale-95"
                      >
                        <ZoomIn size={12} />
                        <span>Zoom In</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-white/80 pointer-events-auto">
                      {formattedTime && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={10} />
                          {formattedTime}
                        </span>
                      )}
                      {captureCount > 0 && (
                        <span className="font-mono text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          #{captureCount} new
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Empty Standby State */
                <div className="p-6 flex flex-col items-center justify-center text-center gap-2">
                  <div className="relative">
                    <div className="p-3 rounded-full bg-surface-2 text-fg-subtle border border-line">
                      <Camera size={22} className="opacity-60" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500"></span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-fg">Waiting for Snapshot...</span>
                    <p className="text-[10px] text-fg-subtle max-w-[200px]">
                      Trigger this Snapshot node or run the pipeline to preview captured frames in realtime.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Details: Tags & Timing */}
            <div className="flex items-center justify-between pt-1 border-t border-line/60 text-[11px]">
              {/* Tags Display */}
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                <Tag size={11} className="text-pink-500 shrink-0" />
                {currentTags.length > 0 ? (
                  currentTags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20"
                    >
                      #{t}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-fg-subtle italic">No tags</span>
                )}
              </div>

              {/* Timestamp or Status */}
              <div className="flex items-center gap-1.5 shrink-0 text-fg-subtle font-mono text-[10px]">
                {formattedTime ? (
                  <span>{formattedTime}</span>
                ) : (
                  <span className="text-fg-subtle">Ready</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Photo Modal */}
      {isFullscreenOpen && snapshot?.snapshot_path && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsFullscreenOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-surface rounded-2xl overflow-hidden border border-line-strong shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-surface-2 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-pink-500" />
                <span className="font-semibold text-sm text-fg">
                  {nodeTitle} — Snapshot Preview
                </span>
                {formattedTime && (
                  <span className="text-xs font-mono text-fg-subtle">({formattedTime})</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreenOpen(false)}
                className="p-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-3 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3 bg-black/95 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img
                src={snapshot.snapshot_path}
                alt="Full Resolution Snapshot"
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
              />
            </div>
            <div className="px-4 py-2.5 bg-surface-2 border-t border-line flex items-center justify-between text-xs text-fg-muted">
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentTags.map((t, idx) => (
                  <span key={idx} className="font-mono text-pink-600 dark:text-pink-400">
                    #{t}
                  </span>
                ))}
              </div>
              <a
                href={snapshot.snapshot_path}
                download={snapshot.filename || 'snapshot.jpg'}
                className="px-3 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium text-xs transition-colors flex items-center gap-1 shadow-sm"
              >
                <ExternalLink size={12} />
                <span>Open Raw</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
