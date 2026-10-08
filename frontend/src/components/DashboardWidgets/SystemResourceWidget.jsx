import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Zap, MemoryStick, Thermometer, ShieldAlert } from 'lucide-react';

export default function SystemResourceWidget({ config = {} }) {
  const [metrics, setMetrics] = useState({
    cpu_percent: 0,
    ram_percent: 0,
    temp_c: 0,
    npu_percent: 0,
    system: {},
    attribution: {}
  });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8000/ws/system_metrics`;
    let ws = null;
    let reconnectTimeout = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMetrics(data);
        } catch (err) {}
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const totalCpu = metrics.system?.cpu_percent ?? metrics.cpu_percent ?? 0;
  const internalCpu = metrics.attribution?.internal_cpu_percent ?? 0;
  const externalCpu = metrics.attribution?.external_cpu_percent ?? 0;
  const npuPercent = metrics.system?.npu_percent ?? metrics.npu_percent ?? 0;
  const ramPercent = metrics.system?.ram_percent ?? metrics.ram_percent ?? 0;
  const tempC = metrics.system?.temp_c ?? metrics.temp_c ?? 0;
  const isHealthy = metrics.system?.hardware_health?.healthy !== false;

  const isRamHigh = ramPercent > 80;
  const isTempHigh = tempC > 75;
  const isCpuHigh = totalCpu > 80;

  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
      {config?.showTitle !== false && (
        <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Activity size={16} className="text-orange-700 dark:text-orange-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-fg truncate">{config?.title || 'System Resources'}</span>
            {!isHealthy && (
              <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-bold px-1 rounded bg-red-950/80 border border-red-800 animate-pulse">
                <ShieldAlert size={10} /> Throttled
              </span>
            )}
          </div>
          <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>
      )}
      
      <div className="flex-1 p-3.5 flex flex-col justify-around gap-2 text-xs font-sans">
        
        {/* CPU with In-Platform vs External Attribution */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-fg-muted font-medium">
              <Cpu size={15} className="text-blue-500" />
              <span>CPU</span>
              <span className="text-[10px] text-fg-subtle font-mono">
                (PiDo: {internalCpu.toFixed(0)}% | Ext: {externalCpu.toFixed(0)}%)
              </span>
            </div>
            <span className={`text-xs font-mono w-10 text-right ${isCpuHigh ? 'text-red-500 font-bold' : 'text-fg font-semibold'}`}>
              {totalCpu.toFixed(0)}%
            </span>
          </div>
          <div 
            className="w-full bg-surface-2 rounded-full h-2 overflow-hidden flex border border-line/30"
            title={`PiDo: ${internalCpu}% | External: ${externalCpu}% | Total: ${totalCpu}%`}
          >
            <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${Math.min(100, internalCpu)}%` }} />
            <div className="bg-orange-500 h-full transition-all duration-300" style={{ width: `${Math.min(100, externalCpu)}%` }} />
          </div>
        </div>

        {/* NPU (Hailo-8L) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-fg-muted font-medium">
              <Zap size={15} className="text-purple-500" />
              <span>NPU {metrics?.npu_device ? metrics.npu_device.split(' ')[0] : 'Hailo'}</span>
            </div>
            <span className={`text-xs font-mono w-10 text-right ${npuPercent > 0 ? 'text-purple-700 dark:text-purple-300 font-bold' : 'text-fg-subtle'}`}>
              {npuPercent.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden border border-line/30">
            <div 
              className="bg-purple-500 h-full transition-all duration-300" 
              style={{ width: `${Math.min(100, Math.max(npuPercent > 0 ? 4 : 0, npuPercent))}%` }} 
            />
          </div>
        </div>

        {/* RAM */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-fg-muted font-medium">
              <MemoryStick size={15} className="text-emerald-500" />
              <span>RAM</span>
            </div>
            <span className={`text-xs font-mono w-10 text-right ${isRamHigh ? 'text-red-600 dark:text-red-400 font-bold' : 'text-fg font-semibold'}`}>
              {ramPercent.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden border border-line/30">
            <div 
              className={`h-full transition-all duration-300 ${isRamHigh ? 'bg-red-500' : 'bg-emerald-500'}`} 
              style={{ width: `${Math.min(100, ramPercent)}%` }} 
            />
          </div>
        </div>

        {/* SoC Temperature */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-fg-muted font-medium">
              <Thermometer size={15} className="text-orange-500" />
              <span>TEMP</span>
            </div>
            <span className={`text-xs font-mono w-12 text-right ${isTempHigh ? 'text-red-600 dark:text-red-400 font-bold' : 'text-fg font-semibold'}`}>
              {tempC.toFixed(1)}°C
            </span>
          </div>
          <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden border border-line/30">
            <div 
              className={`h-full transition-all duration-300 ${isTempHigh ? 'bg-red-500' : 'bg-orange-500'}`} 
              style={{ width: `${Math.min(100, Math.max(10, (tempC / 85) * 100))}%` }} 
            />
          </div>
        </div>

      </div>
    </div>
  );
}
