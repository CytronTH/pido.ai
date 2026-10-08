import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend 
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import { chartTheme } from '../../utils/theme';
import CanvasChart from './CanvasChart';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];
const SAMPLE_SERIES_ID = '__sample';

function getNestedValue(obj, path) {
    if (!path) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

const pad2 = (n) => String(n).padStart(2, '0');

function formatRelative(ms) {
  const s = Math.round(ms / 1000);
  if (s < 5) return 'เมื่อสักครู่';
  if (s < 60) return `${s} วินาทีที่แล้ว`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

/** Turn a unix timestamp (seconds) into { day, time, relative } for display. */
function formatHumanTime(unix) {
  const d = new Date(unix * 1000);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  let day;
  if (d.toDateString() === now.toDateString()) day = 'วันนี้';
  else if (d.toDateString() === yesterday.toDateString()) day = 'เมื่อวาน';
  else day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return {
    day,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`,
    relative: formatRelative(now.getTime() - d.getTime()),
  };
}

function formatValue(value, unit) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  const text = Number.isFinite(num)
    ? num.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(value);
  return unit ? `${text} ${unit}` : text;
}

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload || payload.length === 0 || label === undefined) return null;
  const { day, time, relative } = formatHumanTime(label);

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg text-xs min-w-[170px]"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line-strong)', color: 'var(--fg)' }}
    >
      <div className="flex items-baseline justify-between gap-3 pb-1.5 mb-1.5 border-b" style={{ borderColor: 'var(--line)' }}>
        <span className="font-semibold">{day} {time}</span>
        <span style={{ color: 'var(--fg-subtle)' }} className="text-[10px] whitespace-nowrap">{relative}</span>
      </div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color || entry.stroke }} />
              <span className="truncate" style={{ color: 'var(--fg-muted)' }}>{entry.name}</span>
            </span>
            <span className="font-mono font-semibold whitespace-nowrap">{formatValue(entry.value, unit)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Deterministic sample data so the settings preview looks stable while editing. */
function buildSampleData(seriesIds, timeframeMin, chartType) {
  const points = 48;
  const end = Math.floor(Date.now() / 1000);
  const step = Math.max(1, Math.floor((timeframeMin * 60) / points));
  const data = [];
  for (let i = 0; i < points; i++) {
    const ts = end - (points - 1 - i) * step;
    const row = { timestamp_unix: ts };
    seriesIds.forEach((id, s) => {
      const wave = Math.sin((i + s * 7) / 6) * 18 + Math.sin((i + s * 3) / 2.3) * 6;
      const raw = 50 + s * 12 + wave;
      row[id] = chartType === 'stepAfter' || chartType === 'bar' ? Math.round(raw / 5) * 5 : Math.round(raw * 10) / 10;
    });
    data.push(row);
  }
  return data;
}

export default function ChartWidget({ title, config = {}, paths = [], metadata, icon: Icon = BarChart2, globalTimeframe }) {
  const [historyData, setHistoryData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [zoomDomain, setZoomDomain] = useState(null);
  
  const lastUpdateRef = useRef({});
  const chartWrapperRef = useRef(null);
  const boundsRef = useRef({ min: 0, max: 0 });
  const pendingBatchRef = useRef([]);
  const batchTimeoutRef = useRef(null);
  const gradientPrefix = `chartGrad${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    };
  }, []);

  const isPreview = config.__isPreview === true;
  const chartType = config.chartType || 'stepAfter'; // stepAfter, monotone, area, bar
  const renderEngine = config.renderEngine || 'canvas'; // 'canvas' (60 FPS on Pi) or 'svg' (Recharts)
  const baseColor = config.color || COLORS[0];
  const unit = config.unit || '';

  // Visual tweaks (fall back to defaults when the section is turned off)
  const tweaksOn = config.enableVisualTweaks !== false;
  const strokeWidth = tweaksOn ? (Number(config.strokeWidth) || 2) : 2;
  const showDots = tweaksOn ? !!config.showDots : false;
  const fillOpacityPct = tweaksOn && config.fillOpacity !== undefined && config.fillOpacity !== '' ? Number(config.fillOpacity) : 20;
  const fillOpacity = chartType === 'bar' ? Math.max(fillOpacityPct, 60) / 100 : fillOpacityPct / 100;
  const useGradient = tweaksOn ? config.useGradient !== false : true;
  const showGrid = tweaksOn ? config.showGrid !== false : true;
  const gridDash = tweaksOn && config.gridStyle === '0' ? undefined : (tweaksOn && config.gridStyle) || '3 3';

  // Limits (older configs have no enable* flags: show whenever a value is set)
  const parseNum = (v) => (v !== undefined && v !== null && v !== '' ? parseFloat(v) : null);
  let threshold = config.enableUpperLimit === false ? null : parseNum(config.threshold);
  const thresholdMin = config.enableLowerLimit === false ? null : parseNum(config.thresholdMin);
  let thresholdLabel = config.thresholdLabel || 'Threshold';
  if (isPreview && config.enableUpperLimit && (threshold === null || isNaN(threshold))) {
    threshold = 75;
    thresholdLabel = `${thresholdLabel} (ตัวอย่าง)`;
  }
  const yConstraintsOn = config.enableYAxisConstraints !== false;
  const yMin = yConstraintsOn && parseNum(config.yMin) !== null ? parseNum(config.yMin) : 'auto';
  const yMax = yConstraintsOn && parseNum(config.yMax) !== null ? parseNum(config.yMax) : 'auto';
  const AUTO_DATAPOINTS_BY_TIMEFRAME = {
      '5m': 300,
      '15m': 450,
      '1h': 500,
      '24h': 400,
      '7d': 350,
  };

  const timeframeMap = {
      '5m': { tf: 5, aggr: null, label: '5m', tickInterval: 60 },
      '15m': { tf: 15, aggr: null, label: '15m', tickInterval: 180 },
      '1h': { tf: 60, aggr: 1, label: '1h', tickInterval: 600 },
      '24h': { tf: 1440, aggr: 10, label: '24h', tickInterval: 14400 },
      '7d': { tf: 10080, aggr: 60, label: '7d', tickInterval: 86400 },
  };
  const isLocked = config.lockTimeframe === true;
  const effectiveTimeframe = isLocked ? (config.timeframe || '5m') : (globalTimeframe || config.timeframe || '15m');
  const tfConfig = timeframeMap[effectiveTimeframe] || timeframeMap['15m'];
  const periodSeconds = tfConfig.tf * 60;

  // Auto calculate datapoints based on timeframe or respect manual custom setting
  const isCustomPoints = config.dataPointsMode === 'custom';
  const autoLimit = AUTO_DATAPOINTS_BY_TIMEFRAME[effectiveTimeframe] || 450;
  const maxPoints = isCustomPoints ? (Number(config.maxDataPoints) || autoLimit) : autoLimit;

  // Extract nodeIds safely from paths
  const nodeIds = useMemo(() => {
    return (paths || []).map(p => {
      const match = String(p).match(/(?:dashboard\.)?([a-zA-Z0-9_-]+?)(?:\.(?:value|history))?$/);
      return match ? match[1] : null;
    }).filter(Boolean);
  }, [paths]);

  const nodeIdsKey = nodeIds.join(',');

  // Human-friendly series names: saved data source names, falling back to the node id
  const seriesNames = useMemo(() => {
    const names = { [SAMPLE_SERIES_ID]: 'Sample Data' };
    const savedNames = config.dataPathNames || {};
    (paths || []).forEach(p => {
      const match = String(p).match(/(?:dashboard\.)?([a-zA-Z0-9_-]+?)(?:\.(?:value|history))?$/);
      if (match) names[match[1]] = savedNames[p] || `Node: ${match[1].split('_')[0]}`;
    });
    return names;
  }, [paths, config.dataPathNames]);

  const seriesIds = isPreview && nodeIds.length === 0 ? [SAMPLE_SERIES_ID] : nodeIds;
  const seriesKey = seriesIds.join('|');

  const previewData = useMemo(
    () => (isPreview ? buildSampleData(seriesKey.split('|'), tfConfig.tf, chartType) : null),
    [isPreview, seriesKey, tfConfig.tf, chartType]
  );

  // Fetch history on mount and whenever nodeIds or timeframe changes (both live and preview)
  useEffect(() => {
    if (nodeIds.length === 0) {
      setIsLoaded(true);
      setHistoryData([]);
      return;
    }

    const fetchLimit = Math.max(maxPoints * 2, 1000);
    let urlParams = `?limit=${fetchLimit}&timeframe_min=${tfConfig.tf}`;
    if (tfConfig.aggr) urlParams += `&aggregate_min=${tfConfig.aggr}`;

    Promise.all(nodeIds.map(id => 
        fetch(`/api/nodes/${id}/history${urlParams}`).then(r => r.json()).then(res => ({ id, data: res.data || [] }))
    ))
    .then(results => {
        let merged = [];
        results.forEach(({ id, data }) => {
            data.forEach(item => {
                merged.push({
                    timestamp_unix: item.timestamp_unix,
                    time: item.time,
                    [id]: item.value
                });
            });
        });
        
        // Sort by time
        merged.sort((a, b) => a.timestamp_unix - b.timestamp_unix);
        setHistoryData(merged);
        setIsLoaded(true);
    })
    .catch(err => {
        console.error("Failed to fetch TSDB history", err);
        setIsLoaded(true);
    });
  }, [nodeIdsKey, effectiveTimeframe, tfConfig.tf, tfConfig.aggr, maxPoints]);

  // Listen to live updates from metadata
  useEffect(() => {
    if (!isLoaded || nodeIds.length === 0 || !metadata) return;

    let newPoint = { timestamp_unix: Date.now() / 1000, time: new Date().toLocaleTimeString() };
    let hasChanges = false;

    nodeIds.forEach(id => {
        const livePath = `dashboard.${id}`;
        const nodeData = getNestedValue(metadata, livePath);
        if (nodeData && nodeData.value !== undefined) {
            
            let tsUnix = Date.now() / 1000;
            if (nodeData.msg?.metadata?.timestamp) {
                tsUnix = nodeData.msg.metadata.timestamp;
            }
            const tsUnixInt = Math.floor(tsUnix);
            
            // Check if value changed to throttle updates
            if (lastUpdateRef.current[id] !== nodeData.value) {
                newPoint[id] = nodeData.value;
                newPoint.timestamp_unix = tsUnixInt;
                newPoint.time = new Date(tsUnixInt * 1000).toLocaleTimeString();
                lastUpdateRef.current[id] = nodeData.value;
                hasChanges = true;
            }
        }
    });

    if (hasChanges) {
      pendingBatchRef.current.push(newPoint);
      if (!batchTimeoutRef.current) {
        batchTimeoutRef.current = setTimeout(() => {
          batchTimeoutRef.current = null;
          if (pendingBatchRef.current.length === 0) return;
          const batch = pendingBatchRef.current;
          pendingBatchRef.current = [];
          setHistoryData(prev => {
            const newHistory = [...prev, ...batch];
            // Keep a reasonable buffer so live points don't cause memory leaks
            const bufferLimit = Math.max(maxPoints * 2, 1000);
            if (!tfConfig.aggr && newHistory.length > bufferLimit) return newHistory.slice(-bufferLimit);
            return newHistory;
          });
        }, 100); // 100ms batching (caps React re-renders to max 10 FPS)
      }
    }
  }, [metadata, isLoaded, nodeIdsKey, tfConfig.aggr, maxPoints]);

  // Use real data if available; fallback to preview sample data only if no data points yet in preview mode
  const hasRealData = historyData && historyData.length > 0;
  const chartData = hasRealData ? historyData : (isPreview ? (previewData || []) : []);

  // Downsample or cap chartData if it exceeds maxPoints, ensuring even distribution across full timeframe
  const displayChartData = useMemo(() => {
    if (!chartData || chartData.length <= maxPoints) return chartData;
    
    // Sample evenly across the dataset so full time window is preserved
    const step = (chartData.length - 1) / (maxPoints - 1);
    const sampled = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      sampled.push(chartData[Math.round(i * step)]);
    }
    sampled.push(chartData[chartData.length - 1]);
    return sampled;
  }, [chartData, maxPoints]);

  // Compute Statistics (Min, Mean, Max, Current) for visible series based on true data in window
  const seriesStats = useMemo(() => {
    const stats = {};
    seriesIds.forEach(id => {
      const values = chartData
        .map(row => row[id])
        .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
        .map(Number);
      
      if (values.length > 0) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const sum = values.reduce((acc, v) => acc + v, 0);
        const mean = sum / values.length;
        const current = values[values.length - 1];
        stats[id] = { min, max, mean, current, count: values.length };
      } else {
        stats[id] = null;
      }
    });
    return stats;
  }, [chartData, seriesIds]);

  const primaryId = seriesIds[0];
  const primaryStats = seriesStats[primaryId];

  // Logarithmic scale handling
  const useLogScale = config.yAxisLogScale === true;
  let logYMin = 1;
  if (useLogScale) {
    let positiveMin = Infinity;
    chartData.forEach(row => {
      seriesIds.forEach(id => {
        const val = Number(row[id]);
        if (!isNaN(val) && val > 0 && val < positiveMin) {
          positiveMin = val;
        }
      });
    });
    if (positiveMin !== Infinity) {
      logYMin = positiveMin < 1 ? Math.pow(10, Math.floor(Math.log10(positiveMin))) : 1;
    }
    if (yConstraintsOn && parseNum(config.yMin) !== null && parseNum(config.yMin) > 0) {
      logYMin = parseNum(config.yMin);
    }
  }

  const yDomain = useLogScale 
    ? [logYMin, yMax !== 'auto' ? yMax : 'auto']
    : [yMin, yMax];

  // Sanitized display data for Recharts (clamps non-positive values on log scale to prevent SVG crash)
  const displayData = useMemo(() => {
    if (!useLogScale) return displayChartData;
    return displayChartData.map(row => {
      const safeRow = { ...row };
      seriesIds.forEach(id => {
        const val = Number(safeRow[id]);
        if (!isNaN(val)) {
          safeRow[id] = val > 0 ? val : logYMin;
        }
      });
      return safeRow;
    });
  }, [displayChartData, useLogScale, seriesIds, logYMin]);

  // Chart Component Selection
  const ChartComponent = chartType === 'bar' ? BarChart : (chartType === 'area' ? AreaChart : LineChart);
  const DataComponent = chartType === 'bar' ? Bar : (chartType === 'area' ? Area : Line);
  const lineType = chartType === 'stepAfter' ? 'stepAfter' : 'monotone';

  // Base bounds for X-axis aligned to the selected period
  const nowWallClock = Math.floor(Date.now() / 1000);
  const latestDataTs = chartData.length > 0 ? chartData[chartData.length - 1].timestamp_unix : nowWallClock;
  // If data is historical (far in past), anchor to latest data; otherwise anchor to live clock
  const anchorNow = latestDataTs > 0 && Math.abs(nowWallClock - latestDataTs) > periodSeconds * 2
    ? latestDataTs
    : Math.max(nowWallClock, latestDataTs);
  const minTs = anchorNow - periodSeconds;

  boundsRef.current.max = anchorNow;
  boundsRef.current.min = minTs;

  // Handle Wheel Zoom (for SVG / Recharts mode; CanvasChart handles its own)
  useEffect(() => {
    if (renderEngine === 'canvas') return;
    const el = chartWrapperRef.current;
    if (!el) return;
    
    const handleWheel = (e) => {
      e.preventDefault();
      
      setZoomDomain(prevZoom => {
          let currentMin = prevZoom ? prevZoom[0] : boundsRef.current.min;
          let currentMax = prevZoom ? prevZoom[1] : boundsRef.current.max;
          
          if (currentMin >= currentMax) return prevZoom;
          
          const range = currentMax - currentMin;
          const rect = el.getBoundingClientRect();
          const offsetX = e.clientX - rect.left;
          const plotLeft = 60; // Approx YAxis width
          const plotRight = rect.width - 20;
          const plotWidth = plotRight - plotLeft;
          
          let ratio = 0.5;
          if (offsetX >= plotLeft && offsetX <= plotRight) {
              ratio = (offsetX - plotLeft) / plotWidth;
          }
          
          const mouseTime = currentMin + ratio * range;
          const zoomFactor = e.deltaY < 0 ? 0.75 : 1.25; // 25% zoom
          let newRange = range * zoomFactor;
          
          if (newRange < 10) newRange = 10; // Max zoom limit (10 seconds)
          if (newRange > 86400 * 30) newRange = 86400 * 30; // Min zoom limit (30 days)
          
          return [mouseTime - newRange * ratio, mouseTime + newRange * (1 - ratio)];
      });
    };
    
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [renderEngine]);
  
  const xDomain = zoomDomain || [minTs, anchorNow];

  // Calculate nice stable ticks based on timeframe
  const tickInterval = tfConfig.tickInterval || Math.max(60, Math.floor(periodSeconds / 5));
  const firstTick = Math.ceil(minTs / tickInterval) * tickInterval;
  const ticks = [];
  for (let t = firstTick; t <= anchorNow; t += tickInterval) {
    ticks.push(t);
  }

  const tickFormatter = (unixTime) => {
    const d = new Date(unixTime * 1000);
    if (zoomDomain) {
      const span = zoomDomain[1] - zoomDomain[0];
      if (span <= 300) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      if (span >= 86400 * 2) {
        return `${d.toLocaleDateString([], { month: 'numeric', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (tfConfig.tf >= 10080) { // 7d
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    if (tfConfig.tf >= 1440) { // 24h
      return `${d.toLocaleDateString([], { month: 'numeric', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (tfConfig.tf <= 5) { // 5m
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const xAxisProps = {
    dataKey: "timestamp_unix",
    type: "number",
    domain: xDomain,
    ticks: zoomDomain ? undefined : ticks,
    tickFormatter: tickFormatter,
    minTickGap: 30,
    allowDataOverflow: true,
  };

  const seriesColor = (index) => (index === 0 ? baseColor : COLORS[index % COLORS.length]);

  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
      {/* Header */}
      {config.showTitle !== false && (
        <div className="bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-fg truncate">{title || config?.title || 'Live Chart'}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {zoomDomain && (
              <button 
                onClick={() => setZoomDomain(null)}
                className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 px-2 py-1 rounded transition-colors"
              >
                Reset Zoom
              </button>
            )}
            {useLogScale && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20">
                Log Y
              </span>
            )}
            {renderEngine === 'canvas' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20" title="HTML5 Canvas Engine (Ultra-Fast 60FPS)">
                Canvas
              </span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
              isLocked 
                ? 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20' 
                : 'text-fg-muted bg-surface-2 border border-line-strong'
            }`}>
              {effectiveTimeframe} {isLocked && '(Locked)'}
            </span>
          </div>
        </div>
      )}

      {/* Mean / Min / Max / Current Statistics Bar */}
      {config.showStatistics !== false && chartData.length > 0 && primaryStats && (
        <div className="bg-surface-2/60 px-3 py-1.5 border-b border-line flex items-center justify-between gap-2 text-[11px] overflow-x-auto shrink-0 font-mono">
          <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap">
            <div className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
              <span className="text-[10px] uppercase font-bold text-fg-subtle">Min</span>
              <span className="font-semibold">{formatValue(primaryStats.min, unit)}</span>
            </div>
            <span className="text-line-strong">|</span>
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="text-[10px] uppercase font-bold text-fg-subtle">Avg</span>
              <span className="font-semibold">{formatValue(primaryStats.mean, unit)}</span>
            </div>
            <span className="text-line-strong">|</span>
            <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <span className="text-[10px] uppercase font-bold text-fg-subtle">Max</span>
              <span className="font-semibold">{formatValue(primaryStats.max, unit)}</span>
            </div>
            <span className="text-line-strong">|</span>
            <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
              <span className="text-[10px] uppercase font-bold text-fg-subtle">Cur</span>
              <span className="font-semibold">{formatValue(primaryStats.current, unit)}</span>
            </div>
          </div>
          {seriesIds.length > 1 && (
            <span className="text-[10px] text-fg-muted font-sans truncate shrink-0">
              ({seriesNames[primaryId] || primaryId})
            </span>
          )}
        </div>
      )}

      <div 
        className="flex-1 min-h-[150px] cursor-crosshair relative p-3"
        ref={chartWrapperRef}
        onDoubleClick={() => setZoomDomain(null)}
      >
        {chartData.length > 0 ? (
          renderEngine === 'canvas' ? (
            <CanvasChart
              data={displayData}
              seriesIds={seriesIds}
              seriesNames={seriesNames}
              chartType={chartType}
              baseColor={baseColor}
              unit={unit}
              strokeWidth={strokeWidth}
              showDots={showDots}
              fillOpacity={fillOpacity}
              useGradient={useGradient}
              showGrid={showGrid}
              gridDash={gridDash}
              xDomain={xDomain}
              yDomain={yDomain}
              useLogScale={useLogScale}
              tickFormatter={tickFormatter}
              threshold={threshold}
              thresholdLabel={thresholdLabel}
              thresholdColor={config.thresholdColor || '#ef4444'}
              thresholdMin={thresholdMin}
              thresholdMinLabel={config.thresholdMinLabel || 'Lower Limit'}
              thresholdMinColor={config.thresholdMinColor || '#3b82f6'}
              primaryStats={primaryStats}
              showMeanLine={config.showMeanLine}
              showMinMaxLines={config.showMinMaxLines}
              onZoom={(domain) => setZoomDomain(domain)}
              onResetZoom={() => setZoomDomain(null)}
            />
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={displayData}>
              {chartType === 'area' && useGradient && (
                <defs>
                  {seriesIds.map((id, index) => (
                    <linearGradient key={id} id={`${gradientPrefix}-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={seriesColor(index)} stopOpacity={Math.min(1, fillOpacity * 2)} />
                      <stop offset="95%" stopColor={seriesColor(index)} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
              )}
              {showGrid && <CartesianGrid strokeDasharray={gridDash} stroke={chartTheme.grid} vertical={false} />}
              <XAxis 
                {...xAxisProps}
                stroke={chartTheme.axis} 
                fontSize={12}
              />
              <YAxis 
                stroke={chartTheme.axis} 
                fontSize={12} 
                scale={useLogScale ? "log" : "auto"}
                domain={yDomain}
                allowDataOverflow={true}
              />
              <Tooltip 
                content={<ChartTooltip unit={unit} />}
                cursor={chartType === 'bar' ? chartTheme.tooltip.cursor : { stroke: chartTheme.axis, strokeDasharray: '3 3' }}
              />
              
              {seriesIds.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
              
              {threshold !== null && !isNaN(threshold) && (
                  <ReferenceLine y={threshold} stroke={config.thresholdColor || '#ef4444'} strokeDasharray="3 3" label={{ position: 'top', value: thresholdLabel, fill: config.thresholdColor || '#ef4444', fontSize: 10 }} />
              )}
              {thresholdMin !== null && !isNaN(thresholdMin) && (
                  <ReferenceLine y={thresholdMin} stroke={config.thresholdMinColor || '#3b82f6'} strokeDasharray="3 3" label={{ position: 'bottom', value: config.thresholdMinLabel || 'Lower Limit', fill: config.thresholdMinColor || '#3b82f6', fontSize: 10 }} />
              )}

              {/* Mean / Min / Max Reference Lines */}
              {config.showMeanLine && primaryStats && (
                <ReferenceLine 
                  y={primaryStats.mean} 
                  stroke="#10b981" 
                  strokeDasharray="4 4" 
                  strokeWidth={1.5}
                  label={{ 
                    position: 'right', 
                    value: `Avg: ${formatValue(primaryStats.mean, unit)}`, 
                    fill: '#10b981', 
                    fontSize: 10,
                    fontWeight: 600
                  }} 
                />
              )}
              {config.showMinMaxLines && primaryStats && (
                <>
                  <ReferenceLine 
                    y={primaryStats.min} 
                    stroke="#0ea5e9" 
                    strokeDasharray="3 3" 
                    strokeWidth={1}
                    label={{ 
                      position: 'insideBottomRight', 
                      value: `Min: ${formatValue(primaryStats.min, unit)}`, 
                      fill: '#0ea5e9', 
                      fontSize: 9 
                    }} 
                  />
                  <ReferenceLine 
                    y={primaryStats.max} 
                    stroke="#f43f5e" 
                    strokeDasharray="3 3" 
                    strokeWidth={1}
                    label={{ 
                      position: 'insideTopRight', 
                      value: `Max: ${formatValue(primaryStats.max, unit)}`, 
                      fill: '#f43f5e', 
                      fontSize: 9 
                    }} 
                  />
                </>
              )}
              
              {seriesIds.map((id, index) => {
                  const color = seriesColor(index);
                  const fill = chartType === 'area' && useGradient ? `url(#${gradientPrefix}-${index})` : color;
                  return (
                      <DataComponent 
                        key={id}
                        type={lineType}
                        dataKey={id}
                        name={seriesNames[id] || id}
                        stroke={color} 
                        fill={fill}
                        fillOpacity={chartType === 'area' && useGradient ? 1 : fillOpacity}
                        strokeWidth={strokeWidth} 
                        dot={showDots ? { r: 2.5, strokeWidth: 0, fill: color } : false}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                        connectNulls={true}
                      />
                  );
              })}
            </ChartComponent>
          </ResponsiveContainer>
          )
        ) : (
          <div className="text-fg-muted text-sm italic flex items-center justify-center h-full">
            Waiting for data...
          </div>
        )}
      </div>
    </div>
  );
}
