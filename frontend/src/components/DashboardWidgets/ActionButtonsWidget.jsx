import React from 'react';
import { ToggleRight, Siren, DoorOpen, Lightbulb } from 'lucide-react';

export default function ActionButtonsWidget({ config = {} }) {
  const triggerAction = (actionName) => {
    // In the future, this will POST to FastAPI to trigger a specific webhook/GPIO
    console.log(`Triggering manual action: ${actionName}`);
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
      {config?.showTitle !== false && (
        <div className="bg-surface-2/80 px-3 py-2 flex items-center gap-2 border-b border-line-strong shrink-0">
          <ToggleRight size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-fg truncate">{config?.title || 'Manual Triggers'}</span>
        </div>
      )}
      
      <div className="flex-1 p-3 grid grid-cols-2 gap-3">
        <button 
          onClick={() => triggerAction('Alarm')}
          className="bg-surface-2 hover:bg-surface-3 border border-line-strong rounded-lg flex flex-col items-center justify-center p-2 gap-2 transition-colors active:bg-surface-4"
        >
          <Siren size={24} className="text-red-600 dark:text-red-400" />
          <span className="text-xs text-fg-secondary font-medium">Trigger Alarm</span>
        </button>

        <button 
          onClick={() => triggerAction('Door')}
          className="bg-surface-2 hover:bg-surface-3 border border-line-strong rounded-lg flex flex-col items-center justify-center p-2 gap-2 transition-colors active:bg-surface-4"
        >
          <DoorOpen size={24} className="text-green-600 dark:text-green-400" />
          <span className="text-xs text-fg-secondary font-medium">Open Door</span>
        </button>

        <button 
          onClick={() => triggerAction('Lights')}
          className="bg-surface-2 hover:bg-surface-3 border border-line-strong rounded-lg flex flex-col items-center justify-center p-2 gap-2 transition-colors active:bg-surface-4"
        >
          <Lightbulb size={24} className="text-yellow-700 dark:text-yellow-400" />
          <span className="text-xs text-fg-secondary font-medium">Toggle Lights</span>
        </button>

        <button 
          onClick={() => triggerAction('Reset')}
          className="bg-surface-2 hover:bg-surface-3 border border-line-strong rounded-lg flex flex-col items-center justify-center p-2 gap-2 transition-colors active:bg-surface-4"
        >
          <ToggleRight size={24} className="text-fg-muted" />
          <span className="text-xs text-fg-secondary font-medium">System Reset</span>
        </button>
      </div>
    </div>
  );
}
