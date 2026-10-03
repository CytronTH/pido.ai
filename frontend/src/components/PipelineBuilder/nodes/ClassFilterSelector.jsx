import React, { useState, useMemo } from 'react';
import { Check, Search, Edit3, Layers, AlertCircle, RotateCcw } from 'lucide-react';

export default function ClassFilterSelector({
  selectedClasses = [],
  availableClasses = [],
  modelName = '',
  hasUpstreamAi = false,
  onChange,
  rawInput = ''
}) {
  const [search, setSearch] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);

  const isAllCounted = !selectedClasses || selectedClasses.length === 0;

  const filteredClasses = useMemo(() => {
    if (!search.trim()) return availableClasses;
    return availableClasses.filter(cls => 
      cls.toLowerCase().includes(search.toLowerCase().trim())
    );
  }, [availableClasses, search]);

  const handleToggleClass = (cls) => {
    if (isAllCounted) {
      // Switching from "All Classes" to selecting this single class
      onChange([cls], cls);
    } else {
      if (selectedClasses.includes(cls)) {
        const next = selectedClasses.filter(c => c !== cls);
        onChange(next, next.join(', '));
      } else {
        const next = [...selectedClasses, cls];
        onChange(next, next.join(', '));
      }
    }
  };

  const handleSelectAll = () => {
    // Empty array in backend means count all classes without filter
    onChange([], '');
  };

  const handleClear = () => {
    // Empty array means all classes
    onChange([], '');
  };

  const handleRawChange = (e) => {
    const raw = e.target.value;
    const classes = raw.split(',').map(s => s.trim()).filter(Boolean);
    onChange(classes, raw);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs flex items-center gap-1.5 text-fg-muted">
          <span>Target Classes</span>
          {modelName && (
            <span className="text-[10px] text-purple-300 bg-purple-950/70 border border-purple-800/60 px-1.5 py-0.5 rounded font-mono truncate max-w-[110px]" title={modelName}>
              {modelName}
            </span>
          )}
        </label>

        {hasUpstreamAi && availableClasses.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              isAllCounted 
                ? 'bg-teal-950/80 border border-teal-800 text-teal-300' 
                : 'bg-teal-600/20 border border-teal-600 text-teal-200'
            }`}>
              {isAllCounted ? `All Classes (${availableClasses.length})` : `${selectedClasses.length}/${availableClasses.length}`}
            </span>
            <button
              type="button"
              onClick={() => setIsManualMode(!isManualMode)}
              className={`p-1 rounded transition-colors nodrag ${isManualMode ? 'text-teal-400 bg-teal-950 border border-teal-800' : 'text-fg-subtle hover:text-fg-secondary'}`}
              title={isManualMode ? "Switch to Class Badges" : "Manual Text Input"}
            >
              <Edit3 size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Case 1: No Upstream AI Model connected */}
      {!hasUpstreamAi && (
        <div className="bg-canvas/80 p-2.5 rounded-lg border border-dashed border-line flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-amber-400/90 text-[11px] font-medium">
            <AlertCircle size={13} className="shrink-0" />
            <span>Connect to AI Model</span>
          </div>
          <p className="text-[10px] leading-tight text-fg-subtle">
            Connect an edge from an AI Model node to automatically pull available detection classes.
          </p>
          <input
            type="text"
            className="bg-surface-2 border border-line-strong rounded-md p-1.5 text-xs focus:outline-none focus:border-teal-500 nodrag placeholder:text-fg-faint text-fg"
            value={rawInput !== undefined ? rawInput : selectedClasses.join(', ')}
            onChange={handleRawChange}
            placeholder="e.g. person, car, box_a"
          />
        </div>
      )}

      {/* Case 2: Upstream AI connected but model has 0 classes */}
      {hasUpstreamAi && availableClasses.length === 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] italic text-fg-subtle">
            Connected model has no predefined classes. Enter classes manually:
          </div>
          <input
            type="text"
            className="bg-surface-2 border border-line-strong rounded-md p-1.5 text-xs focus:outline-none focus:border-teal-500 nodrag placeholder:text-fg-faint text-fg"
            value={rawInput !== undefined ? rawInput : selectedClasses.join(', ')}
            onChange={handleRawChange}
            placeholder="e.g. person, car, box_a"
          />
        </div>
      )}

      {/* Case 3: Upstream AI connected with available classes */}
      {hasUpstreamAi && availableClasses.length > 0 && (
        isManualMode ? (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              className="bg-surface-2 border border-line-strong rounded-md p-1.5 text-xs focus:outline-none focus:border-teal-500 nodrag placeholder:text-fg-faint font-mono text-fg"
              value={rawInput !== undefined ? rawInput : selectedClasses.join(', ')}
              onChange={handleRawChange}
              placeholder="e.g. person, car"
            />
            <div className="text-[10px] flex justify-between text-fg-subtle">
              <span>Comma-separated class names</span>
              <button 
                type="button" 
                onClick={() => setIsManualMode(false)}
                className="text-teal-400 hover:underline nodrag"
              >
                Back to Selector
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Action Bar: Search & Quick Buttons */}
            <div className="flex items-center gap-1.5">
              {availableClasses.length > 5 && (
                <div className="relative flex-1">
                  <Search size={11} className="absolute left-2 top-2 text-fg-subtle" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search classes..."
                    className="w-full bg-surface-2 border border-line-strong rounded p-1 pl-6 text-[11px] focus:outline-none focus:border-teal-500 nodrag placeholder:text-fg-subtle text-fg"
                  />
                </div>
              )}

              <div className="flex items-center gap-1 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors nodrag ${
                    isAllCounted 
                      ? 'bg-teal-600 text-white shadow-sm' 
                      : 'bg-surface-2 hover:text-fg hover:bg-surface-3 border border-line-strong text-fg-muted'}`}
                  title="Count all classes from the model"
                >
                  All
                </button>
                {!isAllCounted && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[10px] hover:text-red-400 bg-surface-2 hover:bg-surface-3 border border-line-strong px-1.5 py-0.5 rounded transition-colors nodrag text-fg-muted"
                    title="Reset to All"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Chips Container */}
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto custom-scrollbar p-1.5 bg-canvas/80 rounded-lg border border-line">
              {filteredClasses.length > 0 ? (
                filteredClasses.map(cls => {
                  const isChecked = selectedClasses.includes(cls);
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => handleToggleClass(cls)}
                      className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-all flex items-center gap-1 border nodrag cursor-pointer select-none active:scale-95 ${
                        isChecked
                          ? 'bg-teal-600/30 text-teal-200 border-teal-500/80 shadow-sm'
                          : isAllCounted
                            ? 'bg-surface-2/80 text-fg-faint border-line-strong/80 hover:border-teal-500/60 hover:text-teal-200'
                            : 'bg-surface/60 hover:border-fg-secondary border-line-strong text-fg-subtle hover:text-fg-secondary'
}`}
                    >
                      {isChecked && <Check size={11} className="text-teal-400 shrink-0" />}
                      <span className="truncate max-w-[120px]">{cls}</span>
                    </button>
                  );
                })
              ) : (
                <div className="text-[10px] italic p-1 text-fg-subtle">
                  No classes matching "{search}"
                </div>
              )}
            </div>
            
            <div className="text-[10px] px-0.5 text-fg-subtle">
              {isAllCounted 
                ? "💡 Counting all classes. Click any class to filter specifically."
                : `Filtering ${selectedClasses.length} selected class${selectedClasses.length > 1 ? 'es' : ''}.`}
            </div>
          </div>
        )
      )}
    </div>
  );
}
