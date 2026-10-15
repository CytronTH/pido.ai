import React from 'react';
import { Settings2, Terminal, Network, Info } from 'lucide-react';

const BAUDRATES = [9600, 19200, 38400, 57600, 115200];

export default function RS485NodeSettings({ nodeId, data, onChange }) {
  const port = data?.port || '/dev/ttyUSB0';
  const baudrate = data?.baudrate || 9600;
  const hexMode = Boolean(data?.hex_mode);
  const payload = data?.payload ?? '';
  const triggerOn = data?.triggerOn !== false;

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* USB-to-RS485 Adapter Info */}
      <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg flex items-start gap-2.5 text-indigo-400">
        <Network size={16} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-xs">Raspberry Pi 5 USB-to-RS485</p>
          <p className="text-[11px] leading-relaxed text-indigo-300/90">
            Plug any standard USB-to-RS485 transceiver (CH340, FTDI, CP2102) into one of the Raspberry Pi 5 USB ports. It typically binds as <strong>/dev/ttyUSB0</strong>.
          </p>
        </div>
      </div>

      {/* Serial Port */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Serial Interface Port</label>
        <div className="flex gap-2">
          <select
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-indigo-500 w-full text-fg"
            value={port}
            onChange={(e) => onChange({ port: e.target.value })}
          >
            <option value="/dev/ttyUSB0">/dev/ttyUSB0 (Standard USB Dongle)</option>
            <option value="/dev/ttyUSB1">/dev/ttyUSB1</option>
            <option value="/dev/ttyACM0">/dev/ttyACM0</option>
          </select>
        </div>
      </div>

      {/* Baudrate & Data Mode */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-fg-secondary">Baudrate (bps)</label>
          <select
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-indigo-500 w-full text-fg"
            value={baudrate}
            onChange={(e) => onChange({ baudrate: Number(e.target.value) })}
          >
            {BAUDRATES.map((b) => (
              <option key={b} value={b}>{b} baud</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-fg-secondary">Payload Format</label>
          <select
            className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-indigo-500 w-full text-fg"
            value={hexMode ? 'hex' : 'text'}
            onChange={(e) => onChange({ hex_mode: e.target.value === 'hex' })}
          >
            <option value="hex">HEX Code (Binary Bytes)</option>
            <option value="text">ASCII Plain Text</option>
          </select>
        </div>
      </div>

      {/* Payload Input */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-fg-secondary">Transmit Data Payload</label>
          <span className="text-[10px] text-fg-subtle">
            {hexMode ? 'e.g. Modbus RTU Frame' : 'String'}
          </span>
        </div>
        <textarea
          rows={3}
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-indigo-500 w-full text-fg font-mono"
          placeholder={hexMode ? "01 05 00 01 FF 00 DD FA" : "TRIGGER=ALERT_ACTIVE\n"}
          value={payload}
          onChange={(e) => onChange({ payload: e.target.value })}
        />
        <p className="text-[10px] text-fg-subtle">
          {hexMode
            ? 'HEX mode automatically strips spaces and sends raw binary bytes over serial.'
            : 'Text mode encodes string as UTF-8 bytes.'}
        </p>
      </div>

      {/* Trigger Condition */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Incoming Trigger Condition</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-indigo-500 w-full text-fg"
          value={String(triggerOn)}
          onChange={(e) => onChange({ triggerOn: e.target.value === 'true' })}
        >
          <option value="true">Transmit when Payload is True</option>
          <option value="false">Transmit when Payload is False</option>
        </select>
      </div>
    </div>
  );
}
