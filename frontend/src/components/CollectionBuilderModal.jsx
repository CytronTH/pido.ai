import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Database, AlertCircle, Save, Info } from 'lucide-react';
import { apiError } from '../utils/dbFormat';

const FIELD_TYPES = [
  { value: 'string', label: 'Text / String' },
  { value: 'number', label: 'Number / Decimal' },
  { value: 'boolean', label: 'True/False (Boolean)' },
  { value: 'image', label: 'Image Snapshot' }
];

export default function CollectionBuilderModal({ isOpen, onClose, projectId, onSaveSuccess }) {
  const [name, setName] = useState('');
  const [fields, setFields] = useState([
    { key: 'status', name: 'Status', type: 'string' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleAddField = () => {
    setFields([...fields, { key: '', name: '', type: 'string' }]);
  };

  const handleRemoveField = (index) => {
    const newFields = [...fields];
    newFields.splice(index, 1);
    setFields(newFields);
  };

  const handleFieldChange = (index, key, value) => {
    const newFields = [...fields];
    newFields[index][key] = value;
    
    // Auto-generate key from name if key is empty
    if (key === 'name' && !newFields[index].key) {
      newFields[index].key = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }
    
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Collection Name is required.");
      return;
    }
    
    const validFields = fields.filter(f => f.name.trim() && f.key.trim());
    if (validFields.length === 0) {
      setError("At least one valid column is required.");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/projects/${projectId}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          schema_fields: validFields
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setName('');
        setFields([{ key: 'status', name: 'Status', type: 'string' }]);
        if (onSaveSuccess) onSaveSuccess(data.data);
        onClose();
      } else {
        setError(apiError(data, "Failed to create collection"));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm font-sans">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-fg">Create Data Collection</h2>
              <p className="text-xs text-fg-muted mt-0.5">Define a custom schema for your project data.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-fg-muted hover:bg-surface-2 rounded-lg transition-colors hover:text-fg">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="flex items-center text-sm font-medium text-fg-secondary mb-1.5">
              Collection Name
              <div className="group relative inline-flex ml-1.5">
                <Info size={14} className="text-fg-subtle hover:text-indigo-600 dark:hover:text-indigo-400 cursor-help transition-colors" />
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-surface-2 text-fg text-xs rounded-lg shadow-xl border border-line-strong z-50 text-center pointer-events-none">
                  Enter a unique name for this dataset, e.g., 'Defect Logs' or 'Quality Inspection'.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-line"></div>
                </div>
              </div>
            </label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Defect Logs, Quality Inspection..."
              className="w-full bg-canvas border border-line rounded-xl px-4 py-2.5 text-fg placeholder-fg-faint focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center text-sm font-medium text-fg-secondary">
                Columns (Schema)
                <div className="group relative inline-flex ml-1.5">
                  <Info size={14} className="text-fg-subtle hover:text-indigo-600 dark:hover:text-indigo-400 cursor-help transition-colors" />
                  <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-surface-2 text-fg text-xs rounded-lg shadow-xl border border-line-strong z-50 text-center pointer-events-none">
                    Define the fields to store for each record.
                    <ul className="text-left mt-1 text-[10px] space-y-0.5 text-fg-muted list-disc list-inside">
                      <li><b>Display Name</b>: Human-readable name.</li>
                      <li><b>Database Key</b>: Column ID used in database (auto-generated).</li>
                      <li><b>Type</b>: Format of the data to be stored.</li>
                    </ul>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-line"></div>
                  </div>
                </div>
              </label>
              <button 
                onClick={handleAddField}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                <Plus size={14} />
                <span>Add Column</span>
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((field, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 bg-surface-2/50 rounded-xl border border-line-strong/50">
                  <div className="flex-1 w-full">
                    <input 
                      type="text" 
                      value={field.name}
                      onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                      placeholder="Display Name (e.g. Result)"
                      className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <input 
                      type="text" 
                      value={field.key}
                      onChange={(e) => handleFieldChange(idx, 'key', e.target.value)}
                      placeholder="Database Key (e.g. result_val)"
                      className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-1.5 text-sm text-fg-muted font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <select 
                      value={field.type}
                      onChange={(e) => handleFieldChange(idx, 'type', e.target.value)}
                      className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-indigo-500 appearance-none"
                    >
                      {FIELD_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    onClick={() => handleRemoveField(idx)}
                    className="p-1.5 text-fg-subtle hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-line bg-surface/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-2 rounded-xl transition-all hover:text-fg"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            {loading ? <div className="w-4 h-4 rounded-full border-2 border-fg/30 border-t-fg animate-spin" /> : <Save size={16} />}
            <span>Create Collection</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
