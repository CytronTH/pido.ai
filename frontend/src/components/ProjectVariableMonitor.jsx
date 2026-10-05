import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Database, RefreshCw, Activity, Hash, ChevronRight, Layers, Search, Pause, Play, Download } from 'lucide-react';
import VariableDataViewerModal from './VariableDataViewerModal';
import { formatValue, timeAgo, formatDbTime, downloadCsv, parseDbTime } from '../utils/dbFormat';

const POLL_MS = 5000;

export default function ProjectVariableMonitor({ projectId, nodeMap = {} }) {
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVar, setSelectedVar] = useState(null);
  const [search, setSearch] = useState('');
  const [live, setLive] = useState(true);
  const [, setTick] = useState(0); // re-render "x ago" labels

  const fetchVariables = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/variables`);
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setVariables(data.data || []);
        setError(null);
      } else {
        setError('Failed to load variables');
      }
    } catch (e) {
      console.error('Failed to fetch variables:', e);
      setError('Cannot reach backend');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchVariables();
  }, [fetchVariables]);

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => { fetchVariables(); setTick(t => t + 1); }, POLL_MS);
    return () => clearInterval(id);
  }, [live, fetchVariables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variables;
    return variables.filter(v => {
      const label = nodeMap[v.node_id]?.label || '';
      return v.variable_name.toLowerCase().includes(q) || v.node_id.toLowerCase().includes(q) || label.toLowerCase().includes(q);
    });
  }, [variables, search, nodeMap]);

  const totalRecords = useMemo(() => variables.reduce((s, v) => s + (v.record_count || 0), 0), [variables]);

  const exportSummary = () => {
    downloadCsv(
      `variables_${projectId}_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Variable', 'Node ID', 'Node Label', 'Latest Value', 'Last Updated', 'Records'],
      variables.map(v => [v.variable_name, v.node_id, nodeMap[v.node_id]?.label || '', v.value, formatDbTime(v.last_updated), v.record_count])
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-surface/90 border border-line rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-fg-muted">
          <span className="flex items-center gap-1.5">
            <Hash size={14} className="text-indigo-600 dark:text-indigo-400" />
            <b className="text-fg font-mono">{variables.length}</b> variables
          </span>
          <span className="flex items-center gap-1.5">
            <Database size={14} className="text-indigo-600 dark:text-indigo-400" />
            <b className="text-fg font-mono">{totalRecords.toLocaleString()}</b> data points
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 md:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              id="variables-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search variable / node..."
              className="w-full bg-canvas border border-line rounded-xl pl-8 pr-3 py-1.5 text-xs text-fg focus:outline-none focus:border-indigo-500 placeholder-fg-subtle"
            />
          </div>
          <button
            id="variables-export"
            onClick={exportSummary}
            disabled={variables.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface hover:bg-surface-2 text-fg-secondary border border-line transition-all active:scale-95 disabled:opacity-40"
          >
            <Download size={14} /> Export
          </button>
          <button
            id="variables-live-toggle"
            onClick={() => setLive(l => !l)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all active:scale-95 ${
              live
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-surface hover:bg-surface-2 text-fg-muted border-line'
            }`}
          >
            {live ? <Pause size={14} /> : <Play size={14} />} {live ? 'Live' : 'Paused'}
          </button>
          <button
            id="variables-refresh"
            onClick={() => { setLoading(true); fetchVariables(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all active:scale-95"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">{error}</div>
      )}

      {/* Content */}
      {loading && variables.length === 0 ? (
        <div className="flex justify-center items-center h-48">
          <RefreshCw size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : variables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-fg-subtle bg-surface/50 rounded-2xl border border-dashed border-line text-center px-4">
          <Activity size={36} className="mb-3 opacity-30" />
          <p className="text-sm font-semibold text-fg-secondary">No variables recorded yet</p>
          <p className="text-xs mt-1 max-w-sm">
            Add a <b>💾 Database Writer</b> node in the Pipeline Builder, give it a variable name, then deploy the pipeline.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-xs text-fg-subtle py-12">No variables match “{search}”.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filtered.map((v) => {
            const nodeInfo = nodeMap[v.node_id] || { label: 'Unknown node', type: v.node_id };
            const ageMs = Date.now() - (parseDbTime(v.last_updated)?.getTime() || 0);
            const fresh = ageMs < 15000;
            return (
              <button
                type="button"
                id={`variable-card-${v.node_id}-${v.variable_name}`}
                key={`${v.node_id}::${v.variable_name}`}
                onClick={() => setSelectedVar(v)}
                className="text-left bg-surface/80 border border-line hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 cursor-pointer group transition-all rounded-2xl p-4 flex flex-col"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                      <Hash size={14} />
                    </div>
                    <h3 className="font-semibold text-sm text-fg truncate" title={v.variable_name}>{v.variable_name}</h3>
                  </div>
                  <ChevronRight size={16} className="text-fg-faint group-hover:text-indigo-500 transition-colors shrink-0 mt-1" />
                </div>

                <div className="text-3xl font-extrabold font-mono tracking-tight text-fg mt-3 truncate">
                  {formatValue(v.value)}
                </div>

                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-fg-subtle">
                  <span className={`w-1.5 h-1.5 rounded-full ${fresh ? 'bg-emerald-500 animate-pulse' : 'bg-fg-faint'}`} />
                  {timeAgo(v.last_updated)}
                  <span className="mx-1">•</span>
                  {v.record_count?.toLocaleString() || 0} pts
                </div>

                <div className="flex items-center gap-1 text-[11px] text-fg-muted mt-3 pt-2.5 border-t border-line/60 truncate" title={`${nodeInfo.label} (${v.node_id})`}>
                  <Layers size={11} className="shrink-0" />
                  <span className="truncate">{nodeInfo.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <VariableDataViewerModal
        isOpen={!!selectedVar}
        onClose={() => setSelectedVar(null)}
        onDeleted={() => { setSelectedVar(null); fetchVariables(); }}
        projectId={projectId}
        variable={selectedVar}
        nodeMap={nodeMap}
      />
    </div>
  );
}
