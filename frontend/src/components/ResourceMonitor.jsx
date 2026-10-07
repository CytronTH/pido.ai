import React, { useState, useEffect } from 'react';
import { Cpu, Zap, MemoryStick, Thermometer, ChevronRight } from 'lucide-react';
import ResourceMonitorModal from './ResourceMonitorModal';
import usePipelineStore from '../store/usePipelineStore';

export default function ResourceMonitor() {
  const [telemetry, setTelemetry] = useState(null);
  const [history, setHistory] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);

  const setStoreTelemetry = usePipelineStore((state) => state.setTelemetryData);

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8000/ws/system_metrics`;
    let ws = null;
    let reconnectTimeout = null;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setTelemetry(data);
          if (setStoreTelemetry) {
            setStoreTelemetry(data);
          }

          const cpuVal = data.system?.cpu_percent ?? data.cpu_percent ?? 0;
          const npuVal = data.system?.npu_percent ?? data.npu_percent ?? 0;
          const tempVal = data.system?.temp_c ?? data.temp_c ?? 0;
          const internalCpu = data.attribution?.internal_cpu_percent ?? 0;
          const externalCpu = data.attribution?.external_cpu_percent ?? 0;
          const internalRamMb = data.attribution?.internal_ram_mb ?? 0;
          const externalRamMb = data.attribution?.external_ram_mb ?? 0;
          const ramUsedMb = data.system?.ram_used_mb ?? 0;
          const ramTotalMb = data.system?.ram_total_mb ?? 0;
          const ramPercentVal = data.system?.ram_percent ?? data.ram_percent ?? 0;

          setHistory((prev) => {
            const now = new Date();
            const timeStr = `${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            const next = [...prev, {
              time: timeStr,
              cpu: cpuVal,
              internalCpu: internalCpu,
              externalCpu: externalCpu,
              internalRamMb: Math.round(internalRamMb),
              externalRamMb: Math.round(externalRamMb),
              ramUsedMb: Math.round(ramUsedMb),
              ramTotalMb: Math.round(ramTotalMb),
              ramPercent: ramPercentVal,
              npu: npuVal,
              temp: tempVal
            }];
            return next.slice(-40);
          });
        } catch (err) {
          console.error("System metrics parse error:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("System metrics WS error:", error);
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [setStoreTelemetry]);

  const cpuPercent = telemetry?.system?.cpu_percent ?? telemetry?.cpu_percent ?? 0;
  const npuPercent = telemetry?.system?.npu_percent ?? telemetry?.npu_percent ?? 0;
  const ramPercent = telemetry?.system?.ram_percent ?? telemetry?.ram_percent ?? 0;
  const tempC = telemetry?.system?.temp_c ?? telemetry?.temp_c ?? 0;
  const isHealthy = telemetry?.system?.hardware_health?.healthy !== false;
  const healthMessage = telemetry?.system?.hardware_health?.message || 'Optimal';

  const isRamHigh = ramPercent > 80;
  const isTempHigh = tempC > 75;
  const isCpuHigh = cpuPercent > 80;
  const isNpuHigh = npuPercent > 85;

  return (
    <>
      {/* Desktop / Tablet Bar - Clickable to open deep telemetry modal */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="hidden sm:flex items-center gap-3 md:gap-4 bg-surface/90 hover:bg-surface-2 border border-line hover:border-line-strong rounded-xl px-3.5 py-1.5 shadow-lg transition-all cursor-pointer group"
        title="Click to view detailed CPU, NPU, and External OS workload breakdown"
      >
        {/* Hardware Health Alert icon if throttled or low voltage */}
        {!isHealthy && (
          <div className="flex items-center gap-1 text-red-500 animate-pulse font-mono text-[11px]" title={`Hardware Alert: ${healthMessage}`}>
            <Zap size={14} className="fill-red-500" />
            <span className="hidden lg:inline text-[10px] font-bold">ALERT</span>
          </div>
        )}

        {/* CPU */}
        <div className="flex items-center gap-1.5" title="CPU Usage (Click for details)">
          <Cpu size={15} className="text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
          <span className={`text-xs font-mono w-11 ${isCpuHigh ? 'text-red-600 dark:text-red-400 font-bold' : 'text-fg-secondary'}`}>
            {cpuPercent.toFixed(1)}%
          </span>
        </div>

        {/* NPU (Hailo) */}
        <div className="flex items-center gap-1.5 pl-1 border-l border-line" title="Hailo-8L NPU Usage (Click for details)">
          <Zap size={15} className={`shrink-0 transition-transform group-hover:scale-110 ${npuPercent > 0 ? 'text-purple-600 dark:text-purple-400 animate-pulse' : 'text-purple-600/60 dark:text-purple-400/60'}`} />
          <span className={`text-xs font-mono w-11 ${isNpuHigh ? 'text-red-600 dark:text-red-400 font-bold' : npuPercent > 0 ? 'text-purple-700 dark:text-purple-300 font-medium' : 'text-fg-muted'}`}>
            {npuPercent.toFixed(1)}%
          </span>
        </div>

        {/* RAM */}
        <div className="flex items-center gap-1.5 pl-1 border-l border-line" title="RAM Usage">
          <MemoryStick size={15} className={isRamHigh ? "text-red-500 animate-pulse shrink-0" : "text-emerald-600 dark:text-emerald-400 shrink-0"} />
          <span className={`text-xs font-mono w-11 ${isRamHigh ? "text-red-600 dark:text-red-400 font-bold" : "text-fg-secondary"}`}>
            {ramPercent.toFixed(1)}%
          </span>
        </div>

        {/* Temperature */}
        <div className="flex items-center gap-1.5 pl-1 border-l border-line" title="SoC Temperature">
          <Thermometer size={15} className={isTempHigh ? "text-red-500 animate-pulse shrink-0" : "text-orange-700 dark:text-orange-400 shrink-0"} />
          <span className={`text-xs font-mono w-11 ${isTempHigh ? "text-red-600 dark:text-red-400 font-bold" : "text-fg-secondary"}`}>
            {tempC ? `${tempC.toFixed(0)}°C` : 'N/A'}
          </span>
        </div>

        <div className="text-[10px] text-fg-subtle group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center pl-1 border-l border-line">
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>

      {/* Mobile Compact View (< sm) */}
      <div className="sm:hidden relative">
        <button
          type="button"
          onClick={() => setShowMobileDetails(prev => !prev)}
          className="flex items-center gap-1.5 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs font-mono shadow-md text-fg-secondary active:scale-95 transition-transform"
          title="Tap to see system resources"
        >
          <Cpu size={14} className="text-blue-600 dark:text-blue-400" />
          <span>{cpuPercent.toFixed(0)}%</span>
          <Zap size={14} className="text-purple-600 dark:text-purple-400 ml-0.5" />
          <span>{npuPercent.toFixed(0)}%</span>
          <span className={`w-2 h-2 rounded-full ${isRamHigh || isTempHigh ? 'bg-red-500 animate-ping' : 'bg-green-500'}`} />
        </button>

        {showMobileDetails && (
          <div 
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs" 
            onClick={() => setShowMobileDetails(false)}
          />
        )}

        {showMobileDetails && (
          <div className="absolute right-0 mt-2 z-50 w-56 bg-surface border border-line-strong rounded-xl p-3 shadow-2xl flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider border-b border-line pb-1 flex justify-between">
              <span>System &amp; NPU</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Online</span>
            </div>
            
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-fg-secondary">
                <Cpu size={14} className="text-blue-600 dark:text-blue-400" /> CPU
              </span>
              <span className="text-fg">{cpuPercent.toFixed(1)}%</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                <Zap size={14} className="text-purple-600 dark:text-purple-400" /> NPU Hailo
              </span>
              <span className="text-purple-800 dark:text-purple-200 font-medium">{npuPercent.toFixed(1)}%</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-fg-secondary">
                <MemoryStick size={14} className={isRamHigh ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"} /> RAM
              </span>
              <span className={isRamHigh ? "text-red-600 dark:text-red-400 font-bold" : "text-fg"}>
                {ramPercent.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-fg-secondary">
                <Thermometer size={14} className={isTempHigh ? "text-red-600 dark:text-red-400" : "text-orange-700 dark:text-orange-400"} /> Temp
              </span>
              <span className={isTempHigh ? "text-red-600 dark:text-red-400 font-bold" : "text-fg"}>
                {tempC.toFixed(1)}°C
              </span>
            </div>

            <button
              onClick={() => {
                setShowMobileDetails(false);
                setIsModalOpen(true);
              }}
              className="mt-1 w-full py-1.5 px-2 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-700 dark:text-blue-300 text-[11px] font-medium text-center hover:bg-blue-600/30 transition-colors"
            >
              Open Full Telemetry Breakdown
            </button>
          </div>
        )}
      </div>

      {/* Detailed Modal */}
      <ResourceMonitorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        telemetry={telemetry}
        history={history}
      />
    </>
  );
}
