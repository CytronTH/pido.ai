import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { NodeResizer } from '@xyflow/react';
import { StickyNote, Pencil, Check, X, Bookmark, Palette } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import { COMMENT_THEMES } from './commentThemes';

function CommentNode({ id, data, selected }) {
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;

  const colorKey = data?.color || 'amber';
  const theme = COMMENT_THEMES[colorKey] || COMMENT_THEMES.amber;
  const isBanner = data?.mode === 'banner';
  const fontSize = data?.fontSize || 'base';

  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [draftTitle, setDraftTitle] = useState(data?.label ?? 'Comment');
  const [draftComment, setDraftComment] = useState(data?.comment ?? '');

  const titleInputRef = useRef(null);
  const commentInputRef = useRef(null);

  // Sync draft states when external data changes and not editing
  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(data?.label ?? 'Comment');
      setDraftComment(data?.comment ?? '');
    }
  }, [data?.label, data?.comment, isEditing]);

  const handleStartEditing = useCallback((e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setDraftTitle(data?.label ?? 'Comment');
    setDraftComment(data?.comment ?? '');
    setIsEditing(true);
    setShowColorPicker(false);
  }, [data?.label, data?.comment]);

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    setIsEditing(false);
    setShowColorPicker(false);
    const cleanedTitle = draftTitle.trim() || 'Comment';
    updateNodeData(id, {
      label: cleanedTitle,
      comment: draftComment,
    });
  }, [draftTitle, draftComment, id, updateNodeData]);

  const handleCancel = useCallback((e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsEditing(false);
    setShowColorPicker(false);
    setDraftTitle(data?.label ?? 'Comment');
    setDraftComment(data?.comment ?? '');
  }, [data?.label, data?.comment]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      handleCancel(e);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  }, [handleCancel, handleSave]);

  const handleColorChange = useCallback((newColor, e) => {
    if (e) e.stopPropagation();
    updateNodeData(id, { color: newColor });
    setShowColorPicker(false);
  }, [id, updateNodeData]);

  const currentTitle = (typeof data?.label === 'string' && data.label.trim()) || 'Comment';
  const currentComment = typeof data?.comment === 'string' ? data.comment : '';

  const fontSizeClass = {
    sm: 'text-xs leading-relaxed',
    base: 'text-sm leading-relaxed',
    lg: 'text-base leading-relaxed',
  }[fontSize] || 'text-sm leading-relaxed';

  // Section Header / Banner Mode
  if (isBanner) {
    return (
      <>
        <NodeResizer
          color={theme.resizer}
          isVisible={selected}
          minWidth={220}
          minHeight={46}
          handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
        />
        <div
          onDoubleClick={handleStartEditing}
          className={`w-full h-full bg-surface border-2 ${selected ? theme.borderSelected : theme.border} rounded-xl shadow-md overflow-hidden flex items-center transition-all group`}
          style={{ minWidth: 220, minHeight: 46 }}
        >
          <div className={`w-2.5 self-stretch ${theme.bannerAccent} shrink-0`} />

          {isEditing ? (
            <div
              className="flex-1 p-2 flex items-center gap-2 nodrag nopan"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <input
                ref={titleInputRef}
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Section title..."
                className="bg-surface-2 border border-line-strong rounded px-2 py-1 text-sm font-bold text-fg flex-1 outline-none focus:border-primary"
              />
              <button
                onClick={handleSave}
                title="Save (Ctrl+Enter)"
                className="p-1.5 rounded-lg bg-primary hover:bg-primary-hover text-on-primary active:scale-95 transition-all"
              >
                <Check size={14} />
              </button>
              <button
                onClick={handleCancel}
                title="Cancel (Esc)"
                className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted hover:text-fg active:scale-95 transition-all"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex-1 px-3.5 py-2 flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Bookmark size={16} className={`${theme.accentText} shrink-0`} />
                <span className="font-bold text-sm sm:text-base text-fg tracking-wide truncate">
                  {currentTitle}
                </span>
                {currentComment && (
                  <span className="text-xs text-fg-muted truncate border-l border-line-strong pl-2 hidden sm:inline">
                    {currentComment}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={handleStartEditing}
                  title="Edit banner"
                  className="p-1 rounded hover:bg-surface-3 text-fg-muted hover:text-fg transition-colors"
                >
                  <Pencil size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // Standard Sticky Note Card Mode
  return (
    <>
      <NodeResizer
        color={theme.resizer}
        isVisible={selected}
        minWidth={220}
        minHeight={90}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <div
        onDoubleClick={handleStartEditing}
        className={`w-full h-full bg-surface border-2 ${
          selected ? theme.borderSelected : theme.border
        } rounded-xl shadow-lg shadow-black/5 overflow-hidden flex flex-col transition-all group`}
        style={{ minWidth: 220, minHeight: 90 }}
      >
        {/* Header Bar */}
        <div className={`${theme.headerBg} px-3 py-2 flex items-center justify-between gap-2 shrink-0 select-none`}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`${theme.iconBg} p-1 rounded-md shrink-0 flex items-center justify-center shadow-xs`}>
              <StickyNote size={14} className={theme.iconColor} />
            </div>

            {isEditing ? (
              <div
                className="flex-1 nodrag nopan"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <input
                  ref={titleInputRef}
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Note Title"
                  className="bg-surface-2 border border-line-strong rounded px-1.5 py-0.5 text-xs font-semibold text-fg w-full outline-none focus:border-primary nodrag"
                />
              </div>
            ) : (
              <span
                onClick={handleStartEditing}
                className="font-bold text-xs sm:text-sm text-fg truncate cursor-pointer hover:opacity-85 transition-opacity"
                title="Click to edit note"
              >
                {currentTitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Quick Color Picker */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowColorPicker((prev) => !prev);
                }}
                title="Change note color"
                className="p-1 rounded-md hover:bg-surface-3 text-fg-muted hover:text-fg transition-colors"
              >
                <Palette size={13} />
              </button>

              {showColorPicker && (
                <div
                  className="absolute right-0 top-full mt-1 z-30 bg-surface border border-line-strong rounded-lg p-1.5 shadow-xl flex gap-1 nodrag nopan"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {Object.values(COMMENT_THEMES).map((t) => (
                    <button
                      key={t.key}
                      onClick={(e) => handleColorChange(t.key, e)}
                      title={t.name}
                      className={`w-4 h-4 rounded-full ${t.dot} ${
                        colorKey === t.key ? 'ring-2 ring-fg scale-110' : 'hover:scale-110'
                      } transition-transform`}
                    />
                  ))}
                </div>
              )}
            </div>

            {isEditing ? (
              <div
                className="flex items-center gap-1 nodrag nopan"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleSave}
                  title="Save changes (Ctrl+Enter)"
                  className="p-1 rounded bg-primary hover:bg-primary-hover text-on-primary active:scale-95 transition-all"
                >
                  <Check size={13} />
                </button>
                <button
                  onClick={handleCancel}
                  title="Cancel (Esc)"
                  className="p-1 rounded bg-surface-3 hover:bg-surface-4 text-fg-muted hover:text-fg active:scale-95 transition-all"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartEditing}
                title="Edit note (or double-click)"
                className="p-1 rounded-md hover:bg-surface-3 text-fg-muted hover:text-fg sm:opacity-0 sm:group-hover:opacity-100 transition-all"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Body Content Area */}
        <div className={`${theme.bodyBg} p-3 flex-1 flex flex-col overflow-y-auto cursor-default`}>
          {isEditing ? (
            <div
              className="flex-1 flex flex-col gap-2 nodrag nopan h-full"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <textarea
                ref={commentInputRef}
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write your pipeline documentation, pinout guide, or reminders here... (Press Ctrl+Enter to save)"
                className="w-full flex-1 min-h-[60px] bg-surface-2 border border-line-strong rounded-lg p-2 text-xs font-sans text-fg focus:outline-none focus:border-primary resize-none nodrag leading-relaxed"
                rows={3}
              />
              <div className="flex items-center justify-between text-[10px] text-fg-subtle pt-1 border-t border-line/40">
                <span>Tip: <kbd className="px-1 py-0.5 rounded bg-surface-3 border border-line font-mono">Ctrl+Enter</kbd> to save</span>
                <button
                  onClick={handleSave}
                  className="text-primary font-semibold hover:underline"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-start">
              {currentComment ? (
                <div
                  className={`text-fg whitespace-pre-wrap break-words font-sans ${fontSizeClass}`}
                >
                  {currentComment}
                </div>
              ) : (
                <div
                  onClick={handleStartEditing}
                  className="text-fg-subtle italic text-xs py-2 cursor-pointer hover:text-fg-muted transition-colors flex items-center gap-1.5"
                >
                  <Pencil size={11} className="opacity-70" />
                  <span>Double-click or tap to write comment...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(CommentNode);
