import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, HardDrive, Image as ImageIcon, Trash2, Activity, 
  ShieldAlert, Check, RefreshCw, Archive, Zap, Server, 
  BarChart3, DatabaseZap, Code2, X, AlertTriangle 
} from 'lucide-react';
import SqlExplorer from './SqlExplorer';

export default function DatabaseMonitoring({ projectId }) {
  const [activeTab, setActiveTab] = useState('health');
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Notifications & Modals
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [showVacuumModal, setShowVacuumModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupOptions, setCleanupOptions] = useState({
    days: 30,
    max_records: 50000,
    delete_files: true
  });

  const fetchDbStats = useCallback(async () => {
    try {
      const url = projectId ? `/api/database/stats?project_id=${projectId}` : '/api/database/stats';
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'success') {
        setDbStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch DB stats:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDbStats();
    const interval = setInterval(fetchDbStats, 10000);
    return () => clearInterval(interval);
  }, [fetchDbStats]);

  const handleExecuteCleanup = async () => {
    setActionLoading(true);
    setCleanupResult(null);
    try {
      const res = await fetch('/api/database/maintenance/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanupOptions)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setCleanupResult(data.result);
        setFeedbackMessage({
          type: 'success',
          text: `Cleanup finished: Deleted ${data.result?.deleted_rows?.toLocaleString() || 0} rows and ${data.result?.deleted_files?.toLocaleString() || 0} files.`
        });
        fetchDbStats();
      } else {
        setCleanupResult({ error: data.message || 'Cleanup failed' });
      }
    } catch (err) {
      setCleanupResult({ error: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleVacuum = async () => {
    setShowVacuumModal(false);
    setActionLoading(true);
    try {
      const res = await fetch('/api/database/maintenance/vacuum', { method: 'POST' });
      const data = await res.json();
      setFeedbackMessage({
        type: data.status === 'success' ? 'success' : 'error',
        text: data.message || (data.status === 'success' ? 'Database vacuum completed successfully.' : 'Vacuum failed.')
      });
      fetchDbStats();
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: 'Vacuum failed: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRollup = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/database/maintenance/rollup', { method: 'POST' });
      const data = await res.json();
      setFeedbackMessage({
        type: data.status === 'success' ? 'success' : 'error',
        text: data.message || (data.status === 'success' ? 'Hourly data rollup completed successfully.' : 'Rollup failed.')
      });
      fetchDbStats();
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: 'Rollup failed: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-5 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
      
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 via-indigo-500/15 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-blue-500 shadow-lg shadow-blue-500/10 shrink-0">
            <DatabaseZap size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-fg">Database System</h1>
            <p className="text-[11px] sm:text-xs text-fg-muted mt-0.5">
              Hardware storage metrics, automated database maintenance, and live SQL diagnostics
            </p>
          </div>
        </div>

        {/* Tab Switcher & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <nav className="flex items-center gap-1.5 bg-surface/80 border border-line rounded-2xl p-1.5 shadow-sm" role="tablist">
            <button
              id="db-sys-tab-health"
              role="tab"
              aria-selected={activeTab === 'health'}
              onClick={() => setActiveTab('health')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border whitespace-nowrap transition-all active:scale-95 ${
                activeTab === 'health'
                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-sm shadow-blue-500/10'
                  : 'border-transparent text-fg-muted hover:text-fg hover:bg-surface-2'
              }`}
            >
              <Activity size={15} /> Health & Maintenance
            </button>
            <button
              id="db-sys-tab-explorer"
              role="tab"
              aria-selected={activeTab === 'explorer'}
              onClick={() => setActiveTab('explorer')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border whitespace-nowrap transition-all active:scale-95 ${
                activeTab === 'explorer'
                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-sm shadow-blue-500/10'
                  : 'border-transparent text-fg-muted hover:text-fg hover:bg-surface-2'
              }`}
            >
              <Code2 size={15} /> SQL Explorer
            </button>
          </nav>

          {activeTab === 'health' && (
            <button 
              onClick={fetchDbStats}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-surface hover:bg-surface-2 text-fg-secondary border border-line rounded-xl transition-all text-xs font-semibold shadow-sm active:scale-95"
              title="Refresh database metrics"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* ── In-App Feedback Toast / Banner ──────────────────────────────────── */}
      {feedbackMessage && (
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm ${
          feedbackMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedbackMessage.type === 'success' ? (
              <Check size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldAlert size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="font-medium">{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-fg-subtle hover:text-fg transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Tab Views ───────────────────────────────────────────────────────── */}
      {activeTab === 'explorer' ? (
        <div className="flex-1 min-h-[560px] bg-surface/80 rounded-2xl overflow-hidden border border-line p-4 sm:p-5 shadow-sm">
          <SqlExplorer />
        </div>
      ) : (
        <>
          {/* Primary Storage Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            
            {/* Main Device Storage */}
            <div className="bg-surface/90 border border-line rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Device Storage</p>
                  <h3 className="text-2xl font-extrabold mt-1 tracking-tight text-fg font-mono">
                    {dbStats?.disk_free_gb ? `${dbStats.disk_free_gb} GB` : (loading ? '...' : '-')}
                  </h3>
                  <p className="text-xs text-fg-subtle mt-1">Free of {dbStats?.disk_total_gb || 0} GB</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  dbStats?.disk_usage_percent > 85 
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' 
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  <HardDrive size={20} />
                </div>
              </div>
              {dbStats && (
                <div className="mt-4 w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      dbStats.disk_usage_percent > 85 ? 'bg-rose-500' : dbStats.disk_usage_percent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} 
                    style={{ width: `${Math.min(100, dbStats.disk_usage_percent)}%` }} 
                  />
                </div>
              )}
            </div>

            {/* Config DB Size */}
            <div className="bg-surface/90 border border-line rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Config DB</p>
                <h3 className="text-2xl font-extrabold mt-1 tracking-tight text-fg font-mono">
                  {dbStats?.db_file_size_mb ? `${dbStats.db_file_size_mb} MB` : (loading ? '...' : '-')}
                </h3>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Projects, Models, Cameras</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Database size={20} />
              </div>
            </div>

            {/* Telemetry DB Size */}
            <div className="bg-surface/90 border border-line rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Telemetry DB</p>
                <h3 className="text-2xl font-extrabold mt-1 tracking-tight text-fg font-mono">
                  {dbStats?.telemetry_file_size_mb ? `${dbStats.telemetry_file_size_mb} MB` : (loading ? '...' : '-')}
                </h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Real-time Event Logs</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <DatabaseZap size={20} />
              </div>
            </div>

            {/* Snapshots Size */}
            <div className="bg-surface/90 border border-line rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Snapshot Images</p>
                <h3 className="text-2xl font-extrabold mt-1 tracking-tight text-fg font-mono">
                  {dbStats?.snapshot_size_mb ? `${(dbStats.snapshot_size_mb / 1024).toFixed(2)} GB` : (loading ? '...' : '-')}
                </h3>
                <p className="text-xs text-fg-subtle mt-1">{dbStats?.snapshot_count?.toLocaleString() || 0} files stored</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-fg-muted shrink-0">
                <ImageIcon size={20} />
              </div>
            </div>
          </div>

          {/* Row Counts & Write Queue Health */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            
            {/* Data Row Counts */}
            <div className="bg-surface/90 border border-line rounded-2xl p-5 sm:p-6 shadow-sm">
              <h2 className="text-sm font-bold text-fg mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-blue-500" /> Data Row Counts
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-canvas p-3 sm:p-3.5 rounded-xl border border-line">
                  <div className="text-xs text-fg-subtle mb-1">Raw Event Logs</div>
                  <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{dbStats?.total_event_logs?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-canvas p-3 sm:p-3.5 rounded-xl border border-line">
                  <div className="text-xs text-fg-subtle mb-1">System Metrics</div>
                  <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{dbStats?.total_metrics?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-canvas p-3 sm:p-3.5 rounded-xl border border-line">
                  <div className="text-xs text-fg-subtle mb-1">Raw Class Counts</div>
                  <div className="text-xl font-bold font-mono text-fg">{dbStats?.total_class_counts?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-emerald-500/5 p-3 sm:p-3.5 rounded-xl border border-emerald-500/20">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Hourly Rollups</div>
                  <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{dbStats?.total_hourly_rollups?.toLocaleString() || 0}</div>
                </div>
              </div>
            </div>

            {/* Database Write Queue Health */}
            <div className="bg-surface/90 border border-line rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <h2 className="text-sm font-bold text-fg mb-4 flex items-center gap-2">
                <Server size={16} className="text-indigo-500" /> Write Queue Status
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 flex-1">
                <div className="bg-canvas p-4 rounded-xl border border-line relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-semibold">Pending Writes</div>
                    <div className="text-3xl font-mono font-bold text-fg mt-1">{dbStats?.log_queue_size || 0}</div>
                  </div>
                  <div className="text-[11px] text-fg-subtle mt-3">Capacity: {dbStats?.log_queue_max || 10000} items</div>
                  
                  {dbStats && (
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-surface-2">
                      <div 
                        className={`h-full transition-all duration-300 ${dbStats.log_queue_size > 5000 ? 'bg-rose-500' : 'bg-blue-500'}`}
                        style={{ width: `${(dbStats.log_queue_size / (dbStats.log_queue_max || 10000)) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
                
                <div className="bg-canvas p-4 rounded-xl border border-line flex flex-col justify-center">
                  <div className="text-xs text-fg-subtle mb-1">Pipeline Writer Engine</div>
                  {dbStats?.log_queue_size > 5000 ? (
                    <div className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 text-base">
                      <ShieldAlert size={18} /> High Load
                    </div>
                  ) : (
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 text-base">
                      <Check size={18} /> Normal Health
                    </div>
                  )}
                  <div className="text-[11px] text-fg-subtle mt-2">Background asynchronous batch writer is active.</div>
                </div>
              </div>
            </div>

          </div>

          {/* Maintenance Actions */}
          <div className="bg-surface/90 border border-line rounded-2xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-sm font-bold text-fg mb-4 flex items-center gap-2">
              <Activity size={16} className="text-blue-500" /> Database Maintenance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              
              <button 
                onClick={handleRollup}
                disabled={actionLoading}
                className="bg-canvas hover:bg-surface-2 text-fg border border-line hover:border-emerald-500/40 p-4 rounded-xl flex items-start gap-3 transition-all text-left shadow-sm active:scale-95 disabled:opacity-50 group"
              >
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                  <Zap size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Force Rollup</div>
                  <div className="text-xs text-fg-muted mt-1 leading-relaxed">
                    Aggregate raw metrics into hourly summary buckets immediately
                  </div>
                </div>
              </button>
              
              <button 
                onClick={() => setShowVacuumModal(true)}
                disabled={actionLoading}
                className="bg-canvas hover:bg-surface-2 text-fg border border-line hover:border-indigo-500/40 p-4 rounded-xl flex items-start gap-3 transition-all text-left shadow-sm active:scale-95 disabled:opacity-50 group"
              >
                <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                  <Archive size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Vacuum Database</div>
                  <div className="text-xs text-fg-muted mt-1 leading-relaxed">
                    Defragment database pages and reclaim unused disk space
                  </div>
                </div>
              </button>

              <button 
                onClick={() => setShowCleanupModal(true)}
                disabled={actionLoading}
                className="bg-canvas hover:bg-surface-2 text-fg border border-line hover:border-rose-500/40 p-4 rounded-xl flex items-start gap-3 transition-all text-left shadow-sm active:scale-95 disabled:opacity-50 group"
              >
                <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                  <Trash2 size={18} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Purge Old Logs</div>
                  <div className="text-xs text-fg-muted mt-1 leading-relaxed">
                    Delete historical event logs and old snapshots to free disk space
                  </div>
                </div>
              </button>

            </div>
          </div>

          {/* ── Vacuum Confirmation Modal ─────────────────────────────────────── */}
          {showVacuumModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-surface border border-line rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95">
                <div className="p-5 border-b border-line flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Archive size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-fg">Vacuum Database</h3>
                    <p className="text-xs text-fg-muted">Reclaim unused storage space</p>
                  </div>
                </div>
                <div className="p-5 space-y-3 text-xs sm:text-sm text-fg-secondary">
                  <p>This operation defragments database files and returns free pages back to the operating system.</p>
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>Database writing will be locked temporarily for a few seconds during the vacuum process.</span>
                  </div>
                </div>
                <div className="p-4 bg-surface-2/40 border-t border-line flex justify-end gap-2.5">
                  <button
                    onClick={() => setShowVacuumModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-fg-secondary hover:text-fg hover:bg-surface-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVacuum}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    {actionLoading ? <RefreshCw size={13} className="animate-spin" /> : <Archive size={13} />}
                    Start Vacuum
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Cleanup Modal ─────────────────────────────────────────────────── */}
          {showCleanupModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-surface border border-line rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95">
                <div className="p-5 border-b border-line flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
                      <Trash2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-fg">Database Cleanup</h3>
                      <p className="text-xs text-fg-muted">Purge old event logs and reclaim disk space</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowCleanupModal(false); setCleanupResult(null); }}
                    className="p-1 hover:bg-surface-2 rounded-lg text-fg-subtle hover:text-fg"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span><strong>Warning:</strong> This permanently deletes historical logs and image files older than the selected retention window.</span>
                  </div>

                  <div className="space-y-4 text-xs sm:text-sm">
                    <div>
                      <label className="block text-fg-secondary font-semibold mb-1.5">
                        Retention Policy (Keep logs newer than):
                      </label>
                      <select
                        className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-fg focus:outline-none focus:border-rose-500 text-xs sm:text-sm"
                        value={cleanupOptions.days}
                        onChange={(e) => setCleanupOptions({...cleanupOptions, days: Number(e.target.value)})}
                      >
                        <option value="7">7 Days</option>
                        <option value="15">15 Days</option>
                        <option value="30">30 Days</option>
                        <option value="90">90 Days</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="checkbox" 
                        id="del_files"
                        checked={cleanupOptions.delete_files}
                        onChange={(e) => setCleanupOptions({...cleanupOptions, delete_files: e.target.checked})}
                        className="accent-rose-500 w-4 h-4 rounded"
                      />
                      <label htmlFor="del_files" className="text-fg-secondary cursor-pointer">
                        Also delete associated snapshot images from disk
                      </label>
                    </div>
                  </div>

                  {cleanupResult && (
                    <div className={`p-3.5 rounded-xl border text-xs sm:text-sm ${
                      cleanupResult.error 
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400' 
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {cleanupResult.error ? (
                        <div>Error: {cleanupResult.error}</div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <Check size={16} /> Cleanup completed!
                          </div>
                          <div className="text-xs opacity-90 pl-5">
                            • Deleted {cleanupResult.deleted_rows?.toLocaleString() || 0} log records<br/>
                            • Deleted {cleanupResult.deleted_files?.toLocaleString() || 0} snapshot files
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-surface-2/40 border-t border-line flex justify-end gap-2.5">
                  <button 
                    onClick={() => { setShowCleanupModal(false); setCleanupResult(null); }}
                    className="px-4 py-2 text-xs font-semibold text-fg-secondary hover:text-fg hover:bg-surface-2 rounded-xl transition-colors"
                    disabled={actionLoading}
                  >
                    Close
                  </button>
                  <button 
                    onClick={handleExecuteCleanup}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  >
                    {actionLoading ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Execute Cleanup
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
