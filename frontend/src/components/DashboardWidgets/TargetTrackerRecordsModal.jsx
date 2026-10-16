import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, History, Trophy, TrendingUp, Clock, CheckCircle2, 
  BarChart2, ArrowRight, Trash2, Eye, Calendar, Sparkles, 
  Filter, Play, Square, Layers, RefreshCw, Check
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { chartTheme } from '../../utils/theme';

export default function TargetTrackerRecordsModal({
  isOpen,
  onClose,
  projectId,
  nodeId,
  nodeTitle = 'Target Tracker',
  currentTarget = 100,
  unit = 'items'
}) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'detail' | 'compare'
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Selection for comparison
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Detail view state
  const [detailRecordId, setDetailRecordId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailChartMode, setDetailChartMode] = useState('progress'); // 'progress' | 'count' | 'rate'

  // Comparison view state
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareChartMode, setCompareChartMode] = useState('progress'); // 'progress' | 'actual' | 'rate' | 'bar'

  // Search & filter
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'running' | 'stopped'
  const [searchQuery, setSearchQuery] = useState('');

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Scope filter: this node only vs all project nodes
  const [showAllNodes, setShowAllNodes] = useState(false);

  // Fetch records list
  const fetchRecords = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const qNode = (!showAllNodes && nodeId) ? `&node_id=${nodeId}` : '';
      const url = `/api/projects/${projectId}/target_tracker/records?limit=100${qNode}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load target tracker records');
      const data = await res.json();
      setRecords(data.records || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecords();
    }
  }, [isOpen, projectId, nodeId, showAllNodes]);

  // Fetch detail for a specific record
  const handleOpenDetail = async (recordId) => {
    setDetailRecordId(recordId);
    setActiveTab('detail');
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/target_tracker/records/${recordId}`);
      if (!res.ok) throw new Error('Failed to load record details');
      const data = await res.json();
      setDetailData(data.record);
    } catch (err) {
      console.error(err);
      alert('Could not load record details');
    } finally {
      setDetailLoading(false);
    }
  };

  // Fetch comparison data
  const handleStartCompare = async (idsToCompare = selectedIds) => {
    if (idsToCompare.length < 1) return;
    setActiveTab('compare');
    setCompareLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/target_tracker/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_ids: idsToCompare })
      });
      if (!res.ok) throw new Error('Failed to fetch comparison');
      const data = await res.json();
      setCompareData(data);
    } catch (err) {
      console.error(err);
      alert('Could not load comparison data');
    } finally {
      setCompareLoading(false);
    }
  };

  // Delete record
  const handleDeleteRecord = async (e, recordId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/target_tracker/records/${recordId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete record');
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      setSelectedIds((prev) => prev.filter((id) => id !== recordId));
      if (detailRecordId === recordId) {
        setDetailData(null);
        setActiveTab('list');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete record');
    }
  };

  // Toggle selection for comparison
  const toggleSelect = (e, id) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        if (prev.length >= 6) {
          alert('You can compare at most 6 records at once.');
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesSearch = !searchQuery || (r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase())) || String(r.id).includes(searchQuery);
      return matchesStatus && matchesSearch;
    });
  }, [records, statusFilter, searchQuery]);

  if (!isOpen) return null;

  // Color palette for charts
  const COMPARE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-surface border border-line-strong rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] max-h-[850px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
      >
        {/* Top Header Bar */}
        <div className="bg-surface-2 px-4 py-3 border-b border-line-strong flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <History size={18} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-fg truncate">{nodeTitle} Records</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-fg-muted font-medium border border-line">
                  {records.length} runs
                </span>
              </div>
              <p className="text-xs text-fg-muted truncate">
                Tracked sessions, history analytics, and performance comparison
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={fetchRecords} 
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-surface-3 text-fg-muted hover:text-fg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-3 text-fg-muted hover:text-fg transition-colors"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 border-b border-line bg-surface/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'list' 
                  ? 'border-amber-500 text-amber-500 dark:text-amber-400' 
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`}
            >
              <History size={14} />
              <span>All Records ({records.length})</span>
            </button>

            <button
              onClick={() => {
                if (detailData) setActiveTab('detail');
                else if (records.length > 0) handleOpenDetail(records[0].id);
              }}
              disabled={records.length === 0}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
                activeTab === 'detail' 
                  ? 'border-amber-500 text-amber-500 dark:text-amber-400' 
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`}
            >
              <Eye size={14} />
              <span>Record Details {detailData ? `(#${detailData.id})` : ''}</span>
            </button>

            <button
              onClick={() => {
                if (selectedIds.length >= 1) handleStartCompare();
                else setActiveTab('compare');
              }}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'compare' 
                  ? 'border-amber-500 text-amber-500 dark:text-amber-400' 
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`}
            >
              <BarChart2 size={14} />
              <span>Compare {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</span>
            </button>
          </div>

          {selectedIds.length > 0 && activeTab === 'list' && (
            <div className="flex items-center gap-2 py-1">
              <span className="text-xs text-amber-500 font-medium hidden sm:inline">
                {selectedIds.length} selected
              </span>
              <button
                onClick={() => handleStartCompare()}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all animate-pulse"
              >
                <Trophy size={13} />
                <span>Compare Selected ({selectedIds.length})</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-fg-muted hover:text-fg px-2 py-1"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

          {/* ══════════════════ TAB 1: RECORDS LIST ══════════════════ */}
          {activeTab === 'list' && (
            <div className="flex flex-col gap-3">
              {/* Search & Status Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-2/60 p-2.5 rounded-xl border border-line">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by run name or ID..."
                    className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-1.5 text-xs text-fg focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Filter size={13} className="text-fg-muted" />
                  <span className="text-xs text-fg-muted font-medium">Status:</span>
                  {['all', 'completed', 'running', 'stopped'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`text-xs capitalize px-2.5 py-1 rounded-md transition-colors ${
                        statusFilter === st 
                          ? 'bg-amber-500 text-white font-semibold shadow-xs' 
                          : 'bg-surface-3 text-fg-muted hover:text-fg'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                  {nodeId && (
                    <button
                      onClick={() => setShowAllNodes(!showAllNodes)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1 ml-1.5 ${
                        showAllNodes
                          ? 'bg-amber-500/15 text-amber-500 border-amber-500/40 font-semibold'
                          : 'bg-surface-3 text-fg-muted border-line hover:text-fg'
                      }`}
                      title={showAllNodes ? 'Showing records from all Target Tracker nodes' : 'Showing records for this widget only'}
                    >
                      <Layers size={12} />
                      <span>{showAllNodes ? 'All Nodes' : 'This Widget'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Records Table / Cards */}
              {loading && records.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-fg-muted gap-2">
                  <RefreshCw className="animate-spin text-amber-500" size={24} />
                  <span className="text-sm">Loading records...</span>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-fg-muted gap-3 bg-surface-2/30 rounded-xl border border-dashed border-line">
                  <History size={36} className="text-fg-muted/40" />
                  <span className="text-sm font-medium">No records found</span>
                  <span className="text-xs text-fg-muted/70 max-w-sm text-center">
                    Whenever the target tracker counts items, each session is automatically archived here as 1 record with complete timeline telemetry.
                  </span>
                </div>
              ) : (
                <div className="border border-line rounded-xl overflow-hidden bg-surface shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-2 text-fg-muted font-semibold uppercase tracking-wider border-b border-line text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">
                            <input 
                              type="checkbox"
                              checked={selectedIds.length === filteredRecords.length && filteredRecords.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds(filteredRecords.slice(0, 6).map((r) => r.id));
                                else setSelectedIds([]);
                              }}
                              className="rounded cursor-pointer"
                              title="Select all (max 6)"
                            />
                          </th>
                          <th className="py-2.5 px-3">Run / Batch</th>
                          <th className="py-2.5 px-3">Target</th>
                          <th className="py-2.5 px-3">Actual Count</th>
                          <th className="py-2.5 px-3">Progress</th>
                          <th className="py-2.5 px-3">Duration</th>
                          <th className="py-2.5 px-3">Avg Rate</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Started</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {filteredRecords.map((r) => {
                          const isSelected = selectedIds.includes(r.id);
                          const isOver = r.over_target > 0;
                          return (
                            <tr 
                              key={r.id}
                              onClick={() => handleOpenDetail(r.id)}
                              className={`cursor-pointer transition-colors hover:bg-surface-2/60 ${
                                isSelected ? 'bg-amber-500/5' : ''
                              }`}
                            >
                              <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => toggleSelect(e, r.id)}
                                  className="rounded cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-3 font-semibold text-fg">
                                <div className="flex flex-col">
                                  <span className="truncate max-w-[180px]">{r.name || `Run #${r.id}`}</span>
                                  <span className="text-[10px] text-fg-muted font-mono">ID: {r.id}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-fg-muted font-medium">
                                {r.target?.toLocaleString()} <span className="text-[10px]">{r.unit}</span>
                              </td>
                              <td className="py-3 px-3 font-bold text-fg">
                                <div className="flex items-center gap-1.5">
                                  <span>{r.actual?.toLocaleString()}</span>
                                  {isOver && (
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1 py-0.2 rounded font-mono font-bold border border-emerald-500/20">
                                      +{r.over_target}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2 min-w-[120px]">
                                  <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${
                                        r.status === 'completed' ? 'bg-amber-500' : 'bg-blue-500'
                                      }`}
                                      style={{ width: `${Math.min(100, r.progress_percent || 0)}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-mono text-fg-muted">
                                    {(r.progress_percent || 0).toFixed(0)}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-fg font-medium">
                                <div className="flex items-center gap-1 text-fg-secondary">
                                  <Clock size={11} className="text-fg-muted" />
                                  <span>{r.duration_formatted}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-fg font-medium">
                                <div className="flex items-center gap-1">
                                  <TrendingUp size={11} className="text-fg-muted" />
                                  <span>{r.avg_rate_per_minute?.toFixed(1)}</span>
                                  <span className="text-[10px] text-fg-muted">/min</span>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                {r.status === 'completed' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                                    <CheckCircle2 size={10} /> Completed
                                  </span>
                                ) : r.status === 'running' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-500 border border-blue-500/20 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Running
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-3 text-fg-muted border border-line">
                                    <Square size={10} /> Stopped
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-fg-muted text-[11px]">
                                {r.started_at ? new Date(r.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleOpenDetail(r.id)}
                                    className="p-1 rounded hover:bg-surface-3 text-fg-muted hover:text-fg"
                                    title="View Record Details"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteRecord(e, r.id)}
                                    className="p-1 rounded hover:bg-red-500/10 text-fg-muted hover:text-red-500"
                                    title="Delete Record"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════ TAB 2: RECORD DETAILS ══════════════════ */}
          {activeTab === 'detail' && (
            <div className="flex flex-col gap-4">
              {detailLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-fg-muted gap-2">
                  <RefreshCw className="animate-spin text-amber-500" size={24} />
                  <span className="text-sm">Loading record details...</span>
                </div>
              ) : !detailData ? (
                <div className="py-20 text-center text-fg-muted text-sm">
                  Please select a record from the list to view its complete telemetry and speed analytics.
                </div>
              ) : (
                <>
                  {/* Top Details Header Card */}
                  <div className="bg-surface-2/60 p-4 rounded-xl border border-line flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${detailData.status === 'completed' ? 'bg-amber-500/15 text-amber-500' : 'bg-blue-500/15 text-blue-500'}`}>
                        {detailData.status === 'completed' ? <CheckCircle2 size={24} /> : <TrendingUp size={24} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-fg">{detailData.name || `Run #${detailData.id}`}</h4>
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                            detailData.status === 'completed' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          }`}>
                            {detailData.status}
                          </span>
                        </div>
                        <p className="text-xs text-fg-muted flex items-center gap-3 mt-0.5">
                          <span>Started: {detailData.started_at ? new Date(detailData.started_at).toLocaleString() : '—'}</span>
                          {detailData.completed_at && <span>Completed: {new Date(detailData.completed_at).toLocaleString()}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartCompare([detailData.id])}
                        className="bg-surface-3 hover:bg-surface-2 text-fg text-xs font-semibold px-3 py-1.5 rounded-lg border border-line flex items-center gap-1.5 transition-colors"
                      >
                        <BarChart2 size={13} />
                        <span>Compare with Others</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-surface p-3.5 rounded-xl border border-line flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-fg-muted tracking-wider">Output / Target</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold text-fg">{detailData.actual?.toLocaleString()}</span>
                        <span className="text-xs text-fg-muted">/ {detailData.target?.toLocaleString()} {detailData.unit}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-amber-500 mt-1">
                        {detailData.progress_percent?.toFixed(1)}% achieved
                        {detailData.over_target > 0 && ` (+${detailData.over_target} over)`}
                      </div>
                    </div>

                    <div className="bg-surface p-3.5 rounded-xl border border-line flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-fg-muted tracking-wider">Total Duration</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold text-fg">{detailData.duration_formatted}</span>
                      </div>
                      <span className="text-[11px] text-fg-muted mt-1 font-mono">
                        {detailData.duration_seconds?.toFixed(1)} seconds
                      </span>
                    </div>

                    <div className="bg-surface p-3.5 rounded-xl border border-line flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-fg-muted tracking-wider">Avg Speed</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold text-fg">{detailData.avg_rate_per_minute?.toFixed(1)}</span>
                        <span className="text-xs text-fg-muted">{detailData.unit}/min</span>
                      </div>
                      <span className="text-[11px] text-emerald-500 mt-1 font-medium">
                        ~{((detailData.avg_rate_per_minute || 0) * 60).toFixed(0)} {detailData.unit}/hr
                      </span>
                    </div>

                    <div className="bg-surface p-3.5 rounded-xl border border-line flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-fg-muted tracking-wider">Peak Speed</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold text-fg">{detailData.peak_rate_per_minute?.toFixed(1)}</span>
                        <span className="text-xs text-fg-muted">{detailData.unit}/min</span>
                      </div>
                      <span className="text-[11px] text-fg-muted mt-1 font-medium">
                        Max instantaneous rate
                      </span>
                    </div>
                  </div>

                  {/* Interactive Chart Section */}
                  <div className="bg-surface p-4 rounded-xl border border-line flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                      <div className="flex items-center gap-2">
                        <BarChart2 size={16} className="text-amber-500" />
                        <h4 className="text-xs sm:text-sm font-bold text-fg">Session Timeline Performance</h4>
                        <span className="text-[11px] text-fg-muted">
                          ({detailData.history?.length || 0} telemetry points recorded)
                        </span>
                      </div>

                      {/* Mode Switcher */}
                      <div className="flex items-center bg-surface-2 p-0.5 rounded-lg border border-line text-xs">
                        <button
                          onClick={() => setDetailChartMode('progress')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            detailChartMode === 'progress' 
                              ? 'bg-amber-500 text-white font-semibold shadow-xs' 
                              : 'text-fg-muted hover:text-fg'
                          }`}
                        >
                          📈 Progress %
                        </button>
                        <button
                          onClick={() => setDetailChartMode('count')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            detailChartMode === 'count' 
                              ? 'bg-amber-500 text-white font-semibold shadow-xs' 
                              : 'text-fg-muted hover:text-fg'
                          }`}
                        >
                          📦 Cumulative Count
                        </button>
                        <button
                          onClick={() => setDetailChartMode('rate')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            detailChartMode === 'rate' 
                              ? 'bg-amber-500 text-white font-semibold shadow-xs' 
                              : 'text-fg-muted hover:text-fg'
                          }`}
                        >
                          ⚡ Speed (Rate)
                        </button>
                      </div>
                    </div>

                    {/* Chart Container */}
                    <div className="h-64 w-full">
                      {(!detailData.history || detailData.history.length === 0) ? (
                        <div className="h-full flex items-center justify-center text-fg-muted text-xs">
                          No timeline points recorded for this run.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={detailData.history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="detailGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6}/>
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                            <XAxis 
                              dataKey="t_rel" 
                              stroke={chartTheme.axis}
                              tickFormatter={(val) => `${val}s`}
                              fontSize={11}
                            />
                            <YAxis 
                              stroke={chartTheme.axis}
                              fontSize={11}
                              unit={detailChartMode === 'progress' ? '%' : ''}
                            />
                            <Tooltip {...chartTheme.tooltip} />
                            <Area 
                              type="monotone" 
                              dataKey={detailChartMode === 'progress' ? 'progress' : detailChartMode === 'count' ? 'actual' : 'rate'} 
                              name={detailChartMode === 'progress' ? 'Progress %' : detailChartMode === 'count' ? 'Actual Count' : 'Rate (items/min)'}
                              stroke="#f59e0b" 
                              strokeWidth={2.5}
                              fillOpacity={1} 
                              fill="url(#detailGradient)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════════════ TAB 3: COMPARE RECORDS ══════════════════ */}
          {activeTab === 'compare' && (
            <div className="flex flex-col gap-4">
              {/* Compare Selector Bar */}
              <div className="bg-surface-2/60 p-3 rounded-xl border border-line flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-amber-500" />
                  <span className="text-xs font-bold text-fg">Records Selected for Comparison:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {records.map((r) => {
                      const isSel = selectedIds.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          onClick={() => {
                            if (isSel) {
                              const next = selectedIds.filter((id) => id !== r.id);
                              setSelectedIds(next);
                              if (next.length > 0) handleStartCompare(next);
                            } else {
                              if (selectedIds.length >= 6) return alert('Maximum 6 records to compare');
                              const next = [...selectedIds, r.id];
                              setSelectedIds(next);
                              handleStartCompare(next);
                            }
                          }}
                          className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                            isSel 
                              ? 'bg-amber-500 text-white font-semibold border-amber-600 shadow-xs' 
                              : 'bg-surface-3 text-fg-muted hover:text-fg border-line'
                          }`}
                        >
                          {r.name || `Run #${r.id}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedIds.length > 0 && (
                  <button
                    onClick={() => handleStartCompare()}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={12} className={compareLoading ? "animate-spin" : ""} />
                    <span>Recalculate</span>
                  </button>
                )}
              </div>

              {compareLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-fg-muted gap-2">
                  <RefreshCw className="animate-spin text-amber-500" size={24} />
                  <span className="text-sm">Analyzing and comparing records...</span>
                </div>
              ) : !compareData || !compareData.records || compareData.records.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-fg-muted gap-2 bg-surface-2/30 rounded-xl border border-dashed border-line">
                  <BarChart2 size={36} className="text-fg-muted/40" />
                  <span className="text-sm font-medium">Please select at least 1 record to compare</span>
                  <span className="text-xs text-fg-muted">Choose 2 or more records above to generate a side-by-side KPI comparison and overlaid performance curve.</span>
                </div>
              ) : (
                <>
                  {/* 1. Best Performer Highlights */}
                  {compareData.summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Fastest Run */}
                      {compareData.summary.fastest_id && (() => {
                        const rec = compareData.records.find((r) => r.id === compareData.summary.fastest_id);
                        return rec ? (
                          <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-md">
                              <Trophy size={18} />
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">🏆 Fastest Completion</span>
                              <h5 className="text-sm font-bold text-fg">{rec.name}</h5>
                              <p className="text-xs text-fg-muted font-medium">Completed in {rec.duration_formatted}</p>
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Highest Speed */}
                      {compareData.summary.highest_rate_id && (() => {
                        const rec = compareData.records.find((r) => r.id === compareData.summary.highest_rate_id);
                        return rec ? (
                          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-md">
                              <TrendingUp size={18} />
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">⚡ Highest Average Speed</span>
                              <h5 className="text-sm font-bold text-fg">{rec.name}</h5>
                              <p className="text-xs text-fg-muted font-medium">{rec.avg_rate_per_minute?.toFixed(1)} {rec.unit}/min</p>
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Highest Total Output */}
                      {compareData.summary.highest_output_id && (() => {
                        const rec = compareData.records.find((r) => r.id === compareData.summary.highest_output_id);
                        return rec ? (
                          <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-blue-500 text-white shadow-md">
                              <CheckCircle2 size={18} />
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-blue-500 tracking-wider">📦 Highest Total Output</span>
                              <h5 className="text-sm font-bold text-fg">{rec.name}</h5>
                              <p className="text-xs text-fg-muted font-medium">{rec.actual?.toLocaleString()} items produced</p>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {/* 2. Side-by-Side Numerical Comparison Table */}
                  <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-xs">
                    <div className="p-3 bg-surface-2 border-b border-line flex items-center justify-between">
                      <span className="text-xs font-bold text-fg uppercase tracking-wider">
                        Numerical Comparison Metrics
                      </span>
                      <span className="text-[11px] text-fg-muted">
                        Comparing {compareData.records.length} runs
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-2/40 text-fg-muted border-b border-line text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3 font-semibold text-fg">Metric</th>
                            {compareData.records.map((r, i) => (
                              <th key={r.id} className="py-2.5 px-3 font-bold text-fg">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }}></span>
                                  <span>{r.name}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          <tr>
                            <td className="py-2.5 px-3 font-medium text-fg-muted">Status</td>
                            {compareData.records.map((r) => (
                              <td key={r.id} className="py-2.5 px-3 font-semibold capitalize text-fg">
                                {r.status}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-medium text-fg-muted">Target Count</td>
                            {compareData.records.map((r) => (
                              <td key={r.id} className="py-2.5 px-3 text-fg">
                                {r.target?.toLocaleString()} {r.unit}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-medium text-fg-muted">Actual Produced</td>
                            {compareData.records.map((r) => (
                              <td key={r.id} className="py-2.5 px-3 font-bold text-fg">
                                {r.actual?.toLocaleString()} {r.unit}
                                {r.over_target > 0 && <span className="text-emerald-500 text-[10px] ml-1">(+{r.over_target})</span>}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-medium text-fg-muted">Target Achieved %</td>
                            {compareData.records.map((r) => (
                              <td key={r.id} className="py-2.5 px-3 font-semibold text-amber-500">
                                {r.progress_percent?.toFixed(1)}%
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-medium text-fg-muted">Total Run Time</td>
                            {compareData.records.map((r) => (
                              <td key={r.id} className="py-2.5 px-3 font-medium text-fg">
                                {r.duration_formatted} ({r.duration_seconds?.toFixed(0)}s)
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-medium text-fg-muted">Average Speed</td>
                            {compareData.records.map((r) => (
                              <td key={r.id} className="py-2.5 px-3 font-bold text-fg">
                                {r.avg_rate_per_minute?.toFixed(1)} <span className="text-fg-muted font-normal text-[10px]">{r.unit}/min</span>
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-medium text-fg-muted">Peak Speed</td>
                            {compareData.records.map((r) => (
                              <td key={r.id} className="py-2.5 px-3 text-fg">
                                {r.peak_rate_per_minute?.toFixed(1)} <span className="text-fg-muted text-[10px]">{r.unit}/min</span>
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-medium text-fg-muted">Started At</td>
                            {compareData.records.map((r) => (
                              <td key={r.id} className="py-2.5 px-3 text-fg-muted text-[11px]">
                                {r.started_at ? new Date(r.started_at).toLocaleTimeString() : '—'}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 3. Visual Chart Comparison (Overlaid Normalized Timeline) */}
                  <div className="bg-surface p-4 rounded-xl border border-line flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-fg flex items-center gap-2">
                          <BarChart2 size={16} className="text-amber-500" />
                          <span>Overlaid Chart Comparison (Normalized T=0s)</span>
                        </h4>
                        <p className="text-[11px] text-fg-muted mt-0.5">
                          All runs aligned at start point to compare acceleration and progression speed directly
                        </p>
                      </div>

                      {/* Comparison Chart Mode */}
                      <div className="flex items-center bg-surface-2 p-0.5 rounded-lg border border-line text-xs">
                        <button
                          onClick={() => setCompareChartMode('progress')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            compareChartMode === 'progress' 
                              ? 'bg-amber-500 text-white font-semibold shadow-xs' 
                              : 'text-fg-muted hover:text-fg'
                          }`}
                        >
                          📈 Progress %
                        </button>
                        <button
                          onClick={() => setCompareChartMode('actual')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            compareChartMode === 'actual' 
                              ? 'bg-amber-500 text-white font-semibold shadow-xs' 
                              : 'text-fg-muted hover:text-fg'
                          }`}
                        >
                          📦 Actual Output
                        </button>
                        <button
                          onClick={() => setCompareChartMode('rate')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            compareChartMode === 'rate' 
                              ? 'bg-amber-500 text-white font-semibold shadow-xs' 
                              : 'text-fg-muted hover:text-fg'
                          }`}
                        >
                          ⚡ Speed (Rate)
                        </button>
                        <button
                          onClick={() => setCompareChartMode('bar')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            compareChartMode === 'bar' 
                              ? 'bg-amber-500 text-white font-semibold shadow-xs' 
                              : 'text-fg-muted hover:text-fg'
                          }`}
                        >
                          📊 Side-by-Side Bars
                        </button>
                      </div>
                    </div>

                    {/* Chart Render Area */}
                    <div className="h-72 w-full">
                      {compareChartMode === 'bar' ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={compareData.records} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                            <XAxis dataKey="name" stroke={chartTheme.axis} fontSize={11} />
                            <YAxis stroke={chartTheme.axis} fontSize={11} />
                            <Tooltip {...chartTheme.tooltip} />
                            <Legend />
                            <Bar dataKey="actual" name="Actual Produced" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="target" name="Target" fill="#64748b" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="duration_seconds" name="Duration (sec)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={compareData.normalized_chart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                            <XAxis 
                              dataKey="time_label" 
                              stroke={chartTheme.axis} 
                              fontSize={11}
                            />
                            <YAxis 
                              stroke={chartTheme.axis} 
                              fontSize={11}
                              unit={compareChartMode === 'progress' ? '%' : ''}
                            />
                            <Tooltip {...chartTheme.tooltip} />
                            <Legend />
                            {compareData.records.map((r, i) => (
                              <Line
                                key={r.id}
                                type="monotone"
                                dataKey={`run_${r.id}_${compareChartMode}`}
                                name={r.name}
                                stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5 }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-surface-2 px-4 py-2.5 border-t border-line-strong flex items-center justify-between shrink-0">
          <span className="text-xs text-fg-muted">
            Target Tracker Records & Historical Analytics Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-3 hover:bg-surface text-fg text-xs font-semibold border border-line transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
