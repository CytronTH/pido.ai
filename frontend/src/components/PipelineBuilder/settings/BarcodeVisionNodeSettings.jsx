import React, { useState, useEffect } from 'react';
import { QrCode, Crosshair, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import ROIEditorModal from '../nodes/ROIEditorModal';
import usePipelineStore from '../../../store/usePipelineStore';

export default function BarcodeVisionNodeSettings({ data, onChange, nodeId }) {
  const nodes = usePipelineStore((state) => state.nodes);
  const edges = usePipelineStore((state) => state.edges);

  const [showRoiModal, setShowRoiModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cameras, setCameras] = useState([]);

  const scanMode = data?.scanMode || 'continuous';
  const scanFps = data?.scanFps ?? 5;
  const codeTypes = data?.codeTypes || 'all';
  const configuredCameraId = data?.cameraId || '';
  const roi = data?.roi || { x: 0, y: 0, w: 1, h: 1 };
  const debounceMs = data?.debounceMs ?? 1000;
  const onlyOnChange = data?.onlyOnChange ?? true;
  const replacePayload = data?.replacePayload ?? true;
  const stripPrefix = data?.stripPrefix || '';
  const stripSuffix = data?.stripSuffix || '';
  const regexFilter = data?.regexFilter || '';

  const updateField = (field, value) => {
    onChange({ [field]: value });
  };

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

  const upstreamCameraInfo = React.useMemo(() => {
    if (!edges || !nodes || !nodeId) return null;
    const inEdges = edges.filter((e) => e.target === nodeId);
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
  }, [edges, nodes, nodeId]);

  const effectiveCameraId = configuredCameraId || upstreamCameraInfo?.id || '';
  const isRoiActive = roi && (roi.w < 0.98 || roi.h < 0.98 || roi.x > 0.02 || roi.y > 0.02);

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Scan Mode */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-fg-secondary">Scan Mode</label>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-2 rounded-lg border border-line">
          <button
            type="button"
            onClick={() => updateField('scanMode', 'continuous')}
            className={`py-1.5 text-center rounded-md font-semibold transition-all ${
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
            className={`py-1.5 text-center rounded-md font-semibold transition-all ${
              scanMode === 'triggered'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-fg-subtle hover:text-fg'
            }`}
          >
            Triggered
          </button>
        </div>
        <p className="text-[11px] text-fg-subtle">
          {scanMode === 'continuous'
            ? 'Periodically scans frames from the camera stream at the configured frame rate.'
            : 'Scans the latest camera frame only when an upstream trigger signal is received.'}
        </p>
      </div>

      {/* Camera Selection */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-fg-secondary flex items-center justify-between">
          <span>Camera Stream</span>
          {upstreamCameraInfo && (
            <span className="text-[10px] text-cyan-400 font-mono">
              (Auto linked from flow)
            </span>
          )}
        </label>
        <select
          value={configuredCameraId}
          onChange={(e) => updateField('cameraId', e.target.value)}
          className="w-full bg-surface-2 border border-line rounded-lg px-2.5 py-1.5 text-xs text-fg focus:outline-none focus:border-cyan-500 font-mono"
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

      {/* Code Types */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-fg-secondary">Code Types</label>
        <div className="grid grid-cols-3 gap-1 p-1 bg-surface-2 rounded-lg border border-line text-center">
          <button
            type="button"
            onClick={() => updateField('codeTypes', 'all')}
            className={`py-1 rounded font-semibold transition-all ${
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
            className={`py-1 rounded font-semibold transition-all ${
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
            className={`py-1 rounded font-semibold transition-all ${
              codeTypes === 'barcode'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-fg-subtle hover:text-fg'
            }`}
          >
            1D Only
          </button>
        </div>
      </div>

      {/* Frame Rate (Continuous Mode) */}
      {scanMode === 'continuous' && (
        <div className="flex flex-col gap-1.5 p-3 bg-canvas/40 rounded-lg border border-line/60">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-fg-secondary">Scan Frame Rate</span>
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
          <div className="flex justify-between text-[10px] text-fg-subtle font-mono">
            <span>1 FPS (Low CPU)</span>
            <span>5 FPS (Recommended)</span>
            <span>15 FPS</span>
          </div>
        </div>
      )}

      {/* ROI Area */}
      <div className="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-line/60">
        <div className="flex items-center gap-2">
          <Crosshair size={16} className={isRoiActive ? 'text-amber-400' : 'text-fg-subtle'} />
          <div>
            <div className="text-xs font-semibold text-fg-secondary">Scan Zone (ROI)</div>
            <div className="text-[10px] text-fg-subtle">
              {isRoiActive ? 'Restricted scan region active' : 'Scanning full camera frame'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowRoiModal(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            isRoiActive
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-surface text-fg-subtle hover:text-fg border-line'
          }`}
        >
          {isRoiActive ? 'Edit Zone' : 'Select Zone'}
        </button>
      </div>

      {/* Advanced Accordion */}
      <div className="border border-line rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-3 bg-surface-2 text-xs font-semibold text-fg-secondary hover:bg-surface-3 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sliders size={14} className="text-cyan-400" />
            <span>Sanitization & Filters</span>
          </span>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvanced && (
          <div className="p-3 bg-canvas/30 flex flex-col gap-3 border-t border-line">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-fg-secondary">Debounce Interval</div>
                <div className="text-[10px] text-fg-subtle">Ignore duplicate scans within interval</div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  value={debounceMs}
                  onChange={(e) => updateField('debounceMs', Number(e.target.value))}
                  className="w-20 bg-surface-2 border border-line rounded-md px-2 py-1 text-right font-mono text-xs text-fg"
                />
                <span className="text-[10px] text-fg-subtle font-mono">ms</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-line/40">
              <div>
                <div className="text-xs font-medium text-fg-secondary">Only Emit on Change</div>
                <div className="text-[10px] text-fg-subtle">Do not re-trigger for the same barcode</div>
              </div>
              <input
                type="checkbox"
                checked={onlyOnChange}
                onChange={(e) => updateField('onlyOnChange', e.target.checked)}
                className="w-4 h-4 rounded border-line accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-line/40">
              <div>
                <div className="text-xs font-medium text-fg-secondary">Replace Trigger Payload</div>
                <div className="text-[10px] text-fg-subtle">Set payload directly to decoded code</div>
              </div>
              <input
                type="checkbox"
                checked={replacePayload}
                onChange={(e) => updateField('replacePayload', e.target.checked)}
                className="w-4 h-4 rounded border-line accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-line/40">
              <label className="text-xs font-medium text-fg-secondary">Strip Prefix / Suffix</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Prefix (e.g. ID:)"
                  value={stripPrefix}
                  onChange={(e) => updateField('stripPrefix', e.target.value)}
                  className="bg-surface-2 border border-line rounded-md px-2 py-1 text-xs font-mono text-fg"
                />
                <input
                  type="text"
                  placeholder="Suffix"
                  value={stripSuffix}
                  onChange={(e) => updateField('stripSuffix', e.target.value)}
                  className="bg-surface-2 border border-line rounded-md px-2 py-1 text-xs font-mono text-fg"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-line/40">
              <label className="text-xs font-medium text-fg-secondary">Regex Filter / Extract Group</label>
              <input
                type="text"
                placeholder="e.g. LOT-(\d+)"
                value={regexFilter}
                onChange={(e) => updateField('regexFilter', e.target.value)}
                className="bg-surface-2 border border-line rounded-md px-2 py-1 text-xs font-mono text-fg"
              />
              <span className="text-[10px] text-fg-subtle">
                If regular expression contains a capture group <code>()</code>, that group will be extracted as the payload.
              </span>
            </div>
          </div>
        )}
      </div>

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
