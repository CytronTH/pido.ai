// Shared helpers for the project Database pages (Variables / Collections).

/** Parse a backend timestamp. Naive strings (no offset) are treated as UTC. */
export function parseDbTime(ts) {
  if (!ts) return null;
  if (typeof ts === 'number') return new Date(ts);
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(ts);
  return new Date(hasTz ? ts : `${ts.replace(' ', 'T')}Z`);
}

export function formatDbTime(ts, opts) {
  const d = parseDbTime(ts);
  return d && !isNaN(d) ? d.toLocaleString(undefined, opts) : '-';
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
