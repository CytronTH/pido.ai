import React, { useState, useRef, useEffect } from 'react';
import { 
  Radio, Camera, Film, Maximize2, Trash2, Power, 
  RefreshCw, AlertTriangle, ExternalLink, Play, Pencil
} from 'lucide-react';

export default function SourceListRow({ 
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
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: <Radio size={13} className="text-amber-500" />,
    label: 'CCTV Stream',
  } : isLocal ? {
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: <Camera size={13} className="text-emerald-500" />,
    label: 'Local V4L2',
  } : {
    badge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    icon: <Film size={13} className="text-cyan-500" />,
    label: 'Video File',
  };

  // Hover play logic
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (isVideoFile) {
      if (videoRef.current) videoRef.current.play().catch(() => {});
      return;
    }

    hoverTimerRef.current = setTimeout(async () => {
      setWhepConnecting(true);
      try {
        const acquireRes = await fetch(`/api/cameras/${encodeURIComponent(source.id)}/preview/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: source.path, type: source.type })
        });
        const acquireData = await acquireRes.json();
        if (acquireData.status !== 'success') throw new Error(acquireData.message);

        const whepUrl = `http://${window.location.hostname}:8889/shared_${source.id}/whep`;

        if (pcRef.current) pcRef.current.close();
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

        if (!sdpRes.ok) throw new Error('WHEP failed');
        const answerSdp = await sdpRes.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      } catch (err) {
        setWhepConnecting(false);
      }
    }, 150);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
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
      className={`bg-surface rounded-xl border p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 transition-all hover:bg-surface-2/40 ${
        isEnabled ? 'border-line-strong' : 'border-line opacity-65 bg-surface/40'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Compact Thumbnail (Hover realtime & 10s snapshot) */}
        <div 
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={() => onPreview(source)}
          className="w-24 h-16 sm:w-28 sm:h-18 rounded-lg overflow-hidden bg-black shrink-0 relative cursor-pointer border border-line-strong group"
          title="Click to preview fullscreen"
        >
          {isVideoFile ? (
            <video
              ref={videoRef}
              src={`/api/video-file?path=${encodeURIComponent(source.path)}`}
              muted
              loop
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-200 ${
                isHovered ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
              }`}
            />
          ) : (
            <video
              ref={videoRef}
              muted
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-200 ${
                isHovered && whepConnected ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
              }`}
            />
          )}

          {(!isHovered || (!isVideoFile && !whepConnected)) && (
            <>
              {snapshotError ? (
                <div className="w-full h-full flex items-center justify-center bg-surface-2/60 text-fg-subtle">
                  <AlertTriangle size={16} className="text-amber-500/80" />
                </div>
              ) : (
                <img
                  src={`/api/camera-snapshot?camera_id=${encodeURIComponent(source.id)}&_t=${snapshotTick}`}
                  alt={source.name}
                  onError={() => setSnapshotError(true)}
                  className="w-full h-full object-cover"
                />
              )}
            </>
          )}

          {/* Hover overlay hint */}
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
            <Maximize2 size={13} />
          </div>
        </div>

        {/* Source Meta Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isEditingName ? (
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameBlur(); }}
                autoFocus
                className="bg-surface-2 border border-line-strong rounded px-1.5 py-0.5 text-sm font-bold text-fg focus:outline-none focus:border-primary"
              />
            ) : (
              <span 
                onClick={() => setIsEditingName(true)}
                className="font-bold text-sm text-fg truncate cursor-pointer hover:text-primary transition-colors"
                title="Click to rename"
              >
                {source.name}
              </span>
            )}

            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 shrink-0 ${theme.badge}`}>
              {theme.icon}
              {theme.label}
            </span>
          </div>

          <p className="text-xs text-fg-muted font-mono truncate mt-0.5" title={source.path}>
            {source.path}
          </p>
        </div>
      </div>

      {/* Row End Actions */}
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {/* Status Toggle */}
        <button
          type="button"
          onClick={() => onToggleStatus(source.id, isEnabled)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
            isEnabled 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-surface-2 text-fg-muted border-line hover:text-fg hover:bg-surface-3'
          }`}
          title={isEnabled ? 'Active (Click to Disable)' : 'Disabled (Click to Enable)'}
        >
          <Power size={12} className={isEnabled ? 'text-emerald-500' : 'text-fg-subtle'} />
          {isEnabled ? 'Active' : 'Disabled'}
        </button>

        {/* Modify / Edit Button */}
        <button
          type="button"
          onClick={() => onEdit(source)}
          className="p-2 text-fg-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors border border-line"
          title="Configure / Edit Source"
        >
          <Pencil size={14} />
        </button>

        {/* 1.3.3 Preview Button at the end of list row */}
        <button
          type="button"
          onClick={() => onPreview(source)}
          className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-fg rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-line-strong shadow-xs hover:border-primary/50"
          title="Open Fullscreen Pop-up Preview (Req 1.3.3)"
        >
          <Maximize2 size={13} className="text-primary" />
          Preview
        </button>

        {/* Delete Button */}
        <button
          type="button"
          onClick={() => onDelete(source.id, source.name, isVideoFile ? source.path : null)}
          className="p-1.5 text-fg-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Delete Source"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
