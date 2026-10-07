import React, { useRef, useCallback, useState, useEffect } from 'react';
import { ReactFlow, Controls, Background, MiniMap, ReactFlowProvider } from '@xyflow/react';
import { MousePointer2, Hand, Play, ChevronRight, ChevronLeft, Plus, Activity, ChevronDown, Zap, RefreshCw, Check, AlertTriangle, Loader2, Download, Trash2, Terminal, Network, History, Wand2 } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import Sidebar from './Sidebar';
import DebugPanel from './DebugPanel';
import DebugWebSocket from './DebugWebSocket';
import usePipelineStore from '../../store/usePipelineStore';
import { useShallow } from 'zustand/react/shallow';
import ExportProjectModal from '../Home/ExportProjectModal';
import NodeSettingsSidebar from './NodeSettingsSidebar';
import NodeSuggestionMenu from './NodeSuggestionMenu';
import ProjectRevisionsModal from '../ProjectRevisionsModal';
import SnapshotPreviewFloatingWindow from './SnapshotPreviewFloatingWindow';

import { nodeTypes, edgeTypes, DEFAULT_NODE_NAMES } from './nodeTypes';
import { useResolvedTheme } from '../../utils/theme';

let id = 0;
const getId = () => `dndnode_${Date.now()}_${id++}`;

export default React.memo(function PipelineBuilder({ projectId, onOpenWiki }) {
  const reactFlowWrapper = useRef(null);
  const resolvedTheme = useResolvedTheme();
  const [reactFlowInstance, setReactFlowInstance] = React.useState(null);
  const [isSelectMode, setIsSelectMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [suggestionMenu, setSuggestionMenu] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  
  const { 
    nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, 
    setPipeline, setProjectId, showMetricsOverlay, toggleMetricsOverlay,
    advancedDebugMode, toggleAdvancedDebugMode,
    dirtyNodeIds, deployMode, setDeployMode, markAsDeployed,
    deleteNodes, deleteEdge, pipelineViewMode, setPipelineViewMode,
    syncCurrentPositions, autoSaveStatus,
    activeSidebarNodeId, setActiveSidebarNodeId, beautifyPipeline,
    checkProjectStatus, setIsProjectRunning, updateNodeData
  } = usePipelineStore(useShallow((state) => ({
    nodes: state.nodes,
    edges: state.edges,
    onNodesChange: state.onNodesChange,
    onEdgesChange: state.onEdgesChange,
    onConnect: state.onConnect,
    addNode: state.addNode,
    setPipeline: state.setPipeline,
    setProjectId: state.setProjectId,
    showMetricsOverlay: state.showMetricsOverlay,
    toggleMetricsOverlay: state.toggleMetricsOverlay,
    advancedDebugMode: state.advancedDebugMode,
    toggleAdvancedDebugMode: state.toggleAdvancedDebugMode,
    dirtyNodeIds: state.dirtyNodeIds,
    deployMode: state.deployMode,
    setDeployMode: state.setDeployMode,
    markAsDeployed: state.markAsDeployed,
    deleteNodes: state.deleteNodes,
    deleteEdge: state.deleteEdge,
    pipelineViewMode: state.pipelineViewMode,
    setPipelineViewMode: state.setPipelineViewMode,
    syncCurrentPositions: state.syncCurrentPositions,
    autoSaveStatus: state.autoSaveStatus,
    activeSidebarNodeId: state.activeSidebarNodeId,
    setActiveSidebarNodeId: state.setActiveSidebarNodeId,
    beautifyPipeline: state.beautifyPipeline,
    checkProjectStatus: state.checkProjectStatus,
    setIsProjectRunning: state.setIsProjectRunning,
    updateNodeData: state.updateNodeData,
  })));

  const isValidConnection = useCallback(
    (connection) => {
      // Allow all valid node connections; conflict nodes will show warning aura and banner
      return true;
    },
    []
  );

  const handleConnect = useCallback(
    (connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (sourceNode?.type === 'aiNode' && targetNode?.type === 'unitThroughputNode') {
        setToastMessage({
          type: 'error',
          text: '⚠️ คำเตือน: ต่อ AI Model เข้ากับ Unit Throughput โดยตรง (ระบบจะไม่นับจำนวน แนะนำให้ต่อผ่าน Flow Counter)'
        });
        setTimeout(() => setToastMessage(null), 5000);
      }

      onConnect(connection);
    },
    [nodes, onConnect]
  );

  React.useEffect(() => {
    if (!projectId) return;
    setProjectId(projectId);
    checkProjectStatus(projectId);
    // Fetch project data and initialize store
    fetch('/api/projects')
      .then(res => res.json())
      .then(projects => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
          setCurrentProject(project);
          if (project.pipeline) {
            setPipeline(project.pipeline.nodes || [], project.pipeline.edges || []);
          }
        } else {
          setPipeline([
            { id: 'start', type: 'inputNode', position: { x: 50, y: 150 }, data: { label: 'Camera Input' } }
          ], []);
        }
      });
  }, [projectId, setPipeline]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: DEFAULT_NODE_NAMES[type] || `${type} node` },
      };
      
      if (type === 'debugOutputNode') {
        newNode.style = { width: 320, height: 350 };
      }

      addNode(newNode);
    },
    [reactFlowInstance, addNode],
  );

  const handleConnectEnd = useCallback(
    (event, connectionState) => {
      if (!connectionState.isValid) {
        if (reactFlowInstance && reactFlowWrapper.current) {
          const { clientX, clientY } = ('touches' in event ? event.touches[0] : event);
          const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
          
          const menuPosition = {
            top: clientY - reactFlowBounds.top,
            left: clientX - reactFlowBounds.left,
          };
          
          const flowPosition = reactFlowInstance.screenToFlowPosition({
            x: clientX,
            y: clientY,
          });

          setSuggestionMenu({
            position: menuPosition,
            flowPosition,
            sourceNodeId: connectionState.fromNode?.id,
            sourceNodeType: connectionState.fromNode?.type,
            sourceHandleId: connectionState.fromHandle?.id,
            sourceHandleType: connectionState.fromHandle?.type,
          });
        }
      }
    },
    [reactFlowInstance]
  );

  const handleSuggestionSelect = useCallback((type) => {
    if (!suggestionMenu) return;

    const newNodeId = getId();
    const newNode = {
      id: newNodeId,
      type,
      position: suggestionMenu.flowPosition,
      data: { label: DEFAULT_NODE_NAMES[type] || `${type} node` },
    };

    if (type === 'debugOutputNode') {
      newNode.style = { width: 320, height: 350 };
    }

    addNode(newNode);

    if (suggestionMenu.sourceNodeId) {
      // Connect to the new node based on what handle we dragged from
      const isFromSource = suggestionMenu.sourceHandleType === 'source';
      handleConnect({
        source: isFromSource ? suggestionMenu.sourceNodeId : newNodeId,
        target: isFromSource ? newNodeId : suggestionMenu.sourceNodeId,
        sourceHandle: isFromSource ? suggestionMenu.sourceHandleId : null,
        targetHandle: isFromSource ? null : suggestionMenu.sourceHandleId,
      });
    }

    setSuggestionMenu(null);
  }, [suggestionMenu, addNode, handleConnect]);

  // Tap-to-add node handler for mobile & desktop
  const handleTapAddNode = useCallback(
    (type) => {
      let position = { x: 100, y: 100 };
      if (reactFlowInstance) {
        const container = reactFlowWrapper.current?.getBoundingClientRect();
        const centerX = container ? container.width / 2 : 200;
        const centerY = container ? container.height / 2 : 200;
        const jitterX = (Math.random() - 0.5) * 40;
        const jitterY = (Math.random() - 0.5) * 40;
        position = reactFlowInstance.screenToFlowPosition({
          x: (container?.left || 0) + centerX + jitterX,
          y: (container?.top || 0) + centerY + jitterY,
        });
      }

      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: DEFAULT_NODE_NAMES[type] || `${type} node` },
      };

      if (type === 'debugOutputNode') {
        newNode.style = { width: 320, height: 350 };
      }

      addNode(newNode);
      setIsMobilePaletteOpen(false);
    },
    [reactFlowInstance, addNode]
  );

  const [isDeploying, setIsDeploying] = useState(false);
  const [deployMenuOpen, setDeployMenuOpen] = useState(false);
  const [isRevisionsModalOpen, setIsRevisionsModalOpen] = useState(false);
  const deployMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deployMenuRef.current && !deployMenuRef.current.contains(e.target)) {
        setDeployMenuOpen(false);
      }
    };
    if (deployMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [deployMenuOpen]);

  const handleDeploy = async (overrideMode = null) => {
    if (dirtyNodeIds.length === 0 || isDeploying) return;
    const activeMode = overrideMode || deployMode || 'modified_nodes';
    setIsDeploying(true);
    setDeployMenuOpen(false);
    try {
      const payload = {
        project_id: projectId,
        nodes,
        edges,
        deploy_mode: activeMode
      };
      const response = await fetch(`http://${window.location.hostname}:8000/api/pipeline/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        markAsDeployed(nodes, edges);
        setIsProjectRunning(true);
        const modeLabel = 
          data.mode === 'none' ? 'Already up to date' :
          data.mode === 'router_only' ? '⚡ Logic Hot-Reloaded (0s downtime)' :
          data.mode === 'ai_params_only' ? '⚡ AI Params Hot-Updated (0s downtime)' :
          data.mode === 'hybrid_hot' ? '⚡ Logic & AI Hot-Reloaded (0s downtime)' :
          data.mode === 'flow_restart' ? '🔄 Flow Restarted' :
          '✅ Full Pipeline Deployed';
        setToastMessage({ type: 'success', text: modeLabel });
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setToastMessage({ type: 'error', text: data.message || 'Failed to deploy pipeline.' });
        setTimeout(() => setToastMessage(null), 7000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage({ type: 'error', text: 'Error connecting to backend.' });
      setTimeout(() => setToastMessage(null), 7000);
    } finally {
      setIsDeploying(false);
    }
  };

  const clipboardRef = useRef({ nodes: [], edges: [] });

  // Handle keyboard shortcuts (Delete / Backspace, v, h, copy, paste, cut)
  useEffect(() => {
    const handleKeyDown = (event) => {
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        activeEl?.isContentEditable ||
        activeEl?.closest('.nodrag')
      ) {
        return;
      }

      if (event.key === 'Escape') {
        setSuggestionMenu(null);
        setActiveSidebarNodeId(null);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = nodes.filter(n => n.selected && !n.data?.isTutorialMock);
        const selectedEdges = edges.filter(e => e.selected && !e.data?.isTutorialMock);

        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          event.preventDefault();
          if (selectedNodes.length > 0) {
            deleteNodes(selectedNodes.map(n => n.id));
          }
          if (selectedEdges.length > 0) {
            selectedEdges.forEach(e => deleteEdge(e.id));
          }
        }
      } else if ((event.key === 'c' || event.key === 'C') && (event.metaKey || event.ctrlKey)) {
        const selectedNodes = nodes.filter(n => n.selected && !n.data?.isTutorialMock);
        const selectedEdges = edges.filter(e => e.selected && !e.data?.isTutorialMock);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          clipboardRef.current = { 
            nodes: selectedNodes.map(n => ({ ...n })),
            edges: selectedEdges.map(e => ({ ...e }))
          };
        }
      } else if ((event.key === 'x' || event.key === 'X') && (event.metaKey || event.ctrlKey)) {
        const selectedNodes = nodes.filter(n => n.selected && !n.data?.isTutorialMock);
        const selectedEdges = edges.filter(e => e.selected && !e.data?.isTutorialMock);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          clipboardRef.current = { 
            nodes: selectedNodes.map(n => ({ ...n })),
            edges: selectedEdges.map(e => ({ ...e }))
          };
          deleteNodes(selectedNodes.map(n => n.id));
        }
      } else if (event.key === 'v' || event.key === 'V') {
        if (event.metaKey || event.ctrlKey) {
          if (clipboardRef.current.nodes.length > 0) {
            event.preventDefault();
            
            onNodesChange(nodes.filter(n => n.selected).map(n => ({ id: n.id, type: 'select', selected: false })));
            
            const idMap = {};
            const newNodes = clipboardRef.current.nodes.map(n => {
              const newId = getId();
              idMap[n.id] = newId;
              return {
                ...n,
                id: newId,
                position: { x: n.position.x + 30, y: n.position.y + 30 },
                selected: true,
              };
            });
            
            newNodes.forEach(n => addNode(n));
            
            if (clipboardRef.current.edges) {
              clipboardRef.current.edges.forEach(e => {
                if (idMap[e.source] && idMap[e.target]) {
                  onConnect({
                    source: idMap[e.source],
                    target: idMap[e.target],
                    sourceHandle: e.sourceHandle,
                    targetHandle: e.targetHandle
                  });
                }
              });
            }
            
            clipboardRef.current.nodes = clipboardRef.current.nodes.map(n => ({
              ...n,
              position: { x: n.position.x + 30, y: n.position.y + 30 }
            }));
          }
        } else {
          setIsSelectMode(true);
        }
      } else if (event.key === 'h' || event.key === 'H') {
        if (!event.metaKey && !event.ctrlKey) {
          setIsSelectMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, deleteNodes, deleteEdge, onNodesChange, addNode, onConnect]);

  const selectedNodesCount = React.useMemo(() => {
    return nodes.filter(n => n.selected && !n.data?.isTutorialMock).length;
  }, [nodes]);

  const activeSidebarNode = React.useMemo(() => {
    return nodes.find(n => n.id === activeSidebarNodeId && !n.data?.isTutorialMock);
  }, [nodes, activeSidebarNodeId]);

  const handleNodeClick = useCallback((event, node) => {
    // Single click only selects the node.
    // If clicking on a different node, close sidebar if open.
    if (activeSidebarNodeId && activeSidebarNodeId !== node.id) {
      setActiveSidebarNodeId(null);
    }
  }, [activeSidebarNodeId]);

  const handleNodeDoubleClick = useCallback((event, node) => {
    event?.stopPropagation?.();
    if (node.data?.isTutorialMock) return;
    
    // In inline mode, do NOT open the sidebar (settings are directly on the canvas node)
    if (pipelineViewMode === 'compact') {
      if (node.type === 'debugNode') {
        setIsDebugPanelOpen(true);
        setActiveSidebarNodeId(null);
      } else {
        setActiveSidebarNodeId(node.id);
      }
    } else if (node.type === 'debugNode') {
      setIsDebugPanelOpen(true);
    }

    // Ensure the double-clicked node is exclusively selected
    onNodesChange(
      nodes.map(n => ({
        id: n.id,
        type: 'select',
        selected: n.id === node.id
      }))
    );
  }, [nodes, onNodesChange, pipelineViewMode]);

  // Auto-close sidebar if active node was deleted or removed
  useEffect(() => {
    if (activeSidebarNodeId && !nodes.some(n => n.id === activeSidebarNodeId)) {
      setActiveSidebarNodeId(null);
    }
  }, [nodes, activeSidebarNodeId]);

  // Reset active sidebar on project or view mode change
  useEffect(() => {
    setActiveSidebarNodeId(null);
  }, [projectId, pipelineViewMode]);

  // Close sidebar if multi-selection occurs
  useEffect(() => {
    if (selectedNodesCount > 1 && activeSidebarNodeId) {
      setActiveSidebarNodeId(null);
    }
  }, [selectedNodesCount, activeSidebarNodeId]);

  const isNodeInvalid = useCallback((node) => {
    if (!node || !node.data) return false;
    const { type, data } = node;
    if (data.isTutorialMock) return false;
    
    switch (type) {
      case 'inputNode':
      case 'aiNode':
        return !data.entityId && !data.sourcePath;
      case 'actionNode':
      case 'dashboardMetricNode':
      case 'dashboardTextNode':
      case 'dashboardChartNode':
        return !data.sourcePath && !data.entityId;
      case 'logicNode':
        return (!data.expression || !data.expression.trim()) && !data.rule && !data.condition;
      case 'shelfSlotMonitorNode':
        return !data.slots || data.slots.length === 0;
      case 'forkliftZoneNode':
        return !data.zones || data.zones.length === 0;
      case 'unitThroughputNode': {
        const incomingEdge = edges.find((e) => e.target === node.id);
        if (incomingEdge) {
          const src = nodes.find((n) => n.id === incomingEdge.source);
          if (src?.type === 'aiNode') return true;
        }
        return false;
      }
      case 'rateLimitNode':
        return !data.interval;
      default:
        return false; // Assume valid by default
    }
  }, [nodes, edges]);

  const styledNodes = React.useMemo(() => {
    return nodes.reduce((acc, node) => {
      if (node.data?.isTutorialMock) return acc;
      
      const isDirty = dirtyNodeIds.includes(node.id);
      const isInvalid = isNodeInvalid(node);
      const isDisabled = node.data?.disabled;
      
      let baseClassName = node.className || '';
      baseClassName = baseClassName.replace('node-disabled', '').replace('node-dirty', '').replace('node-invalid', '').trim();
      // Only keep a single space between classes
      baseClassName = baseClassName.replace(/\s+/g, ' ');
      
      const targetClassName = `${baseClassName} ${isDisabled ? 'node-disabled' : ''} ${isDirty ? 'node-dirty' : ''} ${isInvalid ? 'node-invalid' : ''}`.trim().replace(/\s+/g, ' ');
      
      // Prevent creating a new node object if nothing has actually changed
      if (node.className === targetClassName && node.data?.viewMode === pipelineViewMode && node.data?.isDirty === isDirty && node.data?.isInvalid === isInvalid) {
        acc.push(node);
      } else {
        acc.push({ 
          ...node, 
          className: targetClassName, 
          data: { ...node.data, viewMode: pipelineViewMode, isDirty, isInvalid } 
        });
      }
      return acc;
    }, []);
  }, [nodes, edges, dirtyNodeIds, pipelineViewMode, isNodeInvalid]);

  const mainEdges = React.useMemo(() => {
    return edges
      .filter((edge) => !edge.data?.isTutorialMock)
      .map((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (sourceNode?.type === 'aiNode' && targetNode?.type === 'unitThroughputNode') {
          return {
            ...edge,
            animated: true,
            className: `${edge.className || ''} conflict-edge`,
            style: {
              ...edge.style,
              stroke: '#ef4444',
              strokeWidth: 3.5,
              filter: 'drop-shadow(0 0 6px #ef4444) drop-shadow(0 0 14px rgba(239, 68, 68, 0.8))',
              strokeDasharray: '6,6',
            },
          };
        }
        return edge;
      });
  }, [edges, nodes]);

  const conflictConnections = React.useMemo(() => {
    return edges.filter((edge) => {
      const src = nodes.find((n) => n.id === edge.source);
      const tgt = nodes.find((n) => n.id === edge.target);
      return src?.type === 'aiNode' && tgt?.type === 'unitThroughputNode';
    });
  }, [edges, nodes]);

  return (
    <div className="flex h-full bg-canvas rounded-xl overflow-hidden border border-line shadow-2xl animate-in fade-in duration-500 relative">
      <ReactFlowProvider>
        {/* Desktop Collapsible Sidebar Container (Moved to Left) */}
        <div className={`hidden md:flex transition-all duration-300 ease-in-out overflow-hidden shrink-0 border-r border-line ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
          <div className="w-64 shrink-0 flex h-full">
            <Sidebar onOpenWiki={onOpenWiki} onAddNode={handleTapAddNode} />
          </div>
        </div>

        <div className="flex-grow relative" ref={reactFlowWrapper}>
          
          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200 border ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-500 text-emerald-800 dark:text-emerald-200 shadow-emerald-950/50'
                : 'bg-rose-50 dark:bg-rose-950/90 border-rose-500 text-rose-800 dark:text-rose-200 shadow-rose-950/50'
            }`}>
              {toastMessage.type === 'success' ? <Check size={16} className="text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />}
              <span>{toastMessage.text}</span>
            </div>
          )}

          {/* Mobile Floating "Add Node" Trigger Button */}
          <button
            onClick={() => setIsMobilePaletteOpen(true)}
            className="md:hidden absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-xl active:scale-95 transition-all"
          >
            <Plus size={16} />
            <span>Add Node</span>
          </button>

          {/* Floating Dock (Controls) */}
          <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 sm:gap-3 bg-surface/90 p-1.5 sm:p-2 rounded-2xl backdrop-blur-md border border-line-strong shadow-2xl max-w-[95vw]">
            <div className="bg-surface-2 border border-line-strong p-1 rounded-xl flex shadow-inner">
              <button 
                onClick={() => setIsSelectMode(false)}
                className={`p-1.5 sm:p-2 rounded-lg transition-all ${!isSelectMode ? 'bg-surface-3 text-fg shadow' : 'text-fg-muted hover:text-fg'}`}
                title="Pan Tool (Hand)"
              >
                <Hand size={18} className="sm:w-5 sm:h-5" />
              </button>
              <button 
                onClick={() => setIsSelectMode(true)}
                className={`p-1.5 sm:p-2 rounded-lg transition-all ${isSelectMode ? 'bg-blue-600 text-white shadow' : 'text-fg-muted hover:text-fg'}`}
                title="Select Tool (Cursor)"
              >
                <MousePointer2 size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="w-px h-6 sm:h-8 bg-surface-3"></div>

            {/* View Mode Toggle */}
            <div className="bg-surface-2 border border-line-strong p-1 rounded-xl flex shadow-inner">
              <button 
                onClick={() => {
                  setPipelineViewMode('inline');
                  setActiveSidebarNodeId(null);
                }}
                className={`p-1.5 sm:p-2 rounded-lg transition-all text-xs font-semibold flex items-center gap-1 ${pipelineViewMode === 'inline' ? 'bg-surface-3 text-fg shadow' : 'text-fg-muted hover:text-fg'}`}
                title="Inline View: Show settings on the nodes"
              >
                <span className="hidden md:inline">Inline</span>
              </button>
              <button 
                onClick={() => setPipelineViewMode('compact')}
                className={`p-1.5 sm:p-2 rounded-lg transition-all text-xs font-semibold flex items-center gap-1 ${pipelineViewMode === 'compact' ? 'bg-surface-3 text-fg shadow' : 'text-fg-muted hover:text-fg'}`}
                title="Compact View: Settings in sidebar"
              >
                <span className="hidden md:inline">Sidebar</span>
              </button>
            </div>

            {/* Layout Auto-Save Indicator */}
            {autoSaveStatus !== 'idle' && (
              <div 
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-surface-2/80 border border-line-strong/80 animate-in fade-in zoom-in-95 duration-150"
                title={autoSaveStatus === 'saving' ? 'Auto-saving node layout...' : 'Layout saved to device'}
              >
                {autoSaveStatus === 'saving' ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-blue-600 dark:text-blue-400" />
                    <span className="hidden xl:inline font-medium text-fg-muted">Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden xl:inline text-emerald-600 dark:text-emerald-400 font-medium">Saved</span>
                  </>
                )}
              </div>
            )}

            <div className="w-px h-6 sm:h-8 bg-surface-3"></div>

            {/* Toggle Live Telemetry Overlay */}
            <button
              onClick={toggleMetricsOverlay}
              className={`p-1.5 sm:p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all ${
                showMetricsOverlay 
                  ? 'bg-purple-50 dark:bg-purple-950/80 border border-purple-600 text-purple-700 dark:text-purple-300 shadow-md shadow-purple-950/40' 
                  : 'bg-surface-2 border border-line-strong text-fg-muted hover:text-fg'
              }`}
              title="Toggle Live CPU & NPU Performance Overlay on Nodes"
            >
              <Activity size={16} className={showMetricsOverlay ? 'text-purple-600 dark:text-purple-400 animate-pulse' : ''} />
              <span className="hidden md:inline">Telemetry</span>
            </button>

            {/* Toggle Advanced Debug Mode */}
            <button
              onClick={toggleAdvancedDebugMode}
              className={`p-1.5 sm:p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all ${
                advancedDebugMode 
                  ? 'bg-blue-50 dark:bg-blue-950/80 border border-blue-600 text-blue-700 dark:text-blue-300 shadow-md shadow-blue-950/40' 
                  : 'bg-surface-2 border border-line-strong text-fg-muted hover:text-fg'
              }`}
              title="Toggle Advanced Debug Mode (Show payloads on edges)"
            >
              <Terminal size={16} className={advancedDebugMode ? 'text-blue-600 dark:text-blue-400' : ''} />
              <span className="hidden md:inline">Debug Flow</span>
            </button>

            {/* Auto-Layout (Beautify) */}
            <button
              onClick={beautifyPipeline}
              className="p-1.5 sm:p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold bg-surface-2 border border-line-strong hover:text-fg hover:bg-surface-3 transition-all active:scale-95 text-fg-secondary"
              title="Auto-Layout Nodes (Beautify)"
            >
              <Wand2 size={16} className="text-fuchsia-600 dark:text-fuchsia-400" />
              <span className="hidden md:inline">Beautify</span>
            </button>

            {/* Export Project Quick Action */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold bg-surface-2 border border-line-strong hover:text-fg hover:bg-surface-3 transition-all active:scale-95 text-fg-secondary"
              title="Export / Backup this Project"
            >
              <Download size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="hidden md:inline">Export</span>
            </button>

            {/* Revisions / History Button */}
            <button
              onClick={() => setIsRevisionsModalOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold bg-surface-2 border border-line-strong hover:text-fg hover:bg-surface-3 transition-all active:scale-95 text-fg-secondary"
              title="Version History / Restore"
            >
              <History size={16} className="text-amber-700 dark:text-amber-400" />
              <span className="hidden md:inline">History</span>
            </button>

            <div className="w-px h-6 sm:h-8 bg-surface-3"></div>

            {/* Split Deploy Button (Node-RED Style) */}
            <div className="relative flex items-stretch" ref={deployMenuRef}>
              <button 
                onClick={() => handleDeploy()}
                disabled={isDeploying || dirtyNodeIds.length === 0}
                className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-l-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shadow-lg ${
                  dirtyNodeIds.length > 0 && !isDeploying
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-fg-subtle shadow-green-900/50 active:scale-95 cursor-pointer'
                    : 'bg-surface-2/80 text-fg-subtle border-y border-l border-line-strong/60 cursor-not-allowed opacity-50 shadow-none'
                }`}
                title={
                  dirtyNodeIds.length === 0
                    ? 'No modified nodes to deploy'
                    : `Deploy: ${deployMode === 'modified_nodes' ? 'Modified Nodes (Hot Reload)' : deployMode === 'modified_flows' ? 'Modified Flows' : 'Full Restart'}`
                }
              >
                {isDeploying ? (
                  <Loader2 size={16} className="animate-spin text-fg" />
                ) : deployMode === 'modified_nodes' ? (
                  <Zap size={16} className={dirtyNodeIds.length > 0 ? "fill-current text-fg" : "text-fg-subtle"} />
                ) : deployMode === 'modified_flows' ? (
                  <RefreshCw size={16} className={dirtyNodeIds.length > 0 ? "text-amber-700 dark:text-amber-400" : "text-fg-subtle"} />
                ) : (
                  <Play size={16} fill="currentColor" className={dirtyNodeIds.length > 0 ? "" : "text-fg-subtle"} />
                )}
                <span>
                  {isDeploying ? 'Deploying...' : dirtyNodeIds.length > 0 ? `Deploy (${dirtyNodeIds.length})` : 'Deploy'}
                </span>
              </button>

              {/* Dropdown Menu Arrow */}
              <button
                onClick={() => setDeployMenuOpen(prev => !prev)}
                disabled={isDeploying || dirtyNodeIds.length === 0}
                className={`px-2 py-2 sm:py-2.5 rounded-r-xl border-l transition-all ${
                  dirtyNodeIds.length > 0 && !isDeploying
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700/50 cursor-pointer'
                    : 'bg-surface-2/80 text-fg-subtle border-t border-b border-r border-l border-line-strong/60 cursor-not-allowed opacity-50 shadow-none'
                }`}
                title={dirtyNodeIds.length === 0 ? "No modified nodes to deploy" : "Choose Deploy Mode (Node-RED Style)"}
              >
                <ChevronDown size={14} className={`transition-transform duration-200 ${deployMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Popup */}
              {deployMenuOpen && dirtyNodeIds.length > 0 && (
                <div 
                  className="absolute bottom-full mb-2 right-0 w-72 bg-surface border border-line-strong rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border-b border-line mb-1 text-fg-muted">
                    Deploy Options
                  </div>

                  {/* Option 1: Modified Nodes */}
                  <button
                    onClick={() => {
                      setDeployMode('modified_nodes');
                      handleDeploy('modified_nodes');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-2.5 transition-all ${
                      deployMode === 'modified_nodes' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-600/50 text-fg' 
                        : 'hover:bg-surface-2 text-fg-secondary'
                    }`}
                  >
                    <Zap size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div className="flex-grow min-w-0">
                      <div className="text-xs font-semibold flex items-center justify-between">
                        <span>Modified Nodes</span>
                        {deployMode === 'modified_nodes' && <Check size={14} className="text-emerald-600 dark:text-emerald-400" />}
                      </div>
                      <div className="text-[11px] leading-tight mt-0.5 text-fg-muted">
                        Hot-reload changed logic & AI params (Zero video downtime)
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Modified Flows */}
                  <button
                    onClick={() => {
                      setDeployMode('modified_flows');
                      handleDeploy('modified_flows');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-2.5 transition-all mt-1 ${
                      deployMode === 'modified_flows' 
                        ? 'bg-amber-50 dark:bg-amber-950/70 border border-amber-600/50 text-fg' 
                        : 'hover:bg-surface-2 text-fg-secondary'
                    }`}
                  >
                    <RefreshCw size={16} className="text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="flex-grow min-w-0">
                      <div className="text-xs font-semibold flex items-center justify-between">
                        <span>Modified Flows</span>
                        {deployMode === 'modified_flows' && <Check size={14} className="text-amber-700 dark:text-amber-400" />}
                      </div>
                      <div className="text-[11px] leading-tight mt-0.5 text-fg-muted">
                        Restart only changed camera stream flows
                      </div>
                    </div>
                  </button>

                  {/* Option 3: Full Deploy */}
                  <button
                    onClick={() => {
                      setDeployMode('full');
                      handleDeploy('full');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-2.5 transition-all mt-1 ${
                      deployMode === 'full' 
                        ? 'bg-rose-50 dark:bg-rose-950/70 border border-rose-600/50 text-fg' 
                        : 'hover:bg-surface-2 text-fg-secondary'
                    }`}
                  >
                    <Play size={16} className="text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                    <div className="flex-grow min-w-0">
                      <div className="text-xs font-semibold flex items-center justify-between">
                        <span>Full Deploy</span>
                        {deployMode === 'full' && <Check size={14} className="text-rose-600 dark:text-rose-400" />}
                      </div>
                      <div className="text-[11px] leading-tight mt-0.5 text-fg-muted">
                        Full restart of GStreamer & NPU engines
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Floating multi-node selection pill with quick delete */}
          {selectedNodesCount > 1 && (
            <div className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-surface/95 border border-blue-500/70 text-blue-800 dark:text-blue-200 px-3.5 py-1.5 rounded-full text-xs font-medium shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0"></span>
              <span><strong>{selectedNodesCount}</strong> nodes selected</span>
              <span className="text-fg-faint">•</span>
              <button
                onClick={() => {
                  const selectedIds = nodes.filter(n => n.selected && !n.data?.isTutorialMock).map(n => n.id);
                  deleteNodes(selectedIds);
                }}
                className="flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold cursor-pointer transition-colors hover:underline"
                title="Delete selected nodes (Delete / Backspace)"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            </div>
          )}

          <ReactFlow
            colorMode={resolvedTheme}
            nodes={styledNodes}
            edges={mainEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={() => syncCurrentPositions()}
            onSelectionDragStop={() => syncCurrentPositions()}
            isValidConnection={isValidConnection}
            onConnect={handleConnect}
            onConnectEnd={handleConnectEnd}
            onPaneClick={() => {
              setSuggestionMenu(null);
              setActiveSidebarNodeId(null);
            }}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            zoomOnDoubleClick={false}
            onNodesDelete={(deleted) => {
              deleteNodes(deleted.map(n => n.id));
            }}
            onEdgesDelete={(deleted) => {
              deleted.forEach(e => deleteEdge(e.id));
            }}
            deleteKeyCode={['Backspace', 'Delete']}
            selectionKeyCode={['Shift']}
            multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
            panOnDrag={isSelectMode ? [1, 2] : true}
            panActivationKeyCode="Space"
            selectionOnDrag={isSelectMode}
            selectionMode="partial"
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onlyRenderVisibleElements={false}
            fitView
            minZoom={0.05}
            className="bg-surface"
          >
            <Background color="var(--line-strong)" gap={16} />
            <Controls className="bg-surface-2 border-line-strong fill-fg text-fg" />
            <MiniMap 
              nodeColor="#3b82f6" 
              maskColor="color-mix(in srgb, var(--canvas) 70%, transparent)"
              className="hidden sm:block bg-surface-2 border-line-strong" 
            />
          </ReactFlow>
          
          {suggestionMenu && (
            <NodeSuggestionMenu
              position={suggestionMenu.position}
              sourceNodeType={suggestionMenu.sourceNodeType}
              sourceHandleType={suggestionMenu.sourceHandleType}
              onSelect={handleSuggestionSelect}
              onClose={() => setSuggestionMenu(null)}
            />
          )}

          <DebugWebSocket />

          {/* Conflict Nodes Floating Warning Banner (Bottom-Right of Canvas) */}
          {conflictConnections.length > 0 && (
            <div className="absolute bottom-4 right-4 sm:bottom-32 sm:right-4 z-40 max-w-xs sm:max-w-sm bg-rose-950/90 text-rose-100 border border-rose-500/80 rounded-xl p-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-auto">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 shrink-0 mt-0.5 animate-pulse">
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1 flex flex-col gap-1 text-xs">
                  <div className="font-bold text-rose-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>ตรวจพบ Node Conflict</span>
                      <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-800/80 font-mono text-rose-200">
                      {conflictConnections.length} จุด
                    </span>
                  </div>
                  <p className="text-rose-300/90 text-[11px] leading-relaxed">
                    AI Model เชื่อมต่อกับ Unit Throughput โดยตรง — Unit Throughput จะไม่นับชิ้นงาน (กรุณาต่อผ่าน Flow Counter เพื่อขีดเส้นนับ)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Realtime Floating Photo Preview Windows for Snapshot Nodes */}
          {nodes
            .filter((n) => n.type === 'snapshotNode' && (n.data?.showPreviewWindow === true || n.data?.showPreviewWindow === 'true'))
            .map((node, index) => (
              <SnapshotPreviewFloatingWindow
                key={node.id}
                nodeId={node.id}
                nodeData={node.data}
                defaultOffsetIndex={index}
                onClose={() => updateNodeData(node.id, { showPreviewWindow: false })}
              />
            ))}
          
          {/* Desktop Sidebar Toggle Button (Moved to Left) */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden md:flex absolute top-4 left-4 z-20 bg-surface-2 border border-line-strong p-2 rounded-full shadow-lg hover:bg-surface-3 transition-colors text-fg"
            title="Toggle Node Palette"
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <Network size={20} />}
          </button>

          {/* Desktop Debug Panel Toggle Button */}
          <button
            onClick={() => setIsDebugPanelOpen(!isDebugPanelOpen)}
            className="hidden md:flex absolute top-4 right-4 z-20 bg-surface-2 border border-line-strong p-2 rounded-full shadow-lg hover:bg-surface-3 transition-colors text-fg"
            title="Toggle Debug Panel"
          >
            {isDebugPanelOpen ? <ChevronRight size={20} /> : <Terminal size={20} className={nodes.some(n => n.type === 'debugNode' && n.data?.outputType === 'text') ? 'text-purple-600 dark:text-purple-400' : ''} />}
          </button>
        </div>
        
        {/* Node Settings Sidebar */}
        <NodeSettingsSidebar 
          selectedNodeId={activeSidebarNodeId} 
          isOpen={!!activeSidebarNode && selectedNodesCount <= 1}
          onClose={() => {
            setActiveSidebarNodeId(null);
          }} 
        />

        {/* Debug Panel Container (Right) */}
        <DebugPanel isOpen={isDebugPanelOpen} onClose={() => setIsDebugPanelOpen(false)} />

        {/* Mobile Node Palette Slide-in Drawer */}
        {isMobilePaletteOpen && (
          <div 
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobilePaletteOpen(false)}
          >
            <div 
              className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-surface shadow-2xl flex flex-col animate-in slide-in-from-left duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar 
                onOpenWiki={onOpenWiki} 
                onAddNode={handleTapAddNode} 
                onCloseMobile={() => setIsMobilePaletteOpen(false)} 
              />
            </div>
          </div>
        )}
        <ExportProjectModal 
          project={currentProject}
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
        />
        {/* Project Revisions / History Modal */}
        <ProjectRevisionsModal
          isOpen={isRevisionsModalOpen}
          onClose={() => setIsRevisionsModalOpen(false)}
          projectId={currentProject?.id}
          onRestoreSuccess={() => window.location.reload()}
        />
      </ReactFlowProvider>
    </div>
  );
});
