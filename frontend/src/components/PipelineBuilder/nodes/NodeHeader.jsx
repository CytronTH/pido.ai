import React, { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

/**
 * Standard NodeHeader for Pipeline Builder nodes on canvas.
 * - Displays custom name as primary if set; defaultName underneath as secondary.
 * - Displays defaultName as primary if no custom name is set.
 * - In inline mode, allows clicking on the node title directly to rename inline.
 * - Does NOT display any 3-dots menu, settings, disable, or delete buttons in inline mode.
 */
export default function NodeHeader({
  id,
  icon: Icon,
  iconBg = 'bg-blue-600',
  iconColor = 'text-white',
  defaultName = 'Node',
  defaultSubtitle = null,
  data = {},
  children = null,
  headerBg = 'bg-blue-600/20 border-b border-blue-900/50',
  onRename,
}) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  const trimmedLabel = typeof data?.label === 'string' ? data.label.trim() : '';
  const isLegacyDefault = trimmedLabel.toLowerCase() === 'debugnode node' || trimmedLabel.toLowerCase() === 'debugnode';
  const isCustom = Boolean(trimmedLabel && trimmedLabel.toLowerCase() !== defaultName.toLowerCase() && !isLegacyDefault);

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(isCustom ? trimmedLabel : '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEditing = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setDraftName(isCustom ? trimmedLabel : defaultName);
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    const cleaned = draftName.trim();
    const finalLabel = (cleaned.toLowerCase() === defaultName.toLowerCase() || cleaned === '') ? '' : cleaned;
    
    if (onRename) {
      onRename(finalLabel);
    }
    if (id && updateNodeData) {
      updateNodeData(id, { label: finalLabel });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsEditing(false);
    }
  };

  return (
    <div className={`${headerBg} p-3 flex items-center justify-between border-b`}>
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {Icon && (
          <div className={`${iconBg} p-1.5 rounded-lg shrink-0 flex items-center justify-center shadow-sm`}>
            <Icon size={16} className={iconColor} />
          </div>
        )}
        <div className="flex flex-col justify-center min-w-0 flex-1">
          {isEditing ? (
            <div
              className="nodrag nopan"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <input
                ref={inputRef}
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder={defaultName}
                className="bg-surface-2 border border-blue-500 text-sm font-semibold text-fg rounded px-1.5 py-0.5 outline-none w-full shadow-inner nodrag"
              />
            </div>
          ) : (
            <div
              onClick={handleStartEditing}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleStartEditing(e);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="group/title flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-all rounded py-0.5 -my-0.5"
              title="Click to rename node"
            >
              <span className="font-semibold text-sm truncate leading-tight text-fg group-hover/title:text-blue-500 dark:group-hover/title:text-blue-400 transition-colors">
                {isCustom ? trimmedLabel : defaultName}
              </span>
              <Pencil size={11} className="text-fg-subtle opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
            </div>
          )}

          {!isEditing && isCustom ? (
            <span className="text-[10px] font-mono leading-none truncate mt-0.5 text-fg-muted" title={defaultName}>
              {defaultName}
            </span>
          ) : !isEditing && defaultSubtitle ? (
            <span className="text-[10px] leading-none truncate mt-0.5 text-fg-subtle">
              {defaultSubtitle}
            </span>
          ) : null}
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {children}
        </div>
      )}
    </div>
  );
}
