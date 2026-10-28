import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ScanLine } from 'lucide-react';
import NodeHeader from './NodeHeader';
import BarcodeScannerNodeSettings from '../settings/BarcodeScannerNodeSettings';
import usePipelineStore from '../../../store/usePipelineStore';

export default function BarcodeScannerNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;

  const [lastScanned, setLastScanned] = useState(data?.lastScanned || '');
  const [isFlashing, setIsFlashing] = useState(false);

  const connectionType = data?.connectionType || 'serial'; // 'serial', 'hid', 'tcp'
  const port = data?.port || '/dev/ttyACM0';
  const tcpHost = data?.tcpHost || '192.168.1.100';
  const tcpPort = data?.tcpPort || 9004;

  const handleSettingsChange = (updates) => {
    if (data?.onChange) {
      data.onChange({ ...data, ...updates });
    } else {
      updateNodeData(id, updates);
    }
  };

  // Listen to WebSocket barcode_scan event for live indicator
  useEffect(() => {
    const handleWs = (e) => {
      const msg = e.detail;
      if (msg?.type === 'barcode_scan' && (msg.node_id === id || !msg.node_id)) {
        setLastScanned(msg.barcode);
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 800);
      }
    };
    window.addEventListener('pido_ws_message', handleWs);
    return () => window.removeEventListener('pido_ws_message', handleWs);
  }, [id]);

  return (
    <div className={`bg-surface border-2 rounded-xl shadow-xl transition-all duration-200 ${
      selected 
        ? 'border-amber-500 shadow-amber-500/20' 
        : isFlashing 
        ? 'border-emerald-400 shadow-emerald-500/30' 
        : 'border-amber-600 shadow-amber-900/20'
    } overflow-hidden ${isCompact ? 'w-52' : 'w-80'}`}>
      <NodeHeader
        id={id}
        icon={ScanLine}
        iconBg="bg-amber-600"
        headerBg="bg-amber-500/20 border-amber-800/50"
        defaultName="Barcode Scanner"
        defaultSubtitle={
          connectionType === 'serial' 
            ? `Serial (${port})` 
            : connectionType === 'hid' 
            ? 'USB Keyboard (HID)' 
            : `TCP (${tcpHost}:${tcpPort})`
        }
        data={data}
      >
        <div className="flex items-center gap-1.5 nodrag">
          {/* Live Scan ACT Indicator */}
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border transition-all duration-300 ${
              isFlashing
                ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                : 'bg-black/40 border-line/60'
            }`}
            title="สถานะการอ่านบาร์โค้ดล่าสุด"
          >
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              isFlashing ? 'bg-emerald-400 animate-ping' : 'bg-amber-500/80'
            }`}></span>
            <span className={`text-[8px] font-mono font-bold tracking-wider select-none ${
              isFlashing ? 'text-emerald-400' : 'text-fg-subtle'
            }`}>
              {isFlashing ? 'SCAN' : 'READY'}
            </span>
          </div>
        </div>
      </NodeHeader>

      {/* Compact Mode Summary */}
      {isCompact && (
        <div className="px-3 py-2 bg-canvas/40 border-t border-line/60 flex items-center justify-between text-[10px] font-mono nodrag">
          <span className="text-fg-subtle uppercase">
            {connectionType === 'serial' ? 'Serial' : connectionType === 'hid' ? 'HID' : 'TCP'}
          </span>
          <span className="text-amber-500 font-bold truncate max-w-[120px]" title={lastScanned || 'No scan'}>
            {lastScanned || 'Ready'}
          </span>
        </div>
      )}

      {/* Expanded Canvas View */}
      {!isCompact && (
        <div className="p-3.5 space-y-3 nodrag">
          {lastScanned && (
            <div className="bg-canvas border border-line rounded-lg p-2 flex items-center justify-between">
              <span className="text-[10px] text-fg-subtle font-mono">Last Code:</span>
              <span className="text-xs font-mono font-bold text-amber-500 truncate max-w-[180px]" title={lastScanned}>
                {lastScanned}
              </span>
            </div>
          )}

          <BarcodeScannerNodeSettings data={data} onChange={handleSettingsChange} nodeId={id} />
        </div>
      )}

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-amber-500 border-2 border-line-subtle" 
      />
    </div>
  );
}
