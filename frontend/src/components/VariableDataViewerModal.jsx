import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Terminal, Activity, Table as TableIcon, AlertTriangle, CheckCircle2, Unlink } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { chartTheme } from '../utils/theme';
import { parseDbTime, formatDbTime, formatValue, apiError, getVariableConnectionStatus } from '../utils/dbFormat';

const HISTORY_LIMIT = 200;

export default function VariableDataViewerModal({
  isOpen,
  onClose,
  onDeleted,
  projectId,
  variable,
  nodeMap = {},
  pipeline = { nodes: [], edges: [] },
}) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!projectId || !variable?.variable_name) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        variable_name: variable.variable_name,
        limit: String(HISTORY_LIMIT)
      });
      if (variable.node_id) q.set('node_id', variable.node_id);
      const res = await fetch(`/api/projects/${projectId}/variable-history?${q.toString()}`);
      const data = await res.json();
      if (data.status === 'success') {
        // Chronological order (oldest → newest) for the chart; numeric x for a time axis
        setHistory((data.data || []).reverse().map(r => ({ ...r, t: parseDbTime(r.timestamp)?.getTime() })));
      }
    } catch (e) {
      console.error("Failed to fetch variable history:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async (days) => {
    if (!window.confirm(`Are you sure you want to delete all historical data for '${variable.variable_name}' older than ${days} days?`)) return;
    try {
      const q = new URLSearchParams({
        variable_name: variable.variable_name,
        days: String(days)
      });
      if (variable.node_id) q.set('node_id', variable.node_id);
      const res = await fetch(`/api/projects/${projectId}/variable-cleanup?${q.toString()}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert(data.message);
        fetchHistory();
      } else {
        alert(apiError(data, 'Cleanup failed'));
      }
    } catch (e) {
      console.error("Failed to cleanup variable history:", e);
    }
  };

  const handleDeleteVariable = async () => {
    const confirmText = `delete ${variable.variable_name}`;
    const input = window.prompt(`WARNING: This will completely delete the variable '${variable.variable_name}' and ALL its historical data. This cannot be undone.\n\nPlease type '${confirmText}' to confirm:`);
    
    if (input !== confirmText) {
      if (input !== null) alert("Deletion cancelled: Confirmation text did not match.");
      return;
    }

    try {
      const q = new URLSearchParams({
        variable_name: variable.variable_name
      });
      if (variable.node_id) q.set('node_id', variable.node_id);
      const res = await fetch(`/api/projects/${projectId}/variable-delete?${q.toString()}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert(data.message);
        (onDeleted || onClose)();
      } else {
        alert(apiError(data, 'Delete failed'));
      }
    } catch (e) {
      console.error("Failed to delete variable:", e);
    }
  };

  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen, projectId, variable?.node_id, variable?.variable_name]);

  if (!isOpen || !variable) return null;

  const connStatus = getVariableConnectionStatus(variable, pipeline);
  const nodeInfo = nodeMap[variable.node_id] || {
    label: connStatus.writerNode?.data?.label || 'Unknown Node',
    type: 'unknown',
  };

  // Calculate data span to show effective retention
  let spanText = "No data";
  if (history.length > 0 && history[0].t) {
    const oldestTimestamp = history[0].t;
    const now = Date.now();
    const diffMs = now - oldestTimestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffDays > 0) spanText = `${diffDays} Days`;
    else if (diffHours > 0) spanText = `${diffHours} Hours`;
    else spanText = `${diffMins} Minutes`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-surface border border-line rounded-2xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold flex items-center gap-2 text-fg">
                <Activity size={20} className="text-indigo-600 dark:text-indigo-400" />
                {variable.variable_name}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${connStatus.badgeClass}`}>
                {connStatus.status === 'connected' ? (
                  <CheckCircle2 size={12} className="shrink-0" />
                ) : connStatus.status === 'no_input' ? (
                  <Unlink size={12} className="shrink-0" />
                ) : (
                  <AlertTriangle size={12} className="shrink-0" />
                )}
                {connStatus.label}
              </span>
            </div>
            <p className="text-xs text-fg-muted flex items-center gap-2 mt-1">
              <span className="font-semibold text-fg-secondary">{nodeInfo.label}</span> ({nodeInfo.type}) &bull; <Terminal size={12} className="ml-1" /> <span className="font-mono text-[10px]">{variable.node_id}</span> &bull; Latest: {formatValue(variable.value)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 text-fg-muted hover:bg-surface-2 rounded-lg transition-colors hover:text-fg"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-fg-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-canvas p-4 sm:p-6 flex flex-col gap-6">
          {/* Connection Alert Banner */}
          {!connStatus.connected && (
            <div className={`p-3.5 rounded-xl border flex items-start gap-3 shadow-sm ${
              connStatus.status === 'disconnected'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
            }`}>
              <AlertTriangle size={18} className={`shrink-0 mt-0.5 ${
                connStatus.status === 'disconnected' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
              }`} />
              <div className="flex-1">
                <h5 className="font-bold text-xs uppercase tracking-wider">
                  {connStatus.status === 'disconnected'
                    ? 'Alert: Variable Not Connected to Database Writer Node'
                    : 'Alert: Database Writer Node Disconnected'}
                </h5>
                <p className="text-xs mt-0.5 leading-relaxed opacity-95">
                  {connStatus.reason}. {connStatus.status === 'disconnected'
                    ? 'Historical data is retained for inspection, but new values will not be recorded until a Database Writer node is added and connected in the pipeline.'
                    : 'The Database Writer node is present in the pipeline but needs an input wire connected to begin receiving data.'}
                </p>
              </div>
            </div>
          )}
          {/* Chart Section */}
          <div className="bg-surface border border-line rounded-xl p-4 shadow-sm h-72 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-fg-muted uppercase tracking-wider">Trend (Last {HISTORY_LIMIT} points)</h4>
              <div className="text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                Data Span: {spanText}
              </div>
            </div>
            <div className="h-full w-full pb-4">
              {loading && history.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              ) : history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-fg-faint text-sm">
                  No historical data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                    <XAxis 
                      dataKey="t" 
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      stroke={chartTheme.axis} 
                      fontSize={10}
                      tickFormatter={(ms) => new Date(ms).toLocaleTimeString()}
                      minTickGap={30}
                    />
                    <YAxis stroke={chartTheme.axis} fontSize={10} domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ ...chartTheme.tooltip.contentStyle, fontSize: '12px' }}
                      labelFormatter={(ms) => new Date(ms).toLocaleString()}
                    />
                    <Area type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Action/Retention Section */}
          <div className="bg-surface border border-line rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Retention:</span>
              <button onClick={() => handleCleanup(7)} className="text-xs px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-fg-secondary rounded-lg transition-colors border border-line-strong">Keep 7 Days</button>
              <button onClick={() => handleCleanup(15)} className="text-xs px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-fg-secondary rounded-lg transition-colors border border-line-strong">Keep 15 Days</button>
              <button onClick={() => handleCleanup(30)} className="text-xs px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-fg-secondary rounded-lg transition-colors border border-line-strong">Keep 30 Days</button>
            </div>
            <button 
              onClick={handleDeleteVariable}
              className="text-xs px-4 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-lg transition-colors font-medium flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              Delete Variable Entirely
            </button>
          </div>

          {/* Table Section */}
          <div className="flex-1 bg-surface border border-line rounded-xl overflow-hidden flex flex-col min-h-[250px]">
            <div className="p-4 border-b border-line flex items-center justify-between">
               <h4 className="text-xs font-bold text-fg-muted uppercase tracking-wider flex items-center gap-2">
                 <TableIcon size={14} /> Raw Data
               </h4>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm text-fg-secondary">
                <thead className="bg-canvas text-xs uppercase text-fg-subtle sticky top-0 z-10 shadow-sm border-b border-line">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Timestamp</th>
                    <th className="px-4 py-3 font-semibold">Value</th>
                    <th className="px-4 py-3 font-semibold">Node ID</th>
                    <th className="px-4 py-3 font-semibold text-right">Log ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/50">
                  {/* Map history in descending order for table (newest first) */}
                  {[...history].reverse().map((row) => (
                    <tr key={row.id} className="hover:bg-surface-2/30 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs">{formatDbTime(row.timestamp)}</td>
                      <td className="px-4 py-2 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{row.value}</td>
                      <td className="px-4 py-2 text-fg-muted text-xs">{row.node_id}</td>
                      <td className="px-4 py-2 text-fg-subtle text-xs text-right">{row.id}</td>
                    </tr>
                  ))}
                  {history.length === 0 && !loading && (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-fg-subtle">
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
