import React, { useState, useEffect } from 'react';
import { 
  Terminal, Play, AlertCircle, Database, Table as TableIcon, 
  Clock, Copy, Check, Sparkles, RefreshCw, FileCode
} from 'lucide-react';

const QUICK_QUERIES = {
  telemetry: [
    {
      title: 'Recent Custom Metrics (50)',
      desc: 'Latest numerical telemetry points from nodes',
      sql: 'SELECT id, timestamp, node_id, variable_name, value FROM custom_metric_log ORDER BY timestamp DESC LIMIT 50;'
    },
    {
      title: 'Group Metrics by Variable',
      desc: 'Count, average, and latest timestamp per variable',
      sql: 'SELECT variable_name, COUNT(*) AS count, ROUND(AVG(value), 2) AS avg_val, MAX(timestamp) AS last_seen FROM custom_metric_log GROUP BY variable_name ORDER BY count DESC;'
    },
    {
      title: 'Recent Event Logs (50)',
      desc: 'Latest AI inference events and alert triggers',
      sql: 'SELECT id, timestamp, event_type, camera_id, payload FROM event_logs ORDER BY timestamp DESC LIMIT 50;'
    },
    {
      title: 'System Hardware Metrics (50)',
      desc: 'CPU usage, RAM %, and SoC temperature (°C)',
      sql: 'SELECT timestamp, cpu_percent, ram_percent, temp_c FROM system_metrics ORDER BY timestamp DESC LIMIT 50;'
    },
    {
      title: 'Hourly Metric Rollups (50)',
      desc: 'Aggregated hourly metric statistics',
      sql: 'SELECT time_bucket, variable_name, value_avg, value_min, value_max, count FROM custom_metric_hourly ORDER BY time_bucket DESC LIMIT 50;'
    },
    {
      title: 'List All Tables',
      desc: 'Explore schema of telemetry_logs.sqlite',
      sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    }
  ],
  config: [
    {
      title: 'All Projects',
      desc: 'Projects, run state, and creation dates',
      sql: 'SELECT id, name, is_running, created_at, updated_at FROM project;'
    },
    {
      title: 'Connected Cameras',
      desc: 'Camera sources, status, resolution, and FPS',
      sql: 'SELECT id, name, type, is_enabled, resolution, fps FROM camera;'
    },
    {
      title: 'Registered AI Models',
      desc: 'Hailo HEF models, task type, and versions',
      sql: 'SELECT id, name, task, version, is_active FROM aimodel;'
    },
    {
      title: 'External Integrations',
      desc: 'MQTT brokers, Modbus TCP/RTU, and webhooks',
      sql: 'SELECT id, name, type, is_enabled FROM integration;'
    },
    {
      title: 'Dashboard Versions History (20)',
      desc: 'Saved revisions and timestamps',
      sql: 'SELECT id, project_id, version, created_at FROM dashboard_versions ORDER BY created_at DESC LIMIT 20;'
    },
    {
      title: 'List All Tables',
      desc: 'Explore schema of vision_studio.sqlite',
      sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    }
  ]
};

export default function SqlExplorer() {
  const [dbName, setDbName] = useState('telemetry');
  const [query, setQuery] = useState(QUICK_QUERIES.telemetry[0].sql);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [execTime, setExecTime] = useState(null);
  const [copied, setCopied] = useState(false);

  const executeSearch = async (q, db) => {
    const targetQuery = (q || query).trim();
    if (!targetQuery) return;
    
    setLoading(true);
    setExecTime(null);
    const start = performance.now();

    try {
      const res = await fetch('/api/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: targetQuery, db_name: db || dbName })
      });
      const data = await res.json();
      setExecTime(Math.round(performance.now() - start));

      if (!res.ok) {
        setResult({
          status: 'error',
          message: data.detail || data.message || `HTTP ${res.status}: Query execution failed`
        });
      } else if (data.status === 'error') {
        setResult({
          status: 'error',
          message: data.message || 'SQL execution error'
        });
      } else {
        setResult(data);
      }
    } catch (err) {
      setExecTime(Math.round(performance.now() - start));
      setResult({ status: 'error', message: err.message || 'Network error connecting to backend' });
    } finally {
      setLoading(false);
    }
  };

  // Run initial query on mount
  useEffect(() => {
    executeSearch(QUICK_QUERIES.telemetry[0].sql, 'telemetry');
  }, []);

  const handleDbChange = (newDb) => {
    setDbName(newDb);
    const defaultQ = QUICK_QUERIES[newDb][0].sql;
    setQuery(defaultQ);
    executeSearch(defaultQ, newDb);
  };

  const handleRunQuery = () => executeSearch(query, dbName);

  const applyQuickQuery = (q) => {
    setQuery(q);
    executeSearch(q, dbName);
  };

  const handleCellClick = (col, value) => {
    if ((col === 'name' || col === 'tbl_name') && typeof value === 'string') {
      const newQuery = `SELECT * FROM ${value} LIMIT 50;`;
      setQuery(newQuery);
      executeSearch(newQuery, dbName);
    }
  };

  const handleCopyJson = () => {
    if (!result?.rows) return;
    navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickList = QUICK_QUERIES[dbName] || [];

  return (
    <div className="flex flex-col h-full text-fg">
      <div className="flex flex-col lg:flex-row gap-5 h-full">
        {/* Left Panel: Query Editor & Quick Queries */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-line pb-4 lg:pb-0 lg:pr-5 shrink-0">
          {/* Header & DB Switcher */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold flex items-center gap-2 text-fg">
              <Terminal size={17} className="text-blue-500" />
              SQL Explorer
            </h2>
            <select
              className="bg-canvas border border-line rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500 text-fg-secondary cursor-pointer hover:border-line-hover"
              value={dbName}
              onChange={(e) => handleDbChange(e.target.value)}
            >
              <option value="telemetry">Telemetry Logs (AI Data)</option>
              <option value="config">System Config (Projects)</option>
            </select>
          </div>

          {/* SQL Textarea */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between text-[11px] text-fg-muted mb-1.5 px-0.5">
              <span className="flex items-center gap-1 font-mono">
                <FileCode size={12} className="text-blue-500" />
                SQL Query
              </span>
              <span className="text-[10px] text-fg-subtle">SELECT or PRAGMA only</span>
            </div>
            <textarea
              className="w-full h-36 bg-canvas border border-line rounded-xl p-3 font-mono text-xs text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-blue-500 resize-none shadow-inner"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SELECT * FROM table_name LIMIT 50;"
              spellCheck={false}
            />
            <div className="flex justify-between items-center mt-2.5">
              <span className="text-[11px] text-fg-subtle font-mono truncate max-w-[180px]">
                DB: {dbName === 'telemetry' ? 'telemetry_logs.sqlite' : 'vision_studio.sqlite'}
              </span>
              <button
                onClick={handleRunQuery}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 text-xs shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
              >
                {loading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={13} fill="currentColor" />}
                Run Query
              </button>
            </div>
          </div>

          {/* Quick Queries Accordion / List */}
          <div className="bg-canvas border border-line rounded-xl p-3.5 shadow-sm flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-500" />
                Quick Queries
              </h3>
              <span className="text-[10px] text-fg-subtle font-medium">Click to execute</span>
            </div>
            
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[300px] lg:max-h-[360px] pr-0.5 custom-scrollbar">
              {quickList.map((item, idx) => {
                const isActive = query.trim() === item.sql.trim();
                return (
                  <button
                    key={idx}
                    onClick={() => applyQuickQuery(item.sql)}
                    className={`text-left p-2.5 rounded-lg border transition-all text-xs cursor-pointer group ${
                      isActive
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'bg-surface hover:bg-surface-2 border-line text-fg-secondary hover:text-fg'
                    }`}
                  >
                    <div className="font-semibold text-xs truncate flex items-center justify-between">
                      <span className="truncate">{item.title}</span>
                      <Play size={10} className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1 ${isActive ? 'opacity-100 text-blue-500' : 'text-fg-subtle'}`} />
                    </div>
                    <div className="text-[10px] text-fg-subtle mt-0.5 truncate">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="flex-1 flex flex-col bg-canvas border border-line rounded-2xl overflow-hidden shadow-sm min-h-[400px]">
          {/* Results Toolbar */}
          <div className="bg-surface/80 border-b border-line px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <TableIcon size={16} className="text-blue-500" />
              <h3 className="font-semibold text-xs sm:text-sm text-fg">Query Results</h3>
              {result?.status === 'success' && (
                <span className="bg-surface-2 text-[11px] font-mono px-2 py-0.5 rounded-md border border-line text-fg-secondary">
                  {result.count} {result.count === 1 ? 'row' : 'rows'}
                </span>
              )}
              {execTime !== null && (
                <span className="flex items-center gap-1 text-[11px] text-fg-subtle font-mono">
                  <Clock size={11} />
                  {execTime} ms
                </span>
              )}
            </div>

            {result?.rows && result.rows.length > 0 && (
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-line bg-surface hover:bg-surface-2 text-fg-secondary hover:text-fg transition-colors cursor-pointer"
                title="Copy rows as JSON"
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            )}
          </div>
          
          {/* Table / Results Body */}
          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-2 text-fg-subtle">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-xs">Executing query on {dbName}...</p>
              </div>
            ) : !result ? (
              <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-3 text-fg-subtle">
                <Database size={36} className="opacity-20 text-blue-500" />
                <p className="text-sm">Run a query or select a quick query to view results</p>
              </div>
            ) : result.status === 'error' ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 text-red-600 dark:text-red-400">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div className="flex flex-col gap-1">
                  <div className="font-semibold text-xs">Query Failed</div>
                  <div className="text-xs font-mono whitespace-pre-wrap">{result.message}</div>
                </div>
              </div>
            ) : result.rows && result.rows.length > 0 ? (
              <div className="border border-line rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-surface text-[11px] uppercase tracking-wider sticky top-0 text-fg-muted z-10 border-b border-line">
                      <tr>
                        <th className="px-3 py-2.5 font-bold text-fg-subtle w-10 text-center">#</th>
                        {result.columns.map((col, idx) => (
                          <th key={idx} className="px-3.5 py-2.5 font-semibold text-fg">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-mono text-fg-secondary">
                      {result.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-surface-2/60 transition-colors">
                          <td className="px-3 py-2 text-center text-fg-subtle text-[10px] bg-surface/30">
                            {rowIdx + 1}
                          </td>
                          {result.columns.map((col, colIdx) => {
                            const val = row[col];
                            const isClickable = (col === 'name' || col === 'tbl_name') && typeof val === 'string';
                            const isNull = val === null || val === undefined;
                            const isJson = typeof val === 'string' && (val.startsWith('{') || val.startsWith('['));

                            return (
                              <td 
                                key={colIdx} 
                                className={`px-3.5 py-2 max-w-xs truncate ${
                                  isClickable 
                                    ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer font-semibold' 
                                    : ''
                                }`}
                                onClick={() => isClickable && handleCellClick(col, val)}
                                title={isNull ? 'null' : String(val)}
                              >
                                {isNull ? (
                                  <span className="italic text-fg-faint text-[10px]">NULL</span>
                                ) : isJson ? (
                                  <span className="text-purple-600 dark:text-purple-400 font-mono text-[11px] truncate block max-w-sm">
                                    {String(val)}
                                  </span>
                                ) : typeof val === 'number' ? (
                                  <span className="text-amber-600 dark:text-amber-400">{val}</span>
                                ) : (
                                  <span>{String(val)}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.truncated && (
                  <div className="bg-surface border-t border-line px-4 py-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    Displaying first {result.count} rows (results truncated for performance).
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 text-center text-fg-subtle p-6">
                <Database size={28} className="opacity-25" />
                <p className="text-xs font-medium text-fg-muted">Query executed successfully, but returned 0 rows.</p>
                <p className="text-[11px] text-fg-subtle max-w-md">
                  The query produced no matches in <code className="font-mono text-blue-500">{dbName}</code>. Try another quick query from the left panel.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
