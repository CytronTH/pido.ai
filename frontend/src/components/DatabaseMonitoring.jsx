import React, { useState, useEffect } from 'react';
import { Database, HardDrive, Image as ImageIcon, Trash2, Activity, ShieldAlert, Check, RefreshCw, Archive, Zap, Server, BarChart3, DatabaseZap, Code2 } from 'lucide-react';
import SqlExplorer from './SqlExplorer';

export default function DatabaseMonitoring({ projectId }) {
  const [activeTab, setActiveTab] = useState('health');
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Cleanup states
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupOptions, setCleanupOptions] = useState({
    days: 30,
    max_records: 50000,
    delete_files: true
  });

  const fetchDbStats = async () => {
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
  };

  useEffect(() => {
    fetchDbStats();
    const interval = setInterval(fetchDbStats, 10000);
    return () => clearInterval(interval);
  }, [projectId]);

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
    if (!confirm('This will lock the databases temporarily to reclaim disk space. Proceed?')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/database/maintenance/vacuum', { method: 'POST' });
      const data = await res.json();
      alert(data.message || (data.status === 'success' ? 'Vacuum successful' : 'Vacuum failed'));
      fetchDbStats();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRollup = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/database/maintenance/rollup', { method: 'POST' });
      const data = await res.json();
      alert(data.message || (data.status === 'success' ? 'Rollup successful' : 'Rollup failed'));
      fetchDbStats();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-fg">System Metrics</h2>
          <p className="text-xs text-fg-muted mt-0.5">Health monitoring and SQL Explorer</p>
        </div>
        <div className="flex bg-surface border border-line rounded-lg p-1">
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors ${activeTab === 'health' ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            <Activity size={16} />
            Health & Maintenance
          </button>
          <button
            onClick={() => setActiveTab('explorer')}
            className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors ${activeTab === 'explorer' ? 'bg-surface-2 text-blue-600 dark:text-blue-400' : 'text-fg-muted hover:text-fg'}`}
          >
            <Code2 size={16} />
            SQL Explorer
          </button>
        </div>
      </div>

      {activeTab === 'explorer' ? (
        <div className="flex-1 min-h-[500px] bg-canvas rounded-xl overflow-hidden border border-line p-4">
          <SqlExplorer />
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <button 
              onClick={fetchDbStats}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-fg-secondary rounded-lg transition-colors text-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Primary Storage Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Main SD Card / Disk Space */}
        <div className="bg-surface/80 border border-line rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Device Storage</p>
              <h3 className="text-2xl font-extrabold mt-1 tracking-tight text-fg">
                {dbStats?.disk_free_gb ? `${dbStats.disk_free_gb} GB` : (loading ? '...' : '-')}
              </h3>
              <p className="text-xs text-fg-subtle mt-1">Free of {dbStats?.disk_total_gb || 0} GB</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dbStats?.disk_usage_percent > 85 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
              <HardDrive size={20} />
            </div>
          </div>
          {dbStats && (
            <div className="mt-4 w-full bg-surface-2 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full ${dbStats.disk_usage_percent > 85 ? 'bg-rose-500' : dbStats.disk_usage_percent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                style={{ width: `${Math.min(100, dbStats.disk_usage_percent)}%` }} 
              />
            </div>
          )}
        </div>

        {/* Config DB Size */}
        <div className="bg-surface/80 border border-line rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Config DB (vision_studio)</p>
            <h3 className="text-2xl font-extrabold mt-1 tracking-tight text-fg">
              {dbStats?.db_file_size_mb ? `${dbStats.db_file_size_mb} MB` : (loading ? '...' : '-')}
            </h3>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Projects, Models, Cameras</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Database size={20} />
          </div>
        </div>

        {/* Telemetry DB Size */}
        <div className="bg-surface/80 border border-line rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Telemetry DB (Logs)</p>
            <h3 className="text-2xl font-extrabold mt-1 tracking-tight text-fg">
              {dbStats?.telemetry_file_size_mb ? `${dbStats.telemetry_file_size_mb} MB` : (loading ? '...' : '-')}
            </h3>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">High-freq Event Logs</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <DatabaseZap size={20} />
          </div>
        </div>

        {/* Snapshots Size */}
        <div className="bg-surface/80 border border-line rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">Snapshot Images</p>
            <h3 className="text-2xl font-extrabold mt-1 tracking-tight text-fg">
              {dbStats?.snapshot_size_mb ? `${(dbStats.snapshot_size_mb / 1024).toFixed(2)} GB` : (loading ? '...' : '-')}
            </h3>
            <p className="text-xs text-fg-subtle mt-1">{dbStats?.snapshot_count?.toLocaleString() || 0} files stored</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-fg-muted">
            <ImageIcon size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        {/* Data Metrics & Row Counts */}
        <div className="bg-surface/50 border border-line rounded-2xl p-6">
          <h2 className="text-sm font-bold text-fg-secondary mb-4 flex items-center gap-2">
            <BarChart3 size={16} /> Data Row Counts
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-canvas p-3 rounded-xl border border-line/60">
              <div className="text-xs mb-1 text-fg-subtle">Raw Event Logs</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{dbStats?.total_event_logs?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-canvas p-3 rounded-xl border border-line/60">
              <div className="text-xs mb-1 text-fg-subtle">System Metrics</div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400">{dbStats?.total_metrics?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-canvas p-3 rounded-xl border border-line/60">
              <div className="text-xs mb-1 text-fg-subtle">Raw Class Counts</div>
              <div className="text-xl font-bold text-fg">{dbStats?.total_class_counts?.toLocaleString() || 0}</div>
            </div>
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-xs text-emerald-500 mb-1">Hourly Rollups</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{dbStats?.total_hourly_rollups?.toLocaleString() || 0}</div>
            </div>
          </div>
        </div>

        {/* Database Write Queue Health */}
        <div className="bg-surface/50 border border-line rounded-2xl p-6">
          <h2 className="text-sm font-bold text-fg-secondary mb-4 flex items-center gap-2">
            <Server size={16} /> Database Write Queue Health
          </h2>
          <div className="flex gap-4">
            <div className="flex-1 bg-canvas p-4 rounded-xl border border-line relative overflow-hidden">
              <div className="text-xs mb-1 uppercase tracking-wider text-fg-subtle">Pending Writes</div>
              <div className="text-3xl font-mono font-bold text-fg">{dbStats?.log_queue_size || 0}</div>
              <div className="text-xs text-fg-subtle mt-2">Max Capacity: {dbStats?.log_queue_max || 10000}</div>
              
              {dbStats && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-surface-2">
                  <div 
                    className={`h-full ${dbStats.log_queue_size > 5000 ? 'bg-rose-500' : 'bg-blue-500'}`}
                    style={{ width: `${(dbStats.log_queue_size / (dbStats.log_queue_max || 10000)) * 100}%` }}
                  />
                </div>
              )}
            </div>
            
            <div className="flex-1 bg-canvas p-4 rounded-xl border border-line flex flex-col justify-center">
              <div className="text-sm text-fg-muted mb-1">Status</div>
              {dbStats?.log_queue_size > 5000 ? (
                <div className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5"><ShieldAlert size={16}/> High Load</div>
              ) : (
                <div className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5"><Check size={16}/> Healthy</div>
              )}
              <div className="text-xs text-fg-subtle mt-2">Background batch writer is active.</div>
            </div>
          </div>
        </div>

      </div>

      {/* Admin Actions */}
      <div className="bg-surface/30 border border-line rounded-2xl p-6">
        <h2 className="text-sm font-bold text-fg-secondary mb-4 flex items-center gap-2">
          <Activity size={16} /> Manual Maintenance Actions
        </h2>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => handleRollup()}
            disabled={actionLoading}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-4 py-3 rounded-xl flex items-center gap-3 transition-colors text-left flex-1 min-w-[250px]"
          >
            <div className="p-2 bg-emerald-500/20 rounded-lg"><Zap size={18} /></div>
            <div>
              <div className="font-semibold text-sm">Force Data Rollup</div>
              <div className="text-xs text-emerald-500/70 mt-0.5">Aggregate raw data into hourly buckets immediately</div>
            </div>
          </button>
          
          <button 
            onClick={() => handleVacuum()}
            disabled={actionLoading}
            className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-4 py-3 rounded-xl flex items-center gap-3 transition-colors text-left flex-1 min-w-[250px]"
          >
            <div className="p-2 bg-indigo-500/20 rounded-lg"><Archive size={18} /></div>
            <div>
              <div className="font-semibold text-sm">Vacuum Database</div>
              <div className="text-xs text-indigo-500/70 mt-0.5">Defragment and reclaim unused disk space</div>
            </div>
          </button>

          <button 
            onClick={() => setShowCleanupModal(true)}
            disabled={actionLoading}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-4 py-3 rounded-xl flex items-center gap-3 transition-colors text-left flex-1 min-w-[250px]"
          >
            <div className="p-2 bg-rose-500/20 rounded-lg"><Trash2 size={18} /></div>
            <div>
              <div className="font-semibold text-sm">Purge Old Logs</div>
              <div className="text-xs text-rose-500/70 mt-0.5">Delete historical logs and snapshots to free space</div>
            </div>
          </button>
        </div>
      </div>

      {/* Cleanup Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface border border-line rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-line flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-fg">Database Cleanup</h3>
                <p className="text-xs text-fg-muted">Purge old event logs and reclaim disk space</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 p-3 rounded-lg text-xs">
                <strong>Warning:</strong> This action permanently deletes historical event logs and associated snapshot images. It cannot be undone.
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-fg-secondary font-semibold mb-1.5">
                    Retention Policy (Keep logs newer than):
                  </label>
                  <select
                    className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-rose-500"
                    value={cleanupOptions.days}
                    onChange={(e) => setCleanupOptions({...cleanupOptions, days: Number(e.target.value)})}
                  >
                    <option value="7">7 Days</option>
                    <option value="15">15 Days</option>
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="del_files"
                    checked={cleanupOptions.delete_files}
                    onChange={(e) => setCleanupOptions({...cleanupOptions, delete_files: e.target.checked})}
                    className="accent-rose-500 w-4 h-4 rounded bg-surface border-line-strong"
                  />
                  <label htmlFor="del_files" className="text-fg-secondary">Also delete associated snapshot images from disk</label>
                </div>
              </div>

              {cleanupResult && (
                <div className={`mt-4 p-3 rounded-lg border text-sm ${cleanupResult.error ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'}`}>
                  {cleanupResult.error ? (
                    <div>Error: {cleanupResult.error}</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5"><Check size={16} /> Cleanup successful!</div>
                      <div className="text-xs opacity-90 pl-5">
                        • Deleted {cleanupResult.deleted_rows?.toLocaleString() || 0} rows<br/>
                        • Deleted {cleanupResult.deleted_files?.toLocaleString() || 0} files
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-canvas border-t border-line flex justify-end gap-3">
              <button 
                onClick={() => { setShowCleanupModal(false); setCleanupResult(null); }}
                className="px-4 py-2 text-sm font-medium text-fg-secondary transition-colors hover:text-fg"
                disabled={actionLoading}
              >
                Close
              </button>
              <button 
                onClick={handleExecuteCleanup}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 text-fg"
              >
                {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
