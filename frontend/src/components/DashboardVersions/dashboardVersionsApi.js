// API helpers for dashboard version history (backend: web_server/routers/dashboard_versions.py)

const base = (projectId) => `/api/projects/${encodeURIComponent(projectId)}/dashboard/versions`;

async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      // non-JSON error body; keep the status text
    }
    throw new Error(detail);
  }
  return res.json();
}

export const listDashboardVersions = (projectId, limit = 50) =>
  request(`${base(projectId)}?limit=${limit}`);

export const getDashboardVersion = (projectId, versionId) =>
  request(`${base(projectId)}/${encodeURIComponent(versionId)}`);

export const saveDashboardVersion = (projectId, note, layout) =>
  request(base(projectId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note, layout }),
  });

export const restoreDashboardVersion = (projectId, versionId, note) =>
  request(`${base(projectId)}/${encodeURIComponent(versionId)}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(note ? { note } : {}),
  });

/** Thai relative time, e.g. "5 นาทีที่แล้ว". Accepts ISO strings (UTC without 'Z' is treated as UTC). */
export function formatRelativeTime(iso) {
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const diff = Math.max(0, Date.now() - new Date(normalized).getTime());
  const s = Math.round(diff / 1000);
  if (s < 45) return 'เมื่อสักครู่';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} วันที่แล้ว`;
  return new Date(normalized).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso) {
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  return new Date(normalized).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
