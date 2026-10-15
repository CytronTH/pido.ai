import React, { useState } from 'react';
import { Cpu, ChevronDown, ChevronUp } from 'lucide-react';

export const RPI5_PINS = [
  { pin: 1,  bcm: null, name: '3V3 Power', type: 'power3v3' },
  { pin: 2,  bcm: null, name: '5V Power',  type: 'power5v' },
  { pin: 3,  bcm: 2,    name: 'GPIO 2 (SDA)', type: 'gpio' },
  { pin: 4,  bcm: null, name: '5V Power',  type: 'power5v' },
  { pin: 5,  bcm: 3,    name: 'GPIO 3 (SCL)', type: 'gpio' },
  { pin: 6,  bcm: null, name: 'Ground',    type: 'gnd' },
  { pin: 7,  bcm: 4,    name: 'GPIO 4',       type: 'gpio' },
  { pin: 8,  bcm: 14,   name: 'GPIO 14 (TX)', type: 'gpio' },
  { pin: 9,  bcm: null, name: 'Ground',    type: 'gnd' },
  { pin: 10, bcm: 15,   name: 'GPIO 15 (RX)', type: 'gpio' },
  { pin: 11, bcm: 17,   name: 'GPIO 17',      type: 'gpio' },
  { pin: 12, bcm: 18,   name: 'GPIO 18 (PWM0)', type: 'pwm' },
  { pin: 13, bcm: 27,   name: 'GPIO 27',      type: 'gpio' },
  { pin: 14, bcm: null, name: 'Ground',    type: 'gnd' },
  { pin: 15, bcm: 22,   name: 'GPIO 22',      type: 'gpio' },
  { pin: 16, bcm: 23,   name: 'GPIO 23',      type: 'gpio' },
  { pin: 17, bcm: null, name: '3V3 Power', type: 'power3v3' },
  { pin: 18, bcm: 24,   name: 'GPIO 24',      type: 'gpio' },
  { pin: 19, bcm: 10,   name: 'GPIO 10 (MOSI)', type: 'gpio' },
  { pin: 20, bcm: null, name: 'Ground',    type: 'gnd' },
  { pin: 21, bcm: 9,    name: 'GPIO 9 (MISO)', type: 'gpio' },
  { pin: 22, bcm: 25,   name: 'GPIO 25',      type: 'gpio' },
  { pin: 23, bcm: 11,   name: 'GPIO 11 (SCLK)', type: 'gpio' },
  { pin: 24, bcm: 8,    name: 'GPIO 8 (CE0)', type: 'gpio' },
  { pin: 25, bcm: null, name: 'Ground',    type: 'gnd' },
  { pin: 26, bcm: 7,    name: 'GPIO 7 (CE1)', type: 'gpio' },
  { pin: 27, bcm: 0,    name: 'GPIO 0 (ID_SD)', type: 'system' },
  { pin: 28, bcm: 1,    name: 'GPIO 1 (ID_SC)', type: 'system' },
  { pin: 29, bcm: 5,    name: 'GPIO 5',       type: 'gpio' },
  { pin: 30, bcm: null, name: 'Ground',    type: 'gnd' },
  { pin: 31, bcm: 6,    name: 'GPIO 6',       type: 'gpio' },
  { pin: 32, bcm: 12,   name: 'GPIO 12 (PWM0)', type: 'pwm' },
  { pin: 33, bcm: 13,   name: 'GPIO 13 (PWM1)', type: 'pwm' },
  { pin: 34, bcm: null, name: 'Ground',    type: 'gnd' },
  { pin: 35, bcm: 19,   name: 'GPIO 19 (PWM1)', type: 'pwm' },
  { pin: 36, bcm: 16,   name: 'GPIO 16',      type: 'gpio' },
  { pin: 37, bcm: 26,   name: 'GPIO 26',      type: 'gpio' },
  { pin: 38, bcm: 20,   name: 'GPIO 20',      type: 'gpio' },
  { pin: 39, bcm: null, name: 'Ground',    type: 'gnd' },
  { pin: 40, bcm: 21,   name: 'GPIO 21',      type: 'gpio' },
];

export default function RPi5PinoutHeader({ selectedBcm, onSelectBcm, filterType }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedPinObj = RPI5_PINS.find(p => String(p.bcm) === String(selectedBcm));

  const getTypeStyle = (pin, isSelected) => {
    if (isSelected) {
      return 'bg-cyan-500 text-white font-bold ring-2 ring-cyan-400 shadow-md shadow-cyan-500/30';
    }
    switch (pin.type) {
      case 'power3v3':
        return 'bg-amber-500/15 text-amber-500 border border-amber-500/30';
      case 'power5v':
        return 'bg-rose-500/15 text-rose-500 border border-rose-500/30';
      case 'gnd':
        return 'bg-neutral-800 text-neutral-400 border border-neutral-700';
      case 'pwm':
        return 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500/25';
      case 'system':
        return 'bg-neutral-800/60 text-neutral-500 border border-neutral-800';
      default:
        return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/20';
    }
  };

  return (
    <div className="bg-canvas border border-line rounded-lg p-2.5 space-y-2">
      <div 
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(prev => !prev)}
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
          <Cpu size={14} className="text-cyan-500" />
          <span>Raspberry Pi 5 Pinout Header</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedPinObj && (
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              Pin {selectedPinObj.pin} ➔ BCM {selectedPinObj.bcm}
            </span>
          )}
          <button type="button" className="text-fg-muted hover:text-fg">
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="pt-2 border-t border-line space-y-2">
          <div className="text-[10px] text-fg-subtle flex items-center justify-between">
            <span>Click any GPIO pin to select:</span>
            <div className="flex gap-2 text-[9px]">
              <span className="text-amber-500">■ 3.3V</span>
              <span className="text-rose-500">■ 5V</span>
              <span className="text-neutral-400">■ GND</span>
              <span className="text-cyan-400">■ GPIO</span>
              <span className="text-yellow-400">■ PWM</span>
            </div>
          </div>

          {/* 2-Column Pinout grid */}
          <div className="grid grid-cols-2 gap-1 font-mono text-[10px] max-h-56 overflow-y-auto pr-1 styled-scrollbar">
            {Array.from({ length: 20 }).map((_, rowIndex) => {
              const leftPin = RPI5_PINS[rowIndex * 2];
              const rightPin = RPI5_PINS[rowIndex * 2 + 1];

              const isLeftSelected = String(leftPin.bcm) === String(selectedBcm);
              const isRightSelected = String(rightPin.bcm) === String(selectedBcm);

              return (
                <React.Fragment key={rowIndex}>
                  {/* Left (Odd) */}
                  <button
                    type="button"
                    disabled={leftPin.bcm === null || leftPin.type === 'system'}
                    onClick={() => leftPin.bcm !== null && onSelectBcm?.(String(leftPin.bcm))}
                    className={`flex items-center justify-between px-2 py-1 rounded transition-colors ${getTypeStyle(leftPin, isLeftSelected)} ${leftPin.bcm !== null ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="font-bold opacity-75">{leftPin.pin}</span>
                    <span className="truncate ml-1">{leftPin.name}</span>
                  </button>

                  {/* Right (Even) */}
                  <button
                    type="button"
                    disabled={rightPin.bcm === null || rightPin.type === 'system'}
                    onClick={() => rightPin.bcm !== null && onSelectBcm?.(String(rightPin.bcm))}
                    className={`flex items-center justify-between px-2 py-1 rounded transition-colors ${getTypeStyle(rightPin, isRightSelected)} ${rightPin.bcm !== null ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="truncate mr-1">{rightPin.name}</span>
                    <span className="font-bold opacity-75">{rightPin.pin}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
