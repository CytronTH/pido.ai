import React, { useState, useEffect } from 'react';
import { 
  Camera, Radio, Film, Plus, Search, LayoutGrid, List, 
  Sparkles, RefreshCw, Power, CheckCircle2, AlertTriangle, Layers
} from 'lucide-react';
import SourceThumbnailCard from './SourceThumbnailCard';
import SourceListRow from './SourceListRow';
import SourcePreviewModal from './SourcePreviewModal';
import AddSourceModal from './AddSourceModal';
import EditSourceModal from './EditSourceModal';

export default function SourceManager({ 
  sources = [], 
  onSaveEntities, 
  videoDevices = [], 
  onRefreshEntities 
}) {
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('pido_source_view_mode') || 'thumbnail';
  });
  const [filterType, setFilterType] = useState('all'); // 'all', 'rtsp', 'local', 'file'
  const [searchQuery, setSearchQuery] = useState('');
  
  // 10-Second Auto-refreshing Snapshot Tick (Req 1.3.2)
  const [snapshotTick, setSnapshotTick] = useState(Date.now());

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState(null);
  const [editingSource, setEditingSource] = useState(null);

  // Set interval to tick every 10 seconds (Req 1.3.2)
  useEffect(() => {
    const timer = setInterval(() => {
      setSnapshotTick(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('pido_source_view_mode', mode);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleToggleStatus = (id, currentEnabled) => {
    const updated = sources.map(s => s.id === id ? { ...s, is_enabled: !currentEnabled } : s);
    onSaveEntities(updated);
  };

  const handleUpdate = (id, field, value) => {
    const updated = sources.map(s => s.id === id ? { ...s, [field]: value } : s);
    onSaveEntities(updated);
  };

  const handleSaveEditedSource = (updatedSource) => {
    const updated = sources.map(s => s.id === updatedSource.id ? updatedSource : s);
    onSaveEntities(updated);
    if (onRefreshEntities) {
      onRefreshEntities();
    }
  };

  const handleDelete = async (id, name, filePath) => {
    if (!window.confirm(`Delete source "${name}" from system?`)) return;

    if (filePath) {
      try {
        const filename = filePath.split('/').pop();
        await fetch(`/api/videos/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Failed to delete file from disk:', err);
      }
    }

    const updated = sources.filter(s => s.id !== id);
    onSaveEntities(updated);
  };

  const handleSourceAdded = async (newSource) => {
    if (newSource) {
      const updated = [
        ...sources,
        {
          id: `${newSource.type === 'rtsp' ? 'cctv' : newSource.type}_${Date.now()}`,
          ...newSource
        }
      ];
      await onSaveEntities(updated);
    }
    if (onRefreshEntities) {
      await onRefreshEntities();
    }
  };

  // ── Filter & Search Logic ──────────────────────────────────────────────────
  const filteredSources = sources.filter(s => {
    const matchesType = filterType === 'all' || s.type === filterType;
    const matchesSearch = !searchQuery.trim() || 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.path && s.path.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  // Metrics
  const totalCount = sources.length;
  const activeCount = sources.filter(s => s.is_enabled !== false).length;
  const cctvCount = sources.filter(s => s.type === 'rtsp').length;
  const localCount = sources.filter(s => s.type === 'local').length;
  const fileCount = sources.filter(s => s.type === 'file').length;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Top Bar: Header, Metrics, and Add Source Button ── */}
      <div className="bg-gradient-to-r from-surface-2 via-surface to-surface-2 p-5 rounded-2xl border border-line-strong shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-fg flex items-center gap-2">
                Source Entities
                <span className="text-xs bg-surface-3 text-fg-secondary px-2.5 py-0.5 rounded-full font-mono border border-line">
                  {totalCount} Total
                </span>
              </h3>
              <p className="text-xs text-fg-muted mt-0.5">
                Unified source repository: RTSP CCTV cameras, USB/CSI devices, and video media files.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 mt-3 flex-wrap text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {activeCount} Active
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
              <Radio size={13} className="text-amber-500" />
              {cctvCount} CCTV / RTSP
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
              <Camera size={13} className="text-emerald-500" />
              {localCount} Local
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-medium">
              <Film size={13} className="text-cyan-500" />
              {fileCount} Videos
            </span>
          </div>
        </div>

        {/* 1.4 Add Source Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary hover:bg-primary-hover text-on-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-95 shrink-0"
        >
          <Plus size={16} />
          Add New Source
        </button>
      </div>

      {/* ── Filters, Search, and View Mode Switcher (Req 1.2) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-2.5 rounded-xl border border-line">
        {/* Type Filter Pills (Req 1.1) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              filterType === 'all'
                ? 'bg-surface-3 text-fg border border-line-strong'
                : 'text-fg-muted hover:text-fg hover:bg-surface-2'
            }`}
          >
            All Sources ({totalCount})
          </button>

          <button
            onClick={() => setFilterType('rtsp')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              filterType === 'rtsp'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                : 'text-fg-muted hover:text-amber-500 hover:bg-amber-500/10'
            }`}
          >
            <Radio size={12} className="text-amber-500" />
            CCTV / RTSP ({cctvCount})
          </button>

          <button
            onClick={() => setFilterType('local')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              filterType === 'local'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'text-fg-muted hover:text-emerald-500 hover:bg-emerald-500/10'
            }`}
          >
            <Camera size={12} className="text-emerald-500" />
            Local ({localCount})
          </button>

          <button
            onClick={() => setFilterType('file')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              filterType === 'file'
                ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                : 'text-fg-muted hover:text-cyan-500 hover:bg-cyan-500/10'
            }`}
          >
            <Film size={12} className="text-cyan-500" />
            Videos ({fileCount})
          </button>
        </div>

        {/* Search & View Switcher (Req 1.2) */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sources..."
              className="w-full bg-surface-2 border border-line rounded-lg pl-8 pr-3 py-1.5 text-xs text-fg placeholder-fg-faint focus:outline-none focus:border-primary"
            />
          </div>

          {/* View Mode Toggle: Grid vs List (Req 1.2) */}
          <div className="flex items-center bg-surface-2 p-1 rounded-lg border border-line shrink-0">
            <button
              onClick={() => handleViewModeChange('thumbnail')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'thumbnail'
                  ? 'bg-surface text-fg shadow-xs border border-line'
                  : 'text-fg-muted hover:text-fg'
              }`}
              title="Thumbnail Grid View (Req 1.2)"
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
              title="List View (Req 1.2)"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Source Items Display: Thumbnail Cards or List View (Req 1.2) ── */}
      {filteredSources.length === 0 ? (
        <div className="text-center py-16 bg-surface-2/30 rounded-2xl border border-line flex flex-col items-center justify-center gap-3 text-fg-subtle">
          <Layers size={36} className="opacity-40" />
          <div className="text-sm font-semibold text-fg-secondary">No sources match your filter</div>
          <p className="text-xs text-fg-muted max-w-sm">
            Try resetting your search query or click &quot;Add New Source&quot; to connect a CCTV camera or video file.
          </p>
          <button
            onClick={() => { setFilterType('all'); setSearchQuery(''); }}
            className="mt-1 text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : viewMode === 'thumbnail' ? (
        /* ── Thumbnail Grid View ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSources.map((source) => (
            <SourceThumbnailCard
              key={source.id}
              source={source}
              snapshotTick={snapshotTick}
              onPreview={setPreviewSource}
              onEdit={setEditingSource}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      ) : (
        /* ── List View ── */
        <div className="flex flex-col gap-2.5">
          {filteredSources.map((source) => (
            <SourceListRow
              key={source.id}
              source={source}
              snapshotTick={snapshotTick}
              onPreview={setPreviewSource}
              onEdit={setEditingSource}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}

      {/* ── 1.3.3 Fullscreen Pop-up Preview Window Modal ── */}
      <SourcePreviewModal
        source={previewSource}
        isOpen={Boolean(previewSource)}
        onClose={() => setPreviewSource(null)}
      />

      {/* ── 1.4 Add Source Modal ── */}
      <AddSourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSourceAdded={handleSourceAdded}
        videoDevices={videoDevices}
      />

      {/* ── Modify Source Modal (Pencil Edit) ── */}
      <EditSourceModal
        source={editingSource}
        isOpen={Boolean(editingSource)}
        onClose={() => setEditingSource(null)}
        onSave={handleSaveEditedSource}
        videoDevices={videoDevices}
      />
    </div>
  );
}
