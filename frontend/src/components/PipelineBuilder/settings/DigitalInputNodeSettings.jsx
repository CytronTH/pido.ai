import React from 'react';
import { ToggleLeft, AlertTriangle, ShieldCheck } from 'lucide-react';
import RPi5PinoutHeader from './RPi5PinoutHeader';

export default function DigitalInputNodeSettings({ nodeId, data, onChange }) {
  const currentPin = String(data?.pin ?? '17');
  const pullResistor = data?.pullResistor ?? 'up';
  const activeState = data?.activeState ?? 'low';
  const bounceTime = data?.bounceTime ?? 0.1;

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Voltage Safety Alert */}
      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2.5 text-amber-500">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-xs text-amber-400">Raspberry Pi 5 3.3V Voltage Constraint</p>
          <p className="text-[11px] leading-relaxed text-amber-500/90">
            All 40-pin GPIOs operate at <strong>3.3V LVTTL</strong>. Connecting 5V, 12V, or 24V directly without an optocoupler or level-shifter will permanently damage the RP1 chip!
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
        <label className="font-semibold text-fg-secondary">Target BCM Pin</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-cyan-500 w-full text-fg"
          value={currentPin}
          onChange={(e) => onChange({ pin: e.target.value })}
        >
          <option value="17">GPIO 17 (Pin 11 - Recommended)</option>
          <option value="27">GPIO 27 (Pin 13)</option>
          <option value="22">GPIO 22 (Pin 15)</option>
          <option value="23">GPIO 23 (Pin 16)</option>
          <option value="24">GPIO 24 (Pin 18)</option>
          <option value="25">GPIO 25 (Pin 22)</option>
          <option value="4">GPIO 4 (Pin 7)</option>
          <option value="5">GPIO 5 (Pin 29)</option>
          <option value="6">GPIO 6 (Pin 31)</option>
          <option value="16">GPIO 16 (Pin 36)</option>
          <option value="26">GPIO 26 (Pin 37)</option>
        </select>
      </div>

      {/* Internal Pull Resistor */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Internal Resistor (RP1 Bias)</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-cyan-500 w-full text-fg"
          value={pullResistor}
          onChange={(e) => onChange({ pullResistor: e.target.value })}
        >
          <option value="up">Pull-Up (Button connected to Ground / GND)</option>
          <option value="down">Pull-Down (Signal line connects to 3.3V)</option>
          <option value="none">Floating / None (External physical pull resistor)</option>
        </select>
        <p className="text-[10px] text-fg-subtle">
          {pullResistor === 'up'
            ? 'Default for pushbuttons and door sensors: pin is held at 3.3V and pulled to GND when pressed.'
            : pullResistor === 'down'
            ? 'Pin is held at 0V until an active 3.3V signal is applied.'
            : 'No internal pull resistor is activated.'}
        </p>
      </div>

      {/* Active State / Triggering Level */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Active Signal Level</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-cyan-500 w-full text-fg"
          value={activeState}
          onChange={(e) => onChange({ activeState: e.target.value })}
        >
          <option value="low">Active LOW / 0V (Switch Closed / Button Pressed)</option>
          <option value="high">Active HIGH / 3.3V (Sensor High)</option>
        </select>
      </div>

      {/* Debounce Filter */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Bounce Filter (Debounce Seconds)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          max="1.0"
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-cyan-500 w-full text-fg font-mono"
          value={bounceTime}
          onChange={(e) => onChange({ bounceTime: Number(e.target.value) })}
        />
        <p className="text-[10px] text-fg-subtle">Suppresses mechanical switch bounce noise (Default: 0.1s / 100ms).</p>
      </div>

      {/* Live Behavior Note */}
      <div className="p-3 bg-surface-2 rounded-lg border border-line space-y-1">
        <div className="flex items-center gap-1.5 text-cyan-500 font-medium">
          <ShieldCheck size={14} />
          <span>Pipeline Output</span>
        </div>
        <p className="text-[11px] text-fg-muted">
          Sends <code className="text-cyan-400 bg-canvas px-1 py-0.5 rounded font-mono">{"{ payload: true }"}</code> to connected downstream nodes whenever the input pin is triggered.
        </p>
      </div>
    </div>
  );
}
