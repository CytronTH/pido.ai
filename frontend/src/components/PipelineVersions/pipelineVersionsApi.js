// API helpers for pipeline version history (backend: web_server/routers/pipeline_versions.py)

const base = (projectId) => `/api/projects/${encodeURIComponent(projectId)}/pipeline/versions`;

async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      // Keep status text
    }
    throw new Error(detail);
  }
  return res.json();
}

export const listPipelineVersions = (projectId, limit = 50) =>
  request(`${base(projectId)}?limit=${limit}`);

export const getPipelineVersion = (projectId, versionId) =>
  request(`${base(projectId)}/${encodeURIComponent(versionId)}`);

export const savePipelineVersion = (projectId, note, pipeline) =>
  request(base(projectId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note, pipeline }),
  });

export const restorePipelineVersion = (projectId, versionId, note) =>
  request(`${base(projectId)}/${encodeURIComponent(versionId)}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(note ? { note } : {}),
  });

export const checkPipelineCompatibility = (projectId, versionId) =>
  request(`${base(projectId)}/${encodeURIComponent(versionId)}/compatibility`);

export const getVersionDiff = (projectId, versionId, compareTo = null) => {
  const q = compareTo ? `?compare_to=${encodeURIComponent(compareTo)}` : '';
  return request(`${base(projectId)}/${encodeURIComponent(versionId)}/diff${q}`);
};

export const previewPipelineDiff = (projectId, pipeline) =>
  request(`${base(projectId)}/preview-diff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pipeline),
  });

/** Thai relative time, e.g. "5 นาทีที่แล้ว". Accepts ISO strings. */
export function formatRelativeTime(iso) {
  if (!iso) return '';
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
  if (!iso) return '';
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  return new Date(normalized).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
