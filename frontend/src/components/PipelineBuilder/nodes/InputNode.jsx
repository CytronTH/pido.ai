import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Camera, Film, Repeat } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import NodeTelemetryBadge from './NodeTelemetryBadge';
import NodeHeader from './NodeHeader';
import InputNodeSettings from '../settings/InputNodeSettings';

export default function InputNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const isProjectRunning = usePipelineStore((state) => state.isProjectRunning);
  const telemetryData = usePipelineStore((state) => state.telemetryData);

  // Video playback loop tracking
  const [currentLoop, setCurrentLoop] = useState(1);
  const [isFinished, setIsFinished] = useState(false);

  const isFileSource = data?.sourceType === 'file' || 
    Boolean(data?.entityId && (data.entityId.startsWith('cam_file_') || data.entityId.startsWith('wiki_mock')));
  const isLoop = data?.loop ?? true;
  const targetLoops = data?.loop_count || 1;

  const handleSettingsChange = (updates) => {
    updateNodeData(id, updates);
  };

  // Sync with real-time telemetry metrics for loop progress
  useEffect(() => {
    if (!telemetryData?.pipelines) return;
    for (const pipe of telemetryData.pipelines) {
      const found = pipe.nodes?.find((n) => n.node_id === id);
      if (found) {
        if (found.current_loop !== undefined) {
          setCurrentLoop(found.current_loop);
        }
        if (found.is_finished !== undefined) {
          setIsFinished(Boolean(found.is_finished));
        }
        break;
      }
    }
  }, [telemetryData, id]);

  // Listen to WebSocket EOS event for video completion
  useEffect(() => {
    const handleWsMessage = (event) => {
      const detail = event.detail;
      if (!detail) return;
      if (detail.type === 'system' && detail.eos) {
        if (detail.input_node_id === id || detail.camera_id === data?.entityId) {
          setIsFinished(true);
          setCurrentLoop(targetLoops);
        }
      }
    };
    window.addEventListener('pido_ws_message', handleWsMessage);
    return () => window.removeEventListener('pido_ws_message', handleWsMessage);
  }, [id, data?.entityId, targetLoops]);

  // Reset finished flag if project starts afresh
  useEffect(() => {
    if (isProjectRunning && isFinished) {
      setIsFinished(false);
    }
  }, [isProjectRunning, isFinished]);

  return (
    <div className={`relative bg-surface border-2 ${selected ? 'border-blue-500 shadow-blue-500/20' : 'border-blue-600'} rounded-xl shadow-lg ${isCompact ? 'w-48' : 'w-88'} text-fg overflow-hidden`}>
      {/* ── Node Header with Loop / Loops Played Badge ── */}
      <NodeHeader
        id={id}
        icon={Camera}
        iconBg="bg-blue-600"
        headerBg="bg-blue-600/20 border-blue-900/50"
        defaultName="Input Source"
        defaultSubtitle="RTSP / Video / USB"
        data={data}
      >
        {/* Badge indicator on node header: Loop vs Loop Count */}
        {isFileSource && (
          isLoop ? (
            <span 
              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center gap-1 shadow-xs"
              title="เล่นซ้ำต่อเนื่อง (Loop mode)"
            >
              <Repeat size={11} className={isProjectRunning ? 'animate-spin-slow' : ''} />
              <span>Loop</span>
            </span>
          ) : (
            <span 
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 shadow-xs transition-colors ${
                isFinished 
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
              }`}
              title={`เล่นไฟล์วิดีโอ: รอบ ${currentLoop} จาก ${targetLoops} รอบ`}
            >
              <Film size={11} />
              <span>รอบ {currentLoop}/{targetLoops}</span>
            </span>
          )
        )}
      </NodeHeader>
      
      {!isCompact && (
        <div className="p-4 flex flex-col gap-3">
          <InputNodeSettings data={data} onChange={handleSettingsChange} />
          <NodeTelemetryBadge nodeId={id} />
        </div>
      )}

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-blue-500 border-2 border-line-subtle"
      />
    </div>
  );
}
