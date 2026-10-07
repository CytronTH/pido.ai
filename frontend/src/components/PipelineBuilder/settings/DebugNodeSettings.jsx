import React from 'react';
import { Bug, Pause, Play, Activity } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export default function DebugNodeSettings({ nodeId, data, onChange }) {
  const isPaused = data?.isPaused ?? false;
  const nodes = usePipelineStore((state) => state.nodes);
  const edges = usePipelineStore((state) => state.edges);
  const debugData = usePipelineStore((state) => state.debugData || {});

  const upstreamEdge = edges.find((e) => e.target === nodeId);
  const upstreamNode = upstreamEdge ? nodes.find((n) => n.id === upstreamEdge.source) : null;
  const livePayload = debugData[nodeId] || null;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs text-fg-muted leading-relaxed">
        Debug Node inspects realtime payload packets flowing through this pipeline wire.
      </div>

      {/* Pause / Resume Control */}
      <div className="bg-canvas border border-line rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug size={16} className="text-amber-500" />
          <span className="text-xs font-semibold text-fg">Probe State:</span>
          <span className={`text-xs font-medium ${isPaused ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
            {isPaused ? 'Paused' : 'Active'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange({ isPaused: !isPaused })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all ${
            isPaused
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-amber-600 hover:bg-amber-500 text-white'
          }`}
        >
          {isPaused ? <Play size={12} /> : <Pause size={12} />}
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </button>
      </div>

      {/* Upstream Connection Info */}
      <div className="bg-canvas/80 border border-line rounded-lg p-3 text-xs flex flex-col gap-2">
        <div className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
          <Activity size={14} className="text-blue-500" />
          <span>Connected Upstream</span>
        </div>
        {upstreamNode ? (
          <div className="flex flex-col gap-1 text-[11px] text-fg-muted">
            <div><span className="font-semibold text-fg">Node:</span> {upstreamNode.data?.label || upstreamNode.type}</div>
            <div><span className="font-semibold text-fg">Type:</span> <span className="font-mono text-purple-600 dark:text-purple-400">{upstreamNode.type}</span></div>
            <div><span className="font-semibold text-fg">ID:</span> <span className="font-mono text-fg-subtle">{upstreamNode.id}</span></div>
          </div>
        ) : (
          <div className="text-fg-subtle italic text-[11px]">No node connected upstream. Connect a node to inspect its output.</div>
        )}
      </div>

      {/* Live Data Snapshot */}
      {livePayload && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Recent Payload Sample</label>
          <pre className="bg-canvas border border-line rounded-lg p-2.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 overflow-x-auto max-h-40">
            {JSON.stringify(livePayload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
