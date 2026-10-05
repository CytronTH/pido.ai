import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Handle, Position, useHandleConnections, useNodesData, useReactFlow } from '@xyflow/react';
import { Bug, Pause, Play, Code, MonitorPlay, ShieldAlert, AlertTriangle, AlertOctagon, RefreshCw, Film } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
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
  const debugData = usePipelineStore((state) => state.debugData || {});
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
      whepUrl = `http://${window.location.hostname}:8889/${activeProjectId}_${currentStreamId}/whep`;
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
        whepUrl = `http://${window.location.hostname}:8889/${activeProjectId}_${currentStreamId}/whep`;
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

  const [isEos, setIsEos] = useState(false);
  const hasConnectedOnceRef = useRef(false);

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
  useEffect(() => {
    if (isNonLoop && debugData) {
      if (currentStreamId && debugData[currentStreamId]?.eos) {
        setIsEos(true);
      } else if (inputNode && (debugData[inputNode.id]?.eos || (inputNode.data?.entityId && debugData[inputNode.data.entityId]?.eos))) {
        setIsEos(true);
      }
    }
  }, [debugData, currentStreamId, inputNode, isNonLoop]);

  const { status, reconnect } = useWhepStream(activeWhepUrl, videoRef, { disableAutoReconnect: isNonLoop });
  const [resolution, setResolution] = useState(null);

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
  const latestDataRef = useRef(null);

  useEffect(() => {
    if (debugData && currentStreamId && isStreamActive && !isWaitingForDeploy && !isVideoEnd) {
      latestDataRef.current = debugData[currentStreamId];
    }
  }, [debugData, currentStreamId, isStreamActive, isWaitingForDeploy, isVideoEnd]);

  useEffect(() => {
    if (!isStreamActive || isWaitingForDeploy || isVideoEnd) {
      latestDataRef.current = null;
      lastBoxesRef.current = { items: [], time: 0 };
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (isWaitingForDeploy || isVideoEnd) return;
      const payload = latestDataRef.current;
      
      if (shouldDrawBoxes && (currentStreamId || isForkliftNode)) {
        const W = canvas.width, H = canvas.height;

        // 1. Draw Polygon Danger Zones for Forklift Safety Monitor
        if (isForkliftNode) {
          const forkliftDebug = debugData[sourceNode.id];
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
            ctx.lineWidth = isAlert ? 3 : 1.5;
            if (zone.type === 'caution') {
              ctx.setLineDash([6, 4]);
            } else {
              ctx.setLineDash([]);
            }
            ctx.stroke();

            // Zone label tag
            const cx = (poly.reduce((a, p) => a + p.x, 0) / poly.length) * W;
            const cy = (poly.reduce((a, p) => a + p.y, 0) / poly.length) * H;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            const countTag = zone.forklift_count !== undefined ? ` (${zone.forklift_count})` : '';
            const tag = `${zone.name || 'Zone'}${countTag} [${isAlert ? 'ALERT' : 'CLEAR'}]`;
            const tw = ctx.measureText(tag).width + 8;
            ctx.fillRect(cx - tw / 2, cy - 8, tw, 16);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - tw / 2, cy - 8, tw, 16);

            ctx.fillStyle = isAlert ? '#fca5a5' : '#ffffff';
            ctx.fillText(tag, cx, cy + 4);
            ctx.restore();
          });
        }

        if (payload?.roi) {
          const { x, y, w, h } = payload.roi;
          ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.strokeRect(x * W, y * H, w * W, h * H);
          ctx.setLineDash([]);
        }

        let items = payload?.data || payload?.detections || [];
        const now = Date.now();
        
        if (items.length > 0) {
          lastBoxesRef.current = { items, time: now };
        } else {
          if (now - lastBoxesRef.current.time < 300) {
            items = lastBoxesRef.current.items;
          } else {
            lastBoxesRef.current = { items: [], time: now };
          }
        }

        const taskType = payload?.type || "detection";
        const drawMode = payload?.bbox_draw_mode || "frontend";

        if (taskType === "detection") {
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
              ctx.lineWidth = 2;
              ctx.strokeRect(x, y, width, height);

              const lbl = `${det.label} ${(det.confidence ? Math.round(det.confidence * 100) + '%' : '')}`;
              ctx.fillStyle = boxColor;
              ctx.fillRect(x, y - 14, ctx.measureText(lbl).width + 8, 14);
              ctx.fillStyle = '#000';
              ctx.font = 'bold 10px sans-serif';
              ctx.fillText(lbl, x + 4, y - 3);

              // Draw Ground-Contact Anchor Point on floor for Forklift Safety Monitor
              if (isForkliftNode) {
                const anchorX = ((xmin + xmax) / 2) * W;
                const anchorY = ymax * H;
                ctx.beginPath();
                ctx.arc(anchorX, anchorY, 4.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#10b981';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
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
            ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 2;
            SKEL.forEach(([i, j]) => {
              if (pts[i] && pts[j] && pts[i].c > 0.1 && pts[j].c > 0.1) {
                ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
              }
            });
            ctx.fillStyle = '#FF00FF';
            pts.forEach((pt) => { if (pt.c > 0.1) { ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, 2*Math.PI); ctx.fill(); } });
          });
        }

        // Draw Live Hazard HUD Banner on video top
        if (isForkliftNode) {
          const forkliftDebug = debugData[sourceNode.id];
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

          ctx.fillStyle = bannerBg;
          ctx.fillRect(0, 0, W, 22);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(bannerText, 8, 15);

          if (forkliftDebug?.near_miss_count > 0) {
            ctx.textAlign = 'right';
            ctx.fillText(`Near-Miss: ${forkliftDebug.near_miss_count}`, W - 8, 15);
          }
          ctx.restore();
        }
      }
      
      // Draw FPS if available (only for AI nodes)
      const currentMeta = latestDataRef.current;
      if (shouldDrawBoxes && currentMeta && currentMeta.fps !== undefined) {
        const fpsStr = `AI FPS: ${currentMeta.fps}`;
        let fpsColor = '#22c55e'; // green
        if (currentMeta.fps < 10) fpsColor = '#ef4444'; // red
        else if (currentMeta.fps < 20) fpsColor = '#eab308'; // yellow
        
        ctx.font = 'bold 10px monospace';
        const tw = ctx.measureText(fpsStr).width + 8;
        const cw = canvas.width;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cw - tw - 6, 4, tw, 16);
        ctx.fillStyle = fpsColor;
        ctx.fillText(fpsStr, cw - tw - 2, 16);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [shouldDrawBoxes, currentStreamId]);

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
          </>
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
    const state = debugData[sourceNode.id];
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
    const debugState = debugData[sourceNode.id];
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
    const debugState = debugData[sourceNode.id];
    const val = debugState?.value ?? 0;
    content = (
      <div className="flex flex-col items-center justify-center p-3 gap-1 bg-surface/50 min-w-[160px]">
        <span className="text-xs text-fg-muted">Event Counter</span>
        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{val}</span>
      </div>
    );
  } else if (isForkliftNode) {
    const debugState = debugData[sourceNode.id];
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
        
        {/* BIG PAUSE BUTTON (Only for non-video modes) */}
        {!hasVideoPreview && (
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
    </div>
  );
});
