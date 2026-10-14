import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, useHandleConnections, useNodesData, useReactFlow } from '@xyflow/react';
import { 
  Bug, Pause, Play, Code, MonitorPlay, ShieldAlert, AlertTriangle, 
  AlertOctagon, RefreshCw, Film, RotateCcw, Maximize2, Minimize2, 
  X, Camera, ExternalLink, Image as ImageIcon 
} from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import { formatDbTimeOnly } from '../../../utils/dbFormat';
import NodeHeader from './NodeHeader';

function useWhepStream(whepUrl, videoRef, { disableAutoReconnect = false } = {}) {
  const pcRef = useRef(null);
  const [status, setStatus] = useState('idle');

  const connect = useCallback(async () => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (!whepUrl || !videoRef.current) {
      setStatus('idle');
      return false;
    }
    setStatus('connecting');

    try {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (e) => {
        if (videoRef.current && e.streams[0]) {
          videoRef.current.srcObject = e.streams[0];
          setStatus('connected');
        }
        if (e.track) {
          e.track.onended = () => {
            setStatus('ended');
          };
        }
      };
      
      pc.onconnectionstatechange = () => {
        const bad = ['failed', 'closed', 'disconnected'];
        if (bad.includes(pc.connectionState)) {
          setStatus('error');
        }
      };

      pc.addTransceiver('video', { direction: 'recvonly' });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        const h = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', h);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', h);
        setTimeout(resolve, 2000);
      });

      const res = await fetch(whepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription.sdp,
      });

      if (!res.ok) throw new Error(`WHEP endpoint returned ${res.status}`);
      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      return true;
    } catch (err) {
      console.error('[WHEP] Connection failed:', err);
      setStatus('error');
      return false;
    }
  }, [whepUrl]);

  useEffect(() => {
    connect();
    return () => { if (pcRef.current) { pcRef.current.close(); pcRef.current = null; } };
  }, [connect]);

  useEffect(() => {
    if (status !== 'error' || disableAutoReconnect) return;
    const t = setTimeout(connect, 2500);
    return () => clearTimeout(t);
  }, [status, connect, disableAutoReconnect]);

  return { status, reconnect: connect };
}

export default memo(({ data, isConnectable, id }) => {
  const nodes = usePipelineStore((state) => state.nodes);
  const edges = usePipelineStore((state) => state.edges);
  const dirtyNodeIds = usePipelineStore((state) => state.dirtyNodeIds || []);
  const projectId = usePipelineStore((state) => state.projectId);
  const isProjectRunning = usePipelineStore((state) => state.isProjectRunning);
  const highlightedNodeIds = usePipelineStore((state) => state.highlightedNodeIds);
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;
  const isWikiMode = data?.isWikiMode;
  const activeProjectId = isWikiMode ? 'wiki_sandbox' : projectId;
  const isStreamActive = Boolean(isWikiMode || isProjectRunning);
  const connections = useHandleConnections({ type: 'target' });
  const incomingEdge = edges.find((e) => e.target === id);
  const sourceNodeId = connections[0]?.source || incomingEdge?.source;
  const hookSourceNode = useNodesData(connections[0]?.source || 'empty-id');
  const sourceNode = (hookSourceNode && hookSourceNode.type) ? hookSourceNode : nodes.find(n => n.id === sourceNodeId);
  const sourceHandle = connections[0]?.sourceHandle || incomingEdge?.sourceHandle;

  // Selective subscription to debugData only for the connected source node to prevent 30fps re-render overhead
  const sourceDebugData = usePipelineStore(
    useCallback((state) => (sourceNodeId ? state.debugData?.[sourceNodeId] : null), [sourceNodeId])
  );

  const isForkliftNode = sourceNode?.type === 'forkliftZoneNode';
  const isForkliftVideoHandle = !sourceHandle || sourceHandle === 'debug' || sourceHandle === 'telemetry';

  const isDefaultVideo = sourceNode?.type === 'inputNode' || 
                         sourceNode?.type === 'aiNode' || 
                         (isForkliftNode && isForkliftVideoHandle);

  const isVideoMode = data?.outputType === 'video' 
    ? true 
    : data?.outputType === 'text' 
    ? false 
    : isDefaultVideo;

  const hasVideoPreview = Boolean(isVideoMode && sourceNode && (sourceNode.type === 'aiNode' || sourceNode.type === 'inputNode' || isForkliftNode));
  const isSnapshotNode = sourceNode?.type === 'snapshotNode';
  const hasImagePreview = Boolean(isSnapshotNode);
  const hasPreview = hasVideoPreview || hasImagePreview;

  // Trace all upstream nodes connected to this node along the pipeline chain
  const upstreamNodeIds = useMemo(() => {
    const upstreamIds = new Set();
    const queue = [id];
    const visited = new Set([id]);

    while (queue.length > 0) {
      const currId = queue.shift();
      const incomingEdges = edges.filter(e => e.target === currId);
      for (const edge of incomingEdges) {
        if (edge.source && !visited.has(edge.source)) {
          visited.add(edge.source);
          upstreamIds.add(edge.source);
          queue.push(edge.source);
        }
      }
    }
    return Array.from(upstreamIds);
  }, [id, edges]);

  // Find the upstream inputNode for this stream
  const inputNode = useMemo(() => {
    if (sourceNode?.type === 'inputNode') return sourceNode;
    return nodes.find(n => upstreamNodeIds.includes(n.id) && n.type === 'inputNode');
  }, [sourceNode, nodes, upstreamNodeIds]);

  const isNonLoop = Boolean(inputNode && inputNode.data?.loop === false);

  // If any upstream node or this node has undeployed changes, show "waiting for deploy"
  const isWaitingForDeploy = useMemo(() => {
    if (!isStreamActive) return false;
    if (isWikiMode) return false;
    if (!hasVideoPreview) return false;
    if (!dirtyNodeIds || dirtyNodeIds.length === 0) return false;

    // Check if the debug node itself is dirty (e.g. freshly connected or edited)
    if (dirtyNodeIds.includes(id)) return true;

    // Check if any upstream node in the pipeline chain has modified settings
    return upstreamNodeIds.some(upstreamId => dirtyNodeIds.includes(upstreamId));
  }, [isStreamActive, isWikiMode, hasVideoPreview, dirtyNodeIds, id, upstreamNodeIds]);

  const isHighlighted = highlightedNodeIds?.includes(id);
  const isPaused = data?.isPaused;
  const togglePause = () => updateNodeData(id, { isPaused: !isPaused });

  let whepUrl = null;
  let currentStreamId = null;
  
  if (sourceNode?.type === 'inputNode') {
    const cameraId = sourceNode.data?.entityId;
    if (isWikiMode) {
      currentStreamId = `cam_${sourceNode.id}`;
      whepUrl = `http://${window.location.hostname}:8889/${activeProjectId}_${currentStreamId}/whep`;
    } else if (cameraId) {
      currentStreamId = cameraId;
      whepUrl = `http://${window.location.hostname}:8889/shared_${cameraId}/whep`;
    } else if (activeProjectId) {
      currentStreamId = `cam_${sourceNode.id}`;
      whepUrl = `http://${window.location.hostname}:8889/${activeProjectId}_${currentStreamId}/whep`;
    }
  } else if (sourceNode?.type === 'aiNode') {
    const aiIncomingEdge = edges.find(e => e.target === sourceNode.id);
    if (aiIncomingEdge && activeProjectId) {
      const srcId = aiIncomingEdge.source;
      
      // Find all AI nodes connected to this input node in the exact order they appear in edges
      const allAiTargets = edges
        .filter(e => e.source === srcId)
        .map(e => e.target)
        .filter(targetId => nodes.find(n => n.id === targetId)?.type === 'aiNode');
        
      let streamSuffix = '';
      if (allAiTargets.length > 1) {
        const aiIdx = allAiTargets.indexOf(sourceNode.id);
        if (aiIdx > -1) {
          streamSuffix = `_${aiIdx}`;
        }
      }
      
      currentStreamId = `cam_${srcId}${streamSuffix}`;
      const drawMode = sourceNode.data?.bboxDrawMode || 'frontend';
      const inputNode = nodes.find(n => n.id === srcId);
      const cameraId = inputNode?.data?.entityId;

      // If frontend draw mode: stream the clean raw input video (which is already in exact sync with WebSocket Bbox metadata!)
      // If backend draw mode: stream the AI output video (which contains burned-in hailooverlay boxes)
      if (drawMode === 'frontend' && cameraId && !isWikiMode) {
        whepUrl = `http://${window.location.hostname}:8889/shared_${cameraId}/whep`;
      } else {
        whepUrl = `http://${window.location.hostname}:8889/${activeProjectId}_${currentStreamId}/whep`;
      }
    }
  } else if (sourceNode?.type === 'forkliftZoneNode') {
    // Trace backwards to find upstream aiNode and inputNode
    const incomingEdge = edges.find(e => e.target === sourceNode.id);
    let targetAiNode = null;
    if (incomingEdge) {
      targetAiNode = nodes.find(n => n.id === incomingEdge.source && n.type === 'aiNode');
    }

    if (targetAiNode && activeProjectId) {
      const aiIncomingEdge = edges.find(e => e.target === targetAiNode.id);
      if (aiIncomingEdge) {
        const srcId = aiIncomingEdge.source;
        const allAiTargets = edges
          .filter(e => e.source === srcId)
          .map(e => e.target)
          .filter(targetId => nodes.find(n => n.id === targetId)?.type === 'aiNode');

        let streamSuffix = '';
        if (allAiTargets.length > 1) {
          const aiIdx = allAiTargets.indexOf(targetAiNode.id);
          if (aiIdx > -1) {
            streamSuffix = `_${aiIdx}`;
          }
        }
        currentStreamId = `cam_${srcId}${streamSuffix}`;

        const drawMode = targetAiNode.data?.bboxDrawMode || 'frontend';
        const inputNode = nodes.find(n => n.id === srcId);
        const cameraId = inputNode?.data?.entityId;
        if (drawMode === 'frontend' && cameraId && !isWikiMode) {
          whepUrl = `http://${window.location.hostname}:8889/shared_${cameraId}/whep`;
        } else {
          whepUrl = `http://${window.location.hostname}:8889/${activeProjectId}_${currentStreamId}/whep`;
        }
      }
    } else if (activeProjectId) {
      const anyInput = nodes.find(n => n.type === 'inputNode');
      if (anyInput) {
        currentStreamId = `cam_${anyInput.id}`;
        whepUrl = `http://${window.location.hostname}:8889/${activeProjectId}_${currentStreamId}/whep`;
      }
    }
  }
  
  const activeWhepUrl = (!isStreamActive || isWaitingForDeploy) ? null : whepUrl;
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const modalCanvasRef = useRef(null);
  const modalVideoRef = useRef(null);
  const modalContainerRef = useRef(null);
  const hasConnectedOnceRef = useRef(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalFullscreen, setIsModalFullscreen] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
  const [isEos, setIsEos] = useState(false);
  const [resolution, setResolution] = useState(null);

  const { status, reconnect } = useWhepStream(activeWhepUrl, videoRef, { disableAutoReconnect: isNonLoop });

  // Snapshot photo data state
  // Fetch initial latest snapshot from database on mount or when connected to a snapshotNode
  const fetchLatestSnapshot = useCallback(async (targetNodeId) => {
    if (!targetNodeId) return;
    setIsSnapshotLoading(true);
    try {
      const q = new URLSearchParams({
        node_id: targetNodeId,
        event_type: 'SNAPSHOT',
        limit: '1',
      });
      if (activeProjectId && activeProjectId !== 'wiki_sandbox') {
        q.append('project_id', activeProjectId);
      }
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
              tags: lastLog.payload?.tags || sourceNode?.data?.tags || [],
              label: lastLog.payload?.label || sourceNode?.data?.label || 'Snapshot',
              trigger_payload: lastLog.payload?.trigger,
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch snapshot for debug node:', err);
    } finally {
      setIsSnapshotLoading(false);
    }
  }, [activeProjectId, sourceNode]);

  useEffect(() => {
    if (isSnapshotNode && sourceNodeId) {
      fetchLatestSnapshot(sourceNodeId);
    } else {
      setSnapshot(null);
    }
  }, [isSnapshotNode, sourceNodeId, fetchLatestSnapshot]);

  // Realtime snapshot WebSocket listener
  useEffect(() => {
    if (!isSnapshotNode) return;
    const handleWs = (e) => {
      const msg = e.detail;
      if (msg?.type === 'snapshot_capture' && (!sourceNodeId || msg.node_id === sourceNodeId)) {
        const path = msg.snapshot_path 
          ? (msg.snapshot_path.startsWith('/') ? msg.snapshot_path : `/api/snapshots/${msg.snapshot_path.split('/').pop()}`)
          : null;
        setSnapshot({
          snapshot_path: path,
          filename: path ? path.split('/').pop() : msg.filename,
          timestamp: msg.timestamp || new Date().toISOString(),
          tags: msg.tags || sourceNode?.data?.tags || [],
          label: msg.label || sourceNode?.data?.label || 'Snapshot',
          trigger_payload: msg.trigger_payload || msg.payload,
        });
      }
    };
    window.addEventListener('pido_ws_message', handleWs);
    return () => window.removeEventListener('pido_ws_message', handleWs);
  }, [isSnapshotNode, sourceNodeId, sourceNode]);

  // Check store debugData for snapshot updates
  useEffect(() => {
    if (!isSnapshotNode || !sourceDebugData) return;
    if (sourceDebugData.type === 'snapshot_capture' || sourceDebugData.snapshot_path) {
      const path = sourceDebugData.snapshot_path 
        ? (sourceDebugData.snapshot_path.startsWith('/') ? sourceDebugData.snapshot_path : `/api/snapshots/${sourceDebugData.snapshot_path.split('/').pop()}`)
        : null;
      if (path) {
        setSnapshot(prev => ({
          snapshot_path: path,
          filename: path.split('/').pop(),
          timestamp: sourceDebugData.timestamp || prev?.timestamp || new Date().toISOString(),
          tags: sourceDebugData.tags || prev?.tags || [],
          label: sourceDebugData.label || prev?.label || 'Snapshot',
          trigger_payload: sourceDebugData.trigger_payload || prev?.trigger_payload,
        }));
      }
    }
  }, [isSnapshotNode, sourceDebugData]);

  // Sync video stream to modal video element when expanded
  useEffect(() => {
    if (isExpanded && modalVideoRef.current && videoRef.current) {
      if (videoRef.current.srcObject) {
        modalVideoRef.current.srcObject = videoRef.current.srcObject;
        modalVideoRef.current.play().catch(() => {});
      }
    }
  }, [isExpanded, status]);

  // Escape key handler to close expanded preview modal
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          setIsExpanded(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const toggleModalFullscreen = useCallback(() => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen().catch(err => {
        console.warn("Fullscreen request failed:", err);
      });
      setIsModalFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsModalFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsModalFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Listen to WebSocket EOS events broadcasted by backend
  useEffect(() => {
    const handleWsMsg = (e) => {
      const msg = e.detail;
      if (msg && msg.type === 'system' && msg.eos) {
        const matchesStream = currentStreamId && (msg.stream_id === currentStreamId || msg.camera_id === currentStreamId);
        const matchesInput = inputNode && (msg.input_node_id === inputNode.id || msg.camera_id === inputNode.data?.entityId);
        if (matchesStream || matchesInput) {
          setIsEos(true);
        }
      }
    };
    window.addEventListener('pido_ws_message', handleWsMsg);
    return () => window.removeEventListener('pido_ws_message', handleWsMsg);
  }, [currentStreamId, inputNode]);

  // Check store debugData for EOS flag as well
  const isStreamEosInStore = usePipelineStore(
    useCallback((state) => {
      if (!isNonLoop) return false;
      const dbg = state.debugData;
      if (!dbg) return false;
      if (currentStreamId && dbg[currentStreamId]?.eos) return true;
      if (inputNode?.id && dbg[inputNode.id]?.eos) return true;
      if (inputNode?.data?.entityId && dbg[inputNode.data.entityId]?.eos) return true;
      return false;
    }, [isNonLoop, currentStreamId, inputNode])
  );

  useEffect(() => {
    if (isStreamEosInStore) {
      setIsEos(true);
    }
  }, [isStreamEosInStore]);

  useEffect(() => {
    if (status === 'connected') {
      hasConnectedOnceRef.current = true;
    }
  }, [status]);

  useEffect(() => {
    if (isWaitingForDeploy || !isStreamActive) {
      setIsEos(false);
      hasConnectedOnceRef.current = false;
    }
  }, [isWaitingForDeploy, isStreamActive]);

  // Check if non-loop video has ended
  const isVideoEnd = Boolean(
    isStreamActive && hasVideoPreview && isNonLoop && (isEos || status === 'ended' || (status === 'error' && hasConnectedOnceRef.current))
  );

  const shouldDrawBoxes = isStreamActive && (sourceNode?.type === 'aiNode' || (isForkliftNode && isVideoMode)) && !data?.isPaused && !isWaitingForDeploy && !isVideoEnd;
  const lastBoxesRef = useRef({ items: [], time: 0 });
  const lastRoiRef = useRef(null);
  const lastFpsRef = useRef(null);
  const lastFpsTimeRef = useRef(0);
  const latestDataRef = useRef(null);

  // Initialize latestDataRef from store once if available and not yet set
  useEffect(() => {
    if (currentStreamId && isStreamActive && !isWaitingForDeploy && !isVideoEnd && !latestDataRef.current) {
      const initialData = usePipelineStore.getState().debugData?.[currentStreamId];
      if (initialData) {
        latestDataRef.current = initialData;
        if (initialData.roi) lastRoiRef.current = initialData.roi;
        if (initialData.fps !== undefined) {
          lastFpsRef.current = initialData.fps;
          lastFpsTimeRef.current = Date.now();
        }
      }
    }
  }, [currentStreamId, isStreamActive, isWaitingForDeploy, isVideoEnd]);

  // High-frequency WebSocket 'ai_metadata' listener (avoids React state re-render lag)
  useEffect(() => {
    const handleAiMeta = (e) => {
      const msg = e.detail;
      if (!msg) return;
      if (!isStreamActive || isWaitingForDeploy || isVideoEnd) return;

      // Only accept AI metadata packets matching this camera/stream ID (avoids overwriting by non-camera messages)
      if (!msg.camera_id) return;
      const targetStreamId = currentStreamId;
      const targetCameraId = inputNode?.data?.entityId;

      const matches = (targetStreamId && msg.camera_id === targetStreamId) ||
                      (targetCameraId && msg.camera_id === targetCameraId);

      if (matches) {
        latestDataRef.current = msg;
        if (msg.roi) {
          lastRoiRef.current = msg.roi;
        }
        if (msg.fps !== undefined) {
          lastFpsRef.current = msg.fps;
          lastFpsTimeRef.current = Date.now();
        }
      }
    };

    window.addEventListener('ai_metadata', handleAiMeta);
    return () => {
      window.removeEventListener('ai_metadata', handleAiMeta);
    };
  }, [currentStreamId, inputNode, isStreamActive, isWaitingForDeploy, isVideoEnd]);

  useEffect(() => {
    if (!isStreamActive || isWaitingForDeploy || isVideoEnd) {
      latestDataRef.current = null;
      lastBoxesRef.current = { items: [], time: 0 };
      lastFpsRef.current = null;
      lastFpsTimeRef.current = 0;
      if (!isStreamActive) {
        lastRoiRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        if (!isStreamActive || isWaitingForDeploy) {
          videoRef.current.srcObject = null;
        }
      }
      setResolution(null);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [isStreamActive, isWaitingForDeploy, isVideoEnd]);

  useEffect(() => {
    if (videoRef.current) {
      if (!isStreamActive || isPaused || isWaitingForDeploy || isVideoEnd) {
        videoRef.current.pause();
      } else if (activeWhepUrl) {
        videoRef.current.play().catch(e => console.log('[WHEP] Play error:', e));
      }
    }
  }, [isStreamActive, isPaused, isWaitingForDeploy, isVideoEnd, activeWhepUrl]);

  useEffect(() => {
    let animationFrameId;

    const drawToCanvas = (targetCanvas) => {
      if (!targetCanvas) return;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      if (isWaitingForDeploy || isVideoEnd) return;
      const payload = latestDataRef.current;
      
      if (shouldDrawBoxes && (currentStreamId || isForkliftNode)) {
        const W = targetCanvas.width, H = targetCanvas.height;
        const scale = Math.max(1, W / 640);

        // 1. Draw Polygon Danger Zones for Forklift Safety Monitor
        if (isForkliftNode) {
          const forkliftDebug = usePipelineStore.getState().debugData?.[sourceNode.id] || sourceDebugData;
          const configuredZones = sourceNode.data?.zones || [];
          const liveZonesObj = forkliftDebug?.zones || {};

          let zonesList = [];
          if (configuredZones.length > 0) {
            zonesList = configuredZones.map((z) => ({
              ...z,
              ...(liveZonesObj[z.id] || {}),
              polygon: z.polygon || liveZonesObj[z.id]?.polygon || [],
            }));
          } else {
            zonesList = Object.values(liveZonesObj);
          }

          zonesList.forEach((zone) => {
            const poly = zone.polygon || [];
            if (poly.length < 3) return;

            const isAlert = forkliftDebug?.zones?.[zone.id]?.occupied ?? zone.occupied ?? false;
            const color = zone.color || (zone.type === 'caution' ? '#f59e0b' : '#f43f5e');

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(poly[0].x * W, poly[0].y * H);
            for (let i = 1; i < poly.length; i++) {
              ctx.lineTo(poly[i].x * W, poly[i].y * H);
            }
            ctx.closePath();

            // Colored fill
            ctx.fillStyle = isAlert ? `${color}50` : `${color}20`;
            ctx.fill();

            // Border stroke
            ctx.strokeStyle = color;
            ctx.lineWidth = (isAlert ? 3 : 1.5) * scale;
            if (zone.type === 'caution') {
              ctx.setLineDash([6 * scale, 4 * scale]);
            } else {
              ctx.setLineDash([]);
            }
            ctx.stroke();

            // Zone label tag
            const cx = (poly.reduce((a, p) => a + p.x, 0) / poly.length) * W;
            const cy = (poly.reduce((a, p) => a + p.y, 0) / poly.length) * H;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.font = `bold ${Math.round(9 * scale)}px sans-serif`;
            ctx.textAlign = 'center';
            const countTag = zone.forklift_count !== undefined ? ` (${zone.forklift_count})` : '';
            const tag = `${zone.name || 'Zone'}${countTag} [${isAlert ? 'ALERT' : 'CLEAR'}]`;
            const tw = ctx.measureText(tag).width + 8 * scale;
            const th = 16 * scale;
            ctx.fillRect(cx - tw / 2, cy - th / 2, tw, th);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1 * scale;
            ctx.strokeRect(cx - tw / 2, cy - th / 2, tw, th);

            ctx.fillStyle = isAlert ? '#fca5a5' : '#ffffff';
            ctx.fillText(tag, cx, cy + 4 * scale);
            ctx.restore();
          });
        }

        // Draw ROI Box with persistence and fallback to AI node settings to eliminate flickering
        const activeRoi = payload?.roi || 
          lastRoiRef.current || 
          ((sourceNode?.data?.roiEnabled || sourceNode?.data?.showRoi) ? sourceNode?.data?.roi : null);

        if (activeRoi) {
          const { x, y, w, h } = activeRoi;
          ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)';
          ctx.lineWidth = 2 * scale;
          ctx.setLineDash([8 * scale, 6 * scale]);
          ctx.strokeRect(x * W, y * H, w * W, h * H);
          ctx.setLineDash([]);
        }

        let items = payload?.data || payload?.detections || [];
        const now = Date.now();
        
        if (items.length > 0) {
          lastBoxesRef.current = { items, time: now };
        } else {
          if (now - lastBoxesRef.current.time < 120) {
            items = lastBoxesRef.current.items;
          } else {
            lastBoxesRef.current = { items: [], time: now };
          }
        }

        const taskType = payload?.type || "detection";
        const drawMode = payload?.bbox_draw_mode || sourceNode?.data?.bboxDrawMode || "frontend";

        if (taskType === "detection" && drawMode !== "none") {
          items.forEach(det => {
            const [xmin, ymin, xmax, ymax] = det.bbox;
            const x = xmin * W, y = ymin * H;
            const width = (xmax - xmin) * W, height = (ymax - ymin) * H;

            const lbl = String(det.label || '').toLowerCase();
            const isFk = lbl === 'forklift' || lbl === 'folklift' || lbl.includes('fork');
            const isPerson = lbl === 'person' || lbl === 'human' || lbl === 'pedestrian';
            const boxColor = isFk ? '#f43f5e' : isPerson ? '#06b6d4' : '#FF8C00';

            if (drawMode !== 'backend') {
              ctx.strokeStyle = boxColor;
              ctx.lineWidth = 2 * scale;
              ctx.strokeRect(x, y, width, height);

              const displayLabel = `${det.label} ${(det.confidence ? Math.round(det.confidence * 100) + '%' : '')}`;
              ctx.fillStyle = boxColor;
              ctx.font = `bold ${Math.round(10 * scale)}px sans-serif`;
              const tagHeight = 14 * scale;
              const tagWidth = ctx.measureText(displayLabel).width + 8 * scale;
              ctx.fillRect(x, y - tagHeight, tagWidth, tagHeight);
              ctx.fillStyle = '#000';
              ctx.fillText(displayLabel, x + 4 * scale, y - 3 * scale);

              // Draw Ground-Contact Anchor Point on floor for Forklift Safety Monitor
              if (isForkliftNode) {
                const anchorX = ((xmin + xmax) / 2) * W;
                const anchorY = ymax * H;
                ctx.beginPath();
                ctx.arc(anchorX, anchorY, 4.5 * scale, 0, 2 * Math.PI);
                ctx.fillStyle = '#10b981';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5 * scale;
                ctx.stroke();
              }
            }
          });
        } else if (taskType === "pose") {
          const SKEL = [[0,1],[0,2],[1,3],[2,4],[5,6],[5,7],[7,9],[6,8],[8,10],
                        [5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16]];
          items.forEach(pose => {
            if (pose.type !== "skeleton" || !pose.points) return;
            const pts = pose.points.map(pt => ({ x: pt.x * W, y: pt.y * H, c: pt.confidence || 0 }));
            ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 2 * scale;
            SKEL.forEach(([i, j]) => {
              if (pts[i] && pts[j] && pts[i].c > 0.1 && pts[j].c > 0.1) {
                ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
              }
            });
            ctx.fillStyle = '#FF00FF';
            pts.forEach((pt) => { if (pt.c > 0.1) { ctx.beginPath(); ctx.arc(pt.x, pt.y, 3 * scale, 0, 2*Math.PI); ctx.fill(); } });
          });
        }

        // Draw Live Hazard HUD Banner on video top
        if (isForkliftNode) {
          const forkliftDebug = usePipelineStore.getState().debugData?.[sourceNode.id] || sourceDebugData;
          const hLevel = forkliftDebug?.hazard_level ?? 0;

          ctx.save();
          let bannerBg = 'rgba(16, 185, 129, 0.88)'; // Green
          let bannerText = `✓ ALL CLEAR | Forklifts: ${forkliftDebug?.forklift_count || 0}  Persons: ${forkliftDebug?.person_count || 0}`;

          if (hLevel === 2) {
            bannerBg = 'rgba(225, 29, 72, 0.92)'; // Red
            bannerText = `🚨 CRITICAL RISK | Forklifts: ${forkliftDebug?.forklift_count || 0}  Persons: ${forkliftDebug?.person_count || 0}`;
          } else if (hLevel === 1) {
            bannerBg = 'rgba(217, 119, 6, 0.9)'; // Amber
            bannerText = `⚠️ CAUTION | Forklifts: ${forkliftDebug?.forklift_count || 0}  Persons: ${forkliftDebug?.person_count || 0}`;
          }

          const bannerH = 22 * scale;
          ctx.fillStyle = bannerBg;
          ctx.fillRect(0, 0, W, bannerH);
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(10 * scale)}px monospace`;
          ctx.textAlign = 'left';
          ctx.fillText(bannerText, 8 * scale, 15 * scale);

          if (forkliftDebug?.near_miss_count > 0) {
            ctx.textAlign = 'right';
            ctx.fillText(`Near-Miss: ${forkliftDebug.near_miss_count}`, W - 8 * scale, 15 * scale);
          }
          ctx.restore();
        }
      }
      
      // Draw FPS if available (only for AI nodes) with persistence to prevent canvas flicker
      const now = Date.now();
      const currentMeta = latestDataRef.current;
      if (currentMeta?.fps !== undefined) {
        lastFpsRef.current = currentMeta.fps;
        lastFpsTimeRef.current = now;
      }

      const displayFps = (now - lastFpsTimeRef.current < 2000) ? lastFpsRef.current : null;

      if (shouldDrawBoxes && displayFps !== null && displayFps !== undefined) {
        const W = targetCanvas.width;
        const scale = Math.max(1, W / 640);
        const fpsStr = `AI FPS: ${displayFps}`;
        let fpsColor = '#22c55e'; // green
        if (displayFps < 10) fpsColor = '#ef4444'; // red
        else if (displayFps < 20) fpsColor = '#eab308'; // yellow
        
        ctx.font = `bold ${Math.round(10 * scale)}px monospace`;
        const tw = ctx.measureText(fpsStr).width + 8 * scale;
        const cw = targetCanvas.width;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cw - tw - 6 * scale, 4 * scale, tw, 16 * scale);
        ctx.fillStyle = fpsColor;
        ctx.fillText(fpsStr, cw - tw - 2 * scale, 16 * scale);
      }
    };

    const render = () => {
      if (canvasRef.current) {
        drawToCanvas(canvasRef.current);
      }
      if (isExpanded && modalCanvasRef.current) {
        drawToCanvas(modalCanvasRef.current);
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [shouldDrawBoxes, currentStreamId, isWaitingForDeploy, isVideoEnd, isForkliftNode, isExpanded, sourceNode, sourceDebugData]);

  let content = null;
  
  if (!sourceNode) {
    content = <div className="text-fg-subtle text-xs text-center px-2 py-4">Not Connected</div>;

  } else if (isVideoMode && (sourceNode.type === 'aiNode' || sourceNode.type === 'inputNode' || isForkliftNode)) {
    content = (
      <div className="relative w-64 aspect-video bg-black flex items-center justify-center overflow-hidden">
        <video 
          ref={videoRef} 
          className={`w-full h-full object-contain ${(!activeWhepUrl || status === 'error' || status === 'ended' || isWaitingForDeploy || isVideoEnd || !isStreamActive) ? 'hidden' : ''}`} 
          autoPlay 
          playsInline 
          muted 
          onEnded={() => setIsEos(true)}
          onLoadedMetadata={(e) => setResolution(`${e.target.videoWidth}x${e.target.videoHeight}`)}
        />
        
        {!isStreamActive ? (
          <div 
            data-testid="debug-node-project-stopped"
            className="absolute inset-0 bg-surface-2/95 dark:bg-canvas/95 flex flex-col items-center justify-center p-4 text-center select-none z-10"
          >
            <div className="relative mb-2 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-surface-3 border border-line-strong flex items-center justify-center shadow-md text-fg-muted">
                <Play size={18} className="translate-x-0.5 text-fg-muted" />
              </div>
            </div>
            <div className="flex flex-col gap-0.5 items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-fg-secondary font-mono">
                start project to watch debug video
              </span>
              <span className="text-[10px] text-fg-subtle leading-tight max-w-[200px]">
                Project is stopped. Start project or deploy pipeline to view video.
              </span>
              {projectId && (
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await fetch(`/api/projects/${projectId}/start`, { method: 'POST' });
                      usePipelineStore.getState().setIsProjectRunning(true);
                    } catch (err) {
                      console.error("Failed to start project", err);
                    }
                  }}
                  className="mt-2 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/50 flex items-center gap-1 font-medium transition-colors"
                >
                  <Play size={10} fill="currentColor" />
                  <span>Start Project</span>
                </button>
              )}
            </div>
          </div>
        ) : isWaitingForDeploy ? (
          <div 
            data-testid="debug-node-waiting-deploy"
            className="absolute inset-0 bg-surface-2/95 dark:bg-canvas/95 flex flex-col items-center justify-center p-4 text-center select-none z-10"
          >
            <div className="relative mb-2 flex items-center justify-center">
              <div className="absolute w-10 h-10 rounded-full bg-amber-500/20 dark:bg-amber-400/15 animate-ping opacity-70" />
              <div className="relative w-9 h-9 rounded-full bg-amber-500/15 dark:bg-amber-500/25 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10 text-amber-600 dark:text-amber-400">
                <RefreshCw size={16} className="animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            </div>
            <div className="flex flex-col gap-0.5 items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono">
                waiting for deploy
              </span>
              <span className="text-[10px] text-fg-subtle leading-tight max-w-[200px]">
                Upstream settings modified. Deploy pipeline to resume stream.
              </span>
            </div>
          </div>
        ) : (
          <>
            {!activeWhepUrl && !isVideoEnd && (
              <div className="absolute text-xs text-fg-subtle">Initializing stream...</div>
            )}

            {isVideoEnd && (
              <div 
                data-testid="debug-node-video-end"
                className="absolute inset-0 bg-surface-2/95 dark:bg-canvas/95 flex flex-col items-center justify-center p-4 text-center select-none z-10"
              >
                <div className="relative mb-2 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-blue-500/15 dark:bg-blue-500/25 border border-blue-500/30 flex items-center justify-center shadow-md text-blue-600 dark:text-blue-400">
                    <Film size={18} />
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 font-mono">
                    video end
                  </span>
                  <span className="text-[10px] text-fg-subtle leading-tight">
                    Playback finished (non-loop)
                  </span>
                  <button 
                    onClick={() => {
                      setIsEos(false);
                      hasConnectedOnceRef.current = false;
                      reconnect();
                    }} 
                    className="mt-2 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center gap-1 font-medium transition-colors"
                  >
                    <RefreshCw size={10} />
                    <span>Replay</span>
                  </button>
                </div>
              </div>
            )}
            
            {activeWhepUrl && status === 'error' && !isVideoEnd && (
              <div className="absolute flex flex-col items-center gap-2">
                <div className="text-red-500 text-[10px]">Stream Error</div>
                <button onClick={reconnect} className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded hover:bg-red-200 dark:hover:bg-red-900/50">Retry</button>
              </div>
            )}
            
            <canvas ref={canvasRef} width={640} height={360} className="absolute inset-0 w-full h-full pointer-events-none" />
            <div className={`absolute top-1 left-1 bg-black/60 text-fg text-[10px] px-1 rounded flex gap-2 ${isVideoEnd || !isStreamActive ? 'hidden' : ''}`}>
              <span>{sourceNode.type === 'forkliftZoneNode' ? `Forklift Video (${sourceHandle || 'debug'})` : 'Live Preview'}</span>
              {resolution && <span className="text-fg-secondary font-mono">{resolution}</span>}
            </div>
            {isStreamActive && !isWaitingForDeploy && !isVideoEnd && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-all shadow backdrop-blur-xs z-10 border border-white/20 hover:scale-105 active:scale-95"
                title="ขยาย Preview (Expand Preview)"
              >
                <Maximize2 size={12} />
              </button>
            )}
          </>
        )}
      </div>
    );
  } else if (isSnapshotNode) {
    content = (
      <div className="relative w-64 aspect-video bg-black flex flex-col items-center justify-center overflow-hidden group select-none">
        {snapshot?.snapshot_path ? (
          <>
            <img 
              src={snapshot.snapshot_path} 
              alt="Snapshot Debug Preview" 
              className="w-full h-full object-contain"
            />
            {/* Overlay Banner Top */}
            <div className="absolute top-1.5 left-1.5 right-8 flex items-center justify-between pointer-events-none">
              <span className="bg-black/70 backdrop-blur-xs text-pink-400 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-pink-500/30 flex items-center gap-1 truncate max-w-[130px]">
                <Camera size={10} className="shrink-0" />
                <span className="truncate">{snapshot.label || 'Snapshot'}</span>
              </span>
            </div>

            {/* Expand Button Top-Right */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
              className="absolute top-1.5 right-1.5 p-1 rounded bg-black/70 hover:bg-black/90 text-white/80 hover:text-white transition-all shadow backdrop-blur-xs z-10 border border-white/20 hover:scale-105 active:scale-95"
              title="ขยาย Preview (Expand Preview)"
            >
              <Maximize2 size={12} />
            </button>

            {/* Overlay Banner Bottom */}
            <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] text-fg-subtle bg-black/60 backdrop-blur-xs px-1.5 py-0.5 rounded pointer-events-none">
              <span className="font-mono">{formatDbTimeOnly(snapshot.timestamp)}</span>
              <span className="truncate max-w-[120px] font-mono text-fg-faint">{snapshot.filename}</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-3 text-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-surface-2 border border-line-strong flex items-center justify-center text-pink-500">
              <Camera size={16} />
            </div>
            <span className="text-[11px] font-bold text-fg-secondary">
              {isSnapshotLoading ? 'Loading latest snapshot...' : 'No Snapshot Captured'}
            </span>
            <span className="text-[9px] text-fg-subtle max-w-[190px] leading-tight">
              Waiting for capture trigger from pipeline
            </span>
          </div>
        )}
      </div>
    );
  } else if (data?.outputType === 'text' || sourceNode?.type === 'rateLimitNode' || sourceNode?.type === 'functionNode') {
    content = (
      <div className="flex flex-col items-center justify-center p-3 gap-1 bg-surface/50 min-h-[60px]">
        <span className="text-[10px] text-fg-subtle text-center leading-tight">Open right Debug Panel<br/>to view payload</span>
      </div>
    );
  } else if (sourceNode.type === 'logicNode') {
    const state = sourceDebugData;
    let displayValue = "--", color = "text-fg-muted";
    if (state !== undefined) {
      if (typeof state === 'boolean' || typeof state?.value === 'boolean') {
        const val = typeof state === 'boolean' ? state : state.value;
        displayValue = val ? "TRUE" : "FALSE";
        color = val ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
      } else {
        displayValue = String(state?.value || state);
        color = "text-blue-600 dark:text-blue-400";
      }
    }
    content = (
      <div className="flex flex-col items-center justify-center p-3 gap-1 bg-surface/50">
        <span className="text-xs text-fg-muted">Logic Output</span>
        <span className={`text-xl font-bold ${color}`}>{displayValue}</span>
      </div>
    );
  } else if (sourceNode.type === 'flowCounterNode') {
    const debugState = sourceDebugData;
    const counts = debugState?.counts || sourceNode.data?.counts || {};
    const total = debugState?.total ?? sourceNode.data?.total ?? 0;
    const entries = Object.entries(counts);

    content = (
      <div className="flex flex-col p-3 gap-2 bg-surface/60 min-w-[200px]">
        <div className="flex items-center justify-between border-b border-line-strong/60 pb-1.5 text-xs text-fg-muted">
          <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-semibold">
            <span>⇄</span> Flow Counts
          </span>
          <span className="text-white font-bold bg-teal-950 border border-teal-700 px-2 py-0.5 rounded text-xs font-mono">
            Total: {total}
          </span>
        </div>

        {entries.length > 0 ? (
          <div className="flex flex-col gap-1 max-h-44 overflow-y-auto custom-scrollbar pr-0.5">
            {entries.map(([cls, cnt]) => (
              <div key={cls} className="flex items-center justify-between bg-canvas/80 px-2.5 py-1.5 rounded text-xs border border-line">
                <span className="text-teal-700 dark:text-teal-300 font-medium truncate max-w-[130px]" title={cls}>
                  {cls}
                </span>
                <span className="text-fg font-bold font-mono bg-surface px-2 py-0.5 rounded border border-line-strong/60">
                  {cnt}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-fg-subtle italic text-center py-2">
            Waiting for objects... (Total: 0)
          </div>
        )}
      </div>
    );
  } else if (sourceNode.type === 'counterNode') {
    const debugState = sourceDebugData;
    const val = debugState?.value ?? 0;
    content = (
      <div className="flex flex-col items-center justify-center p-3 gap-1 bg-surface/50 min-w-[160px]">
        <span className="text-xs text-fg-muted">Event Counter</span>
        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{val}</span>
      </div>
    );
  } else if (isForkliftNode) {
    const debugState = sourceDebugData;
    const isCriticalVal = debugState?.is_critical ?? false;
    const isDangerVal = debugState?.is_danger ?? false;
    const liveZones = debugState?.zones || {};

    if (sourceHandle === 'is_critical') {
      content = (
        <div className="flex flex-col items-center justify-center p-3.5 gap-2 bg-surface/80 min-w-[210px]">
          <div className="flex items-center gap-1.5 text-xs text-fg-secondary font-medium">
            <AlertOctagon size={15} className={isCriticalVal ? "text-red-500 animate-bounce" : "text-fg-subtle"} />
            <span>Critical Collision Alert</span>
          </div>
          <div className={`text-xl font-black font-mono tracking-wider px-3.5 py-1.5 rounded-lg border ${
            isCriticalVal
              ? "bg-red-50 dark:bg-red-950/90 text-red-800 dark:text-red-200 border-red-600 animate-pulse shadow-lg shadow-red-950/80"
              : "bg-canvas/80 text-fg-muted border-line"
          }`}>
            {isCriticalVal ? "TRUE (SIREN)" : "FALSE"}
          </div>
          <span className="text-[10px] text-fg-muted font-mono text-center">
            {isCriticalVal ? "🚨 Forklift + Person / Conflict" : "Normal / No Critical Hazard"}
          </span>
        </div>
      );
    } else if (sourceHandle === 'is_danger') {
      content = (
        <div className="flex flex-col items-center justify-center p-3.5 gap-2 bg-surface/80 min-w-[210px]">
          <div className="flex items-center gap-1.5 text-xs text-fg-secondary font-medium">
            <AlertTriangle size={15} className={isDangerVal ? "text-amber-700 dark:text-amber-400 animate-pulse" : "text-fg-subtle"} />
            <span>Any Forklift Warning</span>
          </div>
          <div className={`text-xl font-black font-mono tracking-wider px-3.5 py-1.5 rounded-lg border ${
            isDangerVal
              ? "bg-amber-50 dark:bg-amber-950/90 text-amber-800 dark:text-amber-200 border-amber-600 shadow-md shadow-amber-950/60"
              : "bg-canvas/80 text-emerald-600 dark:text-emerald-400 border-line"
          }`}>
            {isDangerVal ? "TRUE (WARN)" : "FALSE (CLEAR)"}
          </div>
          <span className="text-[10px] text-fg-muted font-mono text-center">
            Forklifts in Area: {debugState?.forklift_count ?? 0}
          </span>
        </div>
      );
    } else if (sourceHandle && (sourceHandle.startsWith('zone_') || (sourceNode.data?.zones || []).some(z => z.id === sourceHandle))) {
      const zoneCfg = (sourceNode.data?.zones || []).find(z => z.id === sourceHandle) || liveZones[sourceHandle] || {};
      const zoneState = liveZones[sourceHandle] || {};
      const isOccupied = zoneState.occupied ?? false;
      const fkCount = zoneState.forklift_count ?? 0;
      const pCount = zoneState.person_count ?? 0;
      const zoneColor = zoneCfg.color || (zoneCfg.type === 'caution' ? '#f59e0b' : '#f43f5e');

      content = (
        <div className="flex flex-col p-3 gap-2 bg-surface/80 min-w-[220px]">
          <div className="flex items-center justify-between border-b border-line pb-1.5">
            <div className="flex items-center gap-1.5 truncate max-w-[140px]">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: zoneColor }} />
              <span className="text-xs font-semibold text-fg truncate">{zoneCfg.name || sourceHandle}</span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              isOccupied ? "bg-rose-950 text-rose-200 border border-rose-700" : "bg-canvas text-fg-muted border border-line"
            }`}>
              {isOccupied ? "OCCUPIED" : "CLEAR"}
            </span>
          </div>
          <div className="flex items-center justify-around bg-canvas/90 py-1.5 px-2 rounded border border-line text-center">
            <div>
              <span className="text-[9px] text-fg-muted block">Forklifts</span>
              <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">{fkCount}</span>
            </div>
            <div>
              <span className="text-[9px] text-fg-muted block">Persons</span>
              <span className="text-sm font-bold font-mono text-cyan-600 dark:text-cyan-400">{pCount}</span>
            </div>
          </div>
        </div>
      );
    } else {
      const hazardLevel = debugState?.hazard_level ?? 0;
      const hazardText = debugState?.hazard_text ?? (hazardLevel === 2 ? "CRITICAL" : hazardLevel === 1 ? "CAUTION" : "ALL CLEAR");
      const fkCount = debugState?.forklift_count ?? 0;
      const pCount = debugState?.person_count ?? 0;
      const nearMiss = debugState?.near_miss_count ?? 0;
      const zoneEntries = Object.values(liveZones);

      const isCritical = hazardLevel === 2;
      const isCaution = hazardLevel === 1;

      content = (
        <div className="flex flex-col p-3 gap-2 bg-surface/80 min-w-[240px]">
          <div className="flex items-center justify-between border-b border-line-strong/60 pb-1.5">
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold text-xs">
              <ShieldAlert size={14} /> Forklift Safety Telemetry
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                isCritical
                  ? 'bg-red-950 text-red-200 border border-red-700 animate-pulse'
                  : isCaution
                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
              }`}
            >
              {isCritical ? '🚨 CRITICAL' : isCaution ? '⚠️ CAUTION' : '✓ SAFE'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-canvas/90 p-1.5 rounded border border-line text-center">
            <div>
              <div className="text-[9px] text-fg-muted">Forklifts</div>
              <div className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">{fkCount}</div>
            </div>
            <div>
              <div className="text-[9px] text-fg-muted">Persons</div>
              <div className="text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400">{pCount}</div>
            </div>
            <div>
              <div className="text-[9px] text-fg-muted">Near-Miss</div>
              <div className="text-xs font-bold font-mono text-amber-700 dark:text-amber-400">{nearMiss}</div>
            </div>
          </div>

          <div className="text-[10px] font-medium text-center text-fg-secondary bg-canvas/60 py-1 px-2 rounded border border-line truncate">
            {hazardText}
          </div>

          {zoneEntries.length > 0 && (
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar pr-0.5">
              {zoneEntries.map((z) => (
                <div
                  key={z.id}
                  className={`flex items-center justify-between px-2 py-1 rounded text-[10px] border ${
                    z.occupied
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-800/80 text-rose-800 dark:text-rose-200'
                      : 'bg-canvas/60 border-line text-fg-muted'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: z.color || (z.type === 'caution' ? '#f59e0b' : '#f43f5e') }}
                    />
                    <span className="truncate">{z.name}</span>
                  </div>
                  <span className="font-mono font-bold text-[9px]">
                    {z.occupied ? `ALERT (${z.forklift_count || 0})` : 'CLEAR'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
  } else if (sourceNode.type === 'unitThroughputNode') {
    const debugState = sourceDebugData;
    const isRunning = debugState?.is_running ?? sourceNode.data?.is_running ?? false;
    const currentUnits = debugState?.current_unit ?? debugState?.total_units ?? sourceNode.data?.current_unit ?? 0;
    const primaryUnit = debugState?.rate_unit || sourceNode.data?.rateUnit || 'minute';
    const activeUnits = (Array.isArray(debugState?.rate_units) && debugState.rate_units.length > 0)
      ? debugState.rate_units
      : (Array.isArray(sourceNode.data?.rateUnits) && sourceNode.data.rateUnits.length > 0)
      ? sourceNode.data.rateUnits
      : [primaryUnit];

    const getUnitRates = (u) => {
      if (u === 'second') {
        return {
          label: '/sec',
          name: 'Per Second',
          rate: debugState?.current_rate_per_sec ?? (primaryUnit === 'second' ? (debugState?.throughput ?? sourceNode.data?.throughput) : undefined),
          avg: debugState?.average_rate_per_sec ?? (primaryUnit === 'second' ? debugState?.average_rate : undefined)
        };
      }
      if (u === 'hour') {
        return {
          label: '/hr',
          name: 'Per Hour',
          rate: debugState?.current_rate_per_hour ?? (primaryUnit === 'hour' ? (debugState?.throughput ?? sourceNode.data?.throughput) : undefined),
          avg: debugState?.average_rate_per_hour ?? (primaryUnit === 'hour' ? debugState?.average_rate : undefined)
        };
      }
      return {
        label: '/min',
        name: 'Per Minute',
        rate: debugState?.current_rate_per_min ?? debugState?.current_rate_per_minute ?? (primaryUnit === 'minute' ? (debugState?.throughput ?? sourceNode.data?.throughput) : undefined),
        avg: debugState?.average_rate_per_min ?? debugState?.average_rate_per_minute ?? (primaryUnit === 'minute' ? debugState?.average_rate : undefined)
      };
    };

    content = (
      <div className="flex flex-col p-3 gap-2 bg-surface/80 min-w-[210px]">
        {/* Header / Status Bar */}
        <div className="flex items-center justify-between border-b border-line pb-1.5">
          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
            <span>⏱️</span> Throughput Rate
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
              isRunning
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                : 'bg-surface-3 text-fg-muted border border-line'
            }`}
          >
            {isRunning ? '● RUNNING' : '○ PAUSED'}
          </span>
        </div>

        {/* Total Units Counter */}
        <div className="flex items-center justify-between bg-canvas/80 px-2.5 py-1.5 rounded border border-line">
          <span className="text-xs text-fg-muted">Total Units:</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
              {currentUnits}
            </span>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                const pid = usePipelineStore.getState().projectId || 'default';
                try {
                  await fetch('/api/analytics/throughput/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ project_id: pid, node_id: sourceNodeId })
                  });
                  const setDebugData = usePipelineStore.getState().setDebugData;
                  if (setDebugData && sourceNodeId) {
                    setDebugData(sourceNodeId, {
                      ...debugState,
                      current_unit: 0,
                      total_units: 0,
                      throughput: 0,
                      current_rate: 0,
                      average_rate: 0,
                      current_rate_per_sec: 0,
                      average_rate_per_sec: 0,
                      current_rate_per_min: 0,
                      average_rate_per_min: 0,
                      current_rate_per_hour: 0,
                      average_rate_per_hour: 0
                    });
                  }
                  usePipelineStore.getState().updateNodeData(sourceNodeId, {
                    current_unit: 0,
                    total_units: 0,
                    throughput: 0
                  });
                } catch (err) {
                  console.error("Failed to reset throughput counter:", err);
                }
              }}
              className="text-[10px] px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 active:scale-95 text-red-500 border border-red-500/30 rounded font-sans font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
              title="Reset Counter to 0"
            >
              <RotateCcw size={10} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Multi-rate Units */}
        <div className="flex flex-col gap-1.5">
          {activeUnits.map((u) => {
            const info = getUnitRates(u);
            const isPrimary = u === primaryUnit;
            const rateVal = info.rate !== undefined ? Number(info.rate).toFixed(1) : '-';
            const avgVal = info.avg !== undefined ? Number(info.avg).toFixed(1) : null;

            return (
              <div
                key={u}
                className={`p-2 rounded border flex flex-col gap-1 transition-all ${
                  isPrimary
                    ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm'
                    : 'bg-canvas/90 border-line'
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-fg-secondary uppercase tracking-wider font-mono flex items-center gap-1">
                    <span>{info.name}</span>
                    {isPrimary && (
                      <span className="text-[9px] text-indigo-400 bg-indigo-500/20 px-1 rounded font-normal lowercase">
                        primary
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-fg-subtle font-mono">{info.label}</span>
                </div>

                <div className="flex items-baseline justify-between font-mono">
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-bold text-emerald-500">{rateVal}</span>
                    <span className="text-[10px] text-fg-faint">{info.label}</span>
                  </div>
                  {avgVal !== null && (
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400" title="Average Rate">
                      Avg: {avgVal}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  } else if (sourceNode.type === 'targetTrackerNode') {
    const debugState = sourceDebugData;
    const actual = debugState?.actual ?? 0;
    const target = debugState?.target ?? sourceNode.data?.target ?? 0;
    const progress = debugState?.progress_percent ?? (target > 0 ? (actual / target) * 100 : 0);
    const isComplete = debugState?.is_complete ?? (target > 0 && actual >= target);

    content = (
      <div className="flex flex-col p-3 gap-2 bg-surface/80 min-w-[200px]">
        <div className="flex items-center justify-between border-b border-line pb-1.5 text-xs">
          <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
            🎯 Target Tracker
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
              isComplete
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                : 'bg-amber-950 text-amber-300 border border-amber-700'
            }`}
          >
            {isComplete ? '✓ COMPLETE' : `${Number(progress).toFixed(1)}%`}
          </span>
        </div>
        <div className="flex items-center justify-between bg-canvas/80 px-2.5 py-1.5 rounded border border-line">
          <span className="text-xs text-fg-muted">Actual / Target:</span>
          <span className="text-sm font-bold font-mono text-amber-500">
            {actual} <span className="text-fg-faint">/ {target}</span>
          </span>
        </div>
      </div>
    );
  } else {
    content = <div className="text-fg-muted text-xs text-center px-2 py-3">Unsupported Node</div>;
  }

  return (
    <div className={`bg-surface border-2 rounded-xl shadow-2xl min-w-[180px] overflow-hidden transition-all duration-300 relative ${
      isHighlighted 
        ? 'border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.6)] scale-105 z-50' 
        : !isStreamActive
        ? 'border-line-strong/80'
        : isWaitingForDeploy
        ? 'border-amber-500/70 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
        : isVideoEnd
        ? 'border-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
        : isPaused 
        ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
        : 'border-line-strong/80'
    }`}>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3 bg-fg-muted border-2 border-line" />
      <NodeHeader
        id={id}
        icon={Bug}
        iconBg={!isStreamActive ? 'bg-surface-3' : isWaitingForDeploy || isPaused ? 'bg-amber-600' : isVideoEnd ? 'bg-blue-600' : 'bg-surface-3'}
        iconColor={!isStreamActive ? 'text-fg-secondary' : isWaitingForDeploy || isPaused || isVideoEnd ? 'text-white' : 'text-fg-secondary'}
        headerBg={
          !isStreamActive
            ? 'bg-surface-2/80 border-line-strong/80'
            : isWaitingForDeploy
            ? 'bg-amber-500/10 border-amber-500/30'
            : isVideoEnd
            ? 'bg-blue-500/10 border-blue-500/30'
            : isPaused 
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-900/50' 
            : 'bg-surface-2/80 border-line-strong/80'
        }
        defaultName="Debug node"
        defaultSubtitle="Payload Probe"
        data={data}
      >
        {!isStreamActive && hasVideoPreview && (
          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface-3 text-fg-subtle border border-line-strong font-mono shrink-0">
            Stopped
          </span>
        )}
        {isStreamActive && isWaitingForDeploy && (
          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-mono shrink-0">
            Waiting Deploy
          </span>
        )}
        {isStreamActive && isVideoEnd && !isWaitingForDeploy && (
          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 font-mono shrink-0">
            Video End
          </span>
        )}
        {hasPreview && (
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
            className="bg-surface/80 hover:bg-surface-3 p-1 rounded text-fg-secondary hover:text-fg shadow-md transition-colors" 
            title="ขยาย Preview (Expand Preview)"
          >
            <Maximize2 size={12} />
          </button>
        )}
        {hasVideoPreview && (
          <button 
            onClick={togglePause} 
            disabled={!isStreamActive || isWaitingForDeploy || isVideoEnd}
            className={`bg-surface/80 hover:bg-surface-3 p-1 rounded text-fg-secondary shadow-md transition-colors ${
              (!isStreamActive || isWaitingForDeploy || isVideoEnd) ? 'opacity-40 cursor-not-allowed' : ''
            }`} 
            title={!isStreamActive ? "Start project to resume" : isWaitingForDeploy ? "Waiting for deploy" : isVideoEnd ? "Video End" : isPaused ? "Resume Node" : "Pause Node"}
          >
            {isPaused ? <Play size={12} className="text-green-600 dark:text-green-400" /> : <Pause size={12} className="text-amber-700 dark:text-amber-400" />}
          </button>
        )}
      </NodeHeader>
      <div className="bg-canvas flex flex-col relative min-h-[40px]">
        <div className={`transition-all duration-300 ${isPaused ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
          {content}
        </div>
        
        {/* BIG PAUSE BUTTON (Only for non-preview modes) */}
        {!hasPreview && (
          <div className="p-2 border-t border-line/50 bg-surface/50">
            <button 
              onClick={togglePause} 
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-[11px] uppercase tracking-wider shadow-sm transition-all active:scale-95 ${
                isPaused 
                  ? 'bg-amber-500 text-gray-900 hover:bg-amber-400 border border-amber-400/50' 
                  : 'bg-surface-2 text-fg-secondary hover:bg-surface-3 border border-line-strong hover:text-fg'
              }`}
            >
              {isPaused ? <Play size={14} className="fill-current" /> : <Pause size={14} className="fill-current" />}
              {isPaused ? 'Resume Debug' : 'Pause Debug'}
            </button>
          </div>
        )}
      </div>

      {/* Expanded Preview Modal */}
      {isExpanded && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200 select-none nodrag"
          onClick={() => setIsExpanded(false)}
        >
          <div 
            ref={modalContainerRef}
            className="relative w-full max-w-5xl bg-surface border border-line-strong rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-2/90">
              <div className="flex items-center gap-2.5 truncate min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                  <Bug size={16} />
                </div>
                <div className="flex flex-col truncate min-w-0">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-sm text-fg truncate">
                      {data?.label || 'Debug node'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-3 text-fg-secondary border border-line shrink-0">
                      {sourceNode?.data?.label || sourceNode?.type || 'Live Source'}
                    </span>
                  </div>
                  <span className="text-[10px] text-fg-subtle truncate">
                    {hasVideoPreview ? 'Expanded Video Stream & Realtime AI Overlay' : 'Captured Snapshot Preview'}
                  </span>
                </div>
              </div>

              {/* Modal Status Badges & Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {hasVideoPreview && (
                  <>
                    {resolution && (
                      <span className="hidden sm:inline-flex text-[10px] font-mono text-fg-secondary bg-surface px-2 py-1 rounded border border-line">
                        {resolution}
                      </span>
                    )}
                    {isStreamActive && !isWaitingForDeploy && !isVideoEnd && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                      </span>
                    )}
                    {isWaitingForDeploy && (
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700">
                        WAITING DEPLOY
                      </span>
                    )}
                    {isVideoEnd && (
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-700">
                        VIDEO END
                      </span>
                    )}
                    <button 
                      onClick={togglePause} 
                      disabled={!isStreamActive || isWaitingForDeploy || isVideoEnd}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-line-strong bg-surface hover:bg-surface-3 text-fg-secondary hover:text-fg transition-all active:scale-95 ${
                        (!isStreamActive || isWaitingForDeploy || isVideoEnd) ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                      title={isPaused ? "Resume Preview" : "Pause Preview"}
                    >
                      {isPaused ? <Play size={12} className="text-green-500 fill-current" /> : <Pause size={12} className="text-amber-500 fill-current" />}
                      <span className="hidden sm:inline">{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                  </>
                )}

                {isSnapshotNode && snapshot?.snapshot_path && (
                  <a
                    href={snapshot.snapshot_path}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-line-strong bg-surface hover:bg-surface-3 text-fg-secondary hover:text-fg transition-all active:scale-95"
                    title="Open full image in new tab"
                  >
                    <ExternalLink size={12} />
                    <span className="hidden sm:inline">Open Image</span>
                  </a>
                )}

                {/* Fullscreen Button */}
                <button
                  onClick={toggleModalFullscreen}
                  className="p-1.5 rounded-lg border border-line-strong bg-surface hover:bg-surface-3 text-fg-secondary hover:text-fg transition-all active:scale-95"
                  title={isModalFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isModalFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-red-500/20 hover:border-red-500/40 border border-transparent transition-all active:scale-95"
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Main Content Area */}
            <div className="relative bg-black flex items-center justify-center overflow-hidden min-h-[300px] max-h-[80vh]">
              {hasVideoPreview && (
                <div className="relative w-full aspect-video flex items-center justify-center max-h-[80vh]">
                  <video 
                    ref={modalVideoRef} 
                    className={`w-full h-full object-contain ${(!activeWhepUrl || status === 'error' || status === 'ended' || isWaitingForDeploy || isVideoEnd || !isStreamActive) ? 'hidden' : ''}`} 
                    autoPlay 
                    playsInline 
                    muted 
                    onEnded={() => setIsEos(true)}
                  />

                  <canvas 
                    ref={modalCanvasRef} 
                    width={1280} 
                    height={720} 
                    className="absolute inset-0 w-full h-full pointer-events-none" 
                  />

                  {!isStreamActive ? (
                    <div className="absolute inset-0 bg-surface-2/95 dark:bg-canvas/95 flex flex-col items-center justify-center p-6 text-center select-none z-10">
                      <div className="w-12 h-12 rounded-full bg-surface-3 border border-line-strong flex items-center justify-center text-fg-muted mb-2 shadow-lg">
                        <Play size={22} className="translate-x-0.5 text-fg-muted" />
                      </div>
                      <span className="text-sm font-bold uppercase tracking-wider text-fg-secondary font-mono">
                        Project is stopped
                      </span>
                      <span className="text-xs text-fg-subtle max-w-sm mt-1">
                        Start project from header or deploy pipeline to view video stream.
                      </span>
                    </div>
                  ) : isWaitingForDeploy ? (
                    <div className="absolute inset-0 bg-surface-2/95 dark:bg-canvas/95 flex flex-col items-center justify-center p-6 text-center select-none z-10">
                      <div className="relative w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500 mb-2">
                        <RefreshCw size={20} className="animate-spin" style={{ animationDuration: '3s' }} />
                      </div>
                      <span className="text-sm font-bold uppercase tracking-wider text-amber-500 font-mono">
                        Waiting for deploy
                      </span>
                      <span className="text-xs text-fg-subtle max-w-sm mt-1">
                        Upstream nodes were modified. Deploy the pipeline to resume stream.
                      </span>
                    </div>
                  ) : isVideoEnd ? (
                    <div className="absolute inset-0 bg-surface-2/95 dark:bg-canvas/95 flex flex-col items-center justify-center p-6 text-center select-none z-10">
                      <div className="w-12 h-12 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500 mb-2">
                        <Film size={22} />
                      </div>
                      <span className="text-sm font-bold uppercase tracking-wider text-blue-500 font-mono">
                        Video Playback Finished
                      </span>
                      <span className="text-xs text-fg-subtle max-w-sm mt-1">
                        Non-looping video file reached the end of stream.
                      </span>
                      <button 
                        onClick={() => {
                          setIsEos(false);
                          hasConnectedOnceRef.current = false;
                          reconnect();
                        }} 
                        className="mt-3 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all shadow-md active:scale-95"
                      >
                        <RefreshCw size={12} />
                        <span>Replay Video</span>
                      </button>
                    </div>
                  ) : status === 'error' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6">
                      <span className="text-red-500 font-medium text-sm">WebRTC Video Stream Error</span>
                      <button 
                        onClick={reconnect} 
                        className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow"
                      >
                        <RefreshCw size={12} /> Retry Stream
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {isSnapshotNode && (
                <div className="relative w-full flex flex-col items-center justify-center p-4">
                  {snapshot?.snapshot_path ? (
                    <img 
                      src={snapshot.snapshot_path} 
                      alt="Expanded Snapshot Preview" 
                      className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-2xl"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                      <Camera size={36} className="text-pink-500/60" />
                      <span className="text-sm font-bold text-fg-secondary">No Snapshot Available Yet</span>
                      <span className="text-xs text-fg-subtle max-w-xs">
                        Trigger a snapshot in the pipeline or wait for incoming capture events.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Info Bar */}
            <div className="px-4 py-2 bg-surface-2/80 border-t border-line flex items-center justify-between text-xs text-fg-subtle">
              <div className="flex items-center gap-3">
                <span className="font-mono">
                  Source: <strong className="text-fg">{sourceNode?.data?.label || sourceNode?.id || 'Connected Node'}</strong>
                </span>
                {hasVideoPreview && currentStreamId && (
                  <span className="font-mono hidden sm:inline">
                    Stream: <span className="text-fg-secondary">{currentStreamId}</span>
                  </span>
                )}
                {isSnapshotNode && snapshot?.timestamp && (
                  <span className="font-mono">
                    Captured: <span className="text-fg-secondary">{formatDbTimeOnly(snapshot.timestamp)}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-canvas border border-line-strong rounded text-fg-muted">ESC to close</kbd>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});
