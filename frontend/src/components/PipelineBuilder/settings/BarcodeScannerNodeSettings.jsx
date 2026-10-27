import React, { useState, useEffect, useCallback } from 'react';
import { 
  Usb, Keyboard, Network, Sliders, ChevronDown, ChevronUp, RefreshCw, Info 
} from 'lucide-react';

const DEFAULT_SERIAL_PORTS = [
  { port: '/dev/ttyACM0', label: '/dev/ttyACM0 (USB CDC-ACM Scanner)' },
  { port: '/dev/ttyUSB0', label: '/dev/ttyUSB0 (Standard USB Serial)' },
  { port: '/dev/ttyACM1', label: '/dev/ttyACM1' },
  { port: '/dev/ttyUSB1', label: '/dev/ttyUSB1' },
];

const BAUDRATES = [9600, 19200, 38400, 57600, 115200];

export default function BarcodeScannerNodeSettings({ data, onChange, nodeId }) {
  const [availablePorts, setAvailablePorts] = useState(DEFAULT_SERIAL_PORTS);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
    onChange({ [field]: value });
  };

  const fetchPorts = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/hardware/scanner-ports', { cache: 'no-store' });
      const d = await res.json();
      if (d.serial_ports && Array.isArray(d.serial_ports) && d.serial_ports.length > 0) {
        setAvailablePorts(d.serial_ports);
      }
      if (d.input_devices && Array.isArray(d.input_devices)) {
        setAvailableDevices(d.input_devices);
      }
    } catch (err) {
      console.warn("Failed to fetch scanner ports", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Connection Type Switcher */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-fg-secondary">
          ประเภทการเชื่อมต่อ (Connection Mode)
        </label>
        <div className="grid grid-cols-3 gap-1 bg-surface-2 p-1 rounded-lg border border-line">
          <button
            type="button"
            onClick={() => updateField('connectionType', 'serial')}
            className={`text-xs font-semibold py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              connectionType === 'serial'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-fg-subtle hover:text-fg'
            }`}
          >
            <Usb size={13} />
            <span>Serial</span>
          </button>
          <button
            type="button"
            onClick={() => updateField('connectionType', 'hid')}
            className={`text-xs font-semibold py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              connectionType === 'hid'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-fg-subtle hover:text-fg'
            }`}
            title="USB Keyboard (ดักจับคีย์บอร์ดระดับเคอร์เนล ไม่ต้องคลิกช่องรับข้อความ)"
          >
            <Keyboard size={13} />
            <span>HID</span>
          </button>
          <button
            type="button"
            onClick={() => updateField('connectionType', 'tcp')}
            className={`text-xs font-semibold py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              connectionType === 'tcp'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-fg-subtle hover:text-fg'
            }`}
          >
            <Network size={13} />
            <span>TCP</span>
          </button>
        </div>
      </div>

      {/* 1. Mode: USB Serial (CDC-ACM / UART) */}
      {connectionType === 'serial' && (
        <div className="flex flex-col gap-3 p-3 bg-surface-2 rounded-lg border border-line/70">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-fg-secondary">Serial Port</label>
              <button
                type="button"
                onClick={fetchPorts}
                disabled={isRefreshing}
                className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
                title="สแกนพอร์ตใหม่"
              >
                <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
                <span>ตรวจหาพอร์ต</span>
              </button>
            </div>
            <select
              className="w-full bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs text-fg focus:outline-none focus:border-amber-500 font-mono"
              value={port}
              onChange={(e) => updateField('port', e.target.value)}
            >
              {availablePorts.map((p) => (
                <option key={p.port} value={p.port}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-fg-secondary">Baudrate</label>
              <select
                className="w-full bg-surface border border-line rounded-lg px-2 py-1.5 text-xs text-fg focus:outline-none focus:border-amber-500 font-mono"
                value={baudrate}
                onChange={(e) => updateField('baudrate', Number(e.target.value))}
              >
                {BAUDRATES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-fg-secondary">Delimiter</label>
              <select
                className="w-full bg-surface border border-line rounded-lg px-2 py-1.5 text-xs text-fg focus:outline-none focus:border-amber-500 font-mono"
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
        <div className="flex flex-col gap-3 p-3 bg-surface-2 rounded-lg border border-line/70">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-fg-secondary">อุปกรณ์ Input Event</label>
              <button
                type="button"
                onClick={fetchPorts}
                disabled={isRefreshing}
                className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
                title="สแกนอุปกรณ์ใหม่"
              >
                <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
                <span>ตรวจหาอุปกรณ์</span>
              </button>
            </div>
            <select
              className="w-full bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs text-fg focus:outline-none focus:border-amber-500 font-mono"
              value={devicePath}
              onChange={(e) => updateField('devicePath', e.target.value)}
            >
              <option value="auto">⚡ ตรวจหาอัตโนมัติ (Auto-detect Barcode Scanner)</option>
              {availableDevices.map((d) => (
                <option key={d.path} value={d.path}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="text-[11px] text-fg-subtle bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 leading-relaxed flex items-start gap-2">
            <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span>
              ดักจับข้อมูลการยิงบาร์โค้ดระดับลินุกซ์เคอร์เนล โดยตรงจากเครื่องยิง USB โดยไม่ต้องคลิกเมาส์หรือเปิดช่องข้อความบนจอ
            </span>
          </div>
        </div>
      )}

      {/* 3. Mode: TCP Socket */}
      {connectionType === 'tcp' && (
        <div className="flex flex-col gap-2.5 p-3 bg-surface-2 rounded-lg border border-line/70">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-fg-secondary">Scanner IP Host</label>
            <input
              type="text"
              className="w-full bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-amber-500"
              value={tcpHost}
              placeholder="192.168.1.100"
              onChange={(e) => updateField('tcpHost', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-fg-secondary">TCP Port</label>
            <input
              type="number"
              className="w-full bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs font-mono text-fg focus:outline-none focus:border-amber-500"
              value={tcpPort}
              onChange={(e) => updateField('tcpPort', Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Advanced Accordion */}
      <div className="border border-line rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-3 bg-surface-2 text-xs font-semibold text-fg-secondary hover:bg-surface-3 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sliders size={14} className="text-amber-500" />
            <span>การกรองข้อมูลขั้นสูง (Filter & Debounce)</span>
          </span>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvanced && (
          <div className="p-3 bg-canvas/30 flex flex-col gap-3 border-t border-line">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-fg-secondary">Debounce ป้องกันการยิงซ้ำ</div>
                <div className="text-[10px] text-fg-subtle">หน่วงเวลาไม่ให้รับบาร์โค้ดเดิมซ้ำ</div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  value={debounceMs}
                  onChange={(e) => updateField('debounceMs', Number(e.target.value))}
                  className="w-20 bg-surface-2 border border-line rounded-md px-2 py-1 text-right font-mono text-xs text-fg"
                />
                <span className="text-[10px] text-fg-subtle font-mono">ms</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-line/40">
              <label className="text-xs font-medium text-fg-secondary">ตัด Prefix / Suffix</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="เช่น ]C1"
                  value={stripPrefix}
                  onChange={(e) => updateField('stripPrefix', e.target.value)}
                  className="bg-surface-2 border border-line rounded-md px-2 py-1 text-xs font-mono text-fg"
                />
                <input
                  type="text"
                  placeholder="เช่น -END"
                  value={stripSuffix}
                  onChange={(e) => updateField('stripSuffix', e.target.value)}
                  className="bg-surface-2 border border-line rounded-md px-2 py-1 text-xs font-mono text-fg"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-line/40">
              <label className="text-xs font-medium text-fg-secondary">Regex Pattern Filter</label>
              <input
                type="text"
                placeholder="เช่น ^[A-Z]{3}-\d{4}$ หรือ LOT-(\d+)"
                value={regexFilter}
                onChange={(e) => updateField('regexFilter', e.target.value)}
                className="bg-surface-2 border border-line rounded-md px-2 py-1 text-xs font-mono text-fg"
              />
              <span className="text-[10px] text-fg-subtle">
                หากกำหนด Regular Expression ที่มี capture group <code>()</code> ระบบจะสกัดเฉพาะข้อความในวงเล็บมาเป็นผลลัพธ์
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-2.5 bg-canvas/40 rounded-lg border border-line/50 text-[11px] text-fg-subtle flex items-center justify-between">
        <span>Outputs: <code className="text-amber-500 font-mono">barcode</code></span>
        <span className="font-mono text-[10px] text-fg-muted">Debounce {debounceMs}ms</span>
      </div>
    </div>
  );
}
