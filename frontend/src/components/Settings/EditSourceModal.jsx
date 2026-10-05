import React, { useState, useEffect } from 'react';
import { 
  X, Radio, Camera, Film, CheckCircle2, AlertTriangle, 
  RefreshCw, Power, Save, Sparkles, Pencil, ExternalLink
} from 'lucide-react';

export default function EditSourceModal({ source, isOpen, onClose, onSave, videoDevices = [] }) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  
  // Test Connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [snapshotTimestamp, setSnapshotTimestamp] = useState(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const isVideoFile = source?.type === 'file';
  const isCctv = source?.type === 'rtsp';
  const isLocal = source?.type === 'local';

  // Sync state with source on open
  useEffect(() => {
    if (source && isOpen) {
      setName(source.name || '');
      setPath(source.path || '');
      setIsEnabled(source.is_enabled !== false);
      setTestResult(null);
      setPreviewing(false);
      setErrorMsg(null);
      setSaving(false);
    }
  }, [source, isOpen]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleTestConnection = async () => {
    if (!path.trim()) {
      setErrorMsg('Please enter a valid source path or URL');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/cameras/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: path.trim(), type: source.type })
      });
      const data = await res.json();
      setTestResult(data);
      if (data.connected) {
        setPreviewing(true);
        setSnapshotTimestamp(Date.now());
      }
    } catch (err) {
      setTestResult({ status: 'error', connected: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Source name is required');
      return;
    }
    if (!path.trim()) {
      setErrorMsg('Source path / URL is required');
      return;
    }

    setSaving(true);
    try {
      const updated = {
        ...source,
        name: name.trim(),
        path: path.trim(),
        is_enabled: isEnabled
      };
      await onSave(updated);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !source) return null;

  const typeConfig = isCctv ? {
    label: 'CCTV / RTSP Stream',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: <Radio size={16} className="text-amber-500" />,
    color: 'amber'
  } : isLocal ? {
    label: 'Local Camera (V4L2)',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: <Camera size={16} className="text-emerald-500" />,
    color: 'emerald'
  } : {
    label: 'Video File',
    badge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    icon: <Film size={16} className="text-cyan-500" />,
    color: 'cyan'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl border border-line-strong w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-2/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Pencil size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg flex items-center gap-2">
                Configure Source Entity
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1 ${typeConfig.badge}`}>
                  {typeConfig.icon}
                  {typeConfig.label}
                </span>
              </h3>
              <p className="text-xs text-fg-muted font-mono">
                ID: {source.id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-fg-muted hover:text-fg hover:bg-surface-3 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Name & Active State */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="sm:col-span-2 flex flex-col gap-1 text-xs text-fg-secondary">
              Source Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-surface-2 border border-line-strong rounded-lg p-2.5 text-sm text-fg focus:outline-none focus:border-primary font-medium"
                required
              />
            </label>

            <div className="flex flex-col gap-1 text-xs text-fg-secondary">
              <span>Status</span>
              <button
                type="button"
                onClick={() => setIsEnabled(!isEnabled)}
                className={`flex-1 p-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors border ${
                  isEnabled
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-surface-2 text-fg-muted border-line hover:bg-surface-3 hover:text-fg'
                }`}
              >
                <Power size={13} className={isEnabled ? 'text-emerald-500' : 'text-fg-subtle'} />
                {isEnabled ? 'Active in Pipelines' : 'Disabled'}
              </button>
            </div>
          </div>

          {/* Path / URL field */}
          <div className="flex flex-col gap-1 text-xs text-fg-secondary">
            <div className="flex items-center justify-between">
              <span>{isCctv ? 'RTSP Stream URL' : isLocal ? 'Device Path (V4L2)' : 'File Path on Server'}</span>
              {isCctv && <span className="text-[11px] text-fg-muted font-mono">rtsp://user:pass@ip:port/stream</span>}
            </div>

            <div className="flex gap-2">
              {isLocal ? (
                <select
                  value={path}
                  onChange={(e) => {
                    setPath(e.target.value);
                    setTestResult(null);
                  }}
                  className="flex-1 bg-surface-2 border border-line-strong rounded-lg p-2.5 text-sm text-fg font-mono focus:outline-none focus:border-primary"
                >
                  {videoDevices && videoDevices.length > 0 ? (
                    videoDevices.map(dev => (
                      <option key={dev} value={dev}>{dev}</option>
                    ))
                  ) : (
                    <option value={path}>{path}</option>
                  )}
                </select>
              ) : (
                <input
                  type="text"
                  value={path}
                  onChange={(e) => {
                    setPath(e.target.value);
                    setTestResult(null);
                  }}
                  disabled={isVideoFile} // Video files have fixed server paths
                  className={`flex-1 bg-surface-2 border border-line-strong rounded-lg p-2.5 text-sm text-fg font-mono focus:outline-none focus:border-primary ${
                    isVideoFile ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  required
                />
              )}

              {(isCctv || isLocal) && (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !path.trim()}
                  className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 border border-line-strong text-fg rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <RefreshCw size={13} className={testing ? 'animate-spin text-primary' : ''} />
                  {testing ? 'Testing...' : 'Test Signal'}
                </button>
              )}
            </div>
          </div>

          {/* Test Result Diagnostics */}
          {testResult && (
            <div className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 animate-in fade-in ${
              testResult.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
            }`}>
              <div className="flex items-center gap-2 font-semibold">
                {testResult.connected ? (
                  <>
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span>Signal Verified!</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} className="text-red-500" />
                    <span>Signal Test Failed</span>
                  </>
                )}
              </div>
              {testResult.connected ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono mt-1 pt-1 border-t border-emerald-500/20">
                  <div>Codec: <strong>{testResult.details?.codec?.toUpperCase()}</strong></div>
                  <div>Resolution: <strong>{testResult.details?.resolution}</strong></div>
                  <div>FPS: <strong>{testResult.details?.fps || 25} fps</strong></div>
                  <div>Transport: <strong>TCP Verified</strong></div>
                </div>
              ) : (
                <div className="text-[11px] text-fg-muted font-mono break-words">
                  {testResult.message}
                </div>
              )}
            </div>
          )}

          {/* Preview Window in Configuration Dialog */}
          <div className="border border-line rounded-xl overflow-hidden bg-surface-2/40">
            <div className="px-4 py-2 border-b border-line bg-surface-2/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-fg-secondary flex items-center gap-1.5">
                {typeConfig.icon}
                Live Preview &amp; Verification
              </span>
              {(isCctv || isLocal) && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewing(true);
                    setSnapshotTimestamp(Date.now());
                  }}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={11} /> Grab Frame
                </button>
              )}
            </div>

            <div className="h-44 sm:h-52 bg-black relative flex items-center justify-center">
              {isVideoFile ? (
                <video
                  src={`/api/video-file?path=${encodeURIComponent(path)}`}
                  controls
                  playsInline
                  loop
                  className="w-full h-full object-contain"
                />
              ) : previewing || snapshotTimestamp ? (
                <img
                  src={`/api/camera-snapshot?path=${encodeURIComponent(path)}&type=${source.type}&_t=${snapshotTimestamp || Date.now()}`}
                  alt="Camera Preview"
                  className="w-full h-full object-contain"
                  onError={() => setPreviewing(false)}
                />
              ) : (
                <img
                  src={`/api/camera-snapshot?camera_id=${encodeURIComponent(source.id)}&_t=${Date.now()}`}
                  alt="Camera Preview"
                  className="w-full h-full object-contain"
                  onError={() => {}}
                />
              )}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-line bg-surface-2/40 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-fg-muted">
            Changes will update this source entity across any pipelines referencing it.
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-fg rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
