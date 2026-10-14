// Shared helpers for the project Database pages (Variables / Collections).

/** Parse a backend timestamp. Naive strings (no offset) are treated as UTC. */
export function parseDbTime(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts;
  if (typeof ts === 'number') return new Date(ts < 1e11 ? ts * 1000 : ts);
  if (typeof ts !== 'string') return null;
  let s = ts.trim();
  if (!s) return null;
  // Strip trailing Z if an offset was already present (e.g. +00:00Z)
  s = s.replace(/([+-]\d{2}:?\d{2})Z$/i, '$1');
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  const d = new Date(hasTz ? s : `${s.replace(' ', 'T')}Z`);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDbTime(ts, opts) {
  const d = parseDbTime(ts);
  return d && !isNaN(d.getTime()) ? d.toLocaleString(undefined, opts) : '-';
}

export function formatDbTimeOnly(ts, opts) {
  const d = parseDbTime(ts);
  return d && !isNaN(d.getTime()) ? d.toLocaleTimeString(undefined, opts) : '-';
}

export function formatDbDateOnly(ts, opts) {
  const d = parseDbTime(ts);
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString(undefined, opts) : '-';
}

/** "3s ago", "5m ago", "2h ago", "4d ago" */
export function timeAgo(ts) {
  const d = parseDbTime(ts);
  if (!d || isNaN(d)) return '-';
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function formatValue(v) {
  if (typeof v !== 'number') return v ?? '-';
  return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/** Extract a readable error from a FastAPI response body. */
export function apiError(body, fallback = 'Request failed') {
  if (!body) return fallback;
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail)) return body.detail.map(d => d.msg || JSON.stringify(d)).join('; ');
  return body.message || fallback;
}

export function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Evaluates whether a variable is properly connected to an active Database Writer node in the pipeline.
 *
 * @param {Object} variable - { node_id, variable_name, ... }
 * @param {Object} pipeline - { nodes: Array, edges: Array }
 * @returns {Object} status details
 */
export function getVariableConnectionStatus(variable, pipeline) {
  if (!pipeline || !Array.isArray(pipeline.nodes)) {
    return {
      status: 'unknown',
      connected: true,
      label: 'Checking...',
      badgeClass: 'bg-surface text-fg-subtle border-line',
      iconType: 'checking',
      reason: 'Checking pipeline connection status...',
      writerNode: null,
    };
  }

  const nodes = pipeline.nodes || [];
  const edges = pipeline.edges || [];
  const varName = (variable?.variable_name || '').trim();

  // 1. Match writer node by node_id
  let writerNode = nodes.find(
    n => n.id === variable?.node_id && (n.type === 'databaseWriterNode' || n.type === 'databaseWriter')
  );

  // 2. If not found by node_id, attempt to match by configured variableName
  if (!writerNode && varName) {
    writerNode = nodes.find(
      n => (n.type === 'databaseWriterNode' || n.type === 'databaseWriter') &&
           (n.data?.variableName || '').trim() === varName
    );
  }

  // Case A: No Database Writer node found in pipeline
  if (!writerNode) {
    return {
      status: 'disconnected',
      connected: false,
      label: 'Not Connected',
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 shadow-sm shadow-rose-500/10',
      iconType: 'disconnected',
      reason: 'No Database Writer node found in pipeline',
      writerNode: null,
    };
  }

  // Case B: Node matched by ID, but its variableName was changed to something else
  const writerVarName = (writerNode.data?.variableName || '').trim();
  if (writerVarName && varName && writerVarName !== varName) {
    return {
      status: 'mismatch',
      connected: false,
      label: 'Renamed in Node',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 shadow-sm shadow-amber-500/10',
      iconType: 'warning',
      reason: `Node renamed to "${writerVarName}" in pipeline`,
      writerNode,
    };
  }

  // Case C: Node exists and variable matches, but has NO incoming edge
  const hasIncoming = edges.some(e => e.target === writerNode.id);
  if (!hasIncoming) {
    return {
      status: 'no_input',
      connected: false,
      label: 'No Input Wire',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 shadow-sm shadow-amber-500/10',
      iconType: 'warning',
      reason: 'Database Writer node has no input connection in pipeline',
      writerNode,
    };
  }

  // Case D: Successfully connected
  const nodeLabel = writerNode.data?.label || writerNode.data?.variableName || 'Database Writer';
  return {
    status: 'connected',
    connected: true,
    label: variable?.isFromPipelineOnly ? 'Connected (Awaiting Data)' : 'Connected',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    iconType: 'connected',
    reason: `Connected to ${nodeLabel}`,
    writerNode,
  };
}

