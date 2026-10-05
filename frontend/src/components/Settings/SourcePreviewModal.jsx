import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Maximize2, Minimize2, Play, Pause, Volume2, VolumeX, 
  RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Film, 
  Camera, Radio, Cpu, Sparkles, ExternalLink
} from 'lucide-react';

/**
 * Fullscreen / Pop-up Preview Modal for both Video files and Live Camera Streams (RTSP / Local).
 */
export default function SourcePreviewModal({ source, isOpen, onClose, onTestConnection }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [whepStatus, setWhepStatus] = useState('connecting'); // connecting, connected, error
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const containerRef = useRef(null);

  const isVideoFile = source?.type === 'file';
  const isCctv = source?.type === 'rtsp';
  const isLocal = source?.type === 'local';

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Connect WHEP for cameras or setup video file
  useEffect(() => {
    if (!isOpen || !source) return;

    let active = true;

    if (isVideoFile) {
      setWhepStatus('connected');
      return;
    }

    // Camera Live Stream via WHEP
    const startCameraStream = async () => {
      setWhepStatus('connecting');
      try {
        // 1. Acquire preview stream from backend
        const acquireRes = await fetch(`/api/cameras/${encodeURIComponent(source.id)}/preview/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: source.path, type: source.type })
        });
        const acquireData = await acquireRes.json();

        if (!active) return;

        if (acquireData.status !== 'success') {
          throw new Error(acquireData.message || 'Failed to acquire stream');
        }

        const whepUrl = `http://${window.location.hostname}:8889/shared_${source.id}/whep`;

        // 2. Setup WebRTC PeerConnection
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.ontrack = (event) => {
          if (event.streams[0] && videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
            videoRef.current.play().catch(() => {});
            if (active) setWhepStatus('connected');
          }
        };

        pc.onconnectionstatechange = () => {
          if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
            if (active) setWhepStatus('error');
          }
        };

        pc.addTransceiver('video', { direction: 'recvonly' });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering or 2s timeout
        await new Promise((resolve) => {
          if (pc.iceGatheringState === 'complete') return resolve();
          const checkIce = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkIce);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkIce);
          setTimeout(resolve, 2000);
        });

        if (!active) return;

        // Send WHEP offer to MediaMTX
        const sdpRes = await fetch(whepUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription.sdp,
        });

        if (!sdpRes.ok) throw new Error(`MediaMTX WHEP HTTP ${sdpRes.status}`);
        const answerSdp = await sdpRes.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      } catch (err) {
        console.warn('WHEP preview error:', err);
        if (active) setWhepStatus('error');
      }
    };

    startCameraStream();

    return () => {
      active = false;
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      // Release camera preview stream
      fetch(`/api/cameras/${encodeURIComponent(source.id)}/preview/stop`, {
        method: 'POST'
      }).catch(() => {});
    };
  }, [isOpen, source, isVideoFile]);

  // Handle Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleTestConnection = async () => {
    if (!source) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/cameras/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: source.path, type: source.type })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ status: 'error', connected: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen || !source) return null;

  const typeConfig = isCctv ? {
    label: 'CCTV / RTSP Stream',
    color: 'amber',
    bgBadge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: <Radio size={16} className="text-amber-500" />
  } : isLocal ? {
    label: 'Local Camera (V4L2)',
    color: 'emerald',
    bgBadge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: <Camera size={16} className="text-emerald-500" />
  } : {
    label: 'Video File',
    color: 'cyan',
    bgBadge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    icon: <Film size={16} className="text-cyan-500" />
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        ref={containerRef}
        className="bg-surface rounded-2xl border border-line-strong w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col shadow-2xl overflow-hidden relative"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-surface-2/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 shrink-0 ${typeConfig.bgBadge}`}>
              {typeConfig.icon}
              {typeConfig.label}
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-fg truncate flex items-center gap-2">
                {source.name}
                {source.is_enabled === false && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-surface-3 text-fg-muted font-normal">
                    Disabled
                  </span>
                )}
              </h3>
              <p className="text-xs text-fg-muted font-mono truncate max-w-md">
                {source.path}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isCctv && (
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Test RTSP connection"
              >
                <RefreshCw size={13} className={testing ? 'animate-spin' : ''} />
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 text-fg-muted hover:text-fg hover:bg-surface-3 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-fg-muted hover:text-fg hover:bg-red-500/15 hover:text-red-500 rounded-lg transition-colors"
              title="Close Preview (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Video Player Display Area */}
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden min-h-0">
          {isVideoFile ? (
            <video
              ref={videoRef}
              src={`/api/video-file?path=${encodeURIComponent(source.path)}`}
              autoPlay
              controls
              playsInline
              loop
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full relative flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isMuted}
                className="w-full h-full object-contain"
              />

              {/* Status Overlay */}
              {whepStatus === 'connecting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white gap-3">
                  <div className="w-10 h-10 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                  <div className="text-sm font-medium">Acquiring Realtime Stream (WHEP)...</div>
                  <div className="text-xs text-fg-subtle font-mono">Stream: shared_{source.id}</div>
                </div>
              )}

              {whepStatus === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="text-base font-semibold text-red-300">Live Stream Unavailable</div>
                  <p className="text-xs text-white/70 max-w-md">
                    Could not establish WebRTC stream for this source. Ensure the camera is powered on and reachable on the network.
                  </p>
                  <button
                    onClick={() => {
                      setWhepStatus('connecting');
                      setTimeout(() => {
                        window.location.reload();
                      }, 500);
                    }}
                    className="mt-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 text-white border border-line-strong rounded-lg text-xs font-medium flex items-center gap-2"
                  >
                    <RefreshCw size={14} /> Retry Stream Connection
                  </button>
                </div>
              )}

              {/* Live Badge */}
              {whepStatus === 'connected' && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-xs font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>LIVE WHEP</span>
                  <span className="text-white/50 text-[10px]">30 FPS</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer / Diagnostics */}
        <div className="p-4 border-t border-line bg-surface flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 flex-wrap text-fg-muted">
            <span className="flex items-center gap-1.5">
              <Cpu size={14} className="text-primary" />
              <span>Source ID:</span>
              <strong className="text-fg font-mono">{source.id}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span>Status:</span>
              <strong className={source.is_enabled !== false ? 'text-emerald-500' : 'text-fg-muted'}>
                {source.is_enabled !== false ? 'Active & Ready' : 'Disabled'}
              </strong>
            </span>
            {testResult && testResult.status === 'success' && (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono">
                <CheckCircle2 size={14} />
                {testResult.details?.resolution} ({testResult.details?.codec?.toUpperCase()} @ {testResult.details?.fps || 25}fps)
              </span>
            )}
            {testResult && testResult.status === 'error' && (
              <span className="flex items-center gap-1.5 text-red-500 truncate max-w-sm" title={testResult.message}>
                <AlertTriangle size={14} />
                {testResult.message}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-fg rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
