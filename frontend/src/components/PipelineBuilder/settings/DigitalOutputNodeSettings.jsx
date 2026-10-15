import React from 'react';
import { ToggleRight, AlertCircle, Info } from 'lucide-react';
import RPi5PinoutHeader from './RPi5PinoutHeader';

export default function DigitalOutputNodeSettings({ nodeId, data, onChange }) {
  const currentPin = String(data?.pin ?? '23');
  const activeState = data?.activeState ?? 'high';
  const action = data?.action ?? 'on';
  const triggerOn = data?.triggerOn !== false;

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Current Limit Info */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-2.5 text-blue-400">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-xs">Drive Current Constraint</p>
          <p className="text-[11px] leading-relaxed text-blue-300/90">
            Raspberry Pi 5 GPIO pins supply up to <strong>16mA</strong> per pin. For driving relay coils, solenoid valves, or lamps, connect an external optocoupler/relay module.
          </p>
        </div>
      </div>

      {/* Interactive Pinout Selector */}
      <RPi5PinoutHeader
        selectedBcm={currentPin}
        onSelectBcm={(bcm) => onChange({ pin: bcm })}
      />

      {/* Target Pin Dropdown */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Target BCM Output Pin</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-orange-500 w-full text-fg"
          value={currentPin}
          onChange={(e) => onChange({ pin: e.target.value })}
        >
          <option value="23">GPIO 23 (Pin 16)</option>
          <option value="24">GPIO 24 (Pin 18)</option>
          <option value="25">GPIO 25 (Pin 22)</option>
          <option value="26">GPIO 26 (Pin 37)</option>
          <option value="17">GPIO 17 (Pin 11)</option>
          <option value="27">GPIO 27 (Pin 13)</option>
          <option value="22">GPIO 22 (Pin 15)</option>
          <option value="5">GPIO 5 (Pin 29)</option>
          <option value="6">GPIO 6 (Pin 31)</option>
          <option value="16">GPIO 16 (Pin 36)</option>
        </select>
      </div>

      {/* Output Logic Mode */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Trigger Logic (Hardware Level)</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-orange-500 w-full text-fg"
          value={activeState}
          onChange={(e) => onChange({ activeState: e.target.value })}
        >
          <option value="high">Active HIGH (3.3V Logic Level - LEDs / Transistors)</option>
          <option value="low">Active LOW (0V / GND Trigger - Standard Relay Modules)</option>
        </select>
        <p className="text-[10px] text-fg-subtle">
          Most multi-channel relay breakout boards are Active LOW (pulling the input pin to Ground energizes the relay coil).
        </p>
      </div>

      {/* Action */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Action on Trigger</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-orange-500 w-full text-fg"
          value={action}
          onChange={(e) => onChange({ action: e.target.value })}
        >
          <option value="on">Turn ON / Energize</option>
          <option value="off">Turn OFF / De-energize</option>
        </select>
      </div>

      {/* Trigger Condition */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Incoming Payload Condition</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-orange-500 w-full text-fg"
          value={String(triggerOn)}
          onChange={(e) => onChange({ triggerOn: e.target.value === 'true' })}
        >
          <option value="true">Trigger when Payload is True</option>
          <option value="false">Trigger when Payload is False</option>
        </select>
      </div>
    </div>
  );
}
