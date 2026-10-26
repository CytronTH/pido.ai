import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  ScanLine, QrCode, Camera, Sliders, ChevronDown, ChevronUp, 
  Layers, Crosshair, Check, Radio, Eye
} from 'lucide-react';
import NodeHeader from './NodeHeader';
import ROIEditorModal from './ROIEditorModal';
import usePipelineStore from '../../../store/usePipelineStore';

export default function BarcodeVisionNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;
  const nodes = usePipelineStore((state) => state.nodes);
  const edges = usePipelineStore((state) => state.edges);
  const debugData = usePipelineStore((state) => state.debugData?.[id]);

  // ACT Blink State
  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimerRef = useRef(null);

  // ROI Modal State
  const [showRoiModal, setShowRoiModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cameras, setCameras] = useState([]);

  // Local state for last scan
  const [lastScanned, setLastScanned] = useState(data?.lastScanned || '');
  const [lastFormat, setLastFormat] = useState(data?.lastFormat || '');
  const [lastCount, setLastCount] = useState(0);

  // Config values
  const scanMode = data?.scanMode || 'continuous'; // 'continuous' | 'triggered'
  const scanFps = data?.scanFps ?? 5;
  const codeTypes = data?.codeTypes || 'all'; // 'all' | 'qr' | 'barcode'
  const configuredCameraId = data?.cameraId || '';
  const roi = data?.roi || { x: 0, y: 0, w: 1, h: 1 };
  const debounceMs = data?.debounceMs ?? 1000;
  const onlyOnChange = data?.onlyOnChange ?? true;
  const replacePayload = data?.replacePayload ?? true;
  const stripPrefix = data?.stripPrefix || '';
  const stripSuffix = data?.stripSuffix || '';
  const regexFilter = data?.regexFilter || '';

  const updateField = (field, value) => {
    if (data?.onChange) {
      data.onChange({ ...data, [field]: value });
    } else {
      updateNodeData(id, { [field]: value });
    }
  };

  // Trigger ACT indicator blink
  const triggerBlink = useCallback(() => {
    setIsBlinking(true);
    if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    blinkTimerRef.current = setTimeout(() => {
      setIsBlinking(false);
    }, 700);
  }, []);

  // Fetch available cameras on mount
  useEffect(() => {
    fetch('/api/entities', { cache: 'no-store' })
      .then((res) => res.json())
      .then((d) => {
        if (d.cameras && Array.isArray(d.cameras)) {
          setCameras(d.cameras);
        }
      })
      .catch(() => {});
  }, []);

  // Detect upstream camera node
  const upstreamCameraInfo = React.useMemo(() => {
    if (!edges || !nodes) return null;
    const inEdges = edges.filter((e) => e.target === id);
    for (const edge of inEdges) {
      const srcNode = nodes.find((n) => n.id === edge.source);
      if (!srcNode) continue;
      if (srcNode.type === 'inputNode') {
        const camId = srcNode.data?.entityId || srcNode.data?.cameraId;
        const camName = srcNode.data?.label || srcNode.data?.name || camId || 'Upstream Camera';
        return { id: camId, name: camName };
      }
      if (srcNode.type === 'aiNode') {
        return { id: srcNode.id, name: srcNode.data?.label || 'AI Model Stream' };
      }
    }
    return null;
  }, [edges, nodes, id]);

  const effectiveCameraId = configuredCameraId || upstreamCameraInfo?.id || '';

  // Listen for WebSocket barcode_vision events
  useEffect(() => {
    const handleWs = (e) => {
      const msg = e.detail;
      if (msg?.type === 'barcode_vision' && msg.node_id === id) {
        if (msg.codes && msg.codes.length > 0) {
          const first = msg.codes[0];
          setLastScanned(first.text || '');
          setLastFormat(first.format || 'CODE');
          setLastCount(msg.codes.length);
          triggerBlink();
        }
      }
    };
    window.addEventListener('pido_ws_message', handleWs);
    return () => {
      window.removeEventListener('pido_ws_message', handleWs);
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [id, triggerBlink]);

  // Watch debugData in store
  useEffect(() => {
    if (debugData?.barcode || debugData?.payload) {
      const code = String(debugData.barcode || debugData.payload);
      if (code) {
        setLastScanned(code);
        setLastFormat(debugData.format || 'CODE');
        setLastCount(debugData.count || 1);
        triggerBlink();
      }
    }
  }, [debugData, triggerBlink]);

  const isRoiActive = roi && (roi.w < 0.98 || roi.h < 0.98 || roi.x > 0.02 || roi.y > 0.02);

  return (
    <div
      className={`bg-surface border-2 rounded-xl shadow-xl ${
        isCompact ? 'w-56' : 'w-80'
      } overflow-hidden transition-all duration-300 ${
        isBlinking
          ? 'border-emerald-400 shadow-emerald-500/30 scale-[1.01]'
          : selected
          ? 'border-cyan-400 shadow-cyan-500/20'
          : 'border-cyan-600'
      }`}
    >
      <NodeHeader
        id={id}
        icon={ScanLine}
        iconBg="bg-cyan-600"
        headerBg="bg-cyan-600/20 border-cyan-900/50"
        defaultName="Barcode Vision"
        defaultSubtitle="Camera Barcode / QR"
        data={data}
      >
        <div className="flex items-center gap-1.5 nodrag">
          {/* Real-time ACT LED indicator */}
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-all duration-300 ${
              isBlinking
                ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]'
                : 'bg-black/40 border-line/60'
            }`}
            title={isBlinking ? 'Barcode / QR code detected!' : 'ACT LED (pulses when code detected)'}
          >
            <span className="relative flex h-2 w-2">
              {isBlinking && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 transition-all duration-200 ${
                  isBlinking
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399,0_0_2px_#fff]'
                    : 'bg-cyan-950/90 border border-cyan-800/40'
                }`}
              ></span>
            </span>
            <span
              className={`text-[8px] font-mono font-bold tracking-wider select-none transition-colors ${
                isBlinking ? 'text-emerald-400' : 'text-fg-subtle'
              }`}
            >
              SCAN
            </span>
          </div>
        </div>
      </NodeHeader>

      {/* Live Read Result Card */}
      <div className="px-3 py-2 bg-canvas/60 border-b border-line/60 flex flex-col gap-1 nodrag">
        <div className="flex items-center justify-between text-[10px] text-fg-subtle font-mono">
          <span className="flex items-center gap-1">
            <QrCode size={11} className="text-cyan-400" />
            <span>LATEST CODE</span>
          </span>
          {lastFormat && (
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
              {lastFormat}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <div
            className={`text-xs font-mono font-bold truncate px-2 py-1 rounded w-full select-all transition-colors ${
              lastScanned
                ? 'bg-surface-2 text-cyan-300 border border-cyan-500/30'
                : 'bg-surface/50 text-fg-muted italic border border-line/30'
            }`}
            title={lastScanned || 'No code scanned yet'}
          >
            {lastScanned || 'Waiting for code...'}
          </div>
          {lastCount > 1 && (
            <span className="text-[10px] font-mono px-1.5 py-1 bg-surface-2 text-cyan-400 border border-line/40 rounded shrink-0">
              +{lastCount - 1}
            </span>
          )}
        </div>
      </div>

      {!isCompact && (
        <div className="p-3.5 flex flex-col gap-3 nodrag text-xs">
          {/* Scan Mode Toggle */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-fg-muted">Scan Mode</label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-2 rounded-lg border border-line/50">
              <button
                type="button"
                onClick={() => updateField('scanMode', 'continuous')}
                className={`py-1 text-center rounded text-xs font-semibold transition-all ${
                  scanMode === 'continuous'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-fg-subtle hover:text-fg'
                }`}
              >
                Continuous
              </button>
              <button
                type="button"
                onClick={() => updateField('scanMode', 'triggered')}
                className={`py-1 text-center rounded text-xs font-semibold transition-all ${
                  scanMode === 'triggered'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-fg-subtle hover:text-fg'
                }`}
              >
                Triggered
              </button>
            </div>
          </div>

          {/* Camera Source */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-fg-muted flex items-center justify-between">
              <span>Camera Stream</span>
              {upstreamCameraInfo && (
                <span className="text-[10px] text-cyan-400 font-mono">
                  (Auto linked)
                </span>
              )}
            </label>
            <select
              value={configuredCameraId}
              onChange={(e) => updateField('cameraId', e.target.value)}
              className="w-full bg-surface-2 border border-line/60 rounded-md px-2 py-1.5 text-xs text-fg focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="">
                {upstreamCameraInfo ? `Auto: ${upstreamCameraInfo.name}` : '-- Select Camera --'}
              </option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.id}
                </option>
              ))}
            </select>
          </div>

          {/* Code Types Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-fg-muted">Code Type</label>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-surface-2 rounded-lg border border-line/50 text-center">
              <button
                type="button"
                onClick={() => updateField('codeTypes', 'all')}
                className={`py-1 text-[11px] rounded font-semibold transition-all ${
                  codeTypes === 'all'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-fg-subtle hover:text-fg'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => updateField('codeTypes', 'qr')}
                className={`py-1 text-[11px] rounded font-semibold transition-all ${
                  codeTypes === 'qr'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-fg-subtle hover:text-fg'
                }`}
              >
                QR Only
              </button>
              <button
                type="button"
                onClick={() => updateField('codeTypes', 'barcode')}
                className={`py-1 text-[11px] rounded font-semibold transition-all ${
                  codeTypes === 'barcode'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-fg-subtle hover:text-fg'
                }`}
              >
                1D Only
              </button>
            </div>
          </div>

          {/* Continuous Mode FPS slider */}
          {scanMode === 'continuous' && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-fg-muted">Scan Rate</span>
                <span className="font-mono text-cyan-400 font-bold">{scanFps} FPS</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={scanFps}
                onChange={(e) => updateField('scanFps', Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-surface-2 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-fg-subtle font-mono px-0.5">
                <span>1 FPS</span>
                <span>5 FPS (Rec.)</span>
                <span>15 FPS</span>
              </div>
            </div>
          )}

          {/* ROI Zone Button */}
          <div className="flex items-center justify-between pt-1 border-t border-line/40">
            <div className="flex items-center gap-1.5">
              <Crosshair size={13} className={isRoiActive ? 'text-amber-400' : 'text-fg-subtle'} />
              <span className="text-[11px] font-medium text-fg-muted">Detection ROI</span>
            </div>
            <button
              type="button"
              onClick={() => setShowRoiModal(true)}
              className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 border transition-all ${
                isRoiActive
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-surface-2 text-fg-subtle hover:text-fg border-line/60'
              }`}
            >
              <span>{isRoiActive ? 'Custom Area' : 'Full Frame'}</span>
            </button>
          </div>

          {/* Advanced Accordion Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between text-[11px] text-fg-subtle hover:text-fg pt-1 border-t border-line/40 transition-colors"
          >
            <span className="flex items-center gap-1">
              <Sliders size={12} />
              <span>Filters & Sanitization</span>
            </span>
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAdvanced && (
            <div className="flex flex-col gap-2.5 p-2.5 bg-canvas/40 rounded-lg border border-line/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-fg-muted">Debounce</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    step="100"
                    value={debounceMs}
                    onChange={(e) => updateField('debounceMs', Number(e.target.value))}
                    className="w-16 bg-surface-2 border border-line/60 rounded px-1.5 py-0.5 text-right font-mono text-xs text-fg"
                  />
                  <span className="text-[10px] text-fg-subtle font-mono">ms</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-fg-muted">Only Emit on Change</span>
                <input
                  type="checkbox"
                  checked={onlyOnChange}
                  onChange={(e) => updateField('onlyOnChange', e.target.checked)}
                  className="rounded border-line accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-fg-muted">Replace Trigger Payload</span>
                <input
                  type="checkbox"
                  checked={replacePayload}
                  onChange={(e) => updateField('replacePayload', e.target.checked)}
                  className="rounded border-line accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-fg-subtle">Strip Prefix / Suffix</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    placeholder="Prefix (e.g. ID:)"
                    value={stripPrefix}
                    onChange={(e) => updateField('stripPrefix', e.target.value)}
                    className="bg-surface-2 border border-line/60 rounded px-2 py-1 text-[11px] font-mono text-fg placeholder:text-fg-subtle/50"
                  />
                  <input
                    type="text"
                    placeholder="Suffix"
                    value={stripSuffix}
                    onChange={(e) => updateField('stripSuffix', e.target.value)}
                    className="bg-surface-2 border border-line/60 rounded px-2 py-1 text-[11px] font-mono text-fg placeholder:text-fg-subtle/50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-fg-subtle">Regex Filter / Group</label>
                <input
                  type="text"
                  placeholder="e.g. LOT-(\d+)"
                  value={regexFilter}
                  onChange={(e) => updateField('regexFilter', e.target.value)}
                  className="bg-surface-2 border border-line/60 rounded px-2 py-1 text-[11px] font-mono text-fg placeholder:text-fg-subtle/50"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Target handle for trigger/stream input */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-cyan-500 border-2 border-line-subtle"
        title="Input trigger / Camera stream"
      />
      {/* Source handle for decoded barcode payload */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-cyan-500 border-2 border-line-subtle"
        title="Decoded Barcode Output"
      />

      {/* ROI Modal */}
      {showRoiModal && (
        <ROIEditorModal
          cameraId={effectiveCameraId}
          currentRoi={roi}
          onApply={(newRoi) => {
            updateField('roi', newRoi);
            setShowRoiModal(false);
          }}
          onClose={() => setShowRoiModal(false)}
        />
      )}
    </div>
  );
}
