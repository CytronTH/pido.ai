import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database,
  RefreshCw,
  Activity,
  Hash,
  ChevronRight,
  Layers,
  Search,
  Pause,
  Play,
  Download,
  AlertTriangle,
  CheckCircle2,
  Unlink,
} from 'lucide-react';
import VariableDataViewerModal from './VariableDataViewerModal';
import {
  formatValue,
  timeAgo,
  formatDbTime,
  downloadCsv,
  parseDbTime,
  getVariableConnectionStatus,
} from '../utils/dbFormat';

const POLL_MS = 5000;

export default function ProjectVariableMonitor({
  projectId,
  nodeMap = {},
  pipeline = { nodes: [], edges: [] },
  onRefreshPipeline,
}) {
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVar, setSelectedVar] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'alerts' | 'connected'
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
    const id = setInterval(() => {
      fetchVariables();
      setTick((t) => t + 1);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [live, fetchVariables]);

  // Combine DB variables with any Database Writer nodes configured in pipeline
  const combinedVariables = useMemo(() => {
    const list = [...variables];
    const seenNames = new Set(list.map((v) => v.variable_name));

    const pipelineNodes = pipeline?.nodes || [];
    pipelineNodes.forEach((n) => {
      if (n.type === 'databaseWriterNode' || n.type === 'databaseWriter') {
        const vName = (n.data?.variableName || '').trim();
        if (vName && !seenNames.has(vName)) {
          list.push({
            node_id: n.id,
            variable_name: vName,
            value: null,
            last_updated: null,
            first_seen: null,
            record_count: 0,
            isFromPipelineOnly: true,
          });
          seenNames.add(vName);
        }
      }
    });

    return list;
  }, [variables, pipeline]);

  // Enrich variables with connection status to Database Writer node
  const enrichedVariables = useMemo(() => {
    return combinedVariables.map((v) => {
      const connStatus = getVariableConnectionStatus(v, pipeline);
      return {
        ...v,
        connStatus,
      };
    });
  }, [combinedVariables, pipeline]);

  // Sync selected variable on polling
  useEffect(() => {
    if (!selectedVar) return;
    const latest = enrichedVariables.find(
      (v) => v.node_id === selectedVar.node_id && v.variable_name === selectedVar.variable_name
    );
    if (
      latest &&
      (latest.value !== selectedVar.value ||
        latest.last_updated !== selectedVar.last_updated ||
        latest.record_count !== selectedVar.record_count ||
        latest.connStatus?.status !== selectedVar.connStatus?.status)
    ) {
      setSelectedVar(latest);
    }
  }, [enrichedVariables, selectedVar]);

  // Count variables that have alert (disconnected, no input, mismatch)
  const alertCount = useMemo(() => {
    return enrichedVariables.filter((v) => !v.connStatus.connected).length;
  }, [enrichedVariables]);

  // Filter by search query and filter tabs
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedVariables.filter((v) => {
      if (filterType === 'alerts' && v.connStatus.connected) return false;
      if (filterType === 'connected' && !v.connStatus.connected) return false;
      if (!q) return true;
      const label = nodeMap[v.node_id]?.label || '';
      return (
        v.variable_name.toLowerCase().includes(q) ||
        v.node_id.toLowerCase().includes(q) ||
        label.toLowerCase().includes(q) ||
        v.connStatus.label.toLowerCase().includes(q) ||
        v.connStatus.reason.toLowerCase().includes(q)
      );
    });
  }, [enrichedVariables, search, nodeMap, filterType]);

  const totalRecords = useMemo(
    () => variables.reduce((s, v) => s + (v.record_count || 0), 0),
    [variables]
  );

  const handleRefresh = () => {
    setLoading(true);
    fetchVariables();
    onRefreshPipeline?.();
  };

  const exportSummary = () => {
    downloadCsv(
      `variables_${projectId}_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Variable', 'Node ID', 'Node Label', 'Connection Status', 'Status Reason', 'Latest Value', 'Last Updated', 'Records'],
      filtered.map((v) => [
        v.variable_name,
        v.node_id,
        nodeMap[v.node_id]?.label || '',
        v.connStatus.label,
        v.connStatus.reason,
        v.value ?? '',
        formatDbTime(v.last_updated),
        v.record_count,
      ])
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-surface/90 border border-line rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4 text-xs text-fg-muted flex-wrap">
          <span className="flex items-center gap-1.5">
            <Hash size={14} className="text-indigo-600 dark:text-indigo-400" />
            <b className="text-fg font-mono">{enrichedVariables.length}</b> variables
          </span>
          <span className="flex items-center gap-1.5">
            <Database size={14} className="text-indigo-600 dark:text-indigo-400" />
            <b className="text-fg font-mono">{totalRecords.toLocaleString()}</b> data points
          </span>
          {alertCount > 0 && (
            <button
              id="variables-alert-filter-btn"
              onClick={() => setFilterType((t) => (t === 'alerts' ? 'all' : 'alerts'))}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'alerts'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
              }`}
              title="Click to view disconnected variables"
            >
              <AlertTriangle size={12} className={filterType === 'alerts' ? '' : 'animate-pulse'} />
              <b>{alertCount}</b> {alertCount === 1 ? 'Not Connected' : 'Not Connected'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Pills */}
          <div className="flex items-center bg-canvas border border-line rounded-xl p-0.5 text-xs">
            <button
              id="filter-all"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filterType === 'all'
                  ? 'bg-surface shadow-sm text-fg font-semibold'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              All ({enrichedVariables.length})
            </button>
            <button
              id="filter-alerts"
              onClick={() => setFilterType('alerts')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                filterType === 'alerts'
                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400 font-semibold'
                  : alertCount > 0
                  ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              <AlertTriangle size={11} />
              Alerts ({alertCount})
            </button>
            <button
              id="filter-connected"
              onClick={() => setFilterType('connected')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filterType === 'connected'
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              Connected ({enrichedVariables.length - alertCount})
            </button>
          </div>

          <div className="relative flex-1 md:w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              id="variables-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search variables / nodes..."
              className="w-full bg-canvas border border-line rounded-xl pl-8 pr-3 py-1.5 text-xs text-fg focus:outline-none focus:border-indigo-500 placeholder-fg-subtle"
            />
          </div>

          <button
            id="variables-export"
            onClick={exportSummary}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface hover:bg-surface-2 text-fg-secondary border border-line transition-all active:scale-95 disabled:opacity-40"
          >
            <Download size={14} /> Export
          </button>

          <button
            id="variables-live-toggle"
            onClick={() => setLive((l) => !l)}
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
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all active:scale-95"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Content */}
      {loading && enrichedVariables.length === 0 ? (
        <div className="flex justify-center items-center h-48">
          <RefreshCw size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : enrichedVariables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-fg-subtle bg-surface/50 rounded-2xl border border-dashed border-line text-center px-4">
          <Activity size={36} className="mb-3 opacity-30" />
          <p className="text-sm font-semibold text-fg-secondary">No variables recorded yet</p>
          <p className="text-xs mt-1 max-w-sm">
            Add a <b>💾 Database Writer</b> node in the Pipeline Builder, give it a variable name, then deploy the pipeline.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-xs text-fg-subtle py-12">
          {filterType === 'alerts'
            ? 'Great! All variables are connected to active Database Writer nodes.'
            : `No variables match "${search}".`}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filtered.map((v) => {
            const nodeInfo = nodeMap[v.node_id] || {
              label: v.connStatus?.writerNode?.data?.label || 'Unknown node',
              type: v.node_id,
            };
            const ageMs = Date.now() - (parseDbTime(v.last_updated)?.getTime() || 0);
            const fresh = v.last_updated && ageMs < 15000;
            const isAlert = !v.connStatus.connected;

            // Card border and background accent based on connection status
            let cardBorderBg = 'bg-surface/80 border-line hover:border-indigo-500/50 hover:shadow-indigo-500/5';
            if (v.connStatus.status === 'disconnected') {
              cardBorderBg =
                'bg-surface/80 border-rose-500/40 hover:border-rose-500/70 shadow-sm shadow-rose-500/5 hover:shadow-rose-500/10 dark:bg-surface/90';
            } else if (v.connStatus.status === 'no_input' || v.connStatus.status === 'mismatch') {
              cardBorderBg =
                'bg-surface/80 border-amber-500/40 hover:border-amber-500/70 shadow-sm shadow-amber-500/5 hover:shadow-amber-500/10 dark:bg-surface/90';
            }

            return (
              <button
                type="button"
                id={`variable-card-${v.node_id}-${v.variable_name}`}
                key={`${v.node_id}::${v.variable_name}`}
                onClick={() => setSelectedVar(v)}
                className={`text-left border hover:shadow-lg hover:-translate-y-0.5 cursor-pointer group transition-all rounded-2xl p-4 flex flex-col relative overflow-hidden ${cardBorderBg}`}
              >
                {/* Visual Alert Strip on Left Border for non-connected variables */}
                {isAlert && (
                  <div
                    className={`absolute top-0 left-0 bottom-0 w-1 ${
                      v.connStatus.status === 'disconnected' ? 'bg-rose-500' : 'bg-amber-500'
                    }`}
                  />
                )}

                {/* Card Header: Variable Name & Connection Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        v.connStatus.status === 'disconnected'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : v.connStatus.status === 'no_input' || v.connStatus.status === 'mismatch'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      <Hash size={14} />
                    </div>
                    <h3 className="font-semibold text-sm text-fg truncate" title={v.variable_name}>
                      {v.variable_name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Status Badge with Color & Symbol */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${v.connStatus.badgeClass}`}
                      title={v.connStatus.reason}
                    >
                      {v.connStatus.status === 'connected' ? (
                        <CheckCircle2 size={11} className="shrink-0" />
                      ) : v.connStatus.status === 'no_input' ? (
                        <Unlink size={11} className="shrink-0" />
                      ) : (
                        <AlertTriangle size={11} className="shrink-0" />
                      )}
                      <span>{v.connStatus.label}</span>
                    </span>
                    <ChevronRight
                      size={15}
                      className="text-fg-faint group-hover:text-indigo-500 transition-colors shrink-0"
                    />
                  </div>
                </div>

                {/* Latest Value */}
                <div className="text-3xl font-extrabold font-mono tracking-tight text-fg mt-3 truncate">
                  {v.value !== null && v.value !== undefined ? (
                    formatValue(v.value)
                  ) : (
                    <span className="text-fg-subtle text-2xl font-normal">—</span>
                  )}
                </div>

                {/* Subtitle / Timestamp / Points */}
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-fg-subtle">
                  {v.record_count > 0 ? (
                    <>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          fresh ? 'bg-emerald-500 animate-pulse' : 'bg-fg-faint'
                        }`}
                      />
                      <span>{timeAgo(v.last_updated)}</span>
                      <span className="mx-1">•</span>
                      <span>{v.record_count?.toLocaleString()} pts</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-fg-faint" />
                      <span className="text-fg-subtle">No records yet • 0 pts</span>
                    </>
                  )}
                </div>

                {/* Node Info & Alert Description Footer */}
                {isAlert ? (
                  <div
                    className={`flex items-center gap-1.5 text-[11px] font-medium mt-3 pt-2.5 border-t truncate ${
                      v.connStatus.status === 'disconnected'
                        ? 'border-rose-500/20 text-rose-600 dark:text-rose-400'
                        : 'border-amber-500/20 text-amber-700 dark:text-amber-400'
                    }`}
                    title={v.connStatus.reason}
                  >
                    {v.connStatus.status === 'no_input' ? (
                      <Unlink size={12} className="shrink-0" />
                    ) : (
                      <AlertTriangle size={12} className="shrink-0" />
                    )}
                    <span className="truncate">{v.connStatus.reason}</span>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between text-[11px] text-fg-muted mt-3 pt-2.5 border-t border-line/60 truncate"
                    title={`${nodeInfo.label} (${v.node_id})`}
                  >
                    <div className="flex items-center gap-1 min-w-0 truncate">
                      <Layers size={11} className="shrink-0 text-fg-subtle" />
                      <span className="truncate">{nodeInfo.label}</span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                      <CheckCircle2 size={11} /> Linked
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Viewer Modal */}
      <VariableDataViewerModal
        isOpen={!!selectedVar}
        onClose={() => setSelectedVar(null)}
        onDeleted={() => {
          setSelectedVar(null);
          fetchVariables();
          onRefreshPipeline?.();
        }}
        projectId={projectId}
        variable={selectedVar}
        nodeMap={nodeMap}
        pipeline={pipeline}
      />
    </div>
  );
}
