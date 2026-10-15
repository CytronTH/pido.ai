import React, { useState, useEffect, useCallback } from 'react';
import { X, History, RotateCcw, Loader2, AlertTriangle, LayoutGrid, CheckCircle2, RefreshCw } from 'lucide-react';
import { listDashboardVersions, getDashboardVersion, restoreDashboardVersion, formatRelativeTime, formatDateTime } from './dashboardVersionsApi';
import usePermissions from '../../utils/usePermissions';

/**
 * Slide-over listing saved dashboard versions (newest first) with non-destructive restore.
 * `onRestored(versionDetail)` receives the newly created version (including its layout).
 */
export default function VersionHistoryPanel({ 
  isOpen, 
  onClose, 
  projectId, 
  currentVersion, 
  isDirty, 
  onRestored, 
  refreshKey,
  dataSources = [],
  dataSourcesLoaded = false
}) {
  const { canEdit } = usePermissions();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [checkingCompatId, setCheckingCompatId] = useState(null);
  const [compatWarnings, setCompatWarnings] = useState([]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      setVersions(await listDashboardVersions(projectId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      setConfirmId(null);
      setCompatWarnings([]);
      load();
    }
  }, [isOpen, load, refreshKey]);

  const handleStartRestore = async (v) => {
    setConfirmId(v.id);
    setCompatWarnings([]);
    if (dataSourcesLoaded && dataSources) {
      setCheckingCompatId(v.id);
      try {
        const detail = await getDashboardVersion(projectId, v.id);
        const widgets = detail.layout?.lg || [];
        const missing = [];
        for (const item of widgets) {
          const cfg = item?.config || {};
          const paths = [cfg.dataPath, ...(Array.isArray(cfg.dataPaths) ? cfg.dataPaths : [])].filter(Boolean);
          for (const p of paths) {
            const clean = String(p).replace('dashboard.', '').split('.')[0];
            const matched = dataSources.some(ds => ds.id === clean || ds.id === p);
            if (!matched) {
              missing.push({
                widgetTitle: cfg.title || cfg.name || item.i,
                path: p,
              });
            }
          }
        }
        setCompatWarnings(missing);
      } catch (err) {
        console.warn("Could not check dashboard version compatibility:", err);
      } finally {
        setCheckingCompatId(null);
      }
    }
  };

  const handleRestore = async (v) => {
    setRestoringId(v.id);
    setError(null);
    try {
      const restored = await restoreDashboardVersion(projectId, v.id);
      setConfirmId(null);
      setCompatWarnings([]);
      onRestored(restored);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div
      className={`absolute top-0 right-0 h-full w-[340px] max-w-full z-50 bg-surface/95 backdrop-blur-md border-l border-line shadow-2xl flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg">
          <History size={16} className="text-blue-500" /> Version History
        </div>
        <div className="flex items-center gap-1">
          <button onClick={load} className="p-1.5 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-2" title="Refresh" aria-label="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-2" aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="mx-3 mt-3 flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>มีการแก้ไขที่ยังไม่ได้บันทึก ถ้ากู้คืนเวอร์ชันอื่น การแก้ไขนี้จะหายไป</span>
        </div>
      )}
      {error && (
        <div className="mx-3 mt-3 text-[11px] text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        {loading && versions.length === 0 ? (
          <div className="flex justify-center py-10 text-fg-subtle"><Loader2 size={20} className="animate-spin" /></div>
        ) : versions.length === 0 ? (
          <div className="text-center py-10 px-4">
            <History size={28} className="mx-auto text-fg-faint mb-2" />
            <p className="text-sm text-fg-secondary">ยังไม่มีเวอร์ชันที่บันทึกไว้</p>
            <p className="text-xs text-fg-subtle mt-1">กด Edit Layout → Save Version เพื่อสร้างเวอร์ชันแรก</p>
          </div>
        ) : (
          <ol className="relative border-l border-line-strong ml-2 space-y-3">
            {versions.map(v => {
              const isCurrent = v.version_number === currentVersion;
              const confirming = confirmId === v.id;
              return (
                <li key={v.id} className="ml-4">
                  <span className={`absolute -left-[5px] mt-3 w-2.5 h-2.5 rounded-full border-2 border-surface ${isCurrent ? 'bg-blue-500' : 'bg-line-stronger'}`} />
                  <div className={`rounded-xl border p-3 transition-colors ${isCurrent ? 'border-blue-500/50 bg-blue-500/5' : 'border-line bg-surface-2/40 hover:border-line-strong'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-fg">v{v.version_number}</span>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            <CheckCircle2 size={10} /> ปัจจุบัน
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-fg-subtle" title={formatDateTime(v.created_at)}>{formatRelativeTime(v.created_at)}</span>
                    </div>
                    <p className="text-xs text-fg-secondary mt-1.5 break-words">{v.note}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-fg-subtle">
                        <LayoutGrid size={10} /> {v.widget_count} widgets
                        {v.restored_from_version && <span className="ml-1">· กู้คืนจาก v{v.restored_from_version}</span>}
                      </span>
                      {canEdit && !isCurrent && !confirming && (
                        <button
                          onClick={() => handleStartRestore(v)}
                          className="text-[11px] flex items-center gap-1 text-blue-500 hover:text-blue-600 hover:underline"
                        >
                          <RotateCcw size={11} /> กู้คืน
                        </button>
                      )}
                    </div>
                    {canEdit && confirming && (
                      <div className="mt-2 pt-2 border-t border-line space-y-2">
                        {checkingCompatId === v.id ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-fg-muted py-1">
                            <Loader2 size={11} className="animate-spin text-blue-500" />
                            <span>กำลังตรวจความเข้ากันได้กับ Pipeline...</span>
                          </div>
                        ) : compatWarnings.length > 0 ? (
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-[11px] text-amber-800 dark:text-amber-200">
                            <div className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 mb-0.5">
                              <AlertTriangle size={12} className="shrink-0" />
                              <span>พบ {compatWarnings.length} widget ที่อ้างอิงโหนดที่ไม่มีใน Pipeline:</span>
                            </div>
                            <ul className="list-disc list-inside text-[10px] text-fg-muted pl-0.5 max-h-24 overflow-y-auto">
                              {compatWarnings.map((w, i) => (
                                <li key={i}>"{w.widgetTitle}" (โหนด: {w.path})</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} />
                            <span>เข้ากันได้กับโหนดใน Pipeline ปัจจุบัน</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-fg-muted">กู้คืนเป็นเวอร์ชันใหม่?</span>
                          <div className="flex gap-1.5">
                            <button 
                              onClick={() => {
                                setConfirmId(null);
                                setCompatWarnings([]);
                              }} 
                              className="text-[11px] px-2 py-1 rounded border border-line-strong text-fg-secondary hover:bg-surface-2"
                            >
                              ยกเลิก
                            </button>
                            <button
                              onClick={() => handleRestore(v)}
                              disabled={restoringId !== null}
                              className="text-[11px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1"
                            >
                              {restoringId === v.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} กู้คืน
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-line text-[10px] text-fg-subtle shrink-0">
        การกู้คืนจะสร้างเวอร์ชันใหม่ ประวัติเดิมไม่หาย · เก็บล่าสุด 100 เวอร์ชัน
      </div>
    </div>
  );
}
