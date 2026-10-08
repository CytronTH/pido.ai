import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Check, MousePointerClick, Lock } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export const JsonTreeNode = ({ nodeKey, value, path, selectedPath, onSelect, isLocked = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isObject = typeof value === 'object' && value !== null;
  const isSelected = selectedPath === path || 
    (Boolean(selectedPath) && Boolean(path) && (
      path === `msg.payload.${selectedPath}` || 
      path === `msg.${selectedPath}` ||
      selectedPath === `msg.payload.${path}` ||
      selectedPath === `msg.${path}`
    ));

  return (
    <div className="font-mono text-[11px] leading-tight">
      <div 
        className={`group flex items-center py-1 hover:bg-surface-2/50 rounded px-1 -ml-1 transition-colors ${isSelected ? (isLocked ? 'bg-teal-100 dark:bg-teal-900/30 border border-teal-800/50' : 'bg-blue-100 dark:bg-blue-900/30 border border-blue-800/50') : 'border border-transparent'}`}
      >
        <div className="flex items-center gap-1 flex-1 cursor-pointer select-none" onClick={() => isObject && setIsExpanded(!isExpanded)}>
          {isObject ? (
            isExpanded ? <ChevronDown size={12} className="text-fg-subtle" /> : <ChevronRight size={12} className="text-fg-subtle" />
          ) : (
            <span className="w-3" />
          )}
          <span className="text-purple-600 dark:text-purple-400">{nodeKey}</span>
          <span className="text-fg-subtle">:</span>
          {!isObject && (
            <span className={typeof value === 'number' ? 'text-orange-700 dark:text-orange-400' : typeof value === 'string' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}>
              {JSON.stringify(value)}
            </span>
          )}
          {isObject && !isExpanded && <span className="italic text-fg-subtle">{"{...}"}</span>}
        </div>
        
        {!isObject && (
          <button 
            type="button"
            disabled={isLocked}
            onClick={(e) => { 
              if (isLocked) return;
              e.stopPropagation(); 
              onSelect(path); 
            }}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-all
              ${isSelected 
                ? (isLocked ? 'opacity-100 bg-teal-600 text-white cursor-default' : 'opacity-100 bg-blue-600 text-white') 
                : (isLocked ? 'opacity-0 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100 bg-surface-3 text-fg-faint hover:bg-blue-600 hover:text-fg-secondary')}`}
          >
            {isSelected ? (isLocked ? <Lock size={10} /> : <Check size={10} />) : <MousePointerClick size={10} />}
            {isSelected ? (isLocked ? 'Locked' : 'Selected') : 'Select'}
          </button>
        )}
      </div>
      
      {isObject && isExpanded && (
        <div className="ml-3 border-l border-line-strong/50 pl-2 mt-0.5 space-y-0.5">
          {Object.entries(value).map(([k, v]) => (
            <JsonTreeNode 
              key={k} 
              nodeKey={k} 
              value={v} 
              path={path ? `${path}.${k}` : k} 
              selectedPath={selectedPath}
              onSelect={onSelect} 
              isLocked={isLocked}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function PayloadPathSelector({ nodeId, selectedPath, onSelect, maxHeight = '250px', isLocked = false }) {
  const edges = usePipelineStore(state => state.edges);
  const debugData = usePipelineStore(state => state.debugData);
  
  // Find incoming node payload
  const incomingEdges = edges.filter(e => e.target === nodeId);
  const incomingNodeIds = incomingEdges.map(e => e.source);
  
  let sourcePayload = null;
  for (const srcId of incomingNodeIds) {
    if (debugData[srcId]) {
      sourcePayload = debugData[srcId];
      break;
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between mt-1">
        <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-fg-muted">
          Realtime Data Mapping
          {isLocked ? (
            <span className="text-[9px] bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
              <Lock size={10} /> Locked by Database Writer
            </span>
          ) : sourcePayload ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          ) : (
            <span className="text-[9px] bg-surface-2 px-1.5 py-0.5 rounded font-normal normal-case border border-line-strong text-fg-subtle">Waiting for data...</span>
          )}
        </label>
      </div>
      
      <div 
        className="bg-canvas border border-line rounded p-3 overflow-y-auto custom-scrollbar shadow-inner"
        style={{ maxHeight }}
      >
        {sourcePayload ? (
          Object.entries(sourcePayload).map(([k, v]) => (
            <JsonTreeNode 
              key={k} 
              nodeKey={k} 
              value={v} 
              path={k}
              selectedPath={selectedPath}
              onSelect={onSelect} 
              isLocked={isLocked}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-4">
            <p className="text-xs text-fg-subtle">No payload data available.</p>
            <p className="text-[10px] mt-1 text-fg-faint">Connect an incoming node and trigger it to see the data structure.</p>
          </div>
        )}
      </div>
    </div>
  );
}
