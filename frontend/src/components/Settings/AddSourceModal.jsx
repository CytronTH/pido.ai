import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Radio, Camera, Film, Upload, CheckCircle2, AlertTriangle, 
  RefreshCw, Play, Pause, HardDrive, ShieldCheck, Sparkles, Check, Info
} from 'lucide-react';

export default function AddSourceModal({ isOpen, onClose, onSourceAdded, videoDevices = [] }) {
  const [sourceType, setSourceType] = useState('rtsp'); // 'rtsp', 'local', 'file'
  
  // CCTV State
  const [cctvName, setCctvName] = useState('Front Gate CCTV');
  const [cctvUrl, setCctvUrl] = useState('');
  const [cctvTesting, setCctvTesting] = useState(false);
  const [cctvTestResult, setCctvTestResult] = useState(null);
  const [cctvPreviewing, setCctvPreviewing] = useState(false);
  const [cctvSnapshotTimestamp, setCctvSnapshotTimestamp] = useState(null);

  // Local Camera State
  const [localName, setLocalName] = useState('USB Camera');
  const [localPath, setLocalPath] = useState(videoDevices[0] || '/dev/video0');
  const [localTesting, setLocalTesting] = useState(false);
  const [localTestResult, setLocalTestResult] = useState(null);
  const [localPreviewing, setLocalPreviewing] = useState(false);

  // Video File State
  const [videoFile, setVideoFile] = useState(null);
  const [videoFilePreviewUrl, setVideoFilePreviewUrl] = useState(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // General State
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCctvTestResult(null);
      setCctvPreviewing(false);
      setLocalTestResult(null);
      setLocalPreviewing(false);
      setVideoFile(null);
      if (videoFilePreviewUrl) {
        URL.revokeObjectURL(videoFilePreviewUrl);
        setVideoFilePreviewUrl(null);
      }
      setErrorMsg(null);
      setSaving(false);
    }
  }, [isOpen]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (videoFilePreviewUrl) {
        URL.revokeObjectURL(videoFilePreviewUrl);
      }
    };
  }, [videoFilePreviewUrl]);

  // Set default local device if available
  useEffect(() => {
    if (videoDevices && videoDevices.length > 0 && !localPath) {
      setLocalPath(videoDevices[0]);
    }
  }, [videoDevices, localPath]);

  // ── CCTV Handlers ──────────────────────────────────────────────────────────
  const handleTestCctv = async () => {
    if (!cctvUrl.trim()) {
      setErrorMsg('Please enter an RTSP stream URL');
      return;
    }
    setCctvTesting(true);
    setCctvTestResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/cameras/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cctvUrl.trim(), type: 'rtsp' })
      });
      const data = await res.json();
      setCctvTestResult(data);
      if (data.connected) {
        // Auto trigger preview snapshot
        setCctvPreviewing(true);
        setCctvSnapshotTimestamp(Date.now());
      }
    } catch (err) {
      setCctvTestResult({ status: 'error', connected: false, message: err.message });
    } finally {
      setCctvTesting(false);
    }
  };

  // ── Local Camera Handlers ──────────────────────────────────────────────────
  const handleTestLocal = async () => {
    if (!localPath.trim()) {
      setErrorMsg('Please select a local device path');
      return;
    }
    setLocalTesting(true);
    setLocalTestResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/cameras/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: localPath.trim(), type: 'local' })
      });
      const data = await res.json();
      setLocalTestResult(data);
      if (data.connected) {
        setLocalPreviewing(true);
      }
    } catch (err) {
      setLocalTestResult({ status: 'error', connected: false, message: err.message });
    } finally {
      setLocalTesting(false);
    }
  };

  // ── Video File Handlers ────────────────────────────────────────────────────
  const handleFileSelect = (file) => {
    if (!file) return;
    if (file.size > 1024 * 1024 * 1024) {
      setErrorMsg('Video file exceeds 1GB limit!');
      return;
    }
    setErrorMsg(null);
    setVideoFile(file);

    // Create local object URL for instant playback preview
    if (videoFilePreviewUrl) {
      URL.revokeObjectURL(videoFilePreviewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setVideoFilePreviewUrl(previewUrl);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // ── Submit Handlers ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSaving(true);

    try {
      if (sourceType === 'rtsp') {
        if (!cctvName.trim()) throw new Error('Please specify a source name');
        if (!cctvUrl.trim()) throw new Error('Please enter the RTSP URL');

        const newSource = {
          name: cctvName.trim(),
          type: 'rtsp',
          path: cctvUrl.trim(),
          is_enabled: true
        };
        await onSourceAdded(newSource);
        onClose();
      } else if (sourceType === 'local') {
        if (!localName.trim()) throw new Error('Please specify a camera name');
        if (!localPath.trim()) throw new Error('Please specify device path');

        const newSource = {
          name: localName.trim(),
          type: 'local',
          path: localPath.trim(),
          is_enabled: true
        };
        await onSourceAdded(newSource);
        onClose();
      } else if (sourceType === 'file') {
        if (!videoFile) throw new Error('Please select a video file to upload');

        setVideoUploading(true);
        const formData = new FormData();
        formData.append('video_file', videoFile);

        const res = await fetch('/api/videos/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.status !== 'success') {
          throw new Error(data.message || 'Upload failed');
        }

        await onSourceAdded(null); // Triggers full entities reload
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
      setVideoUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl border border-line-strong w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-2/60 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-fg flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              Add New Video Source
            </h2>
            <p className="text-xs text-fg-muted mt-0.5">
              Connect network CCTV cameras, local USB/CSI devices, or upload demo video clips.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-fg-muted hover:text-fg hover:bg-surface-3 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Source Type Selector Tabs */}
        <div className="p-6 pb-2 shrink-0">
          <div className="grid grid-cols-3 gap-3">
            {/* CCTV Tab */}
            <button
              type="button"
              onClick={() => { setSourceType('rtsp'); setErrorMsg(null); }}
              className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                sourceType === 'rtsp'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20'
                  : 'bg-surface-2/60 hover:bg-surface-2 border-line text-fg-muted hover:text-fg'
              }`}
            >
              <Radio size={22} className={sourceType === 'rtsp' ? 'text-amber-500' : ''} />
              <div className="text-center">
                <div className="text-xs font-bold">CCTV / RTSP Stream</div>
                <div className="text-[10px] opacity-70">IP Camera & NVRs</div>
              </div>
            </button>

            {/* Local Camera Tab */}
            <button
              type="button"
              onClick={() => { setSourceType('local'); setErrorMsg(null); }}
              className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                sourceType === 'local'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                  : 'bg-surface-2/60 hover:bg-surface-2 border-line text-fg-muted hover:text-fg'
              }`}
            >
              <Camera size={22} className={sourceType === 'local' ? 'text-emerald-500' : ''} />
              <div className="text-center">
                <div className="text-xs font-bold">Local Camera</div>
                <div className="text-[10px] opacity-70">USB / V4L2 / CSI</div>
              </div>
            </button>

            {/* Video File Tab */}
            <button
              type="button"
              onClick={() => { setSourceType('file'); setErrorMsg(null); }}
              className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                sourceType === 'file'
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 ring-2 ring-cyan-500/20'
                  : 'bg-surface-2/60 hover:bg-surface-2 border-line text-fg-muted hover:text-fg'
              }`}
            >
              <Film size={22} className={sourceType === 'file' ? 'text-cyan-500' : ''} />
              <div className="text-center">
                <div className="text-xs font-bold">Video File</div>
                <div className="text-[10px] opacity-70">Upload MP4 / MKV</div>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── 1.4.1 CCTV / RTSP FORM ── */}
          {sourceType === 'rtsp' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs text-fg-secondary">
                  Source Name
                  <input
                    type="text"
                    value={cctvName}
                    onChange={(e) => setCctvName(e.target.value)}
                    placeholder="e.g. Warehouse CCTV Gate 1"
                    className="bg-surface-2 border border-line-strong rounded-lg p-2.5 text-sm text-fg focus:outline-none focus:border-amber-500"
                    required
                  />
                </label>

                <div className="flex flex-col gap-1 text-xs text-fg-secondary">
                  <span>Stream Protocol</span>
                  <div className="flex items-center gap-2 p-2 bg-surface-2 border border-line-strong rounded-lg text-xs text-fg">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>RTSP over TCP (Low latency & Zero-packet loss)</span>
                  </div>
                </div>
              </div>

              {/* RTSP URL with Test button */}
              <div className="flex flex-col gap-1 text-xs text-fg-secondary">
                <div className="flex items-center justify-between">
                  <span>RTSP Stream URL</span>
                  <span className="text-[11px] text-fg-muted font-mono">rtsp://user:pass@ip:port/stream</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cctvUrl}
                    onChange={(e) => {
                      setCctvUrl(e.target.value);
                      setCctvTestResult(null);
                    }}
                    placeholder="rtsp://admin:password@192.168.1.100:554/stream1"
                    className="flex-1 bg-surface-2 border border-line-strong rounded-lg p-2.5 text-sm text-fg font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleTestCctv}
                    disabled={cctvTesting || !cctvUrl.trim()}
                    className="px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw size={14} className={cctvTesting ? 'animate-spin' : ''} />
                    {cctvTesting ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </div>

              {/* Connection Diagnostics Banner */}
              {cctvTestResult && (
                <div className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 animate-in fade-in ${
                  cctvTestResult.connected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                }`}>
                  <div className="flex items-center gap-2 font-semibold">
                    {cctvTestResult.connected ? (
                      <>
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        <span>Connection Successful!</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} className="text-red-500" />
                        <span>Connection Failed</span>
                      </>
                    )}
                  </div>
                  {cctvTestResult.connected ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono mt-1 pt-1 border-t border-emerald-500/20">
                      <div>Codec: <strong>{cctvTestResult.details?.codec?.toUpperCase()}</strong></div>
                      <div>Resolution: <strong>{cctvTestResult.details?.resolution}</strong></div>
                      <div>FPS: <strong>{cctvTestResult.details?.fps || 25} fps</strong></div>
                      <div>Transport: <strong>TCP Verified</strong></div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-fg-muted font-mono break-words">
                      {cctvTestResult.message}
                    </div>
                  )}
                </div>
              )}

              {/* 1.4.1 CCTV Preview Window */}
              <div className="border border-line rounded-xl overflow-hidden bg-surface-2/40">
                <div className="px-4 py-2 border-b border-line bg-surface-2/60 flex items-center justify-between">
                  <span className="text-xs font-semibold text-fg-secondary flex items-center gap-1.5">
                    <Radio size={14} className="text-amber-500" />
                    Stream Preview Window
                  </span>
                  {cctvPreviewing && (
                    <button
                      type="button"
                      onClick={() => setCctvSnapshotTimestamp(Date.now())}
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw size={11} /> Refresh Frame
                    </button>
                  )}
                </div>

                <div className="h-48 sm:h-56 bg-black relative flex items-center justify-center">
                  {cctvPreviewing && cctvUrl ? (
                    <img
                      src={`/api/camera-snapshot?path=${encodeURIComponent(cctvUrl)}&type=rtsp&_t=${cctvSnapshotTimestamp}`}
                      alt="CCTV Preview"
                      className="w-full h-full object-contain"
                      onError={() => setCctvPreviewing(false)}
                    />
                  ) : (
                    <div className="text-center text-fg-subtle p-6 flex flex-col items-center gap-2">
                      <Radio size={32} className="opacity-40 text-amber-500" />
                      <p className="text-xs">
                        Click &quot;Test Connection&quot; above to verify stream and render live snapshot.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── LOCAL CAMERA FORM ── */}
          {sourceType === 'local' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs text-fg-secondary">
                  Camera Name
                  <input
                    type="text"
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    placeholder="e.g. Raspberry Pi Camera / USB Cam"
                    className="bg-surface-2 border border-line-strong rounded-lg p-2.5 text-sm text-fg focus:outline-none focus:border-emerald-500"
                    required
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-fg-secondary">
                  Device Node (V4L2)
                  <div className="flex gap-2">
                    <select
                      value={localPath}
                      onChange={(e) => {
                        setLocalPath(e.target.value);
                        setLocalTestResult(null);
                      }}
                      className="flex-1 bg-surface-2 border border-line-strong rounded-lg p-2.5 text-sm text-fg font-mono focus:outline-none focus:border-emerald-500"
                    >
                      {videoDevices && videoDevices.length > 0 ? (
                        videoDevices.map(dev => (
                          <option key={dev} value={dev}>{dev}</option>
                        ))
                      ) : (
                        <>
                          <option value="/dev/video0">/dev/video0</option>
                          <option value="/dev/video1">/dev/video1</option>
                        </>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={handleTestLocal}
                      disabled={localTesting}
                      className="px-3.5 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <RefreshCw size={13} className={localTesting ? 'animate-spin' : ''} />
                      Test
                    </button>
                  </div>
                </label>
              </div>

              {localTestResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  localTestResult.connected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                }`}>
                  {localTestResult.connected ? (
                    <>
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <span>Device verified: {localTestResult.details?.resolution} ({localTestResult.details?.codec?.toUpperCase()})</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} className="text-red-500" />
                      <span>{localTestResult.message}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 1.4.2 VIDEO FILE UPLOAD & PLAYBACK PREVIEW ── */}
          {sourceType === 'file' && (
            <div className="space-y-4">
              {/* Drag & Drop Upload Box */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-cyan-500 bg-cyan-500/15 scale-[1.01]'
                    : videoFile
                    ? 'border-cyan-500/40 bg-surface-2'
                    : 'border-line-strong hover:border-cyan-500/40 bg-surface-2/40 hover:bg-surface-2'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.avi,.mkv,.mov,.webm"
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-500 flex items-center justify-center">
                  <Upload size={24} />
                </div>

                <div className="text-center">
                  {videoFile ? (
                    <>
                      <div className="text-sm font-bold text-fg flex items-center gap-2 justify-center">
                        <Check size={16} className="text-cyan-500" />
                        {videoFile.name}
                      </div>
                      <div className="text-xs text-fg-muted font-mono mt-0.5">
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB • Click or drag to replace
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-fg">
                        Click to select or drag & drop video file
                      </div>
                      <div className="text-xs text-fg-muted mt-1">
                        Supported: .mp4, .avi, .mkv, .mov, .webm (Max 1GB)
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 1.4.2 Playback Preview Window */}
              {videoFilePreviewUrl && (
                <div className="border border-line rounded-xl overflow-hidden bg-surface-2/40 animate-in fade-in">
                  <div className="px-4 py-2 border-b border-line bg-surface-2/60 flex items-center justify-between">
                    <span className="text-xs font-semibold text-fg-secondary flex items-center gap-1.5">
                      <Film size={14} className="text-cyan-500" />
                      Playback Preview Window
                    </span>
                    <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium">
                      HTML5 Native Player
                    </span>
                  </div>

                  <div className="h-48 sm:h-56 bg-black relative flex items-center justify-center">
                    <video
                      src={videoFilePreviewUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-line bg-surface-2/40 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-fg-muted">
            {sourceType === 'rtsp' && 'Sources are added to system and made available in pipelines.'}
            {sourceType === 'local' && 'V4L2 device will be acquired using low-latency MJPEG/RAW.'}
            {sourceType === 'file' && videoFile && `Ready to upload: ${(videoFile.size / (1024 * 1024)).toFixed(1)} MB`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || videoUploading}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-fg rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || videoUploading || (sourceType === 'file' && !videoFile)}
              className={`px-5 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 ${
                sourceType === 'rtsp'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                  : sourceType === 'local'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30'
              }`}
            >
              {(saving || videoUploading) ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  {videoUploading ? 'Uploading Video...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {sourceType === 'file' ? 'Upload & Register Video' : 'Add Source Entity'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
