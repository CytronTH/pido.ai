import React, { useState, useEffect } from 'react';
import { 
  Target, Save, RefreshCw, Clock, CheckCircle2, 
  TrendingUp, AlertCircle, History, Play, Plus, ChevronDown, ChevronUp, Layers, HelpCircle
} from 'lucide-react';
import TargetTrackerRecordsModal from './TargetTrackerRecordsModal';

export default function TargetTrackerWidget({ title, data, config, projectId }) {
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null

  // New run popover / mode
  const [showNewRunPanel, setShowNewRunPanel] = useState(false);
  const [newRunName, setNewRunName] = useState('');
  const [newRunTarget, setNewRunTarget] = useState('');

  // Records & compare modal
  const [isRecordsModalOpen, setIsRecordsModalOpen] = useState(false);

  // Auto-resolve nodeId from config.nodeId or config.dataPath (e.g. dashboard.node_123.value)
  const resolvedNodeId = config?.nodeId || (config?.dataPath?.startsWith('dashboard.') ? config.dataPath.split('.')[1] : null);

  // Sync internal input value with the latest target when it changes from backend
  useEffect(() => {
    if (data?.target !== undefined && inputValue === '') {
      setInputValue(data.target.toString());
    } else if (config?.targetCount && inputValue === '') {
      setInputValue(config.targetCount.toString());
    }
  }, [data?.target, config?.targetCount, inputValue]);

  // Update target on existing run
  const handleUpdateTarget = async () => {
    if (!resolvedNodeId) {
      alert("Please configure the target node ID or select a valid Target Tracker Data Source first.");
      return;
    }
    
    const newTarget = parseInt(inputValue, 10);
    if (isNaN(newTarget) || newTarget <= 0) return;

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/analytics/target_tracker/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId || 'default',
          node_id: resolvedNodeId,
          target: newTarget
        })
      });
      if (!res.ok) throw new Error('Failed to set target');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Start a brand new run/record directly from the widget
  const handleStartNewRun = async () => {
    if (!resolvedNodeId) {
      alert("Please configure the target node ID or select a valid Target Tracker Data Source first.");
      return;
    }

    const targetVal = parseInt(newRunTarget || inputValue, 10);
    if (isNaN(targetVal) || targetVal <= 0) {
      alert("Please enter a valid positive target count.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId || 'default'}/target_tracker/start_run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: resolvedNodeId,
          target: targetVal,
          name: newRunName.trim()
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to start new run');
      }
      await res.json();
      setInputValue(targetVal.toString());
      setNewRunTarget('');
      setNewRunName('');
      setShowNewRunPanel(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      console.error('Failed to start new run:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!resolvedNodeId) return;
    if (!window.confirm("Reset count and end current session?")) return;
    try {
      await fetch('/api/analytics/counts/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId || 'default',
          node_id: resolvedNodeId
        })
      });
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  const progress = data?.progress_percent || 0;
  const isComplete = data?.is_complete || false;
  const actual = data?.actual || 0;
  const target = data?.target || parseInt(inputValue, 10) || 100;
  const rate = data?.current_rate_per_minute || 0;
  const unit = config?.unit || 'items';
  const isIdle = data?.is_idle || false;
  const isOverTarget = actual > target && target > 0;
  const overCount = isOverTarget ? actual - target : 0;
  const activeRecordName = data?.record_name || null;

  const formatETA = (seconds) => {
    if (isComplete) return "Done";
    if (isIdle) return "Paused / Idle";
    if (seconds === null || seconds === undefined) return "Calculating...";
    if (seconds === 0) return "Done";
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m ${Math.ceil(seconds % 60)}s`;
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
      {/* Header */}
      {config?.showTitle !== false && (
        <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Target size={16} className={`shrink-0 ${isComplete ? "text-amber-500" : "text-blue-500"}`} />
            <span className="text-xs sm:text-sm font-semibold truncate text-fg">
              {title || config?.title || 'Target Tracker'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Records / History Modal Button */}
            <button
              onClick={() => setIsRecordsModalOpen(true)}
              className="px-2 py-0.5 rounded-md bg-surface-3 hover:bg-surface-2 text-fg-secondary hover:text-fg text-xs flex items-center gap-1 border border-line transition-colors shadow-xs"
              title="View Counting Records & Compare"
            >
              <History size={12} className="text-amber-500" />
              <span className="font-semibold text-[11px]">Records</span>
            </button>

            {isOverTarget && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">
                +{overCount.toLocaleString()} Over
              </span>
            )}

            <button 
              onClick={handleReset}
              className="p-1 rounded hover:bg-surface-3 hover:text-fg transition-colors text-fg-muted"
              title="Reset Counts & End Run"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      )}
      
      <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
        
        {/* Active Run Banner (if recorded) */}
        {activeRecordName && (
          <div className="flex items-center justify-between px-2 py-1 bg-surface-2/50 rounded-lg border border-line text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isComplete ? 'bg-amber-500' : isIdle ? 'bg-yellow-500' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="text-fg font-semibold truncate">{activeRecordName}</span>
            </div>
            <span className="text-fg-muted font-mono text-[10px] shrink-0">
              {isComplete ? 'Completed' : isIdle ? 'Idle' : 'Recording'}
            </span>
          </div>
        )}

        {/* Actual vs Target Big Display */}
        <div className="flex items-end justify-between px-2">
          <div className="flex flex-col">
            <span className="text-xs uppercase font-semibold tracking-wider text-fg-muted">Actual Output</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-4xl font-bold tracking-tighter ${isComplete ? 'text-amber-500 dark:text-amber-400' : 'text-fg'}`}>
                {actual.toLocaleString()}
              </span>
              <span className="text-xs text-fg-muted font-medium">{unit}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs uppercase font-semibold tracking-wider text-fg-muted">Target</span>
            <span className="text-2xl font-bold text-fg-muted">
              {target.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-4 bg-surface-2 rounded-full overflow-hidden border border-line-strong/50 shadow-inner">
          <div 
            className={`absolute top-0 left-0 h-full transition-all duration-500 rounded-full ${
              isComplete ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold drop-shadow-md text-fg">
              {progress.toFixed(1)}% {isOverTarget && `(${actual}/${target})`}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 bg-surface-2/40 p-2 rounded-lg border border-line">
          <div className="flex flex-col items-center">
            <span 
              className="text-[10px] uppercase tracking-wide text-fg-muted flex items-center gap-1 cursor-help group"
              title="Current Pace: จังหวะความเร็วชั่วขณะ (Rolling 60s) อิงตามระยะห่างจริงของชิ้นงาน เพื่อใช้พยากรณ์เวลาเสร็จสิ้น (ETA)"
            >
              <TrendingUp size={11} />
              <span>Current Pace</span>
              <HelpCircle size={10} className="text-fg-subtle group-hover:text-amber-500 transition-colors" />
            </span>
            <span className="text-sm font-semibold text-fg">
              {rate.toFixed(1)} <span className="text-xs text-fg-muted">{unit}/min</span>
            </span>
          </div>
          <div className="flex flex-col items-center border-l border-line-strong/50">
            <span 
              className="text-[10px] uppercase tracking-wide text-fg-muted flex items-center gap-1 cursor-help group"
              title="Estimated Time of Arrival: เวลาที่คาดว่าจะเสร็จครบเป้าหมาย โดยคำนวณจากยอดที่เหลือและ Current Pace ณ ขณะนี้"
            >
              <Clock size={11} className={isComplete ? "text-amber-400" : isIdle ? "text-amber-600" : "text-fg-muted"} />
              <span>ETA</span>
              <HelpCircle size={10} className="text-fg-subtle group-hover:text-amber-500 transition-colors" />
            </span>
            <span className={`text-sm font-semibold ${isComplete ? 'text-amber-500 dark:text-amber-400 font-bold' : isIdle ? 'text-fg-muted' : 'text-fg'}`}>
              {formatETA(data?.eta_seconds)}
            </span>
          </div>
        </div>

        {/* Expandable "Start New Run" or Inline Target Editing */}
        <div className="mt-auto pt-2 border-t border-line/80 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-semibold tracking-wide text-fg-muted flex items-center gap-1">
              <span>Target & Run Controls</span>
            </label>
            <div className="flex items-center gap-2">
              {saveStatus === 'success' && (
                <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-medium animate-in fade-in">
                  <CheckCircle2 size={11} /> Synced
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-[10px] text-red-500 flex items-center gap-1 font-medium animate-in fade-in">
                  <AlertCircle size={11} /> Error
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowNewRunPanel(!showNewRunPanel)}
                className="text-[10px] font-semibold text-amber-500 hover:text-amber-400 flex items-center gap-0.5"
              >
                <span>{showNewRunPanel ? 'Simple Mode' : '+ New Run'}</span>
                {showNewRunPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
          </div>

          {/* Simple Inline Target Input */}
          {!showNewRunPanel ? (
            <div className="flex gap-2">
              <input 
                type="number" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="flex-1 bg-canvas border border-line-strong rounded-lg px-2.5 py-1.5 text-xs focus:border-amber-500 outline-none transition-colors text-fg"
                placeholder="Target count"
                min="1"
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateTarget()}
              />
              <button 
                onClick={handleUpdateTarget}
                disabled={isSaving}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white p-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors shadow-xs"
                title="Update target on active run"
              >
                <Save size={13} />
                <span>Update</span>
              </button>
            </div>
          ) : (
            /* New Run / Batch Popover Panel */
            <div className="bg-surface-2/80 p-2.5 rounded-lg border border-amber-500/30 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150">
              <div className="text-[11px] font-bold text-fg flex items-center gap-1">
                <Play size={11} className="text-amber-500" />
                <span>Start New Counting Run / Batch</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-fg-muted font-medium block mb-1">Target Count</label>
                  <input
                    type="number"
                    value={newRunTarget || inputValue}
                    onChange={(e) => setNewRunTarget(e.target.value)}
                    className="w-full bg-canvas border border-line-strong rounded-md px-2 py-1 text-xs text-fg focus:border-amber-500 outline-none"
                    placeholder="e.g. 500"
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-fg-muted font-medium block mb-1">Run Name (Optional)</label>
                  <input
                    type="text"
                    value={newRunName}
                    onChange={(e) => setNewRunName(e.target.value)}
                    className="w-full bg-canvas border border-line-strong rounded-md px-2 py-1 text-xs text-fg focus:border-amber-500 outline-none"
                    placeholder="e.g. Batch #2"
                  />
                </div>
              </div>
              <button
                onClick={handleStartNewRun}
                disabled={isSaving}
                className="w-full mt-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-1.5 px-3 rounded-md flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-sm"
              >
                <Play size={12} />
                <span>Start New Run & Record</span>
              </button>
            </div>
          )}
        </div>
        
      </div>

      {/* Target Tracker Records & Historical Comparison Modal */}
      {isRecordsModalOpen && (
        <TargetTrackerRecordsModal
          isOpen={isRecordsModalOpen}
          onClose={() => setIsRecordsModalOpen(false)}
          projectId={projectId}
          nodeId={resolvedNodeId}
          nodeTitle={title || config?.title || 'Target Tracker'}
          currentTarget={target}
          unit={unit}
        />
      )}
    </div>
  );
}
