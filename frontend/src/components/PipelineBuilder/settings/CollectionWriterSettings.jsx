import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, Database, Plus } from 'lucide-react';
import PayloadPathSelector from './PayloadPathSelector';
import CollectionBuilderModal from '../../CollectionBuilderModal';

export default function CollectionWriterSettings({ nodeId, data, onChange }) {
  const { projectId } = useParams();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSelector, setActiveSelector] = useState(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  
  const fetchCollections = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/collections`);
      const resData = await res.json();
      if (resData.status === 'success') {
        setCollections(resData.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, [projectId]);

  const selectedCollection = collections.find(c => c.id === data?.collectionId);
  
  let schema = [];
  try {
    if (selectedCollection && selectedCollection.schema_json) {
      schema = JSON.parse(selectedCollection.schema_json);
    }
  } catch(e) {}

  const handleFieldMappingChange = (colKey, propPath) => {
    const fieldMappings = { ...(data?.fieldMappings || {}) };
    fieldMappings[colKey] = propPath;
    onChange({ fieldMappings });
  };

  const handleCollectionChange = (e) => {
    const colId = e.target.value;
    const col = collections.find(c => c.id === colId);
    onChange({ 
      collectionId: colId, 
      collectionName: col ? col.name : '',
      fieldMappings: {} // Reset mappings when collection changes
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-fg-muted">Target Collection</label>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsCollectionModalOpen(true)}
              className="flex items-center gap-1 text-[10px] bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 px-1.5 py-0.5 rounded border border-indigo-500/30 transition-colors"
            >
              <Plus size={10} /> New
            </button>
            <button onClick={fetchCollections} className="text-fg-subtle hover:text-fg-secondary">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        <select
          value={data?.collectionId || ''}
          onChange={handleCollectionChange}
          className="w-full bg-canvas border border-line-strong rounded-md p-2 text-sm text-fg focus:outline-none focus:border-indigo-500"
        >
          <option value="">-- Select a Collection --</option>
          {collections.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {schema.length > 0 && (
        <div className="bg-canvas/80 p-3 rounded-lg border border-line">
          <h4 className="text-xs font-semibold text-fg-secondary mb-2 flex items-center gap-1.5">
            <Database size={12} /> Field Mapping
          </h4>
          <p className="text-[10px] text-fg-subtle mb-3 leading-relaxed">
            Map incoming data fields to the collection columns. Type a custom payload path or select from the tree.
          </p>
          
          <div className="space-y-4">
            {schema.map(col => (
              <div key={col.key} className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-fg-muted">
                  {col.name} <span className="text-fg-faint">({col.type})</span>
                </label>
                
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={data?.fieldMappings?.[col.key] || ''}
                    onChange={(e) => handleFieldMappingChange(col.key, e.target.value)}
                    className="w-full bg-surface border border-line-strong rounded p-1.5 text-xs text-fg font-mono focus:border-indigo-500 outline-none"
                    placeholder="e.g. counts.person"
                  />
                  <button
                    onClick={() => setActiveSelector(activeSelector === col.key ? null : col.key)}
                    className={`px-2 py-1.5 rounded border text-xs flex items-center gap-1 transition-colors ${activeSelector === col.key ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300' : 'bg-surface-2 border-line-strong text-fg-muted hover:text-fg hover:border-fg-subtle'}`}
                    title="Select from Payload JSON"
                  >
                    {'{...}'}
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-1 mt-0.5">
                  <button onClick={() => handleFieldMappingChange(col.key, '')} className="text-[9px] bg-surface-2/80 px-1.5 py-0.5 border border-line-strong rounded text-fg-muted hover:bg-surface-3 hover:text-fg">Clear</button>
                  <button onClick={() => handleFieldMappingChange(col.key, '__snapshot__')} className="text-[9px] bg-surface-2/80 px-1.5 py-0.5 border border-line-strong rounded text-fg-muted hover:bg-surface-3 hover:text-fg">📸 __snapshot__</button>
                  <button onClick={() => handleFieldMappingChange(col.key, '__timestamp__')} className="text-[9px] bg-surface-2/80 px-1.5 py-0.5 border border-line-strong rounded text-fg-muted hover:bg-surface-3 hover:text-fg">🕒 __timestamp__</button>
                  <button onClick={() => handleFieldMappingChange(col.key, '__raw_payload__')} className="text-[9px] bg-surface-2/80 px-1.5 py-0.5 border border-line-strong rounded text-fg-muted hover:bg-surface-3 hover:text-fg">📦 __raw_payload__</button>
                </div>

                {activeSelector === col.key && (
                  <div className="mt-2 border border-indigo-500/30 rounded-lg p-2 bg-canvas shadow-inner custom-animate-slide-in">
                    <div className="text-[10px] text-indigo-400 mb-2 flex justify-between items-center font-semibold">
                      <span>Select path for mapping to '{col.name}':</span>
                      <button onClick={() => setActiveSelector(null)} className="text-fg-subtle hover:text-fg-secondary font-normal">✕ Close</button>
                    </div>
                    <PayloadPathSelector
                      nodeId={nodeId}
                      selectedPath={data?.fieldMappings?.[col.key]}
                      onSelect={(path) => {
                        handleFieldMappingChange(col.key, path);
                        setActiveSelector(null);
                      }}
                      maxHeight="160px"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {!selectedCollection && (
        <div className="text-xs text-fg-subtle bg-canvas/50 p-3 rounded-lg border border-line border-dashed text-center">
          Please select a collection to map fields.
        </div>
      )}

      <CollectionBuilderModal
        isOpen={isCollectionModalOpen}
        onClose={() => {
          setIsCollectionModalOpen(false);
          fetchCollections();
        }}
        projectId={projectId}
      />
    </div>
  );
}
