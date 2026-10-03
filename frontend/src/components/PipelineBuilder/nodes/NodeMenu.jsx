import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Settings, PowerOff, Power } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';

export default function NodeMenu({ id }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const deleteNode = usePipelineStore((state) => state.deleteNode);
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const isDisabled = usePipelineStore((state) => state.nodes.find(n => n.id === id)?.data?.disabled || false);
  
  const toggleDisable = () => {
    updateNodeData(id, { disabled: !isDisabled });
    setIsOpen(false);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-md hover:bg-fg/10 text-fg-secondary hover:text-fg transition-colors"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-surface-2 border border-line-strong rounded-lg shadow-xl z-50 overflow-hidden nodrag">
          <button 
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg-secondary hover:bg-surface-3 hover:text-fg transition-colors text-left"
            onClick={() => setIsOpen(false)}
          >
            <Settings size={14} />
            Node Settings
          </button>
          
          <button 
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${isDisabled ? 'text-green-400 hover:bg-green-950 hover:text-green-300' : 'text-orange-400 hover:bg-orange-950 hover:text-orange-300'}`}
            onClick={toggleDisable}
          >
            {isDisabled ? <Power size={14} /> : <PowerOff size={14} />}
            {isDisabled ? 'Enable Node' : 'Disable Node'}
          </button>
          
          <div className="h-px bg-surface-3 w-full" />
          
          <button 
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-950 hover:text-red-300 transition-colors text-left"
            onClick={() => deleteNode(id)}
          >
            <Trash2 size={14} />
            Delete Node
          </button>
        </div>
      )}
    </div>
  );
}
