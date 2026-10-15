import React from 'react';
import { Lightbulb, Zap, Info } from 'lucide-react';
import RPi5PinoutHeader from './RPi5PinoutHeader';

export default function LEDNodeSettings({ nodeId, data, onChange }) {
  const currentPin = String(data?.pin ?? '12');
  const brightness = data?.brightness ?? 100;
  const triggerOn = data?.triggerOn !== false;

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* PWM Capability Info */}
      <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2.5 text-yellow-500">
        <Zap size={16} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-xs text-yellow-400">RP1 Hardware PWM Channels</p>
          <p className="text-[11px] leading-relaxed text-yellow-500/90">
            Raspberry Pi 5 features dual hardware PWM controllers in the RP1 chip on <strong>GPIO 12, 13, 18, 19</strong>, providing smooth, jitter-free dimming without CPU overhead.
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
        <label className="font-semibold text-fg-secondary">PWM Output Pin</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-yellow-500 w-full text-fg"
          value={currentPin}
          onChange={(e) => onChange({ pin: e.target.value })}
        >
          <option value="12">GPIO 12 (Hardware PWM0 - Pin 32)</option>
          <option value="13">GPIO 13 (Hardware PWM1 - Pin 33)</option>
          <option value="18">GPIO 18 (Hardware PWM0 - Pin 12)</option>
          <option value="19">GPIO 19 (Hardware PWM1 - Pin 35)</option>
          <option value="20">GPIO 20 (General GPIO - Pin 38)</option>
          <option value="21">GPIO 21 (General GPIO - Pin 40)</option>
        </select>
      </div>

      {/* Brightness Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <label className="font-semibold text-fg-secondary">Brightness Level (Duty Cycle)</label>
          <span className="font-mono font-bold text-yellow-500">{brightness}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          className="w-full accent-yellow-500 cursor-pointer"
          value={brightness}
          onChange={(e) => onChange({ brightness: Number(e.target.value) })}
        />
        <div className="flex justify-between text-[10px] text-fg-subtle">
          <span>0% (OFF)</span>
          <span>50%</span>
          <span>100% (Full Brightness)</span>
        </div>
      </div>

      {/* Trigger Condition */}
      <div className="flex flex-col gap-1.5">
        <label className="font-semibold text-fg-secondary">Incoming Payload Condition</label>
        <select
          className="bg-surface-2 border border-line-strong rounded-md p-2 text-xs focus:outline-none focus:border-yellow-500 w-full text-fg"
          value={String(triggerOn)}
          onChange={(e) => onChange({ triggerOn: e.target.value === 'true' })}
        >
          <option value="true">Dim / Light Up when Payload is True</option>
          <option value="false">Dim / Light Up when Payload is False</option>
        </select>
      </div>
    </div>
  );
}
