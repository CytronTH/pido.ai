import React, { useState } from 'react';
import { List, MessageSquare, Layers, Clock, Filter, Tag, AlertCircle, Palette, Check, Database, Camera } from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import { useShallow } from 'zustand/react/shallow';
import PayloadPathSelector from './PayloadPathSelector';

export const LOG_COLOR_PRESETS = [
  { id: 'rose', name: 'Red', label: 'Danger / Alert', bg: 'bg-rose-500', ring: 'ring-rose-500', border: 'border-rose-500', text: 'text-rose-400' },
  { id: 'amber', name: 'Orange', label: 'Warning', bg: 'bg-amber-500', ring: 'ring-amber-500', border: 'border-amber-500', text: 'text-amber-400' },
  { id: 'emerald', name: 'Green', label: 'Pass / Normal', bg: 'bg-emerald-500', ring: 'ring-emerald-500', border: 'border-emerald-500', text: 'text-emerald-400' },
  { id: 'sky', name: 'Blue', label: 'Info / Detect', bg: 'bg-sky-500', ring: 'ring-sky-500', border: 'border-sky-500', text: 'text-sky-400' },
  { id: 'purple', name: 'Purple', label: 'Notice', bg: 'bg-purple-500', ring: 'ring-purple-500', border: 'border-purple-500', text: 'text-purple-400' },
  { id: 'indigo', name: 'Indigo', label: 'Default', bg: 'bg-indigo-600', ring: 'ring-indigo-600', border: 'border-indigo-500', text: 'text-indigo-400' },
];

export default function DashboardLogNodeSettings({ nodeId, data, onChange }) {
  const { edges, nodes } = usePipelineStore(useShallow((state) => ({
    edges: state.edges,
    nodes: state.nodes
  })));

  const upstreamEdge = edges.find(e => e.target === nodeId);
  const upstreamNode = upstreamEdge ? nodes.find(n => n.id === upstreamEdge.source) : null;
  const isUpstreamSnapshot = upstreamNode?.type === 'snapshotNode';
  const hasSnapshotNode = nodes.some(n => n.type === 'snapshotNode');

  const logMode = data?.logMode || (data?.messageTemplate ? 'custom' : 'property');
  const triggerCondition = data?.triggerCondition || (upstreamNode?.type === 'logicNode' ? 'on_true' : 'on_change');
  const cooldownSeconds = data?.cooldownSeconds !== undefined ? data.cooldownSeconds : 1.0;
  const currentColorId = data?.logColor || 'indigo';
  const activeColor = LOG_COLOR_PRESETS.find(c => c.id === currentColorId) || LOG_COLOR_PRESETS[5];

  const handleUpdate = (field, value) => {
    onChange({ [field]: value });
  };

  const getCommonPropertySuggestions = () => {
    if (!upstreamNode) return ['msg.payload'];
    if (upstreamNode.type === 'logicNode') {
      return ['msg.payload', 'msg.context', 'msg.payload.count'];
    }
    if (upstreamNode.type === 'flowCounterNode') {
      return ['msg.payload.total', 'msg.payload.newly_counted', 'msg.payload.counts'];
    }
    if (upstreamNode.type === 'counterNode') {
      return ['msg.payload.count', 'msg.payload'];
    }
    if (upstreamNode.type === 'aiNode') {
      return ['msg.payload.count', 'msg.payload.max_confidence', 'msg.payload.labels'];
    }
    return ['msg.payload', 'msg.payload.value', 'msg.payload.count'];
  };

  const suggestions = getCommonPropertySuggestions();

  return (
    <div className="flex flex-col gap-4 text-fg">
      {/* Widget Output Label */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
          <Tag size={12} className="text-indigo-500" />
          <span>Dashboard Widget Label</span>
        </label>
        <input 
          type="text"
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-sm focus:outline-none focus:border-indigo-500 nodrag text-fg"
          value={data?.label || ''}
          onChange={(e) => handleUpdate('label', e.target.value)}
          placeholder="e.g. Alert History / Event Log"
        />
        <span className="text-[10px] text-fg-subtle">
          This title will be shown on the Live Dashboard Log Feed widget.
        </span>
      </div>

      {/* Upstream Connection Info */}
      <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
        upstreamNode 
          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300' 
          : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
      }`}>
        <AlertCircle size={15} className="shrink-0" />
        {upstreamNode ? (
          <div>
            Connected to <strong className="font-semibold text-fg">{upstreamNode.data?.label || upstreamNode.type}</strong>
          </div>
        ) : (
          <div>No upstream node connected. Connect a node to stream log events.</div>
        )}
      </div>

      {/* Snapshot Integration Status Badge */}
      {isUpstreamSnapshot ? (
        <div className="p-2.5 rounded-lg border border-pink-500/30 bg-pink-500/10 text-xs text-pink-700 dark:text-pink-300 flex items-center gap-2">
          <Camera size={15} className="text-pink-500 shrink-0 animate-pulse" />
          <div>
            <strong className="font-semibold text-fg">Snapshot Evidence Linked:</strong> ภาพถ่ายและ Bounding Box จาก SnapshotNode จะถูกแนบเข้ากับ Log นี้อัตโนมัติ
          </div>
        </div>
      ) : hasSnapshotNode ? (
        <div className="p-2 rounded-lg border border-line-strong bg-surface-2/40 text-[11px] text-fg-subtle flex items-center gap-2">
          <Camera size={13} className="text-pink-400 shrink-0" />
          <span>Tip: ลากเส้นเชื่อมต่อจาก <strong>SnapshotNode</strong> มาที่ Node นี้ เพื่อแนบภาพถ่ายหลักฐานลงใน Log Feed</span>
        </div>
      ) : null}

      {/* Log Color Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Palette size={12} className="text-indigo-500" />
            <span>Log Status & Tag Color</span>
          </div>
          <span className={`text-[10px] font-semibold ${activeColor.text}`}>
            {activeColor.name} ({activeColor.label})
          </span>
        </label>
        <div className="grid grid-cols-6 gap-1.5 p-1.5 bg-surface-2/60 border border-line-strong rounded-lg">
          {LOG_COLOR_PRESETS.map((c) => {
            const isSelected = currentColorId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleUpdate('logColor', c.id)}
                title={`${c.name} - ${c.label}`}
                className={`h-7 rounded-md ${c.bg} transition-all nodrag cursor-pointer flex items-center justify-center relative ${
                  isSelected ? `ring-2 ring-offset-2 ring-offset-surface ${c.ring} scale-105 shadow-sm` : 'opacity-70 hover:opacity-100 hover:scale-105'
                }`}
              >
                {isSelected && <Check size={13} className="text-white drop-shadow" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Live Sample Preview */}
      <div className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${activeColor.border} bg-surface-2/40`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${activeColor.bg}`} />
          <span className="font-mono text-[10px] text-fg-subtle shrink-0">[12:00:00]</span>
          <span className="font-mono text-fg text-xs truncate">
            {data?.messageTemplate || (logMode === 'custom' ? 'Sample Alert Message' : (data?.sourcePath || 'msg.payload'))}
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shrink-0 ${activeColor.bg}`}>
          {data?.label || 'Log'}
        </span>
      </div>

      {/* Mode Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
          <List size={12} className="text-indigo-500" />
          <span>Log Entry Content Mode</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleUpdate('logMode', 'custom')}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all nodrag cursor-pointer ${
              logMode === 'custom'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-surface-2 border-line text-fg-secondary hover:bg-surface-3'
            }`}
          >
            <MessageSquare size={13} />
            <span>Custom Message</span>
          </button>
          <button
            type="button"
            onClick={() => handleUpdate('logMode', 'property')}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all nodrag cursor-pointer ${
              logMode === 'property'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-surface-2 border-line text-fg-secondary hover:bg-surface-3'
            }`}
          >
            <Layers size={13} />
            <span>Property Value</span>
          </button>
        </div>
      </div>

      {/* Mode-specific Fields */}
      {logMode === 'custom' ? (
        <div className="flex flex-col gap-2 bg-surface-2/60 border border-line-strong rounded-lg p-3">
          <label className="text-xs font-semibold text-fg flex items-center gap-1.5">
            <MessageSquare size={13} className="text-indigo-400" />
            <span>Message Template</span>
          </label>
          <textarea
            rows={2}
            className="w-full bg-surface border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-indigo-500 nodrag font-mono text-fg resize-none"
            value={data?.messageTemplate || ''}
            onChange={(e) => handleUpdate('messageTemplate', e.target.value)}
            placeholder="e.g. ตรวจพบผู้บุกรุกในโซน A! หรือ Count: {value}"
          />
          <div className="text-[10px] text-fg-subtle flex flex-col gap-1.5">
            <span className="font-semibold text-fg-secondary">คลิกเพื่อแทรกแท็ก (Click to insert placeholder):</span>
            <div className="flex flex-wrap gap-1">
              {[
                { token: '{value}', label: 'Value (ค่าที่ตรวจพบ)' },
                { token: '{count}', label: 'Count (จำนวน)' },
                { token: '{timestamp}', label: 'Time (เวลา)' },
                { token: '{snapshot_url}', label: '📷 Snapshot URL' }
              ].map(({ token, label }) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => handleUpdate('messageTemplate', (data?.messageTemplate || '') + ' ' + token)}
                  className="bg-surface hover:bg-surface-3 border border-line-strong px-2 py-0.5 rounded text-[10px] font-mono text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors nodrag cursor-pointer"
                  title={`Insert ${token}`}
                >
                  {token}
                </button>
              ))}
            </div>
            <span>If left blank, logs default trigger status.</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 bg-surface-2/60 border border-line-strong rounded-lg p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-fg">Target Property Path</label>
            <input
              type="text"
              className="bg-surface border border-line-strong rounded-md p-2 text-xs font-mono focus:outline-none focus:border-indigo-500 nodrag text-fg"
              value={data?.sourcePath || 'msg.payload'}
              onChange={(e) => handleUpdate('sourcePath', e.target.value)}
              placeholder="e.g. msg.payload.count"
            />
          </div>

          {/* Quick suggestions */}
          <div className="flex flex-wrap gap-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleUpdate('sourcePath', s)}
                className="text-[10px] font-mono bg-surface border border-line hover:border-indigo-500 px-1.5 py-0.5 rounded text-fg-secondary hover:text-indigo-400 transition-colors nodrag"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Payload Explorer */}
          <div className="mt-1 pt-2 border-t border-line-strong/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-fg-secondary mb-1.5">
              <Layers size={12} className="text-indigo-400" />
              <span>Payload Explorer</span>
            </div>
            <PayloadPathSelector
              nodeId={nodeId}
              selectedPath={data?.sourcePath || 'msg.payload'}
              onSelect={(path) => handleUpdate('sourcePath', path)}
            />
          </div>
        </div>
      )}

      {/* Trigger Condition Filter */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
          <Filter size={12} className="text-indigo-500" />
          <span>Trigger Condition</span>
        </label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-indigo-500 nodrag text-fg cursor-pointer"
          value={triggerCondition}
          onChange={(e) => handleUpdate('triggerCondition', e.target.value)}
        >
          <option value="on_true" className="bg-surface text-fg">
            ✅ เฉพาะเมื่อเป็นจริง (Only when True / Alert) — แนะนำสำหรับ Logic Node
          </option>
          <option value="on_change" className="bg-surface text-fg">
            🔄 เมื่อค่าเปลี่ยน (On Value Change)
          </option>
          <option value="all" className="bg-surface text-fg">
            ⚡ บันทึกทุกเหตุการณ์ที่ส่งเข้ามา (Every Event)
          </option>
        </select>
        <span className="text-[10px] text-fg-subtle">
          {triggerCondition === 'on_true' && 'Logs will only be created when incoming payload is True or truthy (drops False and idle messages).'}
          {triggerCondition === 'on_change' && 'Logs when the extracted value differs from the previous value.'}
          {triggerCondition === 'all' && 'Logs every packet that flows through this node.'}
        </span>
      </div>

      {/* Cooldown Throttle */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5">
          <Clock size={12} className="text-indigo-500" />
          <span>Throttle / Cooldown (Seconds)</span>
        </label>
        <input 
          type="number"
          min="0"
          max="60"
          step="0.5"
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-indigo-500 nodrag text-fg"
          value={cooldownSeconds}
          onChange={(e) => handleUpdate('cooldownSeconds', parseFloat(e.target.value) || 0)}
          placeholder="1.0"
        />
        <span className="text-[10px] text-fg-subtle">
          Prevents spamming duplicate logs during high-frequency camera detection frames (minimum time between consecutive logs).
        </span>
      </div>

      {/* Save to Database Toggle */}
      <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-line-strong bg-surface-2/60">
        <label className="flex items-center justify-between cursor-pointer select-none">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-indigo-500" />
            <span className="text-xs font-bold text-fg">Save to Event Logs (Database)</span>
          </div>
          <input
            type="checkbox"
            className="rounded border-line-strong text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
            checked={data?.saveToDb !== false}
            onChange={(e) => handleUpdate('saveToDb', e.target.checked)}
          />
        </label>
        <span className="text-[10px] text-fg-subtle">
          บันทึกประวัติข้อความลงฐานข้อมูล เพื่อให้ดูย้อนหลังและโหลดประวัติอัตโนมัติเมื่อเปิดหน้า Dashboard (มีระบบ Retention 7 วัน)
        </span>
      </div>
    </div>
  );
}
