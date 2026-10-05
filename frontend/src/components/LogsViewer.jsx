import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, Image as ImageIcon, RefreshCw, X, ChevronDown, ChevronUp, 
  Download, Play, Pause, Grid, List, Tag, 
  CheckCircle2, AlertTriangle, ChevronLeft, 
  ChevronRight, Copy, Check, Sparkles, Maximize2
} from 'lucide-react';

export default function LogsViewer({ projectId, embedded = false }) {
  const TitleTag = embedded ? 'h2' : 'h1';
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbStats, setDbStats] = useState(null);
  const [cameras, setCameras] = useState([]);
  
  // Available tags extracted from snapshot event logs & current selected tag
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');

  // View mode: 'table' or 'gallery'
  const [viewMode, setViewMode] = useState('gallery');
  
  // Modals
  const [selectedLogIndex, setSelectedLogIndex] = useState(null);

  // Copied payload state
  const [copied, setCopied] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [total, setTotal] = useState(0);
  
  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Expandable rows (table view)
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Fetch Database & Storage Stats
  const fetchDbStats = async () => {
    try {
      const url = projectId ? `/api/database/stats?project_id=${projectId}` : '/api/database/stats';
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'success') {
        setDbStats(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch DB stats:", e);
    }
  };

  // Fetch Cameras for Human-readable labels
  const fetchCameras = async () => {
    try {
      const url = projectId ? `/api/entities?project_id=${projectId}` : '/api/entities';
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.cameras) {
        setCameras(data.cameras);
      }
    } catch (e) {
      console.error("Failed to fetch cameras:", e);
    }
  };

  // Fetch distinct tags recorded from snapshot images
  const fetchAvailableTags = async () => {
    try {
      const url = projectId ? `/api/logs/tags?project_id=${projectId}` : '/api/logs/tags';
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.status === 'success' && Array.isArray(data.tags)) {
        setAvailableTags(data.tags);
      } else {
        setAvailableTags([]);
      }
    } catch (e) {
      console.error("Failed to fetch log tags:", e);
      setAvailableTags([]);
    }
  };

  // Map camera_id to human readable camera name
  const cameraMap = useMemo(() => {
    const map = {};
    cameras.forEach(c => {
      map[c.id] = c.name || c.id;
    });
    return map;
  }, [cameras]);

  // Fetch Event Logs
  const fetchLogs = async (currentPage = page, currentTag = selectedTag) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: perPage,
        page: currentPage
      });

      if (projectId) params.append('project_id', projectId);
      if (currentTag) params.append('tag', currentTag);
      
      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json();
      if (data.status === 'success') {
        setLogs(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh everything
  const handleRefresh = () => {
    fetchLogs(page, selectedTag);
    fetchDbStats();
    fetchAvailableTags();
  };

  useEffect(() => {
    fetchDbStats();
    fetchCameras();
    fetchAvailableTags();
  }, [projectId]);

  useEffect(() => {
    fetchLogs(page, selectedTag);
  }, [page, perPage, selectedTag, projectId]);

  // Auto-refresh interval
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs(1, selectedTag);
        fetchDbStats();
        fetchAvailableTags();
        if (page !== 1) setPage(1);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, selectedTag, page, perPage, projectId]);

  // Client-side fallback filter
  const filteredLogs = useMemo(() => {
    if (!selectedTag) return logs;
    const targetTag = selectedTag.toLowerCase();
    return logs.filter(log => {
      const logTags = Array.isArray(log.payload?.tags)
        ? log.payload.tags
        : (log.payload?.tags ? [log.payload.tags] : []);
      return logTags.some(t => String(t).toLowerCase() === targetTag);
    });
  }, [logs, selectedTag]);

  // Tag selection toggle
  const handleSelectTag = (tag) => {
    setSelectedTag(prev => (prev.toLowerCase() === tag.toLowerCase() ? '' : tag));
    setPage(1);
  };

  const toggleRowExpanded = (id) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  // Helper for Result Badge (OK, NG, Snapshot, Alert)
  const getBadgeInfo = (log) => {
    const label = log.payload?.label?.toUpperCase();
    if (label === 'OK') {
      return { text: 'OK', bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', icon: CheckCircle2 };
    }
    if (label === 'NG') {
      return { text: 'NG', bg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse', icon: AlertTriangle };
    }
    const lowerType = (log.event_type || '').toLowerCase();
    if (lowerType.includes('snapshot')) {
      return { text: log.payload?.label || 'SNAPSHOT', bg: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30', icon: ImageIcon };
    }
    if (lowerType.includes('alert') || lowerType.includes('error')) {
      return { text: log.event_type, bg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30', icon: AlertTriangle };
    }
    return { text: log.event_type, bg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30', icon: Sparkles };
  };

  const totalPages = Math.ceil(total / perPage);

  // Export filtered/current logs to CSV
  const exportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'Event Type', 'Result', 'Tags', 'Camera ID', 'Camera Name', 'Node ID', 'Payload', 'Snapshot Path'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => {
        const payloadStr = log.payload ? JSON.stringify(log.payload).replace(/"/g, '""') : '';
        const camName = cameraMap[log.camera_id] || '';
        const resultLabel = log.payload?.label || '';
        const tagsStr = Array.isArray(log.payload?.tags) ? log.payload.tags.join(';') : '';
        return `"${log.timestamp}","${log.event_type}","${resultLabel}","${tagsStr}","${log.camera_id || ''}","${camName}","${log.node_id}","${payloadStr}","${log.snapshot_path || ''}"`;
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pido_logs_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Lightbox Navigation
  const selectedLog = selectedLogIndex !== null ? filteredLogs[selectedLogIndex] : null;

  const handleNextImage = () => {
    if (selectedLogIndex !== null && selectedLogIndex < filteredLogs.length - 1) {
      setSelectedLogIndex(selectedLogIndex + 1);
    }
  };

  const handlePrevImage = () => {
    if (selectedLogIndex !== null && selectedLogIndex > 0) {
      setSelectedLogIndex(selectedLogIndex - 1);
    }
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedLogIndex === null) return;
      if (e.key === 'ArrowRight') handleNextImage();
      if (e.key === 'ArrowLeft') handlePrevImage();
      if (e.key === 'Escape') setSelectedLogIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLogIndex, filteredLogs.length]);

  return (
    <div className={`${embedded ? '' : 'h-full overflow-y-auto'} flex flex-col p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 bg-canvas text-fg font-sans`}>
      
      {/* ── Top Header & Stats Cards ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {!embedded ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-pink-500/20 to-blue-600/20 border border-pink-500/30 flex items-center justify-center text-pink-500 shadow-lg shadow-pink-500/10 shrink-0">
                <Database size={22} className="sm:w-6 sm:h-6" />
              </div>
              <div>
                <TitleTag className="text-xl sm:text-2xl font-black text-fg tracking-tight">
                  Event Logs & Snapshot Gallery
                </TitleTag>
                <p className="text-xs sm:text-sm text-fg-subtle">
                  Chronological records of pipeline detections, alerts, and captured image frames
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <button 
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-medium bg-surface hover:bg-surface-2 text-fg-secondary border border-line hover:border-line-strong transition-all shadow-sm active:scale-95"
                title="Export logs as CSV spreadsheet"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
              
              <button 
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-medium transition-all border active:scale-95 ${
                  autoRefresh 
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-md shadow-emerald-500/10' 
                    : 'bg-surface hover:bg-surface-2 text-fg-muted border-line hover:border-line-strong'
                }`}
              >
                {autoRefresh ? <Pause size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Play size={14} />}
                <span>{autoRefresh ? 'Live' : 'Auto'}</span>
              </button>

              <button 
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1.5 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-semibold transition-all shadow-lg shadow-pink-500/20 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading && !autoRefresh ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              {autoRefresh && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE
                </span>
              )}
            </div>

            {/* Quick Global Actions */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap ml-auto">
              <button 
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-medium bg-surface hover:bg-surface-2 text-fg-secondary border border-line hover:border-line-strong transition-all shadow-sm active:scale-95"
              >
                <Download size={14} />
                <span>Export</span>
              </button>
              
              <button 
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-medium transition-all border active:scale-95 ${
                  autoRefresh 
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-md shadow-emerald-500/10' 
                    : 'bg-surface hover:bg-surface-2 text-fg-muted border-line hover:border-line-strong'
                }`}
              >
                {autoRefresh ? <Pause size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Play size={14} />}
                <span>{autoRefresh ? 'Live' : 'Auto'}</span>
              </button>

              <button 
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1.5 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-semibold transition-all shadow-lg shadow-pink-500/20 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading && !autoRefresh ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        )}

        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Total Events */}
          <div className="bg-surface/80 backdrop-blur-md border border-line/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Total Event Logs</p>
              <h3 className="text-2xl font-extrabold text-fg mt-1 font-mono tracking-tight">
                {total.toLocaleString()}
              </h3>
              <p className="text-[11px] text-fg-subtle mt-0.5">Inference triggers & alerts</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Database size={20} />
            </div>
          </div>

          {/* Snapshots on Disk */}
          <div className="bg-surface/80 backdrop-blur-md border border-line/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Snapshots Stored</p>
              <h3 className="text-2xl font-extrabold text-fg mt-1 font-mono tracking-tight">
                {dbStats?.snapshot_count ? dbStats.snapshot_count.toLocaleString() : '-'}
              </h3>
              <p className="text-[11px] text-fg-subtle mt-0.5">
                {dbStats?.snapshot_size_mb ? `${(dbStats.snapshot_size_mb / 1024).toFixed(2)} GB on disk` : 'Calculating...'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-600 dark:text-pink-400">
              <ImageIcon size={20} />
            </div>
          </div>

          {/* Available Tags Count */}
          <div className="bg-surface/80 backdrop-blur-md border border-line/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Active Tags</p>
              <h3 className="text-2xl font-extrabold text-fg mt-1 font-mono tracking-tight">
                {availableTags.length}
              </h3>
              <p className="text-[11px] text-fg-subtle mt-0.5">
                {selectedTag ? `Filtered by #${selectedTag}` : 'All tags visible'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500">
              <Tag size={20} />
            </div>
          </div>

          {/* Display Mode Switcher */}
          <div className="bg-surface/80 backdrop-blur-md border border-line/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Display Mode</span>
              <span className="text-[10px] bg-surface-2 text-fg-secondary px-2 py-0.5 rounded-md border border-line-strong">
                {viewMode === 'gallery' ? 'Visual Grid' : 'Data Table'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setViewMode('gallery')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  viewMode === 'gallery'
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                    : 'bg-surface-2 hover:bg-surface-3 text-fg-muted hover:text-fg'
                }`}
              >
                <Grid size={14} /> Gallery
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  viewMode === 'table'
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                    : 'bg-surface-2 hover:bg-surface-3 text-fg-muted hover:text-fg'
                }`}
              >
                <List size={14} /> Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Exclusive Tags Filter Bar (Shown only if tags exist) ─────────────────────────── */}
      {availableTags.length > 0 && (
        <div className="bg-surface/90 border border-line/90 rounded-2xl p-3 sm:p-4 shadow-lg flex items-center justify-between gap-3 flex-wrap animate-in fade-in">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 max-w-full scrollbar-none flex-1">
            <span className="text-xs font-semibold text-fg-secondary mr-1 flex items-center gap-1.5 shrink-0">
              <Tag size={14} className="text-pink-500" />
              Tags:
            </span>

            {/* All Tag Pill */}
            <button
              onClick={() => {
                setSelectedTag('');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 active:scale-95 ${
                !selectedTag
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                  : 'bg-canvas/80 hover:bg-surface-2 text-fg-muted border border-line'
              }`}
            >
              All
            </button>

            {/* Individual Tag Pills */}
            {availableTags.map((tag) => {
              const isSelected = selectedTag.toLowerCase() === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  onClick={() => handleSelectTag(tag)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 active:scale-95 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30 ring-2 ring-pink-400/50'
                      : 'bg-canvas/80 hover:bg-surface-2 text-fg-secondary border border-line hover:border-pink-500/40'
                  }`}
                >
                  <span>#{tag}</span>
                  {isSelected && <X size={12} className="opacity-80" />}
                </button>
              );
            })}
          </div>

          {selectedTag && (
            <button
              onClick={() => {
                setSelectedTag('');
                setPage(1);
              }}
              className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg px-2.5 py-1.5 bg-surface-2 rounded-xl border border-line transition-colors active:scale-95 shrink-0"
            >
              <X size={12} /> Clear Filter
            </button>
          )}
        </div>
      )}

      {/* ── Main Content Area (Gallery or Table) ────────────────────────── */}
      {viewMode === 'gallery' ? (
        /* ── Visual Gallery View ───────────────────────────────────────── */
        <div className="flex-1 bg-surface/60 border border-line/80 rounded-2xl p-5 shadow-xl flex flex-col">
          {loading && logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-fg-subtle gap-3">
              <RefreshCw size={28} className="animate-spin text-pink-500" />
              <p className="text-sm">Loading snapshots from database...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-fg-subtle gap-3">
              <ImageIcon size={38} className="text-fg-faint" />
              <p className="text-base font-semibold text-fg-secondary">
                {selectedTag ? `No snapshots found matching #${selectedTag}` : 'No snapshot events found'}
              </p>
              <p className="text-xs text-fg-subtle max-w-sm text-center">
                {selectedTag ? (
                  <button 
                    onClick={() => { setSelectedTag(''); setPage(1); }} 
                    className="text-pink-600 dark:text-pink-400 hover:underline font-medium"
                  >
                    Clear tag filter to view all snapshots
                  </button>
                ) : (
                  'Snapshots captured by Snapshot nodes will appear here.'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredLogs.map((log, index) => {
                const badge = getBadgeInfo(log);
                const BadgeIcon = badge.icon;
                const snapUrl = log.snapshot_path ? `/api/snapshots/${log.snapshot_path.split('/').pop()}` : null;
                const camName = cameraMap[log.camera_id] || log.camera_id || 'Camera';
                const timeStr = new Date(log.timestamp + 'Z').toLocaleTimeString();
                const dateStr = new Date(log.timestamp + 'Z').toLocaleDateString();
                const logTags = Array.isArray(log.payload?.tags) ? log.payload.tags : [];

                return (
                  <div 
                    key={log.id}
                    onClick={() => setSelectedLogIndex(index)}
                    className="group relative bg-canvas/80 border border-line/80 hover:border-pink-500/50 rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:shadow-pink-500/5 transition-all duration-300 cursor-pointer flex flex-col"
                  >
                    {/* Image Preview Container */}
                    <div className="relative aspect-video bg-surface overflow-hidden flex items-center justify-center">
                      {snapUrl ? (
                        <img 
                          src={snapUrl} 
                          alt="Snapshot"
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}

                      <div className={`${snapUrl ? 'hidden' : 'flex'} flex-col items-center justify-center text-fg-faint gap-1 p-2 text-center`}>
                        <ImageIcon size={24} />
                        <span className="text-[10px]">No image</span>
                      </div>

                      {/* Result Badge Overlay */}
                      <div className="absolute top-2 left-2 z-10">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border backdrop-blur-md shadow-sm ${badge.bg}`}>
                          <BadgeIcon size={12} />
                          {badge.text}
                        </span>
                      </div>

                      {/* Time Badge Overlay */}
                      <div className="absolute bottom-2 right-2 z-10 bg-black/60 backdrop-blur-md border border-fg/10 px-1.5 py-0.5 rounded-md text-[10px] font-mono text-fg-secondary">
                        {timeStr}
                      </div>

                      {/* Zoom Indicator on Hover */}
                      <div className="absolute inset-0 bg-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-surface/80 backdrop-blur-sm flex items-center justify-center text-fg shadow-lg">
                          <Maximize2 size={14} />
                        </div>
                      </div>
                    </div>

                    {/* Meta Footer */}
                    <div className="p-3 flex flex-col justify-between flex-1 bg-canvas">
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-semibold text-fg-secondary truncate" title={camName}>
                          {camName}
                        </span>
                        <span className="text-[10px] text-fg-subtle font-mono">
                          {dateStr}
                        </span>
                      </div>

                      {/* Tags Badges or Payload Label */}
                      {logTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {logTags.map((t, idx) => (
                            <span 
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectTag(t);
                              }}
                              className="text-[10px] bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 px-1.5 py-0.5 rounded font-mono hover:bg-pink-500/25 transition-colors"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1.5 text-[10px] font-mono text-fg-muted bg-surface/80 px-2 py-1 rounded-lg border border-line/60 truncate">
                          {log.payload?.label || log.event_type}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Enhanced Table View ────────────────────────────────────────── */
        <div className="flex-1 bg-surface/60 border border-line/80 rounded-2xl overflow-hidden flex flex-col shadow-xl">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs text-fg-secondary">
              <thead className="text-[11px] font-semibold text-fg-muted uppercase bg-surface/90 border-b border-line sticky top-0 backdrop-blur-md z-10">
                <tr>
                  <th className="px-4 py-3.5 w-10 text-center"></th>
                  <th className="px-4 py-3.5">Snapshot</th>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Event / Result</th>
                  <th className="px-5 py-3.5">Tags</th>
                  <th className="px-5 py-3.5">Camera</th>
                  <th className="px-5 py-3.5">Node ID</th>
                  <th className="px-5 py-3.5">Payload Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 font-sans">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center text-fg-subtle">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-pink-500" />
                        <p className="text-sm">Loading event logs...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center text-fg-subtle">
                      <div className="flex flex-col items-center gap-2">
                        <Database size={32} className="text-fg-faint" />
                        <p className="text-sm font-semibold text-fg-secondary">
                          {selectedTag ? `No logs found matching #${selectedTag}` : 'No logs found'}
                        </p>
                        <p className="text-xs text-fg-subtle">
                          {selectedTag ? 'Try selecting another tag or clearing the filter.' : 'Captured snapshot events will be listed here.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, index) => {
                    const isExpanded = expandedRows.has(log.id);
                    const badge = getBadgeInfo(log);
                    const BadgeIcon = badge.icon;
                    const snapUrl = log.snapshot_path ? `/api/snapshots/${log.snapshot_path.split('/').pop()}` : null;
                    const camName = cameraMap[log.camera_id] || log.camera_id || '-';
                    const logTags = Array.isArray(log.payload?.tags) ? log.payload.tags : [];

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-surface-2/40 transition-colors group">
                          {/* Expand Button */}
                          <td className="px-3 py-3 text-center">
                            {log.payload && (
                              <button 
                                onClick={() => toggleRowExpanded(log.id)}
                                className="text-fg-subtle hover:text-fg p-1 rounded-lg transition-colors hover:bg-surface-2"
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            )}
                          </td>

                          {/* Snapshot Thumbnail */}
                          <td className="px-4 py-3">
                            {snapUrl ? (
                              <div 
                                onClick={() => setSelectedLogIndex(index)}
                                className="w-14 h-9 rounded-lg overflow-hidden bg-canvas border border-line cursor-pointer relative group/thumb hover:border-pink-500 transition-colors"
                              >
                                <img 
                                  src={snapUrl} 
                                  alt="Thumb" 
                                  className="w-full h-full object-cover" 
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                  <Maximize2 size={12} className="text-fg" />
                                </div>
                              </div>
                            ) : (
                              <span className="text-fg-faint font-mono text-[11px]">-</span>
                            )}
                          </td>

                          {/* Timestamp */}
                          <td className="px-5 py-3 whitespace-nowrap font-mono text-[11px] text-fg-secondary">
                            {new Date(log.timestamp + 'Z').toLocaleString()}
                          </td>

                          {/* Event / Result */}
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.bg}`}>
                              <BadgeIcon size={12} />
                              {badge.text}
                            </span>
                          </td>

                          {/* Tags Column */}
                          <td className="px-5 py-3">
                            {logTags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {logTags.map((t, idx) => (
                                  <span
                                    key={idx}
                                    onClick={() => handleSelectTag(t)}
                                    className="text-[10px] bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 px-1.5 py-0.5 rounded font-mono cursor-pointer hover:bg-pink-500/25 transition-colors"
                                  >
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-fg-subtle text-[11px] font-mono">-</span>
                            )}
                          </td>

                          {/* Camera Name */}
                          <td className="px-5 py-3 text-fg font-medium">
                            {camName}
                          </td>

                          {/* Node ID */}
                          <td className="px-5 py-3 font-mono text-[11px] text-fg-muted">
                            {log.node_id}
                          </td>

                          {/* Payload Summary */}
                          <td className="px-5 py-3 font-mono text-[11px] text-fg-muted max-w-[280px] truncate">
                            {log.payload ? JSON.stringify(log.payload) : '-'}
                          </td>
                        </tr>

                        {/* Expanded Payload Code Block */}
                        {isExpanded && log.payload && (
                          <tr className="bg-canvas/70">
                            <td colSpan="8" className="px-6 py-4 border-l-2 border-l-pink-500">
                              <div className="bg-canvas p-4 rounded-xl border border-line/80 shadow-inner">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[11px] text-fg-muted font-bold uppercase tracking-wider">
                                    Structured Payload Data
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(JSON.stringify(log.payload, null, 2));
                                      setCopied(true);
                                      setTimeout(() => setCopied(false), 2000);
                                    }}
                                    className="flex items-center gap-1.5 text-[11px] text-fg-muted hover:text-fg px-2.5 py-1 rounded-lg bg-surface border border-line transition-colors"
                                  >
                                    {copied ? <Check size={12} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={12} />}
                                    <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                                  </button>
                                </div>
                                <pre className="p-3 bg-surface/80 rounded-lg text-[11px] font-mono text-fg overflow-x-auto border border-line-subtle">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination Footer ───────────────────────────────────────────── */}
      <div className="bg-surface/80 border border-line rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-fg-muted shadow-sm">
        <div>
          Showing {total === 0 ? 0 : Math.min((page - 1) * perPage + 1, total)} to {Math.min(page * perPage, total)} of {total.toLocaleString()} records
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>Per page:</span>
            <select 
              value={perPage} 
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="bg-canvas border border-line rounded-lg px-2.5 py-1 text-fg focus:outline-none focus:border-pink-500 cursor-pointer"
            >
              <option value="20">20</option>
              <option value="30">30</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button 
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors text-fg-secondary flex items-center gap-1 font-medium"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <div className="px-3 py-1 font-semibold text-fg bg-canvas border border-line rounded-xl">
              {page} / {totalPages || 1}
            </div>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors text-fg-secondary flex items-center gap-1 font-medium"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Lightbox Image Inspector Modal ─────────────────────────────── */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="relative max-w-5xl w-full bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-surface/90 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-500">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                    Snapshot Inspector
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getBadgeInfo(selectedLog).bg}`}>
                      {getBadgeInfo(selectedLog).text}
                    </span>
                  </h3>
                  <p className="text-[11px] text-fg-muted">
                    {cameraMap[selectedLog.camera_id] || selectedLog.camera_id || 'Camera'} • {new Date(selectedLog.timestamp + 'Z').toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedLog.snapshot_path && (
                  <a 
                    href={`/api/snapshots/${selectedLog.snapshot_path.split('/').pop()}`}
                    download
                    className="p-2 bg-surface-2 hover:bg-surface-3 text-fg-secondary hover:text-fg rounded-xl transition-colors border border-line-strong/80 text-xs flex items-center gap-1.5"
                    title="Download high-resolution image"
                  >
                    <Download size={15} />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                )}
                <button 
                  onClick={() => setSelectedLogIndex(null)}
                  className="p-2 bg-surface-2 hover:bg-surface-3 text-fg-muted hover:text-fg rounded-xl transition-colors border border-line-strong/80"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body: Image + Metadata */}
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row bg-canvas">
              
              {/* Image View with Navigation Arrows */}
              <div className="relative flex-1 bg-black flex items-center justify-center p-4 min-h-[360px] max-h-[65vh]">
                {selectedLog.snapshot_path ? (
                  <img 
                    src={`/api/snapshots/${selectedLog.snapshot_path.split('/').pop()}`} 
                    alt="Snapshot Large" 
                    className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="text-fg-faint flex flex-col items-center gap-2">
                    <ImageIcon size={48} />
                    <span>No snapshot image file available</span>
                  </div>
                )}

                {/* Left/Right Prev/Next Buttons */}
                {selectedLogIndex > 0 && (
                  <button 
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-surface/80 hover:bg-surface-2 text-fg border border-line-strong/80 shadow-lg backdrop-blur-md transition-all active:scale-95"
                    title="Previous Snapshot (Arrow Left)"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}

                {selectedLogIndex < filteredLogs.length - 1 && (
                  <button 
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-surface/80 hover:bg-surface-2 text-fg border border-line-strong/80 shadow-lg backdrop-blur-md transition-all active:scale-95"
                    title="Next Snapshot (Arrow Right)"
                  >
                    <ChevronRight size={20} />
                  </button>
                )}
              </div>

              {/* Sidebar Metadata */}
              <div className="w-full md:w-80 bg-surface/80 border-t md:border-t-0 md:border-l border-line p-5 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-2">Event Information</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-line/80">
                        <span className="text-fg-subtle">Log ID</span>
                        <span className="font-mono text-fg-secondary">{selectedLog.id}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-line/80">
                        <span className="text-fg-subtle">Event Type</span>
                        <span className="text-fg font-semibold">{selectedLog.event_type}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-line/80">
                        <span className="text-fg-subtle">Camera</span>
                        <span className="text-fg font-medium truncate max-w-[150px]" title={cameraMap[selectedLog.camera_id]}>
                          {cameraMap[selectedLog.camera_id] || selectedLog.camera_id}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-line/80">
                        <span className="text-fg-subtle">Pipeline Node</span>
                        <span className="font-mono text-[11px] text-fg-secondary truncate max-w-[140px]" title={selectedLog.node_id}>
                          {selectedLog.node_id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tags Detail in Lightbox */}
                  {Array.isArray(selectedLog.payload?.tags) && selectedLog.payload.tags.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-1.5 flex items-center gap-1.5">
                        <Tag size={12} className="text-pink-500" /> Snapshot Tags
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedLog.payload.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 font-mono"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payload Details */}
                  {selectedLog.payload && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">Payload JSON</h4>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(selectedLog.payload, null, 2));
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="text-[10px] text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 flex items-center gap-1"
                        >
                          {copied ? <Check size={11} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={11} />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="bg-canvas p-3 rounded-xl border border-line text-[11px] text-pink-800 dark:text-pink-200 font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                        {JSON.stringify(selectedLog.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="pt-4 text-center">
                  <span className="text-[11px] text-fg-subtle">
                    Item {selectedLogIndex + 1} of {filteredLogs.length} on this page
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
