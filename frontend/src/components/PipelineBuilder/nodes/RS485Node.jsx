import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Settings2 } from 'lucide-react';
import NodeHeader from './NodeHeader';
import usePipelineStore from '../../../store/usePipelineStore';

const RPI5_SERIAL_PORTS = [
  { port: '/dev/ttyUSB0', label: '/dev/ttyUSB0 (Standard USB Dongle)' },
  { port: '/dev/ttyUSB1', label: '/dev/ttyUSB1' },
  { port: '/dev/ttyACM0', label: '/dev/ttyACM0' },
];

const BAUDRATES = [9600, 19200, 38400, 57600, 115200];

export default function RS485Node({ id, data }) {
  const isCompact = data?.viewMode === 'compact';
  const globalUpdateNodeData = usePipelineStore((state) => state.updateNodeData);
  const updateNodeData = data?.onUpdate || globalUpdateNodeData;

  const port = data?.port || '/dev/ttyUSB0';
  const baudrate = data?.baudrate || 9600;
  const hexMode = Boolean(data?.hex_mode);
  const payload = data?.payload ?? '';

  const updateField = (field, value) => {
    if (data?.onChange) {
      data.onChange({ ...data, [field]: value });
    } else {
      updateNodeData(id, { [field]: value });
    }
  };

  return (
    <div className={`bg-surface border-2 border-indigo-500 rounded-xl shadow-xl shadow-indigo-900/20 overflow-hidden ${isCompact ? 'w-48' : 'w-72'}`}>
      <NodeHeader
        id={id}
        icon={Settings2}
        iconBg="bg-indigo-600"
        headerBg="bg-indigo-500/20 border-indigo-800/50"
        defaultName="RS485 Modbus"
        defaultSubtitle="Raspberry Pi 5 (USB-to-RS485)"
        data={data}
      />

      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500 border-2 border-line-subtle" />

      <div className={`p-4 space-y-3 ${isCompact ? 'hidden' : ''}`}>
        {/* Serial Port */}
        <div>
          <label className="text-xs text-fg-muted block mb-1">Serial Port</label>
          <select 
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
            value={port}
            onChange={(e) => updateField('port', e.target.value)}
          >
            {RPI5_SERIAL_PORTS.map((p) => (
              <option key={p.port} value={p.port}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Baudrate & Format */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-fg-muted block mb-1">Baudrate</label>
            <select
              className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
              value={baudrate}
              onChange={(e) => updateField('baudrate', Number(e.target.value))}
            >
              {BAUDRATES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-fg-muted block mb-1">Format</label>
            <select 
              className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none nodrag"
              value={hexMode ? 'hex' : 'text'}
              onChange={(e) => updateField('hex_mode', e.target.value === 'hex')}
            >
              <option value="hex">HEX Code</option>
              <option value="text">ASCII Text</option>
            </select>
          </div>
        </div>

        {/* Payload */}
        <div>
          <label className="text-xs text-fg-muted block mb-1">Data to send</label>
          <input 
            type="text"
            className="w-full bg-canvas border border-line-strong rounded p-1.5 text-xs text-fg outline-none font-mono nodrag"
            placeholder={hexMode ? "01 05 00 01 FF 00 DD FA" : "Trigger=1"}
            value={payload}
            onChange={(e) => updateField('payload', e.target.value)}
          />
        </div>

        <div className="pt-2 border-t border-line text-[10px] text-fg-subtle">
          Transmits over <code className="text-indigo-600 dark:text-indigo-400 bg-canvas px-1 py-0.5 rounded font-mono">{port}</code> when triggered
        </div>
      </div>
    </div>
  );
}
