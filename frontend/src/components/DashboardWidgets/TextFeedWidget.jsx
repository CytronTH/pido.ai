import React, { useState, useEffect } from 'react';
import { AlignLeft, Sparkles, Camera, Maximize2, ExternalLink, Download, X } from 'lucide-react';

const LOG_COLOR_STYLES = {
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-950/30',
    border: 'border-l-rose-500',
    badge: 'bg-rose-500 text-white',
    text: 'text-rose-700 dark:text-rose-300',
    glow: 'ring-2 ring-rose-500/70 shadow-md shadow-rose-500/20',
    dot: 'bg-rose-500',
    dotPing: 'bg-rose-400'
  },
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-950/30',
    border: 'border-l-amber-500',
    badge: 'bg-amber-500 text-white',
    text: 'text-amber-700 dark:text-amber-300',
    glow: 'ring-2 ring-amber-500/70 shadow-md shadow-amber-500/20',
    dot: 'bg-amber-500',
    dotPing: 'bg-amber-400'
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-500 text-white',
    text: 'text-emerald-700 dark:text-emerald-300',
    glow: 'ring-2 ring-emerald-500/70 shadow-md shadow-emerald-500/20',
    dot: 'bg-emerald-500',
    dotPing: 'bg-emerald-400'
  },
  sky: {
    bg: 'bg-sky-500/10 dark:bg-sky-950/30',
    border: 'border-l-sky-500',
    badge: 'bg-sky-500 text-white',
    text: 'text-sky-700 dark:text-sky-300',
    glow: 'ring-2 ring-sky-500/70 shadow-md shadow-sky-500/20',
    dot: 'bg-sky-500',
    dotPing: 'bg-sky-400'
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-950/30',
    border: 'border-l-purple-500',
    badge: 'bg-purple-500 text-white',
    text: 'text-purple-700 dark:text-purple-300',
    glow: 'ring-2 ring-purple-500/70 shadow-md shadow-purple-500/20',
    dot: 'bg-purple-500',
    dotPing: 'bg-purple-400'
  },
  indigo: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    border: 'border-l-indigo-500',
    badge: 'bg-indigo-600 text-white',
    text: 'text-indigo-700 dark:text-indigo-300',
    glow: 'ring-2 ring-indigo-500/70 shadow-md shadow-indigo-500/20',
    dot: 'bg-indigo-500',
    dotPing: 'bg-indigo-400'
  }
};

export default function TextFeedWidget({ title, feedData = [], config = {}, icon: Icon = AlignLeft }) {
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  // Close Lightbox on ESC key
  useEffect(() => {
    if (!selectedSnapshot) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedSnapshot(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedSnapshot]);

  const renderValue = (val) => {
    if (val === undefined || val === null) return <span className="text-fg-muted italic">-</span>;
    if (typeof val === 'boolean') {
      return (
        <span className={val ? 'text-green-600 dark:text-green-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
          {val ? 'TRUE' : 'FALSE'}
        </span>
      );
    }
    if (typeof val === 'number') {
      return <span className="text-blue-700 dark:text-blue-300 font-semibold">{Number.isInteger(val) ? val : val.toFixed(4)}</span>;
    }
    if (Array.isArray(val)) {
      if (val.length > 0 && typeof val[0] === 'object') {
        const counts = val.reduce((acc, obj) => {
          const l = obj.label || 'item';
          acc[l] = (acc[l] || 0) + 1;
          return acc;
        }, {});
        const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ');
        return <span className="text-yellow-700 dark:text-yellow-300">Found: {summary || '0 items'}</span>;
      }
      return <span className="text-indigo-700 dark:text-indigo-300">[{val.join(', ')}]</span>;
    }
    if (typeof val === 'object') {
      if (val.label !== undefined) {
        return (
          <span className="text-yellow-700 dark:text-yellow-300">
            {val.label} {val.confidence ? `(${(val.confidence * 100).toFixed(0)}%)` : ''}
          </span>
        );
      }
      return <span className="text-fg-muted text-xs">{JSON.stringify(val)}</span>;
    }
    return <span className="text-fg font-medium">{String(val)}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-xl overflow-hidden shadow-xl relative">
      {config?.showTitle !== false && (
        <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={16} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-fg truncate">
              {title || config?.title || 'Log Feed'}
            </span>
          </div>
          {feedData.length > 0 && (
            <span className="text-[10px] font-mono text-fg-subtle bg-surface-3 px-2 py-0.5 rounded-full border border-line">
              {feedData.length} records
            </span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {feedData.length > 0 ? (
          feedData.map((item, index) => {
            const isWrapped = item && typeof item === 'object' && ('timestamp' in item) && ('value' in item || 'text' in item || 'message' in item);
            const ts = isWrapped ? item.timestamp : new Date().toLocaleTimeString();
            const val = isWrapped ? (item.value !== undefined ? item.value : (item.text || item.message)) : item;
            
            // Extract item color (defaults to item.color or config.color or 'indigo')
            const colorKey = item?.color || 'indigo';
            const colorStyle = LOG_COLOR_STYLES[colorKey] || LOG_COLOR_STYLES.indigo;
            const isLatest = index === 0;

            // Extract snapshot image URL if attached
            const rawSnapPath = item?.snapshot_path;
            const snapUrl = rawSnapPath ? (
              rawSnapPath.startsWith('/api/snapshots/')
                ? rawSnapPath
                : `/api/snapshots/${rawSnapPath.split('/').pop()}`
            ) : null;

            const openSnapshotLightbox = (e) => {
              if (e) e.stopPropagation();
              setSelectedSnapshot({
                url: snapUrl,
                title: typeof val === 'string' ? val : (item?.source || 'Evidence Snapshot'),
                timestamp: ts,
                source: item?.source,
                color: colorKey,
                value: val
              });
            };

            return (
              <div
                key={item?.id || index}
                className={`relative text-xs sm:text-sm p-2.5 rounded-lg border-l-4 ${colorStyle.border} ${colorStyle.bg} border border-line-strong/60 font-mono flex items-start gap-2.5 transition-all duration-300 ${
                  isLatest ? `${colorStyle.glow} scale-[1.01]` : 'hover:bg-surface-2/70'
                }`}
              >
                {/* Latest update visual cue with pulsing dot & badge */}
                {isLatest && (
                  <div className="absolute -top-2 -right-1 flex items-center gap-1 bg-surface border border-line-strong shadow-sm px-1.5 py-0.5 rounded-full z-10">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorStyle.dotPing}`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${colorStyle.dot}`} />
                    </span>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-fg-secondary flex items-center gap-0.5">
                      <Sparkles size={9} className="text-amber-500" />
                      <span>NEW</span>
                    </span>
                  </div>
                )}

                {/* Left metadata: Timestamp & Source */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 shrink-0 mt-0.5">
                  <span className="text-[11px] text-fg-subtle font-mono select-none">
                    [{ts}]
                  </span>
                  {item?.source && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colorStyle.badge} shrink-0 leading-tight`}>
                      {item.source}
                    </span>
                  )}
                </div>

                {/* Log message value */}
                <div className={`flex-1 overflow-hidden break-words leading-relaxed ${colorStyle.text}`}>
                  {renderValue(val)}
                </div>

                {/* Snapshot evidence thumbnail & action button */}
                {snapUrl && (
                  <div className="flex items-center gap-2 shrink-0 self-center">
                    <button
                      type="button"
                      onClick={openSnapshotLightbox}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-sans font-semibold bg-surface-2 hover:bg-surface-3 border border-line-strong text-fg-secondary hover:text-fg shadow-sm transition-all hover:scale-105 active:scale-95 group/snap cursor-pointer"
                      title="คลิกเพื่อดูรูปภาพหลักฐาน Snapshot ขยายใหญ่"
                    >
                      <Camera size={12} className="text-pink-500 group-hover/snap:text-pink-400 group-hover/snap:animate-bounce shrink-0" />
                      <span className="hidden sm:inline">Photo</span>
                    </button>

                    <div
                      onClick={openSnapshotLightbox}
                      className="w-10 h-10 rounded-lg overflow-hidden border border-line-strong shrink-0 relative cursor-pointer group/thumb shadow-sm hover:ring-2 hover:ring-pink-500/70 transition-all hover:scale-105 bg-black/20"
                      title="Click to zoom snapshot"
                    >
                      <img 
                        src={snapUrl} 
                        alt="Snapshot preview" 
                        className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 flex items-center justify-center transition-colors">
                        <Maximize2 size={12} className="text-white opacity-0 group-hover/thumb:opacity-100 drop-shadow transition-opacity" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-fg-muted text-sm italic flex flex-col items-center justify-center h-full gap-2">
            <Icon size={24} className="text-fg-subtle opacity-40" />
            <span>Waiting for log events...</span>
          </div>
        )}
      </div>

      {/* Lightbox / Snapshot Modal Pop-up */}
      {selectedSnapshot && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setSelectedSnapshot(null)}
        >
          <div 
            className="bg-surface border border-line-strong rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-3 bg-surface-2 border-b border-line-strong flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-500 shrink-0">
                  <Camera size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-bold text-fg truncate">
                      {selectedSnapshot.source || 'Snapshot Evidence'}
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-3 border border-line text-fg-muted">
                      [{selectedSnapshot.timestamp}]
                    </span>
                  </div>
                  <p className="text-[11px] text-fg-subtle truncate max-w-md mt-0.5">
                    {typeof selectedSnapshot.value === 'string' ? selectedSnapshot.value : 'Inspection capture with AI bounding box overlay'}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={selectedSnapshot.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-surface hover:bg-surface-3 border border-line text-fg-muted hover:text-fg transition-all text-xs flex items-center gap-1"
                  title="Download image"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <a
                  href={selectedSnapshot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-surface hover:bg-surface-3 border border-line text-fg-muted hover:text-fg transition-all text-xs flex items-center gap-1"
                  title="Open full size in new tab"
                >
                  <ExternalLink size={14} />
                  <span className="hidden sm:inline">Open</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedSnapshot(null)}
                  className="p-2 rounded-lg bg-surface hover:bg-surface-3 border border-line text-fg-muted hover:text-fg transition-all cursor-pointer"
                  title="Close (ESC)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Image Body */}
            <div className="flex-1 bg-black/60 overflow-hidden flex items-center justify-center p-3 sm:p-5 min-h-[300px]">
              <img 
                src={selectedSnapshot.url} 
                alt="Snapshot full resolution evidence"
                className="max-h-[68vh] w-auto max-w-full object-contain rounded-lg shadow-2xl border border-line-strong/40"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 bg-surface-2/70 border-t border-line-strong flex items-center justify-between text-[11px] text-fg-subtle shrink-0 font-mono">
              <span className="truncate">{selectedSnapshot.url.split('/').pop()}</span>
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-surface border border-line text-[10px] text-fg">ESC</kbd> or click outside to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
