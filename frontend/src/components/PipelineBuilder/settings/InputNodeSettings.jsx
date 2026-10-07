import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Camera, Radio, Film, LayoutGrid, List, Settings, 
  ExternalLink, RefreshCw, Check, AlertTriangle, Search, Plus
} from 'lucide-react';

export default function InputNodeSettings({ data, onChange }) {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snapshotTick, setSnapshotTick] = useState(() => Date.now());
  const [imageErrors, setImageErrors] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  const [viewMode, setViewMode] = useState(() => {
    return data?.sourceSelectViewMode || localStorage.getItem('pido_input_source_picker_mode') || 'thumbnail';
  });

  const fetchSources = useCallback(async () => {
    if (data?.isWikiMode) {
      setCameras([
        { id: 'wiki_mock_obj_det', name: 'คลิปจำลอง (Object Detection)', type: 'file', path: 'public/videos/wiki_obj_det.mp4', is_enabled: true },
        { id: 'wiki_mock_pose', name: 'คลิปจำลอง (Pose Estimation)', type: 'file', path: 'public/videos/wiki_pose.mp4', is_enabled: true }
      ]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/entities', { cache: 'no-store' });
      const json = await res.json();
      setCameras(json.cameras || []);
    } catch (err) {
      console.error("Failed to fetch entities", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [data?.isWikiMode]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Periodic thumbnail snapshot refresh every 15s
  useEffect(() => {
    const timer = setInterval(() => {
      setSnapshotTick(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setSnapshotTick(Date.now());
    setImageErrors({});
    await fetchSources();
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('pido_input_source_picker_mode', mode);
    onChange({ sourceSelectViewMode: mode });
  };

  const handleGoToSourceManager = (e) => {
    if (e?.metaKey || e?.ctrlKey) {
      window.open('/settings', '_blank');
    } else {
      navigate('/settings', { state: { tab: 'sources' } });
    }
  };

  const handleSelectSource = (selectedId) => {
    const selectedCam = cameras.find(c => c.id === selectedId);
    onChange({ 
      entityId: selectedId,
      label: selectedCam ? selectedCam.name : data?.label,
      sourceType: selectedCam?.type
    });
  };

  const handleImageError = (camId) => {
    setImageErrors(prev => ({ ...prev, [camId]: true }));
  };

  const handleImageSuccess = (camId) => {
    setImageErrors(prev => ({ ...prev, [camId]: false }));
  };

  const getSourceTheme = (type) => {
    switch (type) {
      case 'rtsp':
        return {
          icon: Radio,
          label: 'RTSP',
          badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
          solidBadge: 'bg-amber-500 text-white',
          dot: 'bg-amber-400'
        };
      case 'local':
        return {
          icon: Camera,
          label: 'USB',
          badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          solidBadge: 'bg-emerald-500 text-white',
          dot: 'bg-emerald-400'
        };
      case 'file':
      default:
        return {
          icon: Film,
          label: 'Video',
          badge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
          solidBadge: 'bg-cyan-500 text-white',
          dot: 'bg-cyan-400'
        };
    }
  };

  const selectedCam = cameras.find(c => c.id === data?.entityId);
  const isFileSource = selectedCam?.type === 'file';

  const filteredCameras = cameras.filter(cam => {
    const matchesType = filterType === 'all' || cam.type === filterType;
    const matchesSearch = !searchQuery.trim() ||
      cam.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cam.path && cam.path.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-4 text-fg">
      {/* ── Source Picker Header & Controls ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
            <span>Input Source</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-surface-3 text-fg-muted border border-line">
              {cameras.length}
            </span>
          </label>

          <div className="flex items-center gap-1.5">
            {/* View Mode Switcher: Thumbnail vs List */}
            <div className="flex items-center bg-surface-2 p-0.5 rounded-lg border border-line shrink-0">
              <button
                type="button"
                onClick={() => handleViewModeChange('thumbnail')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'thumbnail'
                    ? 'bg-surface text-fg shadow-xs border border-line'
                    : 'text-fg-muted hover:text-fg'
                }`}
                title="Thumbnail Grid View"
                aria-label="Thumbnail View"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('list')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'list'
                    ? 'bg-surface text-fg shadow-xs border border-line'
                    : 'text-fg-muted hover:text-fg'
                }`}
                title="List View"
                aria-label="List View"
              >
                <List size={13} />
              </button>
            </div>

            {/* Refresh Snapshots Button */}
            <button
              type="button"
              onClick={handleRefresh}
              className={`p-1.5 rounded-lg text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 border border-line transition-colors active:scale-95 ${
                isRefreshing ? 'animate-spin text-primary' : ''
              }`}
              title="Refresh sources & snapshots"
              aria-label="Refresh sources"
            >
              <RefreshCw size={13} />
            </button>

            {/* Go to Source Manager Button */}
            <button
              type="button"
              onClick={handleGoToSourceManager}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-2 hover:bg-primary hover:text-on-primary text-fg-secondary border border-line transition-all shadow-xs active:scale-95 group shrink-0"
              title="Open Source Manager (in Settings)"
            >
              <Settings size={12} className="text-fg-muted group-hover:text-on-primary transition-colors" />
              <span className="hidden sm:inline">Source Manager</span>
              <ExternalLink size={10} className="opacity-70 group-hover:opacity-100" />
            </button>
          </div>
        </div>

        {/* Quick Search (when 4+ sources) */}
        {cameras.length > 3 && (
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sources..."
              className="w-full bg-surface-2 border border-line rounded-lg pl-7 pr-3 py-1.5 text-xs text-fg placeholder-fg-faint focus:outline-none focus:border-primary"
            />
          </div>
        )}

        {/* ── Sources Display Area ── */}
        {loading ? (
          <div className="text-xs py-8 text-center text-fg-subtle flex flex-col items-center gap-2 bg-surface-2/40 rounded-xl border border-line">
            <RefreshCw size={16} className="animate-spin text-primary" />
            <span>Loading sources & thumbnails...</span>
          </div>
        ) : cameras.length === 0 ? (
          <div className="text-center py-6 px-3 bg-surface-2/40 rounded-xl border border-line flex flex-col items-center justify-center gap-2 text-fg-subtle">
            <Camera size={24} className="opacity-40" />
            <div className="text-xs font-semibold text-fg-secondary">No sources configured</div>
            <p className="text-[11px] text-fg-muted max-w-[200px]">
              Go to Source Manager to add RTSP cameras, USB webcams, or video files.
            </p>
            <button
              type="button"
              onClick={handleGoToSourceManager}
              className="mt-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs active:scale-95"
            >
              <Plus size={13} />
              <span>Add Source in Source Manager</span>
            </button>
          </div>
        ) : filteredCameras.length === 0 ? (
          <div className="text-center py-6 px-3 bg-surface-2/40 rounded-xl border border-line text-xs text-fg-muted flex flex-col items-center gap-1.5">
            <span>No sources match &quot;{searchQuery}&quot;</span>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setFilterType('all'); }}
              className="text-[11px] text-primary hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="max-h-64 sm:max-h-72 overflow-y-auto custom-scrollbar pr-0.5">
            {viewMode === 'thumbnail' ? (
              /* ── Mode 1: Thumbnail Grid ── */
              <div className="grid grid-cols-2 gap-2">
                {filteredCameras.map((cam) => {
                  const isSelected = data?.entityId === cam.id;
                  const hasError = Boolean(imageErrors[cam.id]);
                  const theme = getSourceTheme(cam.type);
                  const IconComponent = theme.icon;

                  return (
                    <div
                      key={cam.id}
                      onClick={() => handleSelectSource(cam.id)}
                      className={`group/card relative rounded-xl border-2 transition-all cursor-pointer overflow-hidden flex flex-col bg-surface-2/70 hover:bg-surface-2 ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500/10 shadow-md ring-2 ring-blue-500/20' 
                          : 'border-line hover:border-blue-400/70'
                      } ${cam.is_enabled === false ? 'opacity-65' : ''}`}
                    >
                      {/* Aspect-ratio thumbnail image */}
                      <div className="w-full aspect-video bg-black/90 relative overflow-hidden flex items-center justify-center select-none">
                        {hasError ? (
                          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-surface-2/60 text-fg-subtle gap-1">
                            <IconComponent size={18} className="opacity-50 text-fg-muted" />
                            <span className="text-[9px] font-medium text-fg-muted">
                              {cam.is_enabled === false ? 'Disabled' : 'No Signal'}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={`/api/camera-snapshot?camera_id=${encodeURIComponent(cam.id)}&_t=${snapshotTick}`}
                            alt={cam.name}
                            loading="lazy"
                            onError={() => handleImageError(cam.id)}
                            onLoad={() => handleImageSuccess(cam.id)}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                          />
                        )}

                        {/* Top Badges Overlay */}
                        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm backdrop-blur-xs ${theme.solidBadge}`}>
                            <IconComponent size={10} />
                            <span>{theme.label}</span>
                          </span>

                          {isSelected ? (
                            <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          ) : (
                            <span className={`w-2 h-2 rounded-full ring-2 ring-black/50 ${
                              cam.is_enabled !== false ? 'bg-emerald-400' : 'bg-amber-400'
                            }`} />
                          )}
                        </div>

                        {/* Bottom gradient hint */}
                        <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                      </div>

                      {/* Card Meta */}
                      <div className="p-2 flex flex-col gap-0.5">
                        <div className="text-xs font-semibold text-fg truncate" title={cam.name}>
                          {cam.name}
                        </div>
                        <div className="text-[10px] text-fg-muted font-mono truncate" title={cam.path}>
                          {cam.type === 'file' ? (cam.path?.split('/').pop() || cam.path) : cam.path}
                        </div>
                        {cam.is_enabled === false && (
                          <span className="text-[9px] text-amber-500 font-medium">Disabled in Device</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── Mode 2: List View ── */
              <div className="flex flex-col gap-1.5">
                {filteredCameras.map((cam) => {
                  const isSelected = data?.entityId === cam.id;
                  const hasError = Boolean(imageErrors[cam.id]);
                  const theme = getSourceTheme(cam.type);
                  const IconComponent = theme.icon;

                  return (
                    <div
                      key={cam.id}
                      onClick={() => handleSelectSource(cam.id)}
                      className={`group/row relative p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 text-left bg-surface-2/70 hover:bg-surface-2 ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500/10 shadow-xs ring-1 ring-blue-500/30' 
                          : 'border-line hover:border-line-strong'
                      } ${cam.is_enabled === false ? 'opacity-65' : ''}`}
                    >
                      {/* Left Thumbnail */}
                      <div className="w-16 sm:w-20 aspect-video rounded-lg overflow-hidden bg-black/90 shrink-0 relative flex items-center justify-center border border-line-strong/40 select-none">
                        {hasError ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-surface-2/60 text-fg-subtle">
                            <IconComponent size={14} className="opacity-50 text-fg-muted" />
                          </div>
                        ) : (
                          <img
                            src={`/api/camera-snapshot?camera_id=${encodeURIComponent(cam.id)}&_t=${snapshotTick}`}
                            alt={cam.name}
                            loading="lazy"
                            onError={() => handleImageError(cam.id)}
                            onLoad={() => handleImageSuccess(cam.id)}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover/row:scale-105"
                          />
                        )}
                        <span className={`absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded text-[8px] font-bold ${theme.solidBadge}`}>
                          {theme.label}
                        </span>
                      </div>

                      {/* Middle Details */}
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-fg truncate" title={cam.name}>
                            {cam.name}
                          </span>
                          {cam.is_enabled === false && (
                            <span className="text-[9px] text-amber-500 font-medium shrink-0">(Disabled)</span>
                          )}
                        </div>
                        <span className="text-[10px] text-fg-muted font-mono truncate" title={cam.path}>
                          {cam.type === 'file' ? (cam.path?.split('/').pop() || cam.path) : cam.path}
                        </span>
                      </div>

                      {/* Right Radio/Check Indicator */}
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500 text-white' 
                          : 'border-line-strong text-transparent'
                      }`}>
                        <Check size={10} strokeWidth={3} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer Navigation link */}
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-line text-fg-muted">
          <span>Manage or add new sources:</span>
          <button
            type="button"
            onClick={handleGoToSourceManager}
            className="text-primary hover:underline flex items-center gap-1 font-semibold"
          >
            <span>Source Manager</span>
            <ExternalLink size={10} />
          </button>
        </div>
      </div>

      {/* ── Active Selection Summary ── */}
      {selectedCam && (
        <div className="text-xs bg-surface-2/60 p-2.5 rounded-lg border border-line flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-fg-subtle">Active Feed</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${getSourceTheme(selectedCam.type).badge}`}>
              {getSourceTheme(selectedCam.type).label}
            </span>
          </div>
          <div className="font-semibold text-fg text-xs truncate">{selectedCam.name}</div>
          <div className="text-[10px] text-fg-muted font-mono truncate">{selectedCam.path}</div>
        </div>
      )}

      {/* ── Disabled Warning ── */}
      {selectedCam && selectedCam.is_enabled === false && (
        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
          <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <span>This camera is currently <strong>disabled</strong> in the Device Settings. No feed will be available.</span>
        </div>
      )}

      {/* ── File-only options ── */}
      {isFileSource && (
        <div className="border border-line-strong rounded-lg p-3 bg-surface-2/30 flex flex-col gap-3">
          <div className="text-xs uppercase font-bold tracking-wider text-fg-subtle">Playback Options</div>

          <label className="text-xs flex items-center justify-between cursor-pointer text-fg-secondary">
            <span>Loop Video</span>
            <input
              type="checkbox"
              className="w-4 h-4 accent-blue-500 cursor-pointer"
              checked={data?.loop ?? true}
              onChange={(e) => onChange({ loop: e.target.checked })}
            />
          </label>

          {!(data?.loop ?? true) && (
            <label className="text-xs flex items-center justify-between text-fg-secondary">
              <span>Loop Count</span>
              <input
                type="number"
                min="1"
                className="bg-surface border border-line-strong rounded p-1 text-xs focus:border-blue-500 outline-none w-28 text-fg"
                value={data?.loop_count ?? 1}
                onChange={(e) => onChange({ loop_count: parseInt(e.target.value) || 1 })}
              />
            </label>
          )}

          <label className="text-xs flex items-center justify-between text-fg-secondary">
            <span>Playback Speed</span>
            <select
              className="bg-surface border border-line-strong rounded p-1 text-xs focus:border-blue-500 outline-none w-28 text-fg"
              value={data?.speed ?? '1.0'}
              onChange={(e) => onChange({ speed: e.target.value })}
            >
              <option value="0.5">0.5x (Slow)</option>
              <option value="1.0">1x (Normal)</option>
              <option value="2.0">2x (Fast)</option>
              <option value="4.0">4x (Ultra)</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
