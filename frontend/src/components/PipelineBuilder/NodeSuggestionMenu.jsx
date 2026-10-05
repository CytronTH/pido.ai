import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Sparkles, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { NODE_CATEGORIES } from './Sidebar';

// Human-friendly node names for the context header
const NODE_NAMES = {
  inputNode: 'Input Source',
  aiNode: 'AI Model',
  logicNode: 'Logic Filter',
  flowCounterNode: 'Flow Counter',
  counterNode: 'Event Counter',
  targetTrackerNode: 'Target Tracker',
  unitThroughputNode: 'Unit Throughput',
  functionNode: 'Function',
  rateLimitNode: 'Rate Limit',
  databaseWriterNode: 'Database Writer',
  collectionWriterNode: 'Collection Writer',
  snapshotNode: 'Snapshot',
  actionNode: 'Action / Alert',
  digitalInputNode: 'Digital Input',
  digitalOutputNode: 'Digital Output',
  buzzerNode: 'Active Buzzer',
  ledNode: 'LED Driver',
  rs485Node: 'RS485 Modbus',
  dashboardVideoNode: 'Video Stream',
  dashboardMetricNode: 'Number / Metric',
  dashboardTextNode: 'Text Value',
  dashboardChartNode: 'Chart',
  dashboardLogNode: 'Dashboard Log',
  debugNode: 'Debug Node',
  debugOutputNode: 'Debug Output',
};

// Forward compatibility: When dragging from a Source handle (output) to find a Target
const COMPATIBILITY_TARGETS = {
  inputNode: ['aiNode', 'dashboardVideoNode', 'snapshotNode', 'debugNode'],

  aiNode: [
    'logicNode', 'flowCounterNode', 'targetTrackerNode', 'unitThroughputNode',
    'functionNode', 'rateLimitNode', 'databaseWriterNode', 'collectionWriterNode',
    'snapshotNode', 'dashboardVideoNode', 'dashboardLogNode', 'debugNode'
  ],

  logicNode: [
    'counterNode', 'actionNode', 'snapshotNode',
    'digitalOutputNode', 'ledNode', 'buzzerNode', 'rs485Node',
    'functionNode', 'rateLimitNode', 'databaseWriterNode', 'collectionWriterNode',
    'dashboardMetricNode', 'dashboardTextNode', 'dashboardLogNode', 'debugNode'
  ],

  counterNode: [
    'dashboardMetricNode', 'dashboardChartNode', 'dashboardTextNode', 'dashboardLogNode',
    'databaseWriterNode', 'collectionWriterNode', 'logicNode', 'targetTrackerNode',
    'actionNode', 'digitalOutputNode', 'buzzerNode', 'ledNode', 'functionNode', 'rateLimitNode', 'debugNode'
  ],

  flowCounterNode: [
    'dashboardMetricNode', 'dashboardChartNode', 'dashboardTextNode', 'dashboardLogNode',
    'databaseWriterNode', 'collectionWriterNode', 'logicNode', 'targetTrackerNode',
    'actionNode', 'digitalOutputNode', 'buzzerNode', 'ledNode', 'functionNode', 'rateLimitNode', 'debugNode'
  ],

  targetTrackerNode: [
    'dashboardMetricNode', 'dashboardChartNode', 'dashboardTextNode', 'dashboardLogNode',
    'databaseWriterNode', 'collectionWriterNode', 'logicNode', 'actionNode',
    'digitalOutputNode', 'buzzerNode', 'ledNode', 'functionNode', 'debugNode'
  ],

  unitThroughputNode: [
    'dashboardMetricNode', 'dashboardChartNode', 'dashboardTextNode', 'dashboardLogNode',
    'databaseWriterNode', 'collectionWriterNode', 'logicNode', 'actionNode',
    'functionNode', 'debugNode'
  ],

  rateLimitNode: [
    'logicNode', 'counterNode', 'snapshotNode', 'actionNode',
    'databaseWriterNode', 'collectionWriterNode', 'dashboardMetricNode',
    'dashboardTextNode', 'dashboardChartNode', 'dashboardLogNode',
    'digitalOutputNode', 'buzzerNode', 'ledNode', 'functionNode', 'debugNode'
  ],

  functionNode: [
    'logicNode', 'counterNode', 'snapshotNode', 'actionNode',
    'databaseWriterNode', 'collectionWriterNode', 'dashboardMetricNode',
    'dashboardTextNode', 'dashboardChartNode', 'dashboardLogNode',
    'digitalOutputNode', 'buzzerNode', 'ledNode', 'rs485Node', 'rateLimitNode', 'debugNode'
  ],

  databaseWriterNode: ['dashboardMetricNode', 'dashboardChartNode', 'debugNode', 'actionNode'],
  collectionWriterNode: ['dashboardLogNode', 'debugNode', 'actionNode'],

  snapshotNode: ['actionNode', 'collectionWriterNode', 'dashboardLogNode', 'debugNode'],
  actionNode: ['dashboardLogNode', 'debugNode'],

  digitalInputNode: [
    'logicNode', 'counterNode', 'snapshotNode', 'actionNode',
    'digitalOutputNode', 'buzzerNode', 'ledNode', 'dashboardMetricNode',
    'dashboardTextNode', 'dashboardLogNode', 'databaseWriterNode', 'debugNode'
  ],

  debugNode: ['debugOutputNode', 'debugNode'],
};

// Backward compatibility: When dragging from a Target handle (input) to find a Source
const COMPATIBILITY_SOURCES = {
  inputNode: [],
  aiNode: ['inputNode'],
  dashboardVideoNode: ['inputNode', 'aiNode'],
  logicNode: [
    'aiNode', 'digitalInputNode', 'flowCounterNode', 'counterNode',
    'targetTrackerNode', 'unitThroughputNode', 'functionNode', 'rateLimitNode'
  ],
  counterNode: ['logicNode', 'digitalInputNode', 'flowCounterNode', 'functionNode', 'rateLimitNode'],
  flowCounterNode: ['aiNode'],
  targetTrackerNode: ['flowCounterNode', 'counterNode', 'aiNode', 'logicNode', 'unitThroughputNode'],
  unitThroughputNode: ['flowCounterNode', 'counterNode', 'aiNode', 'logicNode'],
  snapshotNode: ['inputNode', 'logicNode', 'aiNode', 'digitalInputNode', 'counterNode'],
  actionNode: ['logicNode', 'snapshotNode', 'counterNode', 'targetTrackerNode', 'flowCounterNode', 'digitalInputNode', 'functionNode'],
  databaseWriterNode: ['counterNode', 'flowCounterNode', 'unitThroughputNode', 'targetTrackerNode', 'logicNode', 'aiNode', 'functionNode'],
  collectionWriterNode: ['counterNode', 'flowCounterNode', 'unitThroughputNode', 'targetTrackerNode', 'snapshotNode', 'logicNode', 'aiNode', 'functionNode'],
  dashboardMetricNode: ['counterNode', 'flowCounterNode', 'unitThroughputNode', 'targetTrackerNode', 'logicNode', 'databaseWriterNode', 'digitalInputNode', 'functionNode'],
  dashboardTextNode: ['logicNode', 'counterNode', 'flowCounterNode', 'unitThroughputNode', 'targetTrackerNode', 'digitalInputNode', 'actionNode', 'functionNode'],
  dashboardChartNode: ['flowCounterNode', 'unitThroughputNode', 'counterNode', 'targetTrackerNode', 'databaseWriterNode'],
  dashboardLogNode: ['logicNode', 'actionNode', 'snapshotNode', 'flowCounterNode', 'counterNode', 'targetTrackerNode'],
  digitalOutputNode: ['logicNode', 'counterNode', 'digitalInputNode', 'actionNode', 'functionNode'],
  buzzerNode: ['logicNode', 'counterNode', 'digitalInputNode', 'actionNode', 'functionNode'],
  ledNode: ['logicNode', 'counterNode', 'digitalInputNode', 'actionNode', 'functionNode'],
  rs485Node: ['logicNode', 'counterNode', 'digitalInputNode', 'functionNode'],
  rateLimitNode: ['aiNode', 'logicNode', 'flowCounterNode', 'counterNode', 'functionNode', 'digitalInputNode'],
  functionNode: ['aiNode', 'logicNode', 'flowCounterNode', 'counterNode', 'unitThroughputNode', 'targetTrackerNode', 'snapshotNode', 'digitalInputNode'],
  debugOutputNode: ['debugNode'],
  debugNode: [
    'inputNode', 'aiNode', 'logicNode', 'counterNode', 'flowCounterNode',
    'unitThroughputNode', 'targetTrackerNode', 'databaseWriterNode',
    'collectionWriterNode', 'snapshotNode', 'actionNode', 'digitalInputNode',
    'rateLimitNode', 'functionNode'
  ],
};

const getSuggestedNodeTypes = (sourceNodeType, sourceHandleType) => {
  if (!sourceNodeType) return null; // allow all if no source known

  const isDraggingFromOutput = sourceHandleType === 'source';
  if (isDraggingFromOutput) {
    return COMPATIBILITY_TARGETS[sourceNodeType] || ['debugNode'];
  } else {
    return COMPATIBILITY_SOURCES[sourceNodeType] || null;
  }
};

export default function NodeSuggestionMenu({ position, sourceNodeType, sourceHandleType, onSelect, onClose }) {
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isDraggingFromOutput = sourceHandleType === 'source';
  const sourceNodeDisplayName = NODE_NAMES[sourceNodeType] || sourceNodeType || 'Node';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const filteredCategories = useMemo(() => {
    const allowedTypes = getSuggestedNodeTypes(sourceNodeType, sourceHandleType);
    const query = searchQuery.trim().toLowerCase();

    return NODE_CATEGORIES.map(category => {
      const items = category.items.filter(item => {
        const matchesType = !allowedTypes || allowedTypes.includes(item.type);
        const matchesQuery = !query || 
          item.label.toLowerCase().includes(query) || 
          (item.desc && item.desc.toLowerCase().includes(query));
        return matchesType && matchesQuery;
      });
      return { ...category, items };
    }).filter(category => category.items.length > 0);
  }, [sourceNodeType, sourceHandleType, searchQuery]);

  const totalSuggestedCount = useMemo(() => {
    return filteredCategories.reduce((sum, cat) => sum + cat.items.length, 0);
  }, [filteredCategories]);

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-surface border border-line-strong rounded-2xl shadow-2xl w-80 max-h-[460px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, 0)', // Center horizontally on mouse drop
      }}
    >
      {/* Header Context Banner */}
      <div className="bg-surface-2/80 px-3.5 py-2.5 border-b border-line flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles size={14} className="text-blue-500 shrink-0" />
          <div className="flex items-center gap-1 text-xs truncate">
            <span className="text-fg-subtle">
              {isDraggingFromOutput ? 'From' : 'To'}:
            </span>
            <span className="font-semibold text-fg truncate">
              {sourceNodeDisplayName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1">
            {isDraggingFromOutput ? (
              <>
                <span>Output</span>
                <ArrowRight size={10} />
              </>
            ) : (
              <>
                <ArrowLeft size={10} />
                <span>Input</span>
              </>
            )}
          </span>
          <button 
            onClick={onClose}
            className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-3 transition-colors ml-1"
            title="Close menu"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Quick Search Input */}
      <div className="p-2 border-b border-line bg-canvas/40 shrink-0">
        <div className="flex items-center gap-2 bg-surface-2 border border-line-strong rounded-lg px-2.5 py-1.5 focus-within:border-blue-500 transition-colors">
          <Search size={13} className="text-fg-subtle shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search compatible nodes..."
            className="bg-transparent text-xs text-fg placeholder:text-fg-subtle outline-none w-full"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-fg-subtle hover:text-fg text-xs">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Categorized Node List */}
      <div className="flex-1 overflow-y-auto p-2 styled-scrollbar space-y-3">
        {filteredCategories.map(category => (
          <div key={category.title} className="flex flex-col gap-1">
            {/* Category Section Header */}
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
                {category.title}
              </span>
              <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded-full bg-surface-2 text-fg-muted border border-line-strong/60">
                {category.items.length}
              </span>
            </div>

            {/* Nodes in this Category */}
            <div className="flex flex-col gap-1">
              {category.items.map(item => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => onSelect(item.type)}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-surface-2 text-left transition-all active:scale-[0.98] group border border-transparent hover:border-line-strong/60"
                  >
                    <div className={`p-1.5 rounded-lg border shrink-0 ${item.color}`}>
                      {IconComponent && <IconComponent size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs text-fg block truncate group-hover:text-blue-500 transition-colors">
                        {item.label}
                      </span>
                      {item.desc && (
                        <span className="text-[10px] text-fg-subtle block truncate mt-0.5">
                          {item.desc}
                        </span>
                      )}
                    </div>
                    <ArrowRight size={12} className="text-fg-subtle opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 mr-1" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {totalSuggestedCount === 0 && (
          <div className="py-8 px-4 text-center flex flex-col items-center justify-center gap-1.5 text-fg-subtle">
            <X size={20} className="text-fg-faint mb-1" />
            <span className="text-xs font-semibold text-fg-secondary">No compatible nodes found</span>
            <span className="text-[11px] text-fg-subtle">
              {searchQuery ? `No matches for "${searchQuery}"` : 'This port has no compatible automatic suggestions.'}
            </span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-surface-2/40 border-t border-line text-[10px] text-fg-subtle flex items-center justify-between shrink-0">
        <span>{totalSuggestedCount} node{totalSuggestedCount !== 1 ? 's' : ''} available</span>
        <span className="text-fg-faint">Click to connect</span>
      </div>
    </div>
  );
}
