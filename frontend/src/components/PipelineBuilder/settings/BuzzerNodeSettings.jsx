import React from 'react';
import { BellRing, Volume2, Info } from 'lucide-react';
import RPi5PinoutHeader from './RPi5PinoutHeader';

export default function BuzzerNodeSettings({ nodeId, data, onChange }) {
  const currentPin = String(data?.pin ?? '19');
  const duration = data?.duration ?? 1.0;
  const triggerOn = data?.triggerOn !== false;

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Active Buzzer Info */}
      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2.5 text-red-500">
        <Volume2 size={16} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-xs text-red-400">External Active Buzzer Module</p>
          <p className="text-[11px] leading-relaxed text-red-500/90">
            Ensure your buzzer is an <strong>Active Buzzer</strong> (generates its own internal tone when supplied with 3.3V DC). Connect VCC to 3.3V, GND to Ground, and I/O to the chosen BCM GPIO pin.
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
        <label className="font-semibold text-fg-secondary">Buzzer Control BCM Pin</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-red-500 w-full text-fg"
          value={currentPin}
          onChange={(e) => onChange({ pin: e.target.value })}
        >
          <option value="19">GPIO 19 (Pin 35 - Recommended)</option>
          <option value="18">GPIO 18 (Pin 12)</option>
          <option value="21">GPIO 21 (Pin 40)</option>
          <option value="26">GPIO 26 (Pin 37)</option>
          <option value="13">GPIO 13 (Pin 33)</option>
        </select>
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Beep Duration (Seconds)</label>
        <input
          type="number"
          step="0.1"
          min="0.1"
          max="60"
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-red-500 w-full text-fg font-mono"
          value={duration}
          onChange={(e) => onChange({ duration: Number(e.target.value) })}
        />
        <p className="text-[10px] text-fg-subtle">
          When triggered, the backend initiates an asynchronous hardware timer to automatically turn off the buzzer after {duration} seconds.
        </p>
      </div>

      {/* Trigger Condition */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Incoming Payload Condition</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-red-500 w-full text-fg"
          value={String(triggerOn)}
          onChange={(e) => onChange({ triggerOn: e.target.value === 'true' })}
        >
          <option value="true">Beep when Payload is True</option>
          <option value="false">Beep when Payload is False</option>
        </select>
      </div>
    </div>
  );
}
