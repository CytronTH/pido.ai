import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, Save, RotateCcw, X, Clock, Loader2, AlertTriangle, 
  CheckCircle2, RefreshCw, Cpu, GitFork, ShieldAlert, Sparkles,
  ChevronDown, ChevronUp, Sliders, ArrowRight, PlusCircle, MinusCircle, Wand2
} from 'lucide-react';
import { 
  listPipelineVersions, savePipelineVersion, restorePipelineVersion, 
  checkPipelineCompatibility, getVersionDiff, previewPipelineDiff,
  formatRelativeTime, formatDateTime 
} from './PipelineVersions/pipelineVersionsApi';

export default function ProjectRevisionsModal({ 
  isOpen, 
  onClose, 
  projectId, 
  currentNodes = [], 
  currentEdges = [], 
  onRestoreSuccess 
}) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmWarnings, setConfirmWarnings] = useState([]);
  const [loadingWarningsId, setLoadingWarningsId] = useState(null);
  const [newRevisionName, setNewRevisionName] = useState('');
  const [error, setError] = useState(null);

  // Detailed Diff Inspection States
  const [expandedDiffId, setExpandedDiffId] = useState(null);
  const [diffDetails, setDiffDetails] = useState({}); // { [versionId]: diffObject }
  const [loadingDiffId, setLoadingDiffId] = useState(null);

  // Active Pending Changes Preview
  const [activeDiffPreview, setActiveDiffPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listPipelineVersions(projectId);
      setVersions(data);
    } catch (err) {
      console.error("Failed to fetch pipeline versions", err);
      setError(err.message || "Failed to load version history.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load preview of uncommitted changes from current canvas vs latest saved version
  const fetchActivePreview = useCallback(async () => {
    if (!projectId || !currentNodes.length) return;
    setLoadingPreview(true);
    try {
      const payload = {
        nodes: currentNodes.filter(n => !n.data?.isTutorialMock),
        edges: currentEdges
      };
      const diff = await previewPipelineDiff(projectId, payload);
      setActiveDiffPreview(diff);
    } catch (err) {
      console.warn("Failed to preview active diff", err);
    } finally {
      setLoadingPreview(false);
    }
  }, [projectId, currentNodes, currentEdges]);

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
      fetchActivePreview();
      setNewRevisionName('');
      setConfirmId(null);
      setConfirmWarnings([]);
      setExpandedDiffId(null);
      setError(null);
    }
  }, [isOpen, fetchVersions, fetchActivePreview]);

  const handleToggleDiff = async (versionId) => {
    if (expandedDiffId === versionId) {
      setExpandedDiffId(null);
      return;
    }

    setExpandedDiffId(versionId);
    if (!diffDetails[versionId]) {
      setLoadingDiffId(versionId);
      try {
        const diff = await getVersionDiff(projectId, versionId);
        setDiffDetails(prev => ({ ...prev, [versionId]: diff }));
      } catch (err) {
        console.error("Failed to load version diff", err);
      } finally {
        setLoadingDiffId(null);
      }
    }
  };

  const handleSaveRevision = async () => {
    if (!newRevisionName.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const pipelinePayload = {
        nodes: currentNodes.filter(n => !n.data?.isTutorialMock),
        edges: currentEdges
      };
      await savePipelineVersion(projectId, newRevisionName.trim(), pipelinePayload);
      setNewRevisionName('');
      await fetchVersions();
      await fetchActivePreview();
    } catch (err) {
      setError(err.message || "Failed to save version");
    } finally {
      setSaving(false);
    }
  };

  const handleApplySuggestedNote = () => {
    if (!activeDiffPreview) return;
    if (activeDiffPreview.bullet_summaries && activeDiffPreview.bullet_summaries.length > 0) {
      setNewRevisionName(activeDiffPreview.bullet_summaries[0]);
    } else if (activeDiffPreview.summary) {
      setNewRevisionName(activeDiffPreview.summary);
    }
  };

  const handleStartRestore = async (version) => {
    setConfirmId(version.id);
    setLoadingWarningsId(version.id);
    setConfirmWarnings([]);
    try {
      const warnings = await checkPipelineCompatibility(projectId, version.id);
      setConfirmWarnings(warnings || []);
    } catch (err) {
      console.warn("Could not pre-fetch compatibility warnings:", err);
      setConfirmWarnings([]);
    } finally {
      setLoadingWarningsId(null);
    }
  };

  const handleConfirmRestore = async (version) => {
    setRestoringId(version.id);
    setError(null);
    try {
      const res = await restorePipelineVersion(projectId, version.id);
      setConfirmId(null);
      onClose();
      if (onRestoreSuccess) {
        onRestoreSuccess(res.version, res.compatibility_warnings);
      }
    } catch (err) {
      setError(err.message || "Failed to restore version");
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-3 sm:p-4">
      <div className="bg-surface border border-line-strong rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center bg-surface-2 px-5 py-4 border-b border-line-strong shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-sm">
              <History size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-fg">Pipeline Version History & Diffs</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-3 text-fg-muted border border-line">
                  AI Flow
                </span>
              </div>
              <p className="text-[11px] text-fg-muted">
                บันทึกประวัติการแก้ไข การปรับแต่ง Parameter ในแต่ละโหนด พร้อมระบบตรวจสอบความเข้ากันได้
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => { fetchVersions(); fetchActivePreview(); }} 
              className="p-1.5 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-3 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-3 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Manual Checkpoint Bar with Auto-diff Detection */}
        <div className="p-4 bg-canvas/70 border-b border-line shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-fg flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              <span>บันทึกจุดตรวจเช็ค (Manual Checkpoint)</span>
            </label>
            <span className="text-[11px] text-fg-muted">
              {currentNodes.length} nodes · {currentEdges.length} connections
            </span>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              value={newRevisionName}
              onChange={(e) => setNewRevisionName(e.target.value)}
              placeholder="เช่น 'ปรับ confidenceThreshold เป็น 0.75', 'เพิ่ม Comment Node'..."
              className="flex-1 bg-surface border border-line-strong rounded-xl px-3.5 py-2 text-xs focus:border-amber-500 outline-none text-fg placeholder:text-fg-subtle transition-colors shadow-inner"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRevision()}
            />
            <button 
              onClick={handleSaveRevision}
              disabled={saving || !newRevisionName.trim()}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>บันทึก</span>
            </button>
          </div>

          {/* Smart Diff Suggestion Pill */}
          {activeDiffPreview && activeDiffPreview.total_changes > 0 && (
            <div className="flex items-center justify-between text-[11px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-1.5 truncate mr-2">
                <Sliders size={12} className="shrink-0 text-amber-500" />
                <span className="truncate">
                  ตรวจพบการแก้ไข: <b>{activeDiffPreview.summary}</b>
                </span>
              </div>
              <button
                onClick={handleApplySuggestedNote}
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-amber-600/20 hover:bg-amber-600 hover:text-white rounded text-[10px] font-medium transition-colors"
                title="ใช้สรุปการเปลี่ยนแปลงนี้เป็นข้อความบันทึก"
              >
                <Wand2 size={11} />
                <span>ใช้เป็น Note</span>
              </button>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded-lg">
              <AlertTriangle size={13} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Versions List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading && versions.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-48 gap-2 text-fg-muted">
              <Loader2 size={24} className="animate-spin text-amber-500" />
              <span className="text-xs">กำลังโหลดประวัติเวอร์ชันและการตั้งค่า...</span>
            </div>
          ) : versions.length > 0 ? (
            <div className="space-y-3.5">
              {versions.map((rev, idx) => {
                const isLatest = idx === 0;
                const isConfirming = confirmId === rev.id;
                const isExpanded = expandedDiffId === rev.id;
                const diff = diffDetails[rev.id] || rev.changes_summary;

                const modCount = diff?.modified_nodes?.length || 0;
                const addCount = diff?.added_nodes?.length || 0;
                const remCount = diff?.removed_nodes?.length || 0;
                const hasDetailedDiff = modCount > 0 || addCount > 0 || remCount > 0 || diff?.added_edges?.length > 0;

                return (
                  <div 
                    key={rev.id} 
                    className={`border rounded-2xl p-4 transition-all ${
                      isConfirming 
                        ? 'border-amber-500/70 bg-amber-500/5 shadow-md'
                        : isLatest 
                          ? 'border-amber-500/40 bg-surface-2/80 shadow-sm' 
                          : 'border-line-strong bg-surface-2/40 hover:border-fg-subtle'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                            v{rev.version_number}
                          </span>
                          {isLatest && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              <CheckCircle2 size={10} /> ปัจจุบัน (Active)
                            </span>
                          )}
                          <span className="text-[11px] text-fg-subtle" title={formatDateTime(rev.created_at)}>
                            {formatRelativeTime(rev.created_at)}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-fg mt-1.5 break-words">
                          {rev.note}
                        </p>

                        {/* Summary Badges */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
                          <span className="flex items-center gap-1 text-fg-muted bg-surface-3/80 px-2 py-0.5 rounded-md">
                            <Cpu size={12} className="text-blue-500" />
                            {rev.node_count} โหนด
                          </span>
                          <span className="flex items-center gap-1 text-fg-muted bg-surface-3/80 px-2 py-0.5 rounded-md">
                            <GitFork size={12} className="text-purple-500" />
                            {rev.edge_count} เส้นเชื่อม
                          </span>

                          {/* Quick Change Badges */}
                          {modCount > 0 && (
                            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-medium">
                              <Sliders size={11} /> {modCount} โหนดแก้ไข
                            </span>
                          )}
                          {addCount > 0 && (
                            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-medium">
                              <PlusCircle size={11} /> +{addCount} โหนดใหม่
                            </span>
                          )}
                          {remCount > 0 && (
                            <span className="flex items-center gap-1 text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md font-medium">
                              <MinusCircle size={11} /> -{remCount} โหนดลบ
                            </span>
                          )}

                          {rev.restored_from_version && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md">
                              กู้คืนจาก v{rev.restored_from_version}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Top Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleDiff(rev.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1 border ${
                            isExpanded 
                              ? 'bg-surface-3 text-fg border-line-strong' 
                              : 'bg-surface text-fg-secondary border-line hover:bg-surface-2'
                          }`}
                          title="ดูรายละเอียดการเปลี่ยนแปลงของการตั้งค่า"
                        >
                          <Sliders size={12} className="text-amber-500" />
                          <span className="hidden sm:inline">ดูรายละเอียด</span>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {!isConfirming && (
                          <button
                            onClick={() => handleStartRestore(rev)}
                            disabled={restoringId !== null}
                            className="bg-surface border border-line-strong hover:bg-amber-600 hover:text-white hover:border-amber-600 text-fg-secondary px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm disabled:opacity-50"
                            title="กู้คืน Pipeline นี้"
                          >
                            <RotateCcw size={13} />
                            <span>กู้คืน</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Detailed Diff Inspector */}
                    {isExpanded && (
                      <div className="mt-3.5 pt-3.5 border-t border-line-strong/80 animate-in fade-in duration-150">
                        {loadingDiffId === rev.id ? (
                          <div className="flex items-center justify-center py-4 text-xs text-fg-muted gap-2">
                            <Loader2 size={14} className="animate-spin text-amber-500" />
                            <span>กำลังเปรียบเทียบค่าพารามิเตอร์ของโหนด...</span>
                          </div>
                        ) : diff ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-[11px] text-fg-muted border-b border-line pb-1.5">
                              <span className="font-semibold text-fg">
                                การเปลี่ยนแปลงเมื่อเทียบกับ {diff.compare_to_version_number ? `v${diff.compare_to_version_number}` : 'เวอร์ชันก่อนหน้า'}:
                              </span>
                              <span>{diff.total_changes || 0} รายการที่เปลี่ยน</span>
                            </div>

                            {/* 1. Modified Nodes & Field Settings */}
                            {diff.modified_nodes && diff.modified_nodes.length > 0 && (
                              <div className="space-y-2">
                                {diff.modified_nodes.map(node => (
                                  <div key={node.id} className="bg-canvas/80 border border-line rounded-xl p-3 text-xs">
                                    <div className="flex items-center gap-2 font-bold text-fg mb-2">
                                      <Sliders size={13} className="text-amber-500" />
                                      <span>โหนด: {node.label}</span>
                                      <span className="text-[10px] font-mono text-fg-subtle bg-surface px-1.5 py-0.5 rounded border border-line">
                                        {node.id} ({node.type})
                                      </span>
                                    </div>

                                    {/* Settings Table */}
                                    <div className="space-y-1.5">
                                      {node.changes.map((change, cIdx) => (
                                        <div 
                                          key={cIdx} 
                                          className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center bg-surface p-2 rounded-lg border border-line/60 text-[11px]"
                                        >
                                          <div className="sm:col-span-4 font-medium text-fg-secondary">
                                            {change.label}
                                            <span className="text-[9px] block font-mono text-fg-subtle">{change.field}</span>
                                          </div>
                                          <div className="sm:col-span-8 flex items-center gap-2 flex-wrap">
                                            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 line-through font-mono text-[10px] border border-red-500/20 max-w-[140px] truncate" title={String(change.old_value)}>
                                              {change.old_value !== null && change.old_value !== undefined ? String(change.old_value) : '(ไม่มี)'}
                                            </span>
                                            <ArrowRight size={11} className="text-fg-subtle shrink-0" />
                                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold font-mono text-[10px] border border-emerald-500/20 max-w-[140px] truncate" title={String(change.new_value)}>
                                              {change.new_value !== null && change.new_value !== undefined ? String(change.new_value) : '(ไม่มี)'}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* 2. Added Nodes */}
                            {diff.added_nodes && diff.added_nodes.length > 0 && (
                              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-2.5 text-xs">
                                <div className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 mb-1.5">
                                  <PlusCircle size={13} className="text-emerald-500" />
                                  <span>โหนดที่เพิ่มเข้ามาใหม่ ({diff.added_nodes.length}):</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {diff.added_nodes.map(n => (
                                    <span key={n.id} className="inline-flex items-center gap-1 text-[11px] bg-surface px-2 py-1 rounded-lg border border-line text-fg">
                                      <span className="font-medium">{n.label}</span>
                                      <span className="text-[9px] text-fg-subtle">({n.type})</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 3. Removed Nodes */}
                            {diff.removed_nodes && diff.removed_nodes.length > 0 && (
                              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-2.5 text-xs">
                                <div className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-1.5 mb-1.5">
                                  <MinusCircle size={13} className="text-red-500" />
                                  <span>โหนดที่ถูกลบออก ({diff.removed_nodes.length}):</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {diff.removed_nodes.map(n => (
                                    <span key={n.id} className="inline-flex items-center gap-1 text-[11px] bg-surface px-2 py-1 rounded-lg border border-line text-fg line-through opacity-80">
                                      <span>{n.label}</span>
                                      <span className="text-[9px] text-fg-subtle">({n.type})</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 4. Connections (Edges) */}
                            {(diff.added_edges?.length > 0 || diff.removed_edges?.length > 0) && (
                              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-2.5 text-xs space-y-1">
                                <div className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                                  <GitFork size={13} className="text-purple-500" />
                                  <span>การปรับเปลี่ยนการเชื่อมต่อสาย (Wires):</span>
                                </div>
                                {diff.added_edges?.map((e, eIdx) => (
                                  <div key={`add-${eIdx}`} className="text-[11px] text-emerald-600 dark:text-emerald-400 pl-4">
                                    + เพิ่ม: {e.label}
                                  </div>
                                ))}
                                {diff.removed_edges?.map((e, eIdx) => (
                                  <div key={`rem-${eIdx}`} className="text-[11px] text-red-600 dark:text-red-400 pl-4 line-through">
                                    - ตัดออก: {e.label}
                                  </div>
                                ))}
                              </div>
                            )}

                            {!hasDetailedDiff && (
                              <p className="text-xs text-fg-muted italic text-center py-2">
                                เวอร์ชันนี้ไม่มีการเปลี่ยนแปลงของการตั้งค่าโหนด (อาจเป็นการจัดตำแหน่งใหม่หรือเวอร์ชันแรก)
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Confirmation Block with Compatibility Report */}
                    {isConfirming && (
                      <div className="mt-3.5 pt-3.5 border-t border-line-strong">
                        {loadingWarningsId === rev.id ? (
                          <div className="flex items-center gap-2 text-xs text-fg-muted py-2">
                            <Loader2 size={13} className="animate-spin text-amber-500" />
                            <span>กำลังตรวจความเข้ากันได้กับ Dashboard...</span>
                          </div>
                        ) : confirmWarnings.length > 0 ? (
                          <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200">
                            <div className="flex items-center gap-1.5 font-semibold mb-1">
                              <ShieldAlert size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>คำเตือนความเข้ากันได้ (Compatibility Warning):</span>
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-fg-muted pl-1">
                              {confirmWarnings.map((w, i) => (
                                <li key={i}>
                                  Widget <span className="font-semibold text-fg">"{w.widget_title}"</span> อ้างอิงโหนด <code className="bg-surface px-1 py-0.2 rounded border border-line">{w.referenced_node_id}</code> ที่ไม่มีในเวอร์ชันนี้
                                </li>
                              ))}
                            </ul>
                            <p className="text-[10px] text-fg-subtle mt-1.5 italic">
                              * คุณยังสามารถกู้คืนได้ตามปกติ แต่ Widget ดังกล่าวอาจไม่ได้รับข้อมูลจนกว่าจะเพิ่มโหนดกลับคืนมา
                            </p>
                          </div>
                        ) : (
                          <div className="mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                            <span>เข้ากันได้ 100% กับ Widget ทั้งหมดบน Dashboard ในปัจจุบัน</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-fg-muted">
                            กู้คืน Pipeline v{rev.version_number} เป็นเวอร์ชันใหม่?
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setConfirmId(null);
                                setConfirmWarnings([]);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs border border-line-strong hover:bg-surface-3 text-fg-secondary"
                            >
                              ยกเลิก
                            </button>
                            <button
                              onClick={() => handleConfirmRestore(rev)}
                              disabled={restoringId !== null}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              {restoringId === rev.id ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  <span>กำลังกู้คืน...</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw size={12} />
                                  <span>ยืนยันกู้คืน</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 px-4">
              <History size={36} className="mx-auto text-fg-faint mb-2.5" />
              <p className="text-sm font-semibold text-fg-secondary">ยังไม่มีเวอร์ชันของ Pipeline ที่บันทึกไว้</p>
              <p className="text-xs text-fg-subtle mt-1 max-w-sm mx-auto">
                ระบบจะสร้างเวอร์ชันให้อัตโนมัติทุกครั้งที่กด <b>Deploy</b> หรือสามารถพิมพ์บันทึก Checkpoint ด้านบนได้ทันที
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
