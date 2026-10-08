import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Cpu, Zap, Activity, HardDrive, Thermometer, Layers, 
  Workflow, Play, CheckCircle, AlertTriangle, Clock, RefreshCw,
  Search, ChevronDown, ChevronRight, Terminal, BarChart2,
  ShieldCheck, ShieldAlert, Disc, Wifi, ArrowUpRight, ArrowDownLeft,
  Server, Laptop, LayoutDashboard, ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, Legend 
} from 'recharts';
import { chartTheme } from '../utils/theme';

export default function ResourceMonitorModal({ isOpen, onClose, telemetry, history = [] }) {
  const [activeTab, setActiveTab] = useState('hierarchy'); // 'hierarchy' | 'external' | 'processes' | 'charts'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPipelines, setExpandedPipelines] = useState({});

  // Sorting state for process tables
  const [externalSortField, setExternalSortField] = useState('cpu_percent'); // 'cpu_percent' | 'memory_mb' | 'name' | 'pid' | 'user'
  const [externalSortOrder, setExternalSortOrder] = useState('desc'); // 'desc' | 'asc'

  const [pidoSortField, setPidoSortField] = useState('cpu_percent');
  const [pidoSortOrder, setPidoSortOrder] = useState('desc');

  // Origin filter: 'all' | 'pido' | 'external' | 'ide'
  const [processOriginFilter, setProcessOriginFilter] = useState('all');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const system = telemetry?.system || {
    cpu_percent: telemetry?.cpu_percent || 0,
    cpu_cores: [0, 0, 0, 0],
    ram_percent: telemetry?.ram_percent || 0,
    ram_used_mb: 0,
    ram_total_mb: 0,
    swap_percent: 0,
    swap_used_mb: 0,
    swap_total_mb: 0,
    disk_percent: 0,
    disk_used_gb: 0,
    disk_total_gb: 0,
    disk_free_gb: 0,
    disk_read_mbps: 0,
    disk_write_mbps: 0,
    net_rx_kbps: 0,
    net_tx_kbps: 0,
    temp_c: telemetry?.temp_c || 0,
    cpu_freq_mhz: 0,
    core_voltage_v: 0,
    npu_percent: telemetry?.npu_percent || 0,
    npu_device: telemetry?.npu_device || 'Hailo NPU (PCIe)',
    hardware_health: {
      healthy: true,
      message: 'Optimal (Normal)',
      throttled: false,
      under_voltage: false,
      arm_freq_capped: false,
      soft_temp_limit: false
    }
  };

  const attribution = telemetry?.attribution || {
    internal_cpu_percent: 0,
    internal_ram_mb: 0,
    internal_ram_percent: 0,
    external_cpu_percent: 0,
    external_ram_mb: 0,
    external_ram_percent: 0,
    idle_cpu_percent: 100,
    top_external_processes: []
  };

  const processes = telemetry?.processes || [];
  const pipelines = telemetry?.pipelines || [];
  const topExternal = attribution?.top_external_processes || [];

  const handleExternalSort = (field) => {
    if (externalSortField === field) {
      setExternalSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setExternalSortField(field);
      setExternalSortOrder('desc');
    }
  };

  const handlePidoSort = (field) => {
    if (pidoSortField === field) {
      setPidoSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setPidoSortField(field);
      setPidoSortOrder('desc');
    }
  };

  const pidoItems = processes.map(p => ({
    ...p,
    ecosystem: 'pido',
    category: p.category || p.role || 'core',
    user: p.user || 'pi'
  }));

  const externalItems = topExternal.map(p => ({
    ...p,
    ecosystem: p.ecosystem || 'external',
    category: p.category || 'system',
    user: p.user || 'pi'
  }));

  const allProcesses = [...pidoItems, ...externalItems];

  const filteredWorkloads = allProcesses.filter(p => {
    if (processOriginFilter === 'pido') return p.ecosystem === 'pido';
    if (processOriginFilter === 'external') return p.ecosystem === 'external' && p.category !== 'ide';
    if (processOriginFilter === 'ide') return p.category === 'ide';
    return true; // 'all'
  });

  const sortedWorkloads = [...filteredWorkloads].sort((a, b) => {
    let aVal = a[externalSortField];
    let bVal = b[externalSortField];
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = (bVal || '').toLowerCase();
      return externalSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    aVal = aVal ?? 0;
    bVal = bVal ?? 0;
    return externalSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const sortedExternal = [...topExternal].sort((a, b) => {
    let aVal = a[externalSortField];
    let bVal = b[externalSortField];
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = (bVal || '').toLowerCase();
      return externalSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    aVal = aVal ?? 0;
    bVal = bVal ?? 0;
    return externalSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const sortedPidoProcesses = [...processes].sort((a, b) => {
    let aVal = a[pidoSortField];
    let bVal = b[pidoSortField];
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = (bVal || '').toLowerCase();
      return pidoSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    aVal = aVal ?? 0;
    bVal = bVal ?? 0;
    return pidoSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const renderEcosystemBadge = (ecosystem, category) => {
    if (ecosystem === 'pido') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-800/60 shadow-xs">
          <Server size={11} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span>PiDo.AI</span>
        </span>
      );
    }
    if (category === 'ide') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-800/60 shadow-xs">
          <Terminal size={11} className="text-purple-600 dark:text-purple-400 shrink-0" />
          <span>IDE / Dev</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border border-orange-800/60 shadow-xs">
        <Laptop size={11} className="text-orange-600 dark:text-orange-400 shrink-0" />
        <span>Host OS</span>
      </span>
    );
  };

  const renderSortTh = (label, field, currentField, currentOrder, onSort, widthClass, align = 'left') => {
    const isActive = currentField === field;
    const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
    return (
      <th 
        className={`py-2.5 px-3 select-none cursor-pointer hover:bg-surface-2/80 transition-colors ${widthClass} ${alignClass} group`}
        onClick={() => onSort(field)}
        title={`Sort by ${label} (${isActive && currentOrder === 'desc' ? 'High to Low' : 'Low to High'})`}
      >
        <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span className={isActive ? 'font-bold text-fg' : 'text-fg-muted group-hover:text-fg'}>{label}</span>
          {isActive ? (
            currentOrder === 'desc' ? (
              <ArrowDown size={13} className="text-blue-500 shrink-0" />
            ) : (
              <ArrowUp size={13} className="text-blue-500 shrink-0" />
            )
          ) : (
            <ArrowUpDown size={12} className="text-fg-subtle opacity-35 group-hover:opacity-90 shrink-0" />
          )}
        </div>
      </th>
    );
  };

  const togglePipeline = (id) => {
    setExpandedPipelines(prev => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
  };

  const isPipelineExpanded = (id) => expandedPipelines[id] !== false; // Default expanded

  const filteredPipelines = pipelines.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const matchName = (p.name || '').toLowerCase().includes(query);
    const matchId = (p.pipeline_id || '').toLowerCase().includes(query);
    const matchNode = (p.nodes || []).some(n => 
      (n.name || '').toLowerCase().includes(query) || 
      (n.node_id || '').toLowerCase().includes(query) ||
      (n.node_type || '').toLowerCase().includes(query)
    );
    return matchName || matchId || matchNode;
  });

  const getNodeTypeBadge = (type) => {
    switch (type) {
      case 'aiNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-800/60 rounded">AI Inference</span>;
      case 'inputNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-800/60 rounded">Input Stream</span>;
      case 'logicNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-800/60 rounded">Logic Check</span>;
      case 'dashboardVideoNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-800/60 rounded">Video Out</span>;
      case 'functionNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-800/60 rounded">Function</span>;
      case 'counterNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-800/60 rounded">Counter</span>;
      case 'snapshotNode':
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-800/60 rounded">Snapshot</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-semibold bg-surface-2 border border-line-strong rounded text-fg-secondary">{type}</span>;
    }
  };

  const isHealthy = system.hardware_health?.healthy !== false;
  const isSwapHigh = (system.swap_percent || 0) > 80;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto font-sans text-fg animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl h-[88vh] max-h-[88vh] flex flex-col bg-canvas border border-line rounded-2xl shadow-2xl overflow-hidden font-sans text-fg my-auto">
        
        {/* Modal Header (Always Fixed at Top) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line/80 bg-surface/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-400">
              <Activity size={20} className="animate-pulse text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-fg">Precision Resource &amp; Workload Profiler</h2>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-800/60 text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live (1 Hz)
                </span>
                {!isHealthy && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-red-950/90 border border-red-700 text-red-400 animate-pulse">
                    <ShieldAlert size={12} />
                    Hardware Alert
                  </span>
                )}
              </div>
              <p className="text-[11px] text-fg-muted">
                Fine-grained attribution: In-Platform (PiDo.AI) vs External Host OS on Raspberry Pi 5 &amp; Hailo-8L
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:text-fg hover:bg-surface-2/80 transition-colors text-fg-muted cursor-pointer"
            title="Close (ESC)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection & Controls (Always Fixed at Top under Header!) */}
        <div className="flex flex-wrap items-center justify-between px-5 py-2.5 border-b border-line bg-surface/40 gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line shadow-xs">
            <button
              onClick={() => setActiveTab('hierarchy')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'hierarchy' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-fg-muted hover:text-fg hover:bg-surface-2/60'
              }`}
              title="Overview & Pipelines (Default View / หน้าหลัก)"
            >
              <LayoutDashboard size={14} /> Overview &amp; Pipelines
            </button>
            <button
              onClick={() => setActiveTab('external')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'external' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-fg-muted hover:text-fg hover:bg-surface-2/60'
              }`}
              title="All System Workloads & Process Attribution (วิเคราะห์โปรเซสทั้งระบบ)"
            >
              <Laptop size={14} /> System Processes ({allProcesses.length})
            </button>
            <button
              onClick={() => setActiveTab('processes')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'processes' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-fg-muted hover:text-fg hover:bg-surface-2/60'
              }`}
              title="PiDo.AI In-Platform Processes Tree"
            >
              <Terminal size={14} /> PiDo Processes ({processes.length})
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'charts' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-fg-muted hover:text-fg hover:bg-surface-2/60'
              }`}
              title="Real-Time Workload Performance Trends"
            >
              <BarChart2 size={14} /> Real-Time Trends
            </button>
          </div>

          {activeTab === 'hierarchy' && pipelines.length > 0 && (
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                type="text"
                placeholder="Search pipeline or node..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-line rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder-fg-subtle focus:outline-none focus:border-blue-500/60 font-mono text-fg"
              />
            </div>
          )}
        </div>

        {/* Modal Body Content (Scrollable with min-h-0) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* TAB 1: OVERVIEW & PIPELINES HIERARCHY */}
          {activeTab === 'hierarchy' && (
            <div className="space-y-4">

              {/* Top KPI Cards (4 Main Cards) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                
                {/* Card 1: CPU Workload (Segmented Stacked Bar) */}
                <div className="p-3.5 rounded-xl bg-surface/70 border border-line shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold flex items-center gap-1.5 text-fg-muted">
                        <Cpu size={15} className="text-blue-600 dark:text-blue-400" /> CPU Allocation
                      </span>
                      <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">
                        {system.cpu_percent?.toFixed(1)}%
                      </span>
                    </div>

                    {/* Segmented Stacked Bar (PiDo vs External vs Idle) */}
                    <div 
                      className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden flex my-2 border border-line/40 shadow-inner"
                      title={`PiDo: ${attribution.internal_cpu_percent}% | External: ${attribution.external_cpu_percent}% | Idle: ${attribution.idle_cpu_percent}%`}
                    >
                      <div 
                        className="bg-blue-500 h-full transition-all duration-300" 
                        style={{ width: `${Math.min(100, Math.max(0, attribution.internal_cpu_percent || 0))}%` }}
                      />
                      <div 
                        className="bg-orange-500 h-full transition-all duration-300" 
                        style={{ width: `${Math.min(100, Math.max(0, attribution.external_cpu_percent || 0))}%` }}
                      />
                    </div>

                    {/* Attribution Legend */}
                    <div className="flex justify-between items-center text-[10px] font-mono text-fg-subtle">
                      <span className="flex items-center gap-1 text-blue-700 dark:text-blue-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                        PiDo: {attribution.internal_cpu_percent?.toFixed(1)}%
                      </span>
                      <span className="flex items-center gap-1 text-orange-700 dark:text-orange-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                        Ext: {attribution.external_cpu_percent?.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Core Mini Bars */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2.5 pt-2 border-t border-line/40">
                    {(system.cpu_cores || [0, 0, 0, 0]).slice(0, 4).map((core, i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              core > 80 ? 'bg-red-500' : core > 50 ? 'bg-amber-400' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, core))}%` }}
                          />
                        </div>
                        <span className="text-[8px] font-mono text-center text-fg-subtle">C{i}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card 2: NPU Hailo Card */}
                <div className="p-3.5 rounded-xl bg-surface/70 border border-purple-900/40 shadow-xs relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/5 rounded-full blur-2xl pointer-events-none" />
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold flex items-center gap-1.5 text-fg-secondary">
                        <Zap size={15} className="text-purple-600 dark:text-purple-400" /> NPU {system.npu_device ? system.npu_device.split(' ')[0] : 'Hailo'}
                      </span>
                      <span className="text-base font-bold font-mono text-purple-600 dark:text-purple-400">
                        {system.npu_percent?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden mt-2">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          system.npu_percent > 85 ? 'bg-red-500' : system.npu_percent > 50 ? 'bg-purple-500' : 'bg-purple-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(4, system.npu_percent || 0))}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] mt-2 font-mono text-fg-muted">
                      <span className="truncate max-w-[130px]" title={system.npu_device}>13 TOPS AI NPU</span>
                      <span className={system.npu_percent > 0 ? 'text-purple-700 dark:text-purple-300 font-medium' : 'text-fg-subtle'}>
                        {system.npu_percent > 0 ? 'Inferencing' : 'Standby'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-line/40 flex items-center justify-between text-[10px] font-mono text-fg-subtle">
                    <span>PCIe Gen2/3</span>
                    <span className="text-purple-600 dark:text-purple-400 font-medium">Zero-Copy</span>
                  </div>
                </div>

                {/* Card 3: RAM & Swap Memory (Segmented Stacked Bar: PiDo vs External vs Available) */}
                <div className="p-3.5 rounded-xl bg-surface/70 border border-line shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold flex items-center gap-1.5 text-fg-muted">
                        <HardDrive size={15} className="text-emerald-600 dark:text-emerald-400" /> RAM Allocation
                      </span>
                      <span className={`text-base font-bold font-mono ${system.ram_percent > 80 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {system.ram_percent?.toFixed(1)}%
                      </span>
                    </div>

                    {/* Segmented Stacked Bar (PiDo vs External vs Free) */}
                    <div 
                      className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden flex my-2 border border-line/40 shadow-inner"
                      title={`PiDo: ${(attribution.internal_ram_mb || 0).toFixed(0)} MB (${(attribution.internal_ram_percent || 0).toFixed(1)}%) | Ext: ${(attribution.external_ram_mb || 0).toFixed(0)} MB (${(attribution.external_ram_percent || 0).toFixed(1)}%) | Free: ${Math.max(0, (system.ram_total_mb || 0) - (system.ram_used_mb || 0)).toFixed(0)} MB`}
                    >
                      <div 
                        className="bg-blue-500 h-full transition-all duration-300" 
                        style={{ width: `${Math.min(100, Math.max(0, attribution.internal_ram_percent || 0))}%` }}
                      />
                      <div 
                        className="bg-orange-500 h-full transition-all duration-300" 
                        style={{ width: `${Math.min(100, Math.max(0, attribution.external_ram_percent || 0))}%` }}
                      />
                    </div>

                    {/* Attribution RAM Legend */}
                    <div className="flex justify-between items-center text-[10px] font-mono text-fg-subtle">
                      <span className="flex items-center gap-1 text-blue-700 dark:text-blue-300" title={`PiDo.AI: ${(attribution.internal_ram_mb || 0).toFixed(0)} MB`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                        PiDo: {attribution.internal_ram_mb != null ? (attribution.internal_ram_mb >= 1024 ? (attribution.internal_ram_mb / 1024).toFixed(1) + 'G' : attribution.internal_ram_mb.toFixed(0) + 'M') : '0M'}
                      </span>
                      <span className="flex items-center gap-1 text-orange-700 dark:text-orange-300" title={`External Host: ${(attribution.external_ram_mb || 0).toFixed(0)} MB`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                        Ext: {attribution.external_ram_mb != null ? (attribution.external_ram_mb >= 1024 ? (attribution.external_ram_mb / 1024).toFixed(1) + 'G' : attribution.external_ram_mb.toFixed(0) + 'M') : '0M'}
                      </span>
                      <span className="text-fg-muted font-medium">
                        Total: {system.ram_total_mb ? `${(system.ram_total_mb / 1024).toFixed(1)}G` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Swap / ZRAM Sub-Indicator */}
                  <div className="mt-2.5 pt-2 border-t border-line/40">
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-fg-muted">Swap / ZRAM:</span>
                      <span className={isSwapHigh ? 'text-amber-500 font-bold' : 'text-fg-secondary'}>
                        {system.swap_percent?.toFixed(0)}% ({system.swap_used_mb?.toFixed(0)} MB)
                      </span>
                    </div>
                    <div className="w-full h-1 bg-surface-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isSwapHigh ? 'bg-amber-500' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(100, system.swap_percent || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card 4: Thermal & Hardware Health (Raspberry Pi 5) */}
                <div className="p-3.5 rounded-xl bg-surface/70 border border-line shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold flex items-center gap-1.5 text-fg-muted">
                        <Thermometer size={15} className="text-orange-700 dark:text-orange-400" /> SoC Health
                      </span>
                      <span className={`text-base font-bold font-mono ${system.temp_c > 75 ? 'text-red-600 dark:text-red-400' : 'text-orange-700 dark:text-orange-400'}`}>
                        {system.temp_c ? `${system.temp_c.toFixed(1)}°C` : 'N/A'}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden mt-2">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          system.temp_c > 75 ? 'bg-red-500' : system.temp_c > 60 ? 'bg-orange-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(10, ((system.temp_c || 40) - 30) * 1.5))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] mt-1.5 font-mono text-fg-subtle">
                      <span>Clock: {system.cpu_freq_mhz ? `${system.cpu_freq_mhz} MHz` : '2400 MHz'}</span>
                      <span>Core: {system.core_voltage_v ? `${system.core_voltage_v} V` : '0.85 V'}</span>
                    </div>
                  </div>

                  {/* Health Status Badge */}
                  <div className="mt-2.5 pt-2 border-t border-line/40">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-fg-muted">Throttle State:</span>
                      <span className={`font-semibold flex items-center gap-1 ${
                        isHealthy ? 'text-emerald-500' : 'text-red-500 font-bold'
                      }`}>
                        {isHealthy ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                        {system.hardware_health?.message || 'Optimal'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Mini Ribbon: Disk I/O & Network Throughput */}
              <div className="px-4 py-2 bg-surface/50 border border-line rounded-xl flex flex-wrap items-center justify-between text-[11px] font-mono text-fg-muted gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <Disc size={13} className="text-blue-500" />
                    <span>Disk:</span>
                    <strong className="text-fg">{system.disk_free_gb?.toFixed(1)} GB Free</strong>
                    <span className="text-fg-subtle">({system.disk_percent}% used)</span>
                  </span>
                  <span className="text-fg-subtle">•</span>
                  <span className="flex items-center gap-1">
                    <span>I/O:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">R: {system.disk_read_mbps?.toFixed(2)} MB/s</span>
                    <span>|</span>
                    <span className="text-amber-600 dark:text-amber-400">W: {system.disk_write_mbps?.toFixed(2)} MB/s</span>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <Wifi size={13} className="text-purple-500" />
                    <span>Net:</span>
                    <span className="text-blue-600 dark:text-blue-400">RX: {system.net_rx_kbps?.toFixed(1)} kbps</span>
                    <span>|</span>
                    <span className="text-purple-600 dark:text-purple-400">TX: {system.net_tx_kbps?.toFixed(1)} kbps</span>
                  </span>
                </div>
              </div>
              {filteredPipelines.length === 0 ? (
                <div className="space-y-4">
                  {/* System Readiness Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-surface/50 border border-line flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                        <Zap size={20} />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-fg">{system.npu_device ? system.npu_device.split(' ')[0] : 'Hailo'} AI NPU</span>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono font-medium mt-0.5">
                          <CheckCircle size={12} /> {system.npu_device || 'Ready (PCIe Gen2/3)'}
                        </p>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-surface/50 border border-line flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                        <Layers size={20} />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-fg">GStreamer Engine</span>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono font-medium mt-0.5">
                          <CheckCircle size={12} /> DMA-BUF Zero-Copy Active
                        </p>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-surface/50 border border-line flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Server size={20} />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-fg">PiDo Core Platform</span>
                        <p className="text-[11px] text-blue-600 dark:text-blue-400 font-mono font-medium mt-0.5">
                          {processes.length} Processes Running
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Empty Pipelines Card */}
                  <div className="text-center py-10 border border-dashed border-line rounded-2xl bg-surface/20">
                    <Workflow size={36} className="mx-auto mb-3 text-fg-faint" />
                    <h3 className="text-sm font-semibold text-fg-secondary">No Active Pipelines Running</h3>
                    <p className="text-xs mt-1 max-w-md mx-auto text-fg-subtle">
                      Deploy a project pipeline in the Pipeline Builder to see real-time CPU, NPU, and multi-stage latency attribution.
                    </p>
                  </div>
                </div>
              ) : (
                filteredPipelines.map((pipeline) => {
                  const expanded = isPipelineExpanded(pipeline.pipeline_id);
                  const nodes = pipeline.nodes || [];

                  return (
                    <div 
                      key={pipeline.pipeline_id}
                      className="border border-line/80 rounded-2xl bg-surface/40 overflow-hidden shadow-sm"
                    >
                      {/* Pipeline Header */}
                      <div 
                        onClick={() => togglePipeline(pipeline.pipeline_id)}
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-2/40 transition-colors select-none"
                      >
                        <div className="flex items-center gap-3">
                          <button className="text-fg-faint hover:text-fg-muted">
                            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-fg">{pipeline.name || pipeline.pipeline_id}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800/50">
                                ID: {pipeline.pipeline_id}
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle size={12} /> {pipeline.status}
                              </span>
                            </div>
                            <span className="text-xs text-fg-subtle">
                              {nodes.length} registered nodes in dataflow
                            </span>
                          </div>
                        </div>

                        {/* Pipeline Resource Rollup */}
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="flex items-center gap-1.5 bg-surface/80 border border-line px-3 py-1.5 rounded-lg">
                            <Cpu size={14} className="text-blue-600 dark:text-blue-400" />
                            <span className="text-[11px] text-fg-muted">Pipe CPU:</span>
                            <span className="text-blue-700 dark:text-blue-300 font-bold">{pipeline.cpu_percent?.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-900/50 px-3 py-1.5 rounded-lg">
                            <Zap size={14} className="text-purple-600 dark:text-purple-400" />
                            <span className="text-purple-700 dark:text-purple-300 text-[11px]">NPU:</span>
                            <span className="text-purple-700 dark:text-purple-300 font-bold">{pipeline.npu_percent?.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Nodes Table (Inside Pipeline) */}
                      {expanded && (
                        <div className="border-t border-line/60 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-canvas/80 font-medium border-b border-line/80 text-[11px] text-fg-muted">
                              <tr>
                                <th className="py-2.5 px-4">Node / Component</th>
                                <th className="py-2.5 px-3">Type</th>
                                <th className="py-2.5 px-3">CPU Usage</th>
                                <th className="py-2.5 px-3">NPU Hailo Load</th>
                                <th className="py-2.5 px-3">Precision Latency Breakdown</th>
                                <th className="py-2.5 px-3">Throughput &amp; QoS</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line/40">
                              {nodes.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="py-6 text-center font-mono text-xs text-fg-subtle">
                                    No node telemetry recorded yet for this pipeline.
                                  </td>
                                </tr>
                              ) : (
                                nodes.map((node) => {
                                  const isAi = node.node_type === 'aiNode';

                                  return (
                                    <tr key={node.node_id} className="hover:bg-surface-2/20 transition-colors">
                                      {/* Name & ID */}
                                      <td className="py-2.5 px-4 font-mono">
                                        <div className="flex flex-col">
                                          <span className="font-semibold text-fg">{node.name || node.node_id}</span>
                                          <span className="text-[10px] text-fg-subtle">{node.node_id}</span>
                                        </div>
                                      </td>

                                      {/* Type */}
                                      <td className="py-2.5 px-3">
                                        {getNodeTypeBadge(node.node_type)}
                                      </td>

                                      {/* CPU % */}
                                      <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-16 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-blue-500 rounded-full transition-all"
                                              style={{ width: `${Math.min(100, Math.max(node.cpu_percent > 0 ? 5 : 0, (node.cpu_percent || 0) * 3))}%` }}
                                            />
                                          </div>
                                          <span className="font-mono font-medium text-[11px] text-fg-secondary">
                                            {node.cpu_percent?.toFixed(1)}%
                                          </span>
                                        </div>
                                      </td>

                                      {/* NPU % */}
                                      <td className="py-2.5 px-3">
                                        {isAi ? (
                                          <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-purple-500 rounded-full transition-all"
                                                style={{ width: `${Math.min(100, node.npu_percent || 0)}%` }}
                                              />
                                            </div>
                                            <span className="font-mono text-purple-700 dark:text-purple-300 font-bold text-[11px]">
                                              {node.npu_percent?.toFixed(1)}%
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="font-mono text-[11px] text-fg-faint">-</span>
                                        )}
                                      </td>

                                      {/* Precision Latency Breakdown */}
                                      <td className="py-2.5 px-3 font-mono text-[11px]">
                                        {isAi ? (
                                          <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-purple-700 dark:text-purple-300 font-semibold">
                                                Total: {node.total_latency_ms?.toFixed(1) || (node.npu_latency_ms + (node.cpu_postprocess_ms || 0) + (node.python_probe_ms || 0)).toFixed(1)} ms
                                              </span>
                                            </div>
                                            <div className="text-[10px] text-fg-muted flex flex-wrap gap-x-2">
                                              <span>NPU: <strong className="text-fg">{node.npu_latency_ms?.toFixed(1) || 0}ms</strong></span>
                                              <span>Post: <strong className="text-fg">{node.cpu_postprocess_ms?.toFixed(1) || 0}ms</strong></span>
                                              <span>Probe: <strong className="text-fg">{node.python_probe_ms?.toFixed(1) || 0}ms</strong></span>
                                            </div>
                                          </div>
                                        ) : node.node_type === 'inputNode' ? (
                                          <div className="flex flex-col">
                                            <span className="text-fg-secondary">Arrival Latency: {node.latency_ms?.toFixed(1)} ms</span>
                                            <span className="text-[10px] text-fg-subtle">Frame-to-frame interval</span>
                                          </div>
                                        ) : node.cpu_time_ms > 0 ? (
                                          <div className="flex flex-col">
                                            <span className="text-fg-secondary">CPU: {node.cpu_time_ms?.toFixed(2)} ms</span>
                                            <span className="text-[10px] text-fg-subtle">Wall: {node.latency_ms?.toFixed(2)} ms</span>
                                          </div>
                                        ) : node.latency_ms > 0 ? (
                                          <span className="text-fg-secondary">{node.latency_ms?.toFixed(2)} ms</span>
                                        ) : (
                                          <span className="text-fg-faint">&lt; 0.1 ms</span>
                                        )}
                                      </td>

                                      {/* Throughput & QoS Drops */}
                                      <td className="py-2.5 px-3 font-mono text-[11px]">
                                        <div className="flex flex-col gap-0.5">
                                          {node.fps > 0 ? (
                                            <span className="text-blue-700 dark:text-blue-300 font-medium">{node.fps?.toFixed(1)} FPS</span>
                                          ) : node.freq_hz > 0 ? (
                                            <span className="text-emerald-700 dark:text-emerald-300 font-medium">{node.freq_hz?.toFixed(1)} Hz</span>
                                          ) : (
                                            <span className="text-fg-subtle">Idle</span>
                                          )}

                                          {/* Frame Drop Alert Badge */}
                                          {node.queue_drops > 0 && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-800/60 animate-pulse">
                                              <AlertTriangle size={11} />
                                              {node.queue_drops} drops
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: EXTERNAL & HOST OS WORKLOAD */}
          {activeTab === 'external' && (
            <div className="space-y-4">
              {/* Back to Overview Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-surface/50 border border-line">
                <button
                  onClick={() => setActiveTab('hierarchy')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line text-xs font-medium text-blue-600 dark:text-blue-400 transition-colors cursor-pointer shadow-xs group"
                >
                  <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  <span>&larr; Back to Overview &amp; Pipelines (กลับหน้าภาพรวม)</span>
                </button>
                <span className="text-xs text-fg-muted font-mono">
                  External Host CPU: <strong className="text-orange-500">{attribution.external_cpu_percent?.toFixed(1)}%</strong> | RAM: <strong className="text-fg">{attribution.external_ram_mb?.toFixed(0)} MB</strong>
                </span>
              </div>

              {/* Attribution Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40">
                  <div className="flex items-center justify-between text-xs text-blue-400 font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Server size={14} /> PiDo.AI Platform
                    </span>
                    <span className="font-mono text-base font-bold text-blue-300">
                      {attribution.internal_cpu_percent?.toFixed(1)}% CPU
                    </span>
                  </div>
                  <p className="text-[11px] text-fg-muted mt-1">
                    RAM: <strong>{attribution.internal_ram_mb?.toFixed(0)} MB</strong> ({attribution.internal_ram_percent?.toFixed(1)}% of total memory)
                  </p>
                  <p className="text-[10px] text-fg-subtle mt-0.5">
                    FastAPI Core, MediaMTX RTSP, Frontend &amp; GStreamer Pipeline workers.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-orange-950/20 border border-orange-900/40">
                  <div className="flex items-center justify-between text-xs text-orange-400 font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Laptop size={14} /> External Host OS
                    </span>
                    <span className="font-mono text-base font-bold text-orange-300">
                      {attribution.external_cpu_percent?.toFixed(1)}% CPU
                    </span>
                  </div>
                  <p className="text-[11px] text-fg-muted mt-1">
                    RAM: <strong>{attribution.external_ram_mb?.toFixed(0)} MB</strong> ({attribution.external_ram_percent?.toFixed(1)}% of total memory)
                  </p>
                  <p className="text-[10px] text-fg-subtle mt-0.5">
                    Desktop GUI, Browsers, systemd daemons, and background tasks.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-surface/50 border border-line">
                  <div className="flex items-center justify-between text-xs text-fg-muted font-semibold mb-1">
                    <span>Available Capacity</span>
                    <span className="font-mono text-base font-bold text-emerald-500">
                      {attribution.idle_cpu_percent?.toFixed(1)}% Idle
                    </span>
                  </div>
                  <p className="text-[11px] text-fg-muted mt-1">
                    Swap: <strong className={isSwapHigh ? 'text-amber-500' : 'text-fg'}>{system.swap_percent}%</strong> | Temp: <strong>{system.temp_c}°C</strong>
                  </p>
                  <p className="text-[10px] text-fg-subtle mt-0.5">
                    Headroom available for additional AI pipelines &amp; streams.
                  </p>
                </div>

              </div>

              {/* Top Processes Table with Origin & Ecosystem Attribution */}
              <div className="border border-line rounded-xl overflow-hidden bg-surface/40">
                <div className="px-4 py-2.5 bg-canvas border-b border-line flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-orange-500" />
                    <h4 className="text-xs font-semibold text-fg">
                      Raspberry Pi System Workloads &amp; Processes
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 text-fg-muted font-mono">
                      {sortedWorkloads.length} processes
                    </span>
                  </div>

                  {/* Quick Sort Filter Buttons */}
                  <div className="flex items-center gap-1.5 text-[11px] font-sans">
                    <span className="text-fg-subtle text-[10px] mr-1 hidden sm:inline">Quick Sort:</span>
                    <button
                      type="button"
                      onClick={() => { setExternalSortField('cpu_percent'); setExternalSortOrder('desc'); }}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                        externalSortField === 'cpu_percent' && externalSortOrder === 'desc'
                          ? 'bg-orange-500 text-white shadow-xs'
                          : 'bg-surface hover:bg-surface-2 text-fg-secondary border border-line'
                      }`}
                    >
                      🔥 Highest CPU
                    </button>
                    <button
                      type="button"
                      onClick={() => { setExternalSortField('memory_mb'); setExternalSortOrder('desc'); }}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                        externalSortField === 'memory_mb' && externalSortOrder === 'desc'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-surface hover:bg-surface-2 text-fg-secondary border border-line'
                      }`}
                    >
                      💾 Highest RAM
                    </button>
                    <button
                      type="button"
                      onClick={() => { setExternalSortField('name'); setExternalSortOrder('asc'); }}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                        externalSortField === 'name' && externalSortOrder === 'asc'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-surface hover:bg-surface-2 text-fg-secondary border border-line'
                      }`}
                    >
                      🔤 Name (A-Z)
                    </button>
                  </div>
                </div>

                {/* Origin Filter Sub-Bar (แยกแยะ PiDo.AI vs ภายนอก) */}
                <div className="px-4 py-2 bg-surface/60 border-b border-line flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1 bg-surface-2/60 p-0.5 rounded-lg border border-line">
                    <span className="text-[10px] text-fg-muted px-2 font-medium">Origin:</span>
                    <button
                      type="button"
                      onClick={() => setProcessOriginFilter('all')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                        processOriginFilter === 'all'
                          ? 'bg-canvas text-fg shadow-xs font-bold border border-line'
                          : 'text-fg-muted hover:text-fg'
                      }`}
                    >
                      🌐 All Workloads ({allProcesses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProcessOriginFilter('pido')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                        processOriginFilter === 'pido'
                          ? 'bg-blue-600 text-white shadow-xs font-bold'
                          : 'text-blue-700 dark:text-blue-300 hover:bg-blue-950/40'
                      }`}
                    >
                      <Server size={11} /> PiDo.AI Platform ({pidoItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProcessOriginFilter('external')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                        processOriginFilter === 'external'
                          ? 'bg-orange-600 text-white shadow-xs font-bold'
                          : 'text-orange-700 dark:text-orange-300 hover:bg-orange-950/40'
                      }`}
                    >
                      <Laptop size={11} /> External Host OS ({externalItems.filter(p => p.category !== 'ide').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProcessOriginFilter('ide')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                        processOriginFilter === 'ide'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-purple-700 dark:text-purple-300 hover:bg-purple-950/40'
                      }`}
                    >
                      <Terminal size={11} /> IDE &amp; Dev Tools ({externalItems.filter(p => p.category === 'ide').length})
                    </button>
                  </div>
                  <span className="text-[10px] text-fg-subtle font-mono hidden md:inline">
                    Click column header to sort (กดหัวตารางเพื่อเรียงลำดับ)
                  </span>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-xs table-fixed">
                    <thead className="bg-canvas/80 font-medium border-b border-line text-[11px] text-fg-muted">
                      <tr>
                        {renderSortTh("Process Name", "name", externalSortField, externalSortOrder, handleExternalSort, "w-[28%]")}
                        {renderSortTh("Origin / Ecosystem", "ecosystem", externalSortField, externalSortOrder, handleExternalSort, "w-[17%]")}
                        {renderSortTh("PID", "pid", externalSortField, externalSortOrder, handleExternalSort, "w-[10%]")}
                        {renderSortTh("User", "user", externalSortField, externalSortOrder, handleExternalSort, "w-[9%]")}
                        {renderSortTh("CPU Usage", "cpu_percent", externalSortField, externalSortOrder, handleExternalSort, "w-[12%]")}
                        {renderSortTh("Memory (RSS)", "memory_mb", externalSortField, externalSortOrder, handleExternalSort, "w-[12%]")}
                        <th className="py-2.5 px-3 w-[12%] text-left">Workload Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/50 font-mono text-[11px]">
                      {sortedWorkloads.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-fg-subtle">
                            No processes matching the selected origin filter.
                          </td>
                        </tr>
                      ) : (
                        sortedWorkloads.map((p, idx) => {
                          const isHeavy = p.cpu_percent > 10 || p.memory_mb > 500;
                          const isPido = p.ecosystem === 'pido';

                          return (
                            <tr key={p.pid || idx} className="hover:bg-surface-2/20">
                              {/* Process Name with Friendly Subtitle */}
                              <td className="py-2.5 px-3 font-semibold text-fg">
                                <div className="flex items-center gap-2 min-w-0" title={p.raw_name ? `${p.name} (raw: ${p.raw_name})` : p.name}>
                                  {isPido ? (
                                    <Server size={14} className="text-blue-500 shrink-0" />
                                  ) : p.category === 'ide' ? (
                                    <Terminal size={14} className="text-purple-400 shrink-0" />
                                  ) : (
                                    <Laptop size={14} className="text-orange-400 shrink-0" />
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate font-semibold text-fg text-xs">
                                      {p.name}
                                    </span>
                                    <span className="truncate font-mono text-[9px] text-fg-subtle">
                                      {p.raw_name || 'process'} &bull; PID {p.pid}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Origin / Ecosystem Badge */}
                              <td className="py-2.5 px-3">
                                {renderEcosystemBadge(p.ecosystem, p.category)}
                              </td>

                              {/* PID */}
                              <td className="py-2.5 px-3 text-fg-muted truncate">{p.pid}</td>

                              {/* User */}
                              <td className="py-2.5 px-3 text-fg-secondary truncate">{p.user || 'pi'}</td>

                              {/* CPU Usage */}
                              <td className={`py-2.5 px-3 font-semibold ${isPido ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                {p.cpu_percent != null ? `${p.cpu_percent.toFixed(1)}%` : '-'}
                              </td>

                              {/* Memory RSS */}
                              <td className={`py-2.5 px-3 font-semibold ${isPido ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {p.memory_mb != null ? `${p.memory_mb.toFixed(1)} MB` : '-'}
                              </td>

                              {/* Workload Impact */}
                              <td className="py-2.5 px-3">
                                {isPido ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-950/80 text-blue-300 border border-blue-800/60 font-sans inline-block">
                                    PiDo Service
                                  </span>
                                ) : isHeavy ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-orange-950 text-orange-300 border border-orange-800/60 font-sans inline-block">
                                    Heavy Load
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-surface-2 text-fg-subtle font-sans inline-block">
                                    Normal
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Performance Advice Card */}
              <div className="p-3.5 rounded-xl bg-surface/30 border border-line/60 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-fg-muted">
                  <strong className="text-fg">Performance Tip:</strong> If your AI video stream stutters or drops frames, check if web browsers (like Chromium) or heavy desktop background services are open on this Raspberry Pi. Closing unnecessary external apps will free up CPU cores for the Hailo-8L ingestion pipeline.
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: IN-PLATFORM PROCESSES LIST */}
          {activeTab === 'processes' && (
            <div className="space-y-4">
              {/* Back to Overview Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-surface/50 border border-line">
                <button
                  onClick={() => setActiveTab('hierarchy')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line text-xs font-medium text-blue-600 dark:text-blue-400 transition-colors cursor-pointer shadow-xs group"
                >
                  <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  <span>&larr; Back to Overview &amp; Pipelines (กลับหน้าภาพรวม)</span>
                </button>
                <span className="text-xs text-fg-muted font-mono">
                  PiDo Core CPU: <strong className="text-blue-500">{attribution.internal_cpu_percent?.toFixed(1)}%</strong> | RAM: <strong className="text-fg">{attribution.internal_ram_mb?.toFixed(0)} MB</strong>
                </span>
              </div>

              <div className="border border-line rounded-xl overflow-hidden bg-surface/40">
                <div className="px-4 py-2.5 bg-canvas border-b border-line flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-blue-500" />
                    <h4 className="text-xs font-semibold text-fg">
                      PiDo.AI Ecosystem Processes
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 text-fg-muted font-mono">
                      {sortedPidoProcesses.length} processes
                    </span>
                  </div>

                  {/* Quick Sort Filter Buttons */}
                  <div className="flex items-center gap-1.5 text-[11px] font-sans">
                    <span className="text-fg-subtle text-[10px] mr-1 hidden sm:inline">Quick Sort:</span>
                    <button
                      type="button"
                      onClick={() => { setPidoSortField('cpu_percent'); setPidoSortOrder('desc'); }}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                        pidoSortField === 'cpu_percent' && pidoSortOrder === 'desc'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-surface hover:bg-surface-2 text-fg-secondary border border-line'
                      }`}
                    >
                      🔥 Highest CPU
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPidoSortField('memory_mb'); setPidoSortOrder('desc'); }}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                        pidoSortField === 'memory_mb' && pidoSortOrder === 'desc'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-surface hover:bg-surface-2 text-fg-secondary border border-line'
                      }`}
                    >
                      💾 Highest RAM
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPidoSortField('name'); setPidoSortOrder('asc'); }}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                        pidoSortField === 'name' && pidoSortOrder === 'asc'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-surface hover:bg-surface-2 text-fg-secondary border border-line'
                      }`}
                    >
                      🔤 Name (A-Z)
                    </button>
                  </div>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-xs table-fixed">
                    <thead className="bg-canvas/80 font-medium border-b border-line text-[11px] text-fg-muted">
                      <tr>
                        {renderSortTh("Process Name / Command", "name", pidoSortField, pidoSortOrder, handlePidoSort, "w-[28%]")}
                        {renderSortTh("PID", "pid", pidoSortField, pidoSortOrder, handlePidoSort, "w-[12%]")}
                        {renderSortTh("Role", "role", pidoSortField, pidoSortOrder, handlePidoSort, "w-[14%]")}
                        {renderSortTh("Pipeline Attribution", "pipeline_id", pidoSortField, pidoSortOrder, handlePidoSort, "w-[16%]")}
                        {renderSortTh("CPU Usage", "cpu_percent", pidoSortField, pidoSortOrder, handlePidoSort, "w-[14%]")}
                        {renderSortTh("Memory (RSS)", "memory_mb", pidoSortField, pidoSortOrder, handlePidoSort, "w-[16%]")}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/50 font-mono text-[11px]">
                      {sortedPidoProcesses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-fg-subtle">
                            No active child processes detected.
                          </td>
                        </tr>
                      ) : (
                        sortedPidoProcesses.map((proc, idx) => (
                          <tr key={proc.pid || idx} className="hover:bg-surface-2/20">
                            <td className="py-2.5 px-3 font-semibold text-fg">
                              <div className="flex items-center gap-2 min-w-0" title={proc.name}>
                                <Terminal size={13} className="text-fg-muted shrink-0" />
                                <span className="truncate block font-mono text-[11px]">
                                  {proc.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-fg-muted truncate">{proc.pid}</td>
                            <td className="py-2.5 px-3 truncate">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                proc.role === 'core' 
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800/40' 
                                  : proc.role === 'media_server'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                                  : proc.role === 'frontend'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                                  : 'bg-surface-2 text-fg-secondary'
                              }`}>
                                {proc.role}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-fg-secondary truncate">
                              {proc.pipeline_id ? (
                                <span className="text-blue-600 dark:text-blue-400 font-semibold">{proc.pipeline_id}</span>
                              ) : (
                                <span className="text-fg-subtle">Global / System</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-blue-600 dark:text-blue-400">
                              {proc.cpu_percent != null ? `${proc.cpu_percent.toFixed(1)}%` : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                              {proc.memory_mb != null ? `${proc.memory_mb.toFixed(1)} MB` : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE TREND CHARTS */}
          {activeTab === 'charts' && (
            <div className="space-y-4">
              {/* Back to Overview Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-surface/50 border border-line">
                <button
                  onClick={() => setActiveTab('hierarchy')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line text-xs font-medium text-blue-600 dark:text-blue-400 transition-colors cursor-pointer shadow-xs group"
                >
                  <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  <span>&larr; Back to Overview &amp; Pipelines (กลับหน้าภาพรวม)</span>
                </button>
                <span className="text-xs text-fg-muted">
                  Visual telemetry history: PiDo In-Platform vs Host OS vs Hailo NPU
                </span>
              </div>

              {/* Chart 1: CPU Workload Dynamics */}
              <div className="p-4 rounded-xl bg-surface/60 border border-line">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-fg">
                      <BarChart2 size={16} className="text-blue-600 dark:text-blue-400" /> CPU Workload Dynamics: In-Platform vs External OS vs Hailo NPU
                    </h3>
                    <p className="text-xs text-fg-muted">Rolling real-time CPU performance telemetry history (%)</p>
                  </div>
                </div>

                <div className="h-64 w-full">
                  {history.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="internalCpuGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="externalCpuGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="npuGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                        <XAxis dataKey="time" stroke={chartTheme.axis} fontSize={10} tickLine={false} />
                        <YAxis stroke={chartTheme.axis} fontSize={10} domain={[0, 100]} unit="%" tickLine={false} />
                        <Tooltip 
                          contentStyle={{ ...chartTheme.tooltip.contentStyle, borderRadius: '0.75rem' }}
                          labelStyle={chartTheme.tooltip.labelStyle}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area 
                          type="monotone" 
                          dataKey="internalCpu" 
                          name="PiDo In-Platform CPU %" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#internalCpuGrad)" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="externalCpu" 
                          name="External Host OS CPU %" 
                          stroke="#f97316" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#externalCpuGrad)" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="npu" 
                          name="Hailo-8L NPU %" 
                          stroke="#a855f7" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#npuGrad)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs font-mono text-fg-subtle">
                      Collecting telemetry history samples...
                    </div>
                  )}
                </div>
              </div>

              {/* Chart 2: Memory (RAM) Allocation Dynamics */}
              <div className="p-4 rounded-xl bg-surface/60 border border-line">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-fg">
                      <HardDrive size={16} className="text-emerald-600 dark:text-emerald-400" /> Memory (RAM) Allocation Dynamics: PiDo.AI vs External Host OS
                    </h3>
                    <p className="text-xs text-fg-muted">Rolling real-time memory attribution (MB)</p>
                  </div>
                  <div className="text-xs font-mono text-fg-secondary">
                    Total RAM: {system.ram_total_mb ? `${(system.ram_total_mb / 1024).toFixed(1)} GB` : ''}
                  </div>
                </div>

                <div className="h-64 w-full">
                  {history.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history}>
                        <defs>
                          <linearGradient id="internalRamGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="externalRamGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                        <XAxis dataKey="time" stroke={chartTheme.axis} fontSize={10} tickLine={false} />
                        <YAxis stroke={chartTheme.axis} fontSize={10} unit=" MB" tickLine={false} />
                        <Tooltip 
                          contentStyle={{ ...chartTheme.tooltip.contentStyle, borderRadius: '0.75rem' }}
                          labelStyle={chartTheme.tooltip.labelStyle}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area 
                          type="monotone" 
                          dataKey="internalRamMb" 
                          name="PiDo In-Platform RAM (MB)" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#internalRamGrad)" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="externalRamMb" 
                          name="External Host OS RAM (MB)" 
                          stroke="#f97316" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#externalRamGrad)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs font-mono text-fg-subtle">
                      Collecting memory telemetry samples...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-line/80 bg-surface/60 text-xs font-mono text-fg-subtle">
          <div className="flex items-center gap-2">
            <span>Hardware: Raspberry Pi 5 ({system.cpu_cores?.length || 4} Cores @ {system.cpu_freq_mhz || 2400} MHz)</span>
            <span>&bull;</span>
            <span>AI Hat: {system.npu_device || 'Hailo NPU'}</span>
            <span>&bull;</span>
            <span className={isHealthy ? 'text-emerald-500' : 'text-red-500 font-bold'}>
              Power/Throttle: {system.hardware_health?.message || 'OK'}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors font-sans text-xs text-fg"
          >
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
