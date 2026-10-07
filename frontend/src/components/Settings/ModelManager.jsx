import React, { useState, useMemo } from 'react';
import { 
  BrainCircuit, LayoutGrid, List, Search, Plus, Cpu, 
  ShieldCheck, Trash2, FileCode, Tag, Upload, Copy, Check,
  Activity, Layers, Scan, Play, Pause, AlertTriangle
} from 'lucide-react';
import ModelUploadModal from './ModelUploadModal';

export default function ModelManager({ 
  models = [], 
  onSaveEntities, 
  soFiles = [], 
  onRefreshEntities,
  projects = [],
  activeProjects = {}
}) {
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('pido_model_view_mode') || 'block';
  });
  const [filterTask, setFilterTask] = useState('all'); // 'all', 'detection', 'pose', 'segmentation', 'classification'
  const [filterUsage, setFilterUsage] = useState('all'); // 'all', 'running', 'assigned', 'unassigned'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals & Copy
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [copiedHashId, setCopiedHashId] = useState(null);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('pido_model_view_mode', mode);
  };

  const handleCopyHash = (id, hash) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // ── Calculate Pipeline & Node Usages for each Model ────────────────────────
  // Checks nodes inside both `proj.pipeline.nodes` and `proj.nodes`
  const modelUsageMap = useMemo(() => {
    const map = {};
    projects.forEach((proj) => {
      // Determine if project is currently running:
      const isProjectRunning = Boolean(
        (activeProjects && activeProjects[proj.id]) || proj.is_running
      );

      // In vision studio, nodes are stored inside proj.pipeline.nodes
      const nodes = proj.pipeline?.nodes || proj.nodes || [];

      nodes.forEach((node) => {
        if (node.type === 'aiNode' && node.data?.entityId) {
          const modelId = node.data.entityId;
          if (!map[modelId]) map[modelId] = [];
          map[modelId].push({
            projectId: proj.id,
            projectName: proj.name || 'Untitled Pipeline',
            nodeId: node.id,
            nodeLabel: node.data?.label || node.data?.name || 'AI Model Node',
            isProjectRunning
          });
        }
      });
    });
    return map;
  }, [projects, activeProjects]);

  // ── Update & Delete Handlers ───────────────────────────────────────────────
  const handleUpdate = (id, field, value) => {
    const updated = models.map(m => m.id === id ? { ...m, [field]: value } : m);
    onSaveEntities(updated);
  };

  const handleDelete = (id, name) => {
    const usages = modelUsageMap[id] || [];
    let warning = `Delete model '${name}'?`;
    if (usages.length > 0) {
      warning = `⚠️ Warning: Model '${name}' is currently used in ${usages.length} pipeline node(s):\n` +
        usages.map(u => `• ${u.projectName} › ${u.nodeLabel} (${u.isProjectRunning ? 'Running' : 'Idle'})`).join('\n') +
        `\n\nDeleting this model will cause pipelines using it to fail. Are you sure?`;
    }
    if (window.confirm(warning)) {
      const updated = models.filter(m => m.id !== id);
      onSaveEntities(updated);
    }
  };

  // ── Color and Badge Styling by Model Task / Type ───────────────────────────
  const getTaskTheme = (task = 'detection') => {
    const t = task.toLowerCase();
    switch (t) {
      case 'pose':
        return {
          name: 'Pose Estimation',
          badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
          borderHover: 'hover:border-amber-500/50',
          accentBg: 'bg-amber-500/10 text-amber-500',
          icon: <Activity size={15} className="text-amber-500" />
        };
      case 'segmentation':
        return {
          name: 'Segmentation',
          badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          borderHover: 'hover:border-emerald-500/50',
          accentBg: 'bg-emerald-500/10 text-emerald-500',
          icon: <Layers size={15} className="text-emerald-500" />
        };
      case 'classification':
        return {
          name: 'Classification',
          badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
          borderHover: 'hover:border-blue-500/50',
          accentBg: 'bg-blue-500/10 text-blue-500',
          icon: <Tag size={15} className="text-blue-500" />
        };
      case 'detection':
      default:
        return {
          name: 'Object Detection',
          badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
          borderHover: 'hover:border-indigo-500/50',
          accentBg: 'bg-indigo-500/10 text-indigo-500',
          icon: <Scan size={15} className="text-indigo-500" />
        };
    }
  };

  // ── Filter and Search Logic ────────────────────────────────────────────────
  const filteredModels = models.filter(m => {
    const task = (m.task || 'detection').toLowerCase();
    const matchesTask = filterTask === 'all' || task === filterTask;
    
    // Usage filtering (running vs assigned idle vs unassigned)
    const usages = modelUsageMap[m.id] || [];
    const isRunning = usages.some(u => u.isProjectRunning);
    const isAssigned = usages.length > 0;
    
    let matchesUsage = true;
    if (filterUsage === 'running') matchesUsage = isRunning;
    else if (filterUsage === 'assigned') matchesUsage = isAssigned && !isRunning;
    else if (filterUsage === 'unassigned') matchesUsage = !isAssigned;

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      m.name.toLowerCase().includes(query) ||
      (m.hef_path && m.hef_path.toLowerCase().includes(query)) ||
      (m.original_filename && m.original_filename.toLowerCase().includes(query)) ||
      (m.classes && m.classes.some(c => c.toLowerCase().includes(query)));

    return matchesTask && matchesUsage && matchesSearch;
  });

  // Metrics
  const totalCount = models.length;
  const detectionCount = models.filter(m => (m.task || 'detection').toLowerCase() === 'detection').length;
  const poseCount = models.filter(m => (m.task || '').toLowerCase() === 'pose').length;
  const segCount = models.filter(m => (m.task || '').toLowerCase() === 'segmentation').length;
  const clsCount = models.filter(m => (m.task || '').toLowerCase() === 'classification').length;

  const runningCount = models.filter(m => (modelUsageMap[m.id] || []).some(u => u.isProjectRunning)).length;
  const assignedIdleCount = models.filter(m => {
    const u = modelUsageMap[m.id] || [];
    return u.length > 0 && !u.some(x => x.isProjectRunning);
  }).length;
  const unassignedCount = models.filter(m => !(modelUsageMap[m.id] || []).length).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Top Header Banner & Add Model Button ── */}
      <div className="bg-gradient-to-r from-purple-950/25 via-surface to-surface-2 p-5 rounded-2xl border border-purple-500/25 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/20 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/30">
              <BrainCircuit size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-fg flex items-center gap-2">
                AI Model Manager
                <span className="text-xs bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full font-mono border border-purple-700/40">
                  {totalCount} Models
                </span>
              </h3>
              <p className="text-xs text-fg-muted mt-0.5">
                Hailo-8/8L neural models (.hef), task types, classes, and pipeline node runtime tracking.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar with 2 Usage Types */}
          <div className="flex items-center gap-2.5 mt-3 flex-wrap text-xs">
            <span 
              onClick={() => setFilterUsage(filterUsage === 'running' ? 'all' : 'running')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold cursor-pointer transition-all ${
                filterUsage === 'running'
                  ? 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
              title="Click to filter models currently running"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{runningCount} กำลังรันอยู่ (Running)</span>
            </span>

            <span 
              onClick={() => setFilterUsage(filterUsage === 'assigned' ? 'all' : 'assigned')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold cursor-pointer transition-all ${
                filterUsage === 'assigned'
                  ? 'bg-blue-500/25 text-blue-700 dark:text-blue-300 border-blue-500 ring-2 ring-blue-500/20'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
              }`}
              title="Click to filter models assigned to nodes but not running"
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>{assignedIdleCount} ผูกโหนดแล้ว (ยังไม่รัน)</span>
            </span>

            <span 
              onClick={() => setFilterUsage(filterUsage === 'unassigned' ? 'all' : 'unassigned')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-fg-muted cursor-pointer transition-all ${
                filterUsage === 'unassigned'
                  ? 'bg-surface-3 text-fg border-line-strong ring-2 ring-line-strong'
                  : 'bg-surface-2 border-line hover:bg-surface-3 hover:text-fg'
              }`}
              title="Click to filter unassigned models"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-fg-subtle" />
              <span>{unassignedCount} ยังไม่ถูกใช้งาน (Unassigned)</span>
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-900/30 hover:scale-[1.02] active:scale-95 shrink-0 self-start md:self-center"
        >
          <Plus size={16} />
          Upload New AI Model
        </button>
      </div>

      {/* ── Filters & View Mode Switcher ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-2.5 rounded-xl border border-line">
        {/* Task Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterTask('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              filterTask === 'all'
                ? 'bg-surface-3 text-fg border border-line-strong'
                : 'text-fg-muted hover:text-fg hover:bg-surface-2'
            }`}
          >
            All Tasks ({totalCount})
          </button>

          <button
            onClick={() => setFilterTask('detection')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              filterTask === 'detection'
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                : 'text-fg-muted hover:text-indigo-500 hover:bg-indigo-500/10'
            }`}
          >
            <Scan size={12} className="text-indigo-500" />
            Detection ({detectionCount})
          </button>

          <button
            onClick={() => setFilterTask('pose')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              filterTask === 'pose'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                : 'text-fg-muted hover:text-amber-500 hover:bg-amber-500/10'
            }`}
          >
            <Activity size={12} className="text-amber-500" />
            Pose ({poseCount})
          </button>

          <button
            onClick={() => setFilterTask('segmentation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              filterTask === 'segmentation'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'text-fg-muted hover:text-emerald-500 hover:bg-emerald-500/10'
            }`}
          >
            <Layers size={12} className="text-emerald-500" />
            Segmentation ({segCount})
          </button>

          {clsCount > 0 && (
            <button
              onClick={() => setFilterTask('classification')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
                filterTask === 'classification'
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                  : 'text-fg-muted hover:text-blue-500 hover:bg-blue-500/10'
              }`}
            >
              <Tag size={12} className="text-blue-500" />
              Classification ({clsCount})
            </button>
          )}
        </div>

        {/* Search and View Mode Switcher */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models or classes..."
              className="w-full bg-surface-2 border border-line rounded-lg pl-8 pr-3 py-1.5 text-xs text-fg placeholder-fg-faint focus:outline-none focus:border-primary"
            />
          </div>

          {/* View Mode Toggle: Block vs List */}
          <div className="flex items-center bg-surface-2 p-1 rounded-lg border border-line shrink-0">
            <button
              onClick={() => handleViewModeChange('block')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'block'
                  ? 'bg-surface text-fg shadow-xs border border-line'
                  : 'text-fg-muted hover:text-fg'
              }`}
              title="Block / Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-surface text-fg shadow-xs border border-line'
                  : 'text-fg-muted hover:text-fg'
              }`}
              title="List View"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Reset notification if filtered */}
      {(filterTask !== 'all' || filterUsage !== 'all' || searchQuery) && (
        <div className="flex items-center justify-between text-xs px-2 text-fg-muted">
          <span>
            Showing {filteredModels.length} of {totalCount} models
            {filterUsage !== 'all' && ` • Filtered by ${filterUsage.toUpperCase()} status`}
          </span>
          <button
            onClick={() => { setFilterTask('all'); setFilterUsage('all'); setSearchQuery(''); }}
            className="text-primary hover:underline font-medium"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* ── Model Items Display: Block (Cards) or List Mode ── */}
      {filteredModels.length === 0 ? (
        <div className="text-center py-16 bg-surface-2/30 rounded-2xl border border-line flex flex-col items-center justify-center gap-3 text-fg-subtle">
          <BrainCircuit size={36} className="opacity-40 text-purple-400" />
          <div className="text-sm font-semibold text-fg-secondary">No AI models match your filter</div>
          <p className="text-xs text-fg-muted max-w-sm">
            Try adjusting your search query or reset filters above.
          </p>
          <button
            onClick={() => { setFilterTask('all'); setFilterUsage('all'); setSearchQuery(''); }}
            className="mt-1 text-xs text-primary hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'block' ? (
        /* ── Block / Card Grid View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredModels.map((model) => {
            const theme = getTaskTheme(model.task);
            const usages = modelUsageMap[model.id] || [];
            const isAnyRunning = usages.some(u => u.isProjectRunning);
            const isAssigned = usages.length > 0;
            const isCopied = copiedHashId === model.id;

            return (
              <div
                key={model.id}
                className={`bg-surface rounded-xl border border-line-strong p-4 flex flex-col justify-between gap-3.5 shadow-sm transition-all hover:shadow-md ${theme.borderHover}`}
              >
                <div>
                  {/* Card Top: Task Icon, Name, Version, Delete */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-line">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`p-2 rounded-xl border border-line shrink-0 ${theme.accentBg}`}>
                        {theme.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            value={model.name}
                            onChange={(e) => handleUpdate(model.id, 'name', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-line-stronger focus:border-purple-500 font-bold text-fg text-sm focus:bg-surface px-1 py-0.5 rounded transition-colors truncate max-w-xs"
                            title="Click to rename"
                          />
                          <span className="text-[10px] font-mono font-bold bg-surface-3 text-fg-secondary px-1.5 py-0.5 rounded border border-line shrink-0">
                            {model.version || 'v1.0'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${theme.badge}`}>
                            {theme.name}
                          </span>
                          <span className="text-[10px] text-fg-muted font-mono truncate" title={model.hef_path}>
                            {model.hef_path}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(model.id, model.name)}
                      className="p-1.5 text-fg-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                      title="Delete Model"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* ── 2 States for Bound Models: 1) Active & Running vs 2) Assigned but not running ── */}
                  <div className="mt-3">
                    {isAssigned ? (
                      <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${
                        isAnyRunning
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-blue-500/10 border-blue-500/30'
                      }`}>
                        {/* Header Status Badge */}
                        <div className="flex items-center justify-between text-xs">
                          {isAnyRunning ? (
                            <span className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
                              <span>กำลังรันอยู่ (Active &amp; Running)</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <span>กำหนดไว้ในโหนดแล้ว (ยังไม่รัน)</span>
                            </span>
                          )}

                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                            isAnyRunning 
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40' 
                              : 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40'
                          }`}>
                            {usages.length} Node{usages.length > 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* List of Bound Pipeline Nodes */}
                        <div className="flex flex-col gap-1.5">
                          {usages.map((u, i) => (
                            <div 
                              key={i} 
                              className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-surface border border-line text-fg"
                            >
                              <div className="flex items-center gap-2 truncate max-w-[240px]">
                                {u.isProjectRunning ? (
                                  <Play size={12} className="text-emerald-500 shrink-0 fill-emerald-500" />
                                ) : (
                                  <Pause size={12} className="text-blue-500 shrink-0" />
                                )}
                                <span className="font-semibold truncate" title={u.projectName}>
                                  {u.projectName}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-fg-secondary font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded border border-line">
                                  Node: {u.nodeLabel}
                                </span>
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  u.isProjectRunning 
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' 
                                    : 'bg-surface-3 text-fg-muted'
                                }`}>
                                  {u.isProjectRunning ? 'RUNNING' : 'IDLE'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Unassigned state */
                      <div className="p-2.5 rounded-xl bg-surface-2/40 border border-line/60 flex items-center justify-between text-xs text-fg-muted">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-fg-subtle" />
                          <span>สถานะ: <strong>ยังไม่ถูกใช้งาน (Unassigned)</strong></span>
                        </span>
                        <span className="text-[10px] text-fg-subtle font-mono">Not used in any active pipeline</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata Specs Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    {/* Checksum */}
                    <div className="p-2 rounded-lg bg-surface-2/60 border border-line space-y-1">
                      <div className="text-fg-muted text-[10px] font-semibold flex items-center justify-between">
                        <span>SHA-256</span>
                        <span className="font-mono text-primary">{formatFileSize(model.file_size)}</span>
                      </div>
                      {model.file_hash ? (
                        <button
                          type="button"
                          onClick={() => handleCopyHash(model.id, model.file_hash)}
                          className="w-full flex items-center justify-between bg-surface hover:bg-surface-3 border border-line rounded px-1.5 py-0.5 text-[10px] font-mono text-fg-secondary transition-colors"
                          title="Click to copy full SHA-256"
                        >
                          <span className="truncate">{model.file_hash.substring(0, 10)}...</span>
                          {isCopied ? (
                            <span className="text-emerald-500 text-[10px] flex items-center gap-0.5">
                              <Check size={10} /> Copied
                            </span>
                          ) : (
                            <Copy size={10} className="text-fg-subtle" />
                          )}
                        </button>
                      ) : (
                        <span className="text-fg-subtle text-[10px] italic">No hash</span>
                      )}
                    </div>

                    {/* Post-Process .so */}
                    <div className="p-2 rounded-lg bg-surface-2/60 border border-line space-y-1">
                      <div className="text-fg-muted text-[10px] font-semibold">Post-Process (.so)</div>
                      <select
                        value={model.so_path}
                        onChange={(e) => handleUpdate(model.id, 'so_path', e.target.value)}
                        className="w-full bg-surface border border-line rounded px-1.5 py-0.5 text-[10px] text-fg font-mono focus:outline-none focus:border-primary truncate"
                      >
                        {soFiles.length === 0 ? (
                          <option value={model.so_path}>{model.so_path}</option>
                        ) : (
                          soFiles.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Classes Row */}
                  <div className="p-2 rounded-lg bg-surface-2/40 border border-line/70 mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-fg-secondary flex items-center gap-1">
                        <Tag size={11} className="text-primary" />
                        Classes ({model.classes ? model.classes.length : 0})
                      </span>
                      <label className="cursor-pointer text-[10px] text-primary hover:underline flex items-center gap-1">
                        <Upload size={10} />
                        Upload .yaml
                        <input
                          type="file"
                          accept=".yaml,.yml"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append('metadata_file', file);
                            try {
                              const res = await fetch(`/api/models/${model.id}/metadata`, { method: 'POST', body: formData });
                              const data = await res.json();
                              if (data.status === 'success') {
                                handleUpdate(model.id, 'classes', data.classes);
                                alert(`Loaded ${data.classes.length} classes for ${model.name}`);
                              } else {
                                alert('Error: ' + data.message);
                              }
                            } catch (err) {
                              alert('Upload failed: ' + err.message);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {model.classes && model.classes.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                        {model.classes.map((cls, idx) => (
                          <span key={idx} className="bg-surface border border-line text-[10px] px-1.5 py-0.5 rounded font-mono text-fg-secondary">
                            {cls}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-fg-subtle italic">
                        No custom class labels defined.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List Mode ── */
        <div className="flex flex-col gap-3">
          {filteredModels.map((model) => {
            const theme = getTaskTheme(model.task);
            const usages = modelUsageMap[model.id] || [];
            const isAnyRunning = usages.some(u => u.isProjectRunning);
            const isAssigned = usages.length > 0;
            const isCopied = copiedHashId === model.id;

            return (
              <div
                key={model.id}
                className={`bg-surface rounded-xl border border-line-strong p-4 flex flex-col gap-3 shadow-xs hover:shadow-sm transition-all ${theme.borderHover}`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-xl border border-line shrink-0 ${theme.accentBg}`}>
                      {theme.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          value={model.name}
                          onChange={(e) => handleUpdate(model.id, 'name', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-line-stronger focus:border-purple-500 font-bold text-fg text-sm focus:bg-surface px-1 py-0.5 rounded transition-colors"
                          title="Click to rename"
                        />
                        <span className="text-[10px] font-mono font-bold bg-surface-3 text-fg-secondary px-1.5 py-0.5 rounded border border-line">
                          {model.version || 'v1.0'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${theme.badge}`}>
                          {theme.name}
                        </span>
                      </div>
                      <p className="text-xs text-fg-muted font-mono truncate mt-0.5" title={model.hef_path}>
                        {model.hef_path} • {formatFileSize(model.file_size)} • {model.classes?.length || 0} classes
                      </p>
                    </div>
                  </div>

                  {/* Actions & Delete */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {model.file_hash && (
                      <button
                        type="button"
                        onClick={() => handleCopyHash(model.id, model.file_hash)}
                        className="px-2.5 py-1 bg-surface-2 hover:bg-surface-3 border border-line rounded-lg text-xs font-mono text-fg-secondary flex items-center gap-1.5 transition-colors"
                        title="Copy SHA-256 Hash"
                      >
                        {isCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        <span>{model.file_hash.substring(0, 8)}...</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(model.id, model.name)}
                      className="p-1.5 text-fg-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete Model"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* ── 2 States Status Bar in List View ── */}
                <div className="pt-2 border-t border-line/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
                  {isAssigned ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAnyRunning ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>กำลังรันอยู่ (Active &amp; Running):</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>กำหนดไว้ในโหนดแล้ว (ยังไม่รัน):</span>
                        </span>
                      )}

                      {usages.map((u, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-surface-2 border border-line text-fg text-[11px] flex items-center gap-1 font-mono">
                          <strong>{u.projectName}</strong> › {u.nodeLabel}
                          <span className={`text-[9px] px-1 rounded ${
                            u.isProjectRunning ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-surface-3 text-fg-muted'
                          }`}>
                            {u.isProjectRunning ? 'RUNNING' : 'IDLE'}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-fg-subtle flex items-center gap-1.5 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-fg-subtle" />
                      <span>สถานะ: <strong>ยังไม่ถูกใช้งาน (Unassigned)</strong></span>
                    </span>
                  )}

                  <div className="text-[11px] text-fg-muted font-mono self-end sm:self-auto">
                    Post-process: {model.so_path}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Upload Modal ── */}
      <ModelUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={() => {
          if (onRefreshEntities) onRefreshEntities();
        }}
        soFiles={soFiles}
      />
    </div>
  );
}
