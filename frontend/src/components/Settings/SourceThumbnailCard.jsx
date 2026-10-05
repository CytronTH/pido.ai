import React, { useState, useRef, useEffect } from 'react';
import { 
  Radio, Camera, Film, Maximize2, Trash2, CheckCircle2, 
  AlertTriangle, RefreshCw, Power, ExternalLink, Play, Pencil
} from 'lucide-react';

export default function SourceThumbnailCard({ 
  source, 
  snapshotTick, 
  onPreview, 
  onEdit,
  onToggleStatus, 
  onDelete, 
  onUpdate 
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [snapshotError, setSnapshotError] = useState(false);
  const [whepConnecting, setWhepConnecting] = useState(false);
  const [whepError, setWhepError] = useState(false);
  const [whepConnected, setWhepConnected] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(source.name);

  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const hoverTimerRef = useRef(null);

  const isVideoFile = source.type === 'file';
  const isCctv = source.type === 'rtsp';
  const isLocal = source.type === 'local';
  const isEnabled = source.is_enabled !== false;

  // ── Color and Badge Styling by Source Type (Req 1.1) ───────────────────────
  const theme = isCctv ? {
    borderHover: 'hover:border-amber-500/60',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: <Radio size={14} className="text-amber-500" />,
    label: 'CCTV Stream',
    dotColor: 'bg-amber-400'
  } : isLocal ? {
    borderHover: 'hover:border-emerald-500/60',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: <Camera size={14} className="text-emerald-500" />,
    label: 'Local V4L2',
    dotColor: 'bg-emerald-400'
  } : {
    borderHover: 'hover:border-cyan-500/60',
    badge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    icon: <Film size={14} className="text-cyan-500" />,
    label: 'Video File',
    dotColor: 'bg-cyan-400'
  };

  // ── Hover-to-Play Realtime Stream Handling (Req 1.3.1) ──────────────────────
  const handleMouseEnter = () => {
    setIsHovered(true);

    if (isVideoFile) {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
      return;
    }

    // For Camera: Start WHEP stream after a brief 150ms debounce
    hoverTimerRef.current = setTimeout(async () => {
      setWhepConnecting(true);
      setWhepError(false);
      try {
        const acquireRes = await fetch(`/api/cameras/${encodeURIComponent(source.id)}/preview/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: source.path, type: source.type })
        });
        const acquireData = await acquireRes.json();
        if (acquireData.status !== 'success') throw new Error(acquireData.message);

        const whepUrl = `http://${window.location.hostname}:8889/shared_${source.id}/whep`;

        if (pcRef.current) {
          pcRef.current.close();
        }
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.ontrack = (event) => {
          if (event.streams[0] && videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
            videoRef.current.play().catch(() => {});
            setWhepConnecting(false);
            setWhepConnected(true);
          }
        };

        pc.addTransceiver('video', { direction: 'recvonly' });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await new Promise((resolve) => {
          if (pc.iceGatheringState === 'complete') return resolve();
          const checkIce = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkIce);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkIce);
          setTimeout(resolve, 1500);
        });

        const sdpRes = await fetch(whepUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription.sdp,
        });

        if (!sdpRes.ok) throw new Error('WHEP negotiation failed');
        const answerSdp = await sdpRes.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      } catch (err) {
        console.warn('Hover stream error:', err);
        setWhepError(true);
        setWhepConnecting(false);
      }
    }, 150);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    if (isVideoFile) {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    } else {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      setWhepConnecting(false);
      setWhepConnected(false);
      fetch(`/api/cameras/${encodeURIComponent(source.id)}/preview/stop`, {
        method: 'POST'
      }).catch(() => {});
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, []);

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (editedName.trim() && editedName !== source.name) {
      onUpdate(source.id, 'name', editedName.trim());
    } else {
      setEditedName(source.name);
    }
  };

  return (
    <div 
      className={`group bg-surface rounded-xl border transition-all duration-200 flex flex-col overflow-hidden shadow-sm hover:shadow-md relative ${
        isEnabled 
          ? `border-line-strong ${theme.borderHover}` 
          : 'border-line opacity-65 bg-surface/50'
      }`}
    >
      {/* ── Pencil Modify Button on Edge (Corner floating action) ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(source);
        }}
        className="absolute top-2 right-2 z-20 w-7 h-7 rounded-lg bg-black/60 hover:bg-primary text-white/90 hover:text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all shadow-md active:scale-90"
        title="Configure / Edit Source"
      >
        <Pencil size={13} />
      </button>

      {/* ── Realtime Preview Thumbnail with Hover-to-Play (Req 1.3) ── */}
      <div 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="w-full aspect-video bg-black/90 relative overflow-hidden cursor-pointer select-none"
      >
        {/* Realtime Video Stream on Hover (Req 1.3.1) */}
        {isVideoFile ? (
          <video
            ref={videoRef}
            src={`/api/video-file?path=${encodeURIComponent(source.path)}`}
            muted
            loop
            playsInline
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isHovered ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
            }`}
          />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isHovered && whepConnected ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
            }`}
          />
        )}

        {/* 10-Second Auto-refreshing Snapshot when Idle (Req 1.3.2) */}
        {(!isHovered || (!isVideoFile && !whepConnected)) && (
          <>
            {snapshotError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-fg-subtle p-4 text-center gap-1.5 bg-surface-2/40">
                <AlertTriangle size={22} className="opacity-50 text-amber-500" />
                <span className="text-[11px] font-medium text-fg-muted">Source Standby / Offline</span>
                <span className="text-[10px] text-fg-subtle">Retrying snapshot...</span>
              </div>
            ) : (
              <img
                src={`/api/camera-snapshot?camera_id=${encodeURIComponent(source.id)}&_t=${snapshotTick}`}
                alt={source.name}
                onError={() => setSnapshotError(true)}
                onLoad={() => setSnapshotError(false)}
                className="w-full h-full object-cover"
              />
            )}
          </>
        )}

        {/* WHEP Connecting Indicator on Hover */}
        {isHovered && !isVideoFile && whepConnecting && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center text-white text-xs gap-2">
            <RefreshCw size={14} className="animate-spin text-amber-400" />
            <span>Connecting stream...</span>
          </div>
        )}

        {/* Top Badges Overlay (positioned next to edge edit button) */}
        <div className="absolute top-2.5 left-2.5 right-11 flex items-center justify-between pointer-events-none">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md flex items-center gap-1.5 shadow-sm ${theme.badge}`}>
            {theme.icon}
            {theme.label}
          </span>

          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 backdrop-blur-md ${
            isHovered && (isVideoFile || whepConnected)
              ? 'bg-red-500/80 text-white animate-pulse'
              : 'bg-black/60 text-white/80'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isHovered ? 'bg-white' : 'bg-emerald-400'}`} />
            {isHovered && (isVideoFile || whepConnected) ? 'REALTIME' : '10s'}
          </span>
        </div>

        {/* 1.3.3 Fullscreen Preview Button Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(source);
            }}
            className="pointer-events-auto px-3.5 py-1.5 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-semibold backdrop-blur-md border border-white/20 flex items-center gap-2 shadow-lg transform transition-transform hover:scale-105 active:scale-95"
            title="Open Fullscreen Preview (Req 1.3.3)"
          >
            <Maximize2 size={13} />
            Preview Window
          </button>
        </div>
      </div>

      {/* ── Card Body & Details ── */}
      <div className="p-3.5 flex flex-col gap-2.5 flex-1 justify-between">
        <div>
          {/* Editable Name */}
          <div className="flex items-center justify-between gap-2">
            {isEditingName ? (
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameBlur(); }}
                autoFocus
                className="bg-surface-2 border border-line-strong rounded px-1.5 py-0.5 text-sm font-bold text-fg w-full focus:outline-none focus:border-primary"
              />
            ) : (
              <h4 
                onClick={() => setIsEditingName(true)}
                className="font-bold text-sm text-fg truncate cursor-pointer hover:text-primary transition-colors flex-1"
                title="Click to rename inline"
              >
                {source.name}
              </h4>
            )}
          </div>

          {/* Path / URL */}
          <p className="text-[11px] text-fg-muted font-mono truncate mt-0.5" title={source.path}>
            {source.path}
          </p>
        </div>

        {/* Card Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-line/60 gap-2">
          {/* Active / Disabled Status Toggle */}
          <button
            type="button"
            onClick={() => onToggleStatus(source.id, isEnabled)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors border ${
              isEnabled 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-surface-2 text-fg-muted border-line hover:text-fg hover:bg-surface-3'
            }`}
            title={isEnabled ? 'Active in pipelines (Click to Disable)' : 'Disabled (Click to Enable)'}
          >
            <Power size={11} className={isEnabled ? 'text-emerald-500' : 'text-fg-subtle'} />
            {isEnabled ? 'Active' : 'Disabled'}
          </button>

          <div className="flex items-center gap-1">
            {/* Pencil Modify Button */}
            <button
              type="button"
              onClick={() => onEdit(source)}
              className="p-1.5 text-fg-muted hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
              title="Configure Source Settings"
            >
              <Pencil size={14} />
            </button>

            {/* Pop-up Preview Button */}
            <button
              type="button"
              onClick={() => onPreview(source)}
              className="p-1.5 text-fg-muted hover:text-fg hover:bg-surface-2 rounded-md transition-colors"
              title="Pop-up Preview"
            >
              <Maximize2 size={15} />
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => onDelete(source.id, source.name, isVideoFile ? source.path : null)}
              className="p-1.5 text-fg-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
              title="Delete Source"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
