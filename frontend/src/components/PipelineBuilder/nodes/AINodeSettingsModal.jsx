import React from 'react';
import { createPortal } from 'react-dom';
import { X, Settings } from 'lucide-react';
import AINodeAdvancedSettingsContent from '../settings/AINodeAdvancedSettingsContent';

export default function AINodeSettingsModal({
  id, data, updateNodeData, modelClasses, isInputNode, onClose, onOpenROI
}) {
  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" 
      onMouseDown={onClose}
    >
      <div 
        className="bg-surface border border-purple-600/50 rounded-xl shadow-2xl w-[450px] max-h-[85vh] flex flex-col overflow-hidden text-fg" 
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-line flex justify-between items-center bg-surface-2/50">
          <h3 className="text-fg font-semibold flex items-center gap-2">
            <Settings size={16} className="text-purple-600 dark:text-purple-400"/> AI Node Settings
          </h3>
          <button onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Close">
            <X size={16}/>
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex flex-col gap-4 nodrag custom-scrollbar">
          <AINodeAdvancedSettingsContent
            id={id}
            data={data}
            updateNodeData={updateNodeData}
            modelClasses={modelClasses}
            isInputNode={isInputNode}
            onOpenROI={onOpenROI}
          />
        </div>

        <div className="p-4 border-t border-line flex justify-end bg-surface-2/30 mt-auto">
          <button 
            type="button"
            onClick={onClose} 
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-purple-900/20 active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
