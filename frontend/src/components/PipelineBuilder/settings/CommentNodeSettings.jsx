import React from 'react';
import { StickyNote, Bookmark, Type, Palette, Info } from 'lucide-react';
import { COMMENT_THEMES } from '../nodes/commentThemes';

export default function CommentNodeSettings({ data = {}, onChange }) {
  const label = data.label ?? 'Comment';
  const comment = data.comment ?? '';
  const color = data.color || 'amber';
  const mode = data.mode || 'note';
  const fontSize = data.fontSize || 'base';

  const handleTitleChange = (e) => {
    onChange({ label: e.target.value });
  };

  const handleCommentChange = (e) => {
    onChange({ comment: e.target.value });
  };

  const handleColorChange = (newColor) => {
    onChange({ color: newColor });
  };

  const handleModeChange = (newMode) => {
    onChange({ mode: newMode });
  };

  const handleFontSizeChange = (newSize) => {
    onChange({ fontSize: newSize });
  };

  return (
    <div className="flex flex-col gap-5 text-fg text-sm">
      {/* Note Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
          <Type size={14} className="text-primary" />
          <span>Note Title / Header</span>
        </label>
        <input
          type="text"
          value={label}
          onChange={handleTitleChange}
          placeholder="e.g. Stage 1: Camera Ingestion"
          className="bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-primary nodrag"
        />
      </div>

      {/* Display Mode */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
          <StickyNote size={14} className="text-primary" />
          <span>Display Style</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleModeChange('note')}
            className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-xs ${
              mode === 'note'
                ? 'bg-primary/10 border-primary text-primary font-semibold shadow-xs'
                : 'bg-surface-2 border-line-strong text-fg-muted hover:text-fg hover:bg-surface-3'
            }`}
          >
            <StickyNote size={18} />
            <span>Sticky Note</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('banner')}
            className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-xs ${
              mode === 'banner'
                ? 'bg-primary/10 border-primary text-primary font-semibold shadow-xs'
                : 'bg-surface-2 border-line-strong text-fg-muted hover:text-fg hover:bg-surface-3'
            }`}
          >
            <Bookmark size={18} />
            <span>Section Banner</span>
          </button>
        </div>
      </div>

      {/* Color Palette */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
          <Palette size={14} className="text-primary" />
          <span>Color Theme</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Object.values(COMMENT_THEMES).map((t) => {
            const isSelected = color === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleColorChange(t.key)}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-xs ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-surface-3 font-semibold'
                    : 'border-line-strong bg-surface-2 hover:bg-surface-3 text-fg-muted hover:text-fg'
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full ${t.dot} shrink-0`} />
                <span className="truncate">{t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Size */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
          Text Size
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'sm', label: 'Small' },
            { id: 'base', label: 'Normal' },
            { id: 'lg', label: 'Large' },
          ].map((size) => (
            <button
              key={size.id}
              type="button"
              onClick={() => handleFontSizeChange(size.id)}
              className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                fontSize === size.id
                  ? 'bg-primary/10 border-primary text-primary font-semibold'
                  : 'bg-surface-2 border-line-strong text-fg-muted hover:text-fg hover:bg-surface-3'
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comment / Description Body */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
            Note Content / Documentation
          </label>
          <span className="text-[10px] text-fg-subtle">Supports multi-line text</span>
        </div>
        <textarea
          rows={6}
          value={comment}
          onChange={handleCommentChange}
          placeholder="Write explanatory notes, pinout descriptions, logic flow summaries, or operator instructions..."
          className="bg-surface-2 border border-line-strong rounded-lg p-3 text-xs leading-relaxed text-fg focus:outline-none focus:border-primary resize-y nodrag font-sans"
        />
      </div>

      {/* Helpful info box */}
      <div className="bg-surface-2 border border-line rounded-xl p-3 text-xs text-fg-muted flex items-start gap-2.5">
        <Info size={16} className="text-primary shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-fg">Tip: เหมือนใน Node-RED</span>
          <p className="text-[11px] leading-relaxed text-fg-subtle">
            Comment Node เป็นโหนดสำหรับจดบันทึกและจัดหมวดหมู่ใน Pipeline โดยไม่มีสายเชื่อมต่อ (Handles) และไม่ส่งผลต่อการทำงานของโมเดล AI หรือ GStreamer สามารถลากขอบเพื่อขยายขนาด (Resize) ได้อิสระ
          </p>
        </div>
      </div>
    </div>
  );
}
