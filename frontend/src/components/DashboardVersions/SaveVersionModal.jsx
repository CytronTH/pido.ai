import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Plus, Minus, Move, Settings2, LayoutGrid, Loader2, AlertTriangle } from 'lucide-react';

const NOTE_MAX = 200;
const QUICK_NOTES = ['ปรับตำแหน่ง widget', 'เพิ่ม widget ใหม่', 'แก้ไขการตั้งค่า widget', 'ลบ widget ที่ไม่ใช้'];

/**
 * Asks for a required note before creating a new dashboard version.
 * `changes` = { added, removed, moved, configured, modeChanged } (counts / boolean) vs. the last saved version.
 */
export default function SaveVersionModal({ isOpen, onClose, onConfirm, changes, nextVersion, saving, error }) {
  const [note, setNote] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setNote('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmed = note.trim();
  const canSave = trimmed.length > 0 && !saving;
  const submit = () => { if (canSave) onConfirm(trimmed); };

  const rows = [
    { key: 'added', icon: Plus, label: 'widget ที่เพิ่ม', value: changes.added, color: 'text-emerald-500' },
    { key: 'removed', icon: Minus, label: 'widget ที่ลบ', value: changes.removed, color: 'text-red-500' },
    { key: 'moved', icon: Move, label: 'ย้าย / ปรับขนาด', value: changes.moved, color: 'text-blue-500' },
    { key: 'configured', icon: Settings2, label: 'แก้ไขการตั้งค่า', value: changes.configured, color: 'text-amber-500' },
  ].filter(r => r.value > 0);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onMouseDown={onClose}>
      <div
        className="w-[440px] max-w-[92vw] bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="save-version-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <h3 id="save-version-title" className="text-sm font-semibold text-fg">บันทึก Dashboard เป็นเวอร์ชันใหม่</h3>
            <p className="text-xs text-fg-subtle mt-0.5">จะถูกบันทึกเป็น <span className="font-mono font-semibold text-blue-500">v{nextVersion}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-2" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-line bg-surface-2/50 p-3">
            <div className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider mb-2">การเปลี่ยนแปลงจากเวอร์ชันล่าสุด</div>
            {rows.length === 0 && !changes.modeChanged ? (
              <p className="text-xs text-fg-subtle">ไม่มีการเปลี่ยนแปลง (บันทึกสถานะปัจจุบันเป็นเวอร์ชันแรก)</p>
            ) : (
              <ul className="space-y-1.5">
                {rows.map(({ key, icon: Icon, label, value, color }) => (
                  <li key={key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-fg-secondary"><Icon size={13} className={color} />{label}</span>
                    <span className="font-mono font-semibold text-fg">{value}</span>
                  </li>
                ))}
                {changes.modeChanged && (
                  <li className="flex items-center gap-2 text-xs text-fg-secondary"><LayoutGrid size={13} className="text-violet-500" />เปลี่ยนโหมดจัดวาง</li>
                )}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="version-note" className="flex items-center justify-between text-xs font-medium text-fg-secondary mb-1.5">
              <span>บันทึกการเปลี่ยนแปลง <span className="text-red-500">*</span></span>
              <span className={`font-mono ${note.length > NOTE_MAX * 0.9 ? 'text-amber-500' : 'text-fg-subtle'}`}>{note.length}/{NOTE_MAX}</span>
            </label>
            <textarea
              id="version-note"
              ref={inputRef}
              value={note}
              maxLength={NOTE_MAX}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); }}
              placeholder="เช่น เพิ่มกราฟอุณหภูมิ และย้ายกล้องไปด้านซ้าย"
              className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_NOTES.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setNote(prev => (prev.trim() ? `${prev.trim()}, ${q}` : q).slice(0, NOTE_MAX))}
                  className="text-[11px] px-2 py-1 rounded-full border border-line-strong text-fg-muted hover:text-blue-500 hover:border-blue-500/60 transition-colors"
                >
                  + {q}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>บันทึกไม่สำเร็จ: {error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-line bg-surface-2/40">
          <span className="text-[11px] text-fg-subtle">Ctrl + Enter เพื่อบันทึก</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-line-strong text-fg-secondary hover:bg-surface-2">ยกเลิก</button>
            <button
              onClick={submit}
              disabled={!canSave}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium flex items-center gap-2 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} บันทึก v{nextVersion}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
