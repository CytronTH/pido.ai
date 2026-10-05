import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Trash2, Image as ImageIcon, FileSpreadsheet, XCircle, Download,
  Pause, Play, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { formatDbTime, apiError, downloadCsv } from '../utils/dbFormat';

const POLL_MS = 3000;
const snapshotUrl = (v) => (typeof v === 'string' ? v.replace('/api/files/snapshots/', '/api/snapshots/') : null);

function CellValue({ col, val, onImage }) {
  if (col.type === 'image') {
    const url = snapshotUrl(val);
    return url ? (
      <img
        src={url}
        alt={col.name}
        loading="lazy"
        onClick={() => onImage(url)}
        className="h-10 w-16 object-cover rounded-md bg-black/50 border border-line-strong cursor-zoom-in hover:border-emerald-500 hover:scale-105 transition-all"
      />
    ) : (
      <ImageIcon size={14} className="text-fg-faint" />
    );
  }
  if (val === null || val === undefined || val === '') return <span className="text-fg-faint">-</span>;
  if (col.type === 'boolean') {
    const truthy = val === true || val === 'true' || val === 1;
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${truthy ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'}`}>
        {truthy ? 'True' : 'False'}
      </span>
    );
  }
  if (col.type === 'number') {
    const n = Number(val);
    return <span className="font-mono text-blue-700 dark:text-blue-300">{isNaN(n) ? String(val) : n.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>;
  }
  const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return <span className="truncate max-w-[320px] block" title={s}>{s}</span>;
}

export default function CollectionDataViewer({ projectId, collection, onChanged, onCollectionDeleted }) {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [live, setLive] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const schema = useMemo(() => {
    if (Array.isArray(collection.schema)) return collection.schema;
    try {
      const parsed = JSON.parse(collection.schema_json || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [collection.schema, collection.schema_json]);

  const baseUrl = `/api/projects/${projectId}/collections/${collection.id}`;

  const fetchRecords = useCallback(async () => {
    try {
      const offset = (page - 1) * perPage;
      const res = await fetch(`${baseUrl}/records?limit=${perPage}&offset=${offset}`);
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setRecords(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error('Failed to fetch collection records:', e);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, page, perPage]);

  useEffect(() => { setPage(1); setLive(false); }, [collection.id]);

  useEffect(() => {
    setLoading(true);
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    if (!live) return undefined;
    if (page !== 1) setPage(1);
    const id = setInterval(fetchRecords, POLL_MS);
    return () => clearInterval(id);
  }, [live, page, fetchRecords]);

  useEffect(() => {
    if (!selectedImage) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSelectedImage(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedImage]);

  const handleClear = async () => {
    if (!confirm(`Delete ALL ${total.toLocaleString()} records in "${collection.name}"? Snapshot images referenced by these records will also be removed. This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${baseUrl}/records`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(apiError(data));
      setPage(1);
      await fetchRecords();
      onChanged?.();
    } catch (e) {
      alert('Failed to clear collection: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCollection = async () => {
    const input = window.prompt(`DANGER: This deletes the collection "${collection.name}", its schema and all data.\n\nType the collection name to confirm:`);
    if (input === null) return;
    if (input !== collection.name) { alert('Name did not match. Nothing was deleted.'); return; }
    setBusy(true);
    try {
      const res = await fetch(baseUrl, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(apiError(data));
      onCollectionDeleted?.();
    } catch (e) {
      alert('Failed to delete collection: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      // Fetch everything in pages of 500 so large collections export completely
      const all = [];
      for (let offset = 0; offset < total; offset += 500) {
        const res = await fetch(`${baseUrl}/records?limit=500&offset=${offset}`);
        const data = await res.json();
        if (!res.ok) throw new Error(apiError(data));
        all.push(...(data.data || []));
      }
      downloadCsv(
        `${collection.name.replace(/[^a-z0-9_-]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.csv`,
        ['Timestamp', ...schema.map(c => c.name)],
        all.map(r => [formatDbTime(r.timestamp), ...schema.map(c => r.data?.[c.key])])
      );
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const btn = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-col h-full min-h-[480px] overflow-hidden bg-surface border border-line rounded-2xl shadow-lg">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-4 border-b border-line bg-surface/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <FileSpreadsheet size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-fg truncate flex items-center gap-2">
              {collection.name}
              {live && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> LIVE
                </span>
              )}
            </h2>
            <p className="text-xs text-fg-muted mt-0.5">
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">{total.toLocaleString()}</span> records
              <span className="mx-1.5">•</span>{schema.length} columns
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button id="collection-live-toggle" onClick={() => setLive(l => !l)} className={`${btn} ${live ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40' : 'bg-surface-2 hover:bg-surface-3 text-fg-secondary border-line-strong'}`}>
            {live ? <Pause size={14} /> : <Play size={14} />} {live ? 'Live' : 'Auto'}
          </button>
          <button id="collection-refresh" onClick={() => { setLoading(true); fetchRecords(); }} disabled={busy} className={`${btn} bg-surface-2 hover:bg-surface-3 text-fg-secondary border-line-strong`}>
            <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-500' : ''} /> Refresh
          </button>
          <button id="collection-export" onClick={handleExport} disabled={busy || total === 0} className={`${btn} bg-surface-2 hover:bg-surface-3 text-fg-secondary border-line-strong`}>
            <Download size={14} /> CSV
          </button>
          <div className="w-px h-6 bg-line mx-0.5" />
          <button id="collection-clear" onClick={handleClear} disabled={busy || total === 0} title="Delete all records in this collection" className={`${btn} bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20 text-orange-700 dark:text-orange-400`}>
            <Trash2 size={14} /> <span className="hidden sm:inline">Clear Data</span>
          </button>
          <button id="collection-delete" onClick={handleDeleteCollection} disabled={busy} title="Delete the collection structure and all its data" className={`${btn} bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-600 dark:text-rose-400`}>
            <XCircle size={14} /> <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-canvas">
        <table className="w-full text-left text-sm text-fg-muted border-collapse">
          <thead className="text-[10px] text-fg-muted font-bold uppercase tracking-wider bg-surface/95 sticky top-0 z-10 border-b border-line-strong backdrop-blur-md">
            <tr>
              <th className="px-4 py-2.5 whitespace-nowrap w-[170px]">Timestamp</th>
              {schema.map(col => (
                <th key={col.key} className="px-4 py-2.5 whitespace-nowrap">
                  {col.name}
                  <span className="ml-1 normal-case font-normal text-fg-faint">({col.type})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {loading && records.length === 0 ? (
              <tr><td colSpan={schema.length + 1} className="px-4 py-12 text-center text-fg-subtle">Loading records...</td></tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={schema.length + 1} className="px-4 py-16 text-center text-fg-subtle">
                  <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-semibold text-fg-secondary">No data in this collection yet</p>
                  <p className="text-xs mt-1">Connect a <b>📚 Collection Writer</b> node to this collection and deploy the pipeline.</p>
                </td>
              </tr>
            ) : (
              records.map(record => (
                <tr key={record.id} className="hover:bg-surface-2/40 transition-colors">
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-fg-muted font-mono">{formatDbTime(record.timestamp)}</td>
                  {schema.map(col => (
                    <td key={col.key} className="px-4 py-2 text-xs text-fg-secondary">
                      <CellValue col={col} val={record.data?.[col.key]} onImage={setSelectedImage} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-line bg-surface/80 text-xs text-fg-muted">
        <span>
          {total === 0 ? 'No records' : `Showing ${((page - 1) * perPage + 1).toLocaleString()}–${Math.min(page * perPage, total).toLocaleString()} of ${total.toLocaleString()}`}
        </span>
        <div className="flex items-center gap-3">
          <select
            id="collection-per-page"
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="bg-canvas border border-line rounded-lg px-2 py-1 text-fg focus:outline-none focus:border-emerald-500"
          >
            {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <button disabled={page <= 1 || live} onClick={() => setPage(p => p - 1)} className="p-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg disabled:opacity-40"><ChevronLeft size={14} /></button>
            <span className="px-2 font-semibold text-fg">{page} / {totalPages}</span>
            <button disabled={page >= totalPages || live} onClick={() => setPage(p => p + 1)} className="p-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg disabled:opacity-40"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Snapshot" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 bg-surface-2/70 hover:bg-surface-3 p-2 rounded-full text-fg" onClick={() => setSelectedImage(null)}>
            <X size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
