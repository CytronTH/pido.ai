import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Settings, Info, Radio, Database, RefreshCw, ArrowRight } from 'lucide-react';

export default function WidgetAlertModal({ 
  isOpen, 
  onClose, 
  item, 
  alertInfo, 
  onOpenSettings 
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !alertInfo || !item) return null;

  const config = item.config || {};
  const widgetTitle = config.title || item.i || 'Widget';
  const widgetType = item.type || item.i?.split('_')[0] || 'Unknown';

  const typeLabels = {
    metric: 'Number / Metric',
    gauge: 'Gauge',
    capacityBar: 'Capacity Bar',
    radialDonut: 'Radial Donut',
    trafficLight: 'Traffic Light',
    targetTracker: 'Target Tracker',
    chart: 'Line Chart',
    text: 'Text Value',
    textFeed: 'Log Feed',
    video: 'Video Stream',
  };

  const displayType = typeLabels[widgetType] || widgetType;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-surface border border-amber-500/40 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
      >
        {/* Top Glowing Amber Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 pb-3 flex items-start justify-between gap-3 border-b border-line-strong">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 shrink-0 shadow-inner">
              <AlertTriangle size={22} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="alert-dialog-title" className="text-base sm:text-lg font-bold text-fg truncate">
                  แจ้งเตือนข้อมูล Widget
                </h3>
                <span className="text-[10px] sm:text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                  {alertInfo.statusLabel || 'Alert'}
                </span>
              </div>
              <p className="text-xs text-fg-muted truncate mt-0.5">
                {widgetTitle} • <span className="font-medium text-fg-secondary">{displayType}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors shrink-0"
            title="ปิดหน้าต่าง (Close)"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Main Alert Reason Card */}
          <div className="bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5 sm:p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
              <Info size={16} className="shrink-0" />
              <span>{alertInfo.reason}</span>
            </div>
            {alertInfo.detail && (
              <p className="text-xs sm:text-sm text-fg-secondary leading-relaxed pl-6">
                {alertInfo.detail}
              </p>
            )}
          </div>

          {/* Diagnostic Info Box */}
          <div className="bg-surface-2/80 rounded-xl p-3.5 border border-line-strong space-y-2.5 text-xs">
            <div className="text-[11px] font-bold text-fg-muted uppercase tracking-wider">
              ข้อมูลการเชื่อมโยง (Binding Info)
            </div>

            <div className="flex justify-between items-center py-1 border-b border-line-subtle gap-2">
              <span className="text-fg-muted">Data Source:</span>
              <span className="font-mono text-fg font-medium truncate max-w-[240px]" title={alertInfo.dataPath}>
                {alertInfo.dataPath || '(ยังไม่ได้ระบุ)'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-line-subtle gap-2">
              <span className="text-fg-muted">Widget Type:</span>
              <span className="text-fg font-medium">{displayType}</span>
            </div>

            <div className="flex justify-between items-center py-1 gap-2">
              <span className="text-fg-muted">Pipeline Requirement:</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                ต้องการข้อมูลจาก Pipeline Builder เท่านั้น
              </span>
            </div>
          </div>

          {/* Actionable Suggestion */}
          {alertInfo.suggestion && (
            <div className="bg-surface-2/50 rounded-xl p-3.5 border border-line flex items-start gap-2.5">
              <ArrowRight size={15} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-fg-secondary leading-relaxed">
                <span className="font-semibold text-fg">แนวทางแก้ไข: </span>
                {alertInfo.suggestion}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-surface-2/70 border-t border-line-strong flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-fg-secondary hover:text-fg hover:bg-surface-3 transition-colors border border-line-strong active:scale-95"
          >
            ปิด
          </button>

          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings(item);
              }}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Settings size={15} />
              <span>เปิดการตั้งค่า Widget</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
