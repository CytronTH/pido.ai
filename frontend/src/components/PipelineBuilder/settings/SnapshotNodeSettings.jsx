import React, { useState } from 'react';
import { Tag, Plus, X, Layers } from 'lucide-react';

const SUGGESTED_TAGS = ['ok', 'ng', 'defect', 'inspection', 'alert'];

export default function SnapshotNodeSettings({ data, onChange }) {
  const zeroLatency = data?.zeroLatency ?? true;
  const triggerEdge = data?.triggerEdge || 'rising';
  const syncDelay = data?.syncDelay ?? 0;
  const tags = Array.isArray(data?.tags) ? data.tags : [];

  const [tagInput, setTagInput] = useState('');

  const addTag = (textToAdd) => {
    const raw = (textToAdd || tagInput).trim();
    if (!raw) return;

    // Support comma-separated strings
    const newItems = raw
      .split(',')
      .map(t => t.trim().replace(/^#+/, ''))
      .filter(t => t.length > 0 && !tags.includes(t));

    if (newItems.length > 0) {
      onChange({ tags: [...tags, ...newItems] });
    }
    setTagInput('');
  };

  const removeTag = (indexToRemove) => {
    const nextTags = tags.filter((_, idx) => idx !== indexToRemove);
    onChange({ tags: nextTags });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      
      {/* Event Tags Section */}
      <div className="flex flex-col gap-2 bg-canvas p-3 rounded-lg border border-line">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-fg flex items-center gap-1.5">
            <Tag size={14} className="text-pink-500" />
            Snapshot Tags
          </label>
          <span className="text-[10px] text-fg-subtle">
            {tags.length} tag{tags.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-[10px] leading-relaxed text-fg-subtle">
          Tags attached to recorded snapshots for filtering in Event Logs. Press Enter or comma to add.
        </p>

        {/* Tag Input Field */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle text-xs font-mono">#</span>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. defect, ok, line-1"
              className="w-full bg-surface border border-line rounded-lg pl-6 pr-3 py-1.5 text-xs text-fg focus:outline-none focus:border-pink-500 placeholder-fg-subtle"
            />
          </div>
          <button
            type="button"
            onClick={() => addTag()}
            disabled={!tagInput.trim()}
            className="px-2.5 py-1.5 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-all active:scale-95"
            title="Add Tag"
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
        </div>

        {/* Existing Tag Chips */}
        <div className="flex flex-wrap gap-1.5 min-h-[28px] pt-1">
          {tags.length === 0 ? (
            <span className="text-[11px] text-fg-subtle italic">No tags attached</span>
          ) : (
            tags.map((t, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 group animate-in fade-in"
              >
                <span>#{t}</span>
                <button
                  type="button"
                  onClick={() => removeTag(idx)}
                  className="text-pink-500/60 hover:text-pink-600 dark:hover:text-pink-300 transition-colors"
                  title="Remove tag"
                >
                  <X size={11} />
                </button>
              </span>
            ))
          )}
        </div>

        {/* Suggested Quick Tags */}
        <div className="pt-2 border-t border-line/60 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-fg-subtle">Suggested:</span>
          {SUGGESTED_TAGS.map((st) => {
            const isAdded = tags.includes(st);
            return (
              <button
                key={st}
                type="button"
                disabled={isAdded}
                onClick={() => addTag(st)}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
                  isAdded
                    ? 'opacity-40 bg-surface-2 text-fg-subtle border-transparent cursor-not-allowed'
                    : 'bg-surface hover:bg-surface-2 text-fg-muted hover:text-fg border-line hover:border-pink-500/50'
                }`}
              >
                +{st}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Trigger Edge Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-fg">Trigger Edge</label>
        <p className="text-[10px] leading-relaxed mb-1 text-fg-subtle">
          Choose when the snapshot should be taken relative to the incoming condition.
        </p>
        <div className="flex bg-canvas p-1 rounded-lg border border-line">
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${triggerEdge === 'rising' ? 'bg-pink-600/20 text-pink-600 dark:text-pink-400 border border-pink-500/30 shadow-sm' : 'hover:bg-surface-2 border border-transparent text-fg-muted hover:text-fg-secondary'}`}
            onClick={() => onChange({ triggerEdge: 'rising' })}
          >
            Rising Edge (False → True)
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${triggerEdge === 'falling' ? 'bg-pink-600/20 text-pink-600 dark:text-pink-400 border border-pink-500/30 shadow-sm' : 'hover:bg-surface-2 border border-transparent text-fg-muted hover:text-fg-secondary'}`}
            onClick={() => onChange({ triggerEdge: 'falling' })}
          >
            Falling Edge (True → False)
          </button>
        </div>
      </div>
      
      {/* Zero Latency Toggle */}
      <div className="flex items-start justify-between bg-canvas p-3 rounded-lg border border-line">
        <div className="pr-4">
          <label className="text-sm font-medium block mb-1 text-fg">Zero Latency Mode</label>
          <p className="text-[10px] leading-relaxed text-fg-subtle">
            Continuously buffers frames in memory to eliminate RTSP connection delay when triggered. 
            Improves accuracy but consumes slightly more memory per snapshot node.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={zeroLatency}
            onChange={(e) => onChange({ zeroLatency: e.target.checked })}
          />
          <div className="w-9 h-5 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-fg after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white border-line-strong after:border-fg-secondary after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-600"></div>
        </label>
      </div>

      {/* RTSP Sync Delay Slider */}
      {zeroLatency && (
        <div className="flex flex-col gap-1.5 bg-canvas p-3 rounded-lg border border-line">
          <label className="text-sm font-medium text-fg">Video Sync Delay (ms)</label>
          <p className="text-[10px] leading-relaxed mb-2 text-fg-subtle">
            Fine-tune the capture timing. Negative values (-ms) will act as a Time Machine, pulling an older frame from memory so the object hasn't crossed the line yet.
          </p>
          <div className="flex items-center gap-4">
            <input 
              type="range" 
              min="-500" 
              max="500" 
              step="10"
              value={syncDelay}
              onChange={(e) => onChange({ syncDelay: parseInt(e.target.value, 10) })}
              className="flex-1 accent-pink-600 h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-pink-600 dark:text-pink-400 w-14 text-right">{syncDelay > 0 ? `+${syncDelay}` : syncDelay}ms</span>
          </div>
        </div>
      )}

      {/* Bounding Box Mode Info */}
      <div className="flex flex-col gap-2 bg-canvas p-3 rounded-lg border border-line">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-fg flex items-center gap-1.5">
            <Layers size={14} className="text-pink-500" />
            Bounding Box Overlay
          </label>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium">
            Follows AI Model
          </span>
        </div>
        <p className="text-[10px] leading-relaxed text-fg-subtle">
          Snapshot recording adheres to the <strong className="text-fg-secondary">Draw Mode</strong> setting in the AI Model node.
          When AI Model is set to <em>Backend</em>, frames are saved with backend-rendered bounding boxes. When set to <em>Frontend</em>, clean frames without boxes are saved.
        </p>
      </div>

    </div>
  );
}
