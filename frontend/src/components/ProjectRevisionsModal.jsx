import React, { useState, useEffect, useCallback } from 'react';
import { History, Save, RotateCcw, X, Clock, Loader2, AlertTriangle } from 'lucide-react';

export default function ProjectRevisionsModal({ isOpen, onClose, projectId, onRestoreSuccess }) {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [newRevisionName, setNewRevisionName] = useState('');
  const [error, setError] = useState(null);

  const fetchRevisions = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/revisions`);
      if (res.ok) {
        const data = await res.json();
        setRevisions(data);
      }
    } catch (err) {
      console.error("Failed to fetch revisions", err);
      setError("Failed to load revisions.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      fetchRevisions();
      setNewRevisionName('');
      setError(null);
    }
  }, [isOpen, fetchRevisions]);

  const handleSaveRevision = async () => {
    if (!newRevisionName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRevisionName.trim() })
      });
      if (res.ok) {
        setNewRevisionName('');
        await fetchRevisions();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to save revision");
      }
    } catch (err) {
      setError("Network error while saving revision");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (revId) => {
    if (!window.confirm("Are you sure you want to restore this revision? This will overwrite your current pipeline and dashboard layout. Unsaved changes will be lost.")) {
      return;
    }
    setRestoringId(revId);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/restore/${revId}`, {
        method: 'POST'
      });
      if (res.ok) {
        onClose();
        if (onRestoreSuccess) onRestoreSuccess();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to restore revision");
      }
    } catch (err) {
      setError("Network error while restoring revision");
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-line-strong rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center bg-surface-2 p-4 border-b border-line-strong shrink-0">
          <div className="flex items-center gap-2 font-bold text-fg">
            <History size={18} className="text-blue-600 dark:text-blue-400" />
            <span>Version History</span>
          </div>
          <button onClick={onClose} className="hover:text-fg transition-colors text-fg-muted">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 bg-canvas border-b border-line shrink-0">
          <label className="block text-sm font-medium mb-1 text-fg-muted">Save Current State</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newRevisionName}
              onChange={(e) => setNewRevisionName(e.target.value)}
              placeholder="e.g., Working Model before adding OCR"
              className="flex-1 bg-surface border border-line-strong rounded-lg p-2 text-sm focus:border-blue-500 outline-none text-fg"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRevision()}
            />
            <button 
              onClick={handleSaveRevision}
              disabled={saving || !newRevisionName.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save
            </button>
          </div>
          {error && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : revisions.length > 0 ? (
            <div className="space-y-3">
              {revisions.map((rev) => (
                <div key={rev.id} className="bg-surface-2 border border-line-strong rounded-lg p-3 flex items-center justify-between group hover:border-fg-subtle transition-colors">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm text-fg">{rev.name}</span>
                    <span className="text-xs flex items-center gap-1 mt-1 text-fg-subtle">
                      <Clock size={12} />
                      {new Date(rev.created_at).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRestore(rev.id)}
                    disabled={restoringId === rev.id}
                    className="opacity-0 group-hover:opacity-100 bg-surface-3 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50 text-fg-secondary"
                  >
                    {restoringId === rev.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                    Restore
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm italic py-8 text-fg-subtle">
              No revisions saved yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
