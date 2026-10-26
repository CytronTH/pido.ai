import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ScanLine, Usb, Keyboard, Network, ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import NodeHeader from './NodeHeader';
import usePipelineStore from '../../../store/usePipelineStore';

const DEFAULT_SERIAL_PORTS = [
  { port: '/dev/ttyACM0', label: '/dev/ttyACM0 (USB CDC-ACM Scanner)' },
  { port: '/dev/ttyUSB0', label: '/dev/ttyUSB0 (Standard USB Serial)' },
  { port: '/dev/ttyACM1', label: '/dev/ttyACM1' },
  { port: '/dev/ttyUSB1', label: '/dev/ttyUSB1' },
];

const BAUDRATES = [9600, 19200, 38400, 57600, 115200];

export default function BarcodeScannerNode({ id, data, selected }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;

  const [availablePorts, setAvailablePorts] = useState(DEFAULT_SERIAL_PORTS);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [lastScanned, setLastScanned] = useState(data?.lastScanned || '');
  const [isFlashing, setIsFlashing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const connectionType = data?.connectionType || 'serial'; // 'serial', 'hid', 'tcp'
  const port = data?.port || '/dev/ttyACM0';
  const baudrate = data?.baudrate || 9600;
  const delimiter = data?.delimiter ?? '\\r\\n';
  const devicePath = data?.devicePath || 'auto';
  const tcpHost = data?.tcpHost || '192.168.1.100';
  const tcpPort = data?.tcpPort || 9004;
  const debounceMs = data?.debounceMs ?? 800;
  const stripPrefix = data?.stripPrefix || '';
  const stripSuffix = data?.stripSuffix || '';
  const regexFilter = data?.regexFilter || '';

  const updateField = (field, value) => {
    if (data?.onChange) {
      data.onChange({ ...data, [field]: value });
    } else {
      updateNodeData(id, { [field]: value });
    }
  };

  // Fetch detected hardware ports and devices on mount
  useEffect(() => {
    fetch('/api/hardware/scanner-ports', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (d.serial_ports && d.serial_ports.length > 0) {
          setAvailablePorts(d.serial_ports);
        }
        if (d.input_devices) {
          setAvailableDevices(d.input_devices);
        }
      })
      .catch(() => {
        // Fallback to defaults if backend endpoint is unavailable
      });
  }, []);

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
    } overflow-hidden ${isCompact ? 'w-48' : 'w-76'}`}>
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

      <div className={`p-3 space-y-2.5 ${isCompact ? 'hidden' : ''}`}>
        {/* Last Scanned Barcode Display */}
        {lastScanned && (
          <div className="bg-canvas border border-line rounded-lg p-2 flex items-center justify-between">
            <span className="text-[10px] text-fg-subtle font-mono">Last Code:</span>
            <span className="text-xs font-mono font-bold text-amber-500 truncate max-w-[170px]" title={lastScanned}>
              {lastScanned}
            </span>
          </div>
        )}

        {/* Connection Type Switcher */}
        <div>
          <label className="text-[10px] text-fg-subtle uppercase tracking-wider block mb-1">
            ประเภทการเชื่อมต่อ (Mode)
          </label>
          <div className="grid grid-cols-3 gap-1 bg-canvas p-0.5 rounded-md border border-line">
            <button
              type="button"
              onClick={() => updateField('connectionType', 'serial')}
              className={`text-[10px] font-bold py-1 px-1.5 rounded flex items-center justify-center gap-1 transition-colors nodrag ${
                connectionType === 'serial'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-fg-subtle hover:text-fg'
              }`}
            >
              <Usb size={11} /> Serial
            </button>
            <button
              type="button"
              onClick={() => updateField('connectionType', 'hid')}
              className={`text-[10px] font-bold py-1 px-1.5 rounded flex items-center justify-center gap-1 transition-colors nodrag ${
                connectionType === 'hid'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-fg-subtle hover:text-fg'
              }`}
              title="USB HID Keyboard (ดักจับคีย์บอร์ดระดับเคอร์เนล ไม่ต้องคลิกช่องรับข้อความ)"
            >
              <Keyboard size={11} /> HID
            </button>
            <button
              type="button"
              onClick={() => updateField('connectionType', 'tcp')}
              className={`text-[10px] font-bold py-1 px-1.5 rounded flex items-center justify-center gap-1 transition-colors nodrag ${
                connectionType === 'tcp'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-fg-subtle hover:text-fg'
              }`}
            >
              <Network size={11} /> TCP
            </button>
          </div>
        </div>

        {/* 1. Mode: USB Serial */}
        {connectionType === 'serial' && (
          <div className="space-y-2 bg-canvas/40 p-2 rounded-lg border border-line/70">
            <div>
              <label className="text-[10px] text-fg-subtle block mb-1">Serial Port</label>
              <select 
                className="w-full bg-surface border border-line-strong rounded p-1 text-xs text-fg outline-none nodrag"
                value={port}
                onChange={(e) => updateField('port', e.target.value)}
              >
                {availablePorts.map((p) => (
                  <option key={p.port} value={p.port}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-fg-subtle block mb-1">Baudrate</label>
                <select
                  className="w-full bg-surface border border-line-strong rounded p-1 text-xs text-fg outline-none nodrag"
                  value={baudrate}
                  onChange={(e) => updateField('baudrate', Number(e.target.value))}
                >
                  {BAUDRATES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-fg-subtle block mb-1">Line Delimiter</label>
                <select
                  className="w-full bg-surface border border-line-strong rounded p-1 text-xs text-fg outline-none nodrag font-mono"
                  value={delimiter}
                  onChange={(e) => updateField('delimiter', e.target.value)}
                >
                  <option value="\\r\\n">CR+LF (\r\n)</option>
                  <option value="\\n">LF only (\n)</option>
                  <option value="\\r">CR only (\r)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 2. Mode: USB HID Keyboard */}
        {connectionType === 'hid' && (
          <div className="space-y-2 bg-canvas/40 p-2 rounded-lg border border-line/70">
            <div>
              <label className="text-[10px] text-fg-subtle block mb-1">อุปกรณ์ Input Event</label>
              <select
                className="w-full bg-surface border border-line-strong rounded p-1 text-xs text-fg outline-none nodrag"
                value={devicePath}
                onChange={(e) => updateField('devicePath', e.target.value)}
              >
                <option value="auto">⚡ ตรวจหาอัตโนมัติ (Auto-detect Barcode Scanner)</option>
                {availableDevices.map((d) => (
                  <option key={d.path} value={d.path}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="text-[10px] text-fg-subtle bg-amber-500/10 border border-amber-500/20 rounded p-1.5 leading-relaxed">
              💡 ดักจับข้อมูลการยิงระดับเคอร์เนล โดยไม่ต้องคลิกเมาส์หรือเปิดช่องรับข้อความบนหน้าจอ
            </div>
          </div>
        )}

        {/* 3. Mode: TCP Socket */}
        {connectionType === 'tcp' && (
          <div className="grid grid-cols-3 gap-2 bg-canvas/40 p-2 rounded-lg border border-line/70">
            <div className="col-span-2">
              <label className="text-[10px] text-fg-subtle block mb-1">Scanner IP Host</label>
              <input
                type="text"
                className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg outline-none nodrag"
                value={tcpHost}
                placeholder="192.168.1.100"
                onChange={(e) => updateField('tcpHost', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-fg-subtle block mb-1">Port</label>
              <input
                type="number"
                className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg outline-none nodrag"
                value={tcpPort}
                onChange={(e) => updateField('tcpPort', Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {/* Advanced Filters Accordion */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-[10px] text-fg-muted hover:text-fg font-medium py-1 nodrag"
          >
            <span className="flex items-center gap-1">
              <Sliders size={11} className="text-amber-500" />
              การกรองข้อมูลขั้นสูง (Filter & Debounce)
            </span>
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showAdvanced && (
            <div className="space-y-2 mt-1.5 p-2 bg-canvas/30 rounded border border-line">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-fg-subtle block mb-0.5">ตัด Prefix นำหน้า</label>
                  <input
                    type="text"
                    className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg outline-none nodrag"
                    placeholder="เช่น ]C1"
                    value={stripPrefix}
                    onChange={(e) => updateField('stripPrefix', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-fg-subtle block mb-0.5">ตัด Suffix ต่อท้าย</label>
                  <input
                    type="text"
                    className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg outline-none nodrag"
                    placeholder="เช่น -END"
                    value={stripSuffix}
                    onChange={(e) => updateField('stripSuffix', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-fg-subtle block mb-0.5">Regex Pattern Filter</label>
                <input
                  type="text"
                  className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg outline-none nodrag"
                  placeholder="เช่น ^[A-Z]{3}-\d{4}$"
                  value={regexFilter}
                  onChange={(e) => updateField('regexFilter', e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] text-fg-subtle block mb-0.5">Debounce ป้องกันการยิงซ้ำ (ms)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg outline-none nodrag"
                  value={debounceMs}
                  onChange={(e) => updateField('debounceMs', Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-line text-[10px] text-fg-subtle flex items-center justify-between">
          <span>Outputs: <code className="text-amber-500 bg-canvas px-1 py-0.5 rounded font-mono">barcode</code></span>
          <span className="font-mono text-[9px] text-fg-muted">Debounce {debounceMs}ms</span>
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-amber-500 border-2 border-line-subtle" 
      />
    </div>
  );
}
