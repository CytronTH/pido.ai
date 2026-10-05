import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, FileSpreadsheet, Library, Search } from 'lucide-react';
import CollectionDataViewer from './CollectionDataViewer';
import CollectionBuilderModal from './CollectionBuilderModal';
import { timeAgo } from '../utils/dbFormat';

const POLL_MS = 10000;

export default function ProjectCollectionsPanel({ projectId }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [search, setSearch] = useState('');

  const fetchCollections = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/collections`);
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        const list = data.data || [];
        setCollections(list);
        setSelectedId(prev => (prev && list.some(c => c.id === prev) ? prev : list[0]?.id ?? null));
      }
    } catch (e) {
      console.error('Failed to fetch collections:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchCollections();
    const id = setInterval(fetchCollections, POLL_MS); // keep record counts fresh
    return () => clearInterval(id);
  }, [fetchCollections]);

  const selected = collections.find(c => c.id === selectedId) || null;
  const visible = collections.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[520px]">
      {/* Collection list */}
      <aside className="lg:w-72 shrink-0 bg-surface/90 border border-line rounded-2xl flex flex-col overflow-hidden">
        <div className="p-3 border-b border-line flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-fg-muted flex items-center gap-1.5">
            <Library size={14} /> Collections
            <span className="font-mono text-fg-subtle normal-case">({collections.length})</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              id="collections-refresh"
              onClick={() => { setLoading(true); fetchCollections(); }}
              className="p-1.5 text-fg-subtle hover:text-fg hover:bg-surface-2 rounded-lg"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              id="collections-new"
              onClick={() => setShowBuilder(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <Plus size={12} /> New
            </button>
          </div>
        </div>

        {collections.length > 5 && (
          <div className="p-2 border-b border-line">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                id="collections-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter collections..."
                className="w-full bg-canvas border border-line rounded-lg pl-7 pr-2 py-1 text-xs text-fg focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[260px] lg:max-h-none">
          {loading && collections.length === 0 ? (
            <div className="py-10 flex justify-center"><RefreshCw size={18} className="animate-spin text-emerald-500" /></div>
          ) : collections.length === 0 ? (
            <div className="py-10 px-3 text-center text-xs text-fg-subtle">
              No collections yet.<br />Click <b>New</b> to define one.
            </div>
          ) : (
            visible.map(c => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  id={`collection-item-${c.id}`}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                    active
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm'
                      : 'bg-canvas/60 border-transparent hover:border-line hover:bg-surface-2/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={14} className={active ? 'text-emerald-600 dark:text-emerald-400' : 'text-fg-subtle'} />
                    <span className={`text-sm font-semibold truncate ${active ? 'text-fg' : 'text-fg-secondary'}`}>{c.name}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1 pl-[22px] text-[11px] text-fg-subtle">
                    <span className="font-mono">{(c.record_count || 0).toLocaleString()} rows · {c.schema?.length || 0} cols</span>
                    <span>{c.last_record_at ? timeAgo(c.last_record_at) : '—'}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Data viewer */}
      <section className="flex-1 min-w-0 flex flex-col">
        {selected ? (
          <CollectionDataViewer
            key={selected.id}
            projectId={projectId}
            collection={selected}
            onChanged={fetchCollections}
            onCollectionDeleted={() => { setSelectedId(null); fetchCollections(); }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center bg-surface/50 border border-dashed border-line rounded-2xl p-8 text-fg-subtle">
            <FileSpreadsheet size={40} className="mb-3 opacity-25" />
            <p className="text-sm font-semibold text-fg-secondary">Collections store structured rows</p>
            <p className="text-xs mt-1 max-w-sm">
              Define a table schema (text, number, boolean, image columns), then use a <b>📚 Collection Writer</b> node to save pipeline data into it.
            </p>
            <button
              onClick={() => setShowBuilder(true)}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Plus size={14} /> Create Collection
            </button>
          </div>
        )}
      </section>

      <CollectionBuilderModal
        isOpen={showBuilder}
        onClose={() => setShowBuilder(false)}
        projectId={projectId}
        onSaveSuccess={(created) => { if (created?.id) setSelectedId(created.id); fetchCollections(); }}
      />
    </div>
  );
}
