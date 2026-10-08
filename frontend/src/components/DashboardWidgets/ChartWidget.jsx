import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend 
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import { chartTheme } from '../../utils/theme';

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
  const gradientPrefix = `chartGrad${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const isPreview = config.__isPreview === true;
  const chartType = config.chartType || 'stepAfter'; // stepAfter, monotone, area, bar
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
  const maxPoints = Number(config.maxDataPoints) || 500;
  
  const timeframeMap = {
      '5m': { tf: 5, aggr: null, label: '5m' },
      '15m': { tf: 15, aggr: null, label: '15m' },
      '1h': { tf: 60, aggr: 1, label: '1h' },
      '24h': { tf: 1440, aggr: 10, label: '24h' },
      '7d': { tf: 10080, aggr: 60, label: '7d' },
  };
  const isLocked = config.lockTimeframe === true;
  const effectiveTimeframe = isLocked ? (config.timeframe || '5m') : (globalTimeframe || config.timeframe || '15m');
  const tfConfig = timeframeMap[effectiveTimeframe] || timeframeMap['15m'];

  // Extract nodeIds
  const nodeIds = paths.map(p => {
    const match = p.match(/^dashboard\.(.+?)\.(?:value|history)$/);
    return match ? match[1] : null;
  }).filter(Boolean);

  // Human-friendly series names: saved data source names, falling back to the node id
  const seriesNames = { [SAMPLE_SERIES_ID]: 'Sample Data' };
  const savedNames = config.dataPathNames || {};
  paths.forEach(p => {
    const match = p.match(/^dashboard\.(.+?)\.(?:value|history)$/);
    if (match) seriesNames[match[1]] = savedNames[p] || `Node: ${match[1].split('_')[0]}`;
  });

  const seriesIds = isPreview && nodeIds.length === 0 ? [SAMPLE_SERIES_ID] : nodeIds;
  const seriesKey = seriesIds.join('|');

  const previewData = useMemo(
    () => (isPreview ? buildSampleData(seriesKey.split('|'), tfConfig.tf, chartType) : null),
    [isPreview, seriesKey, tfConfig.tf, chartType]
  );

  // Fetch history on mount
  useEffect(() => {
    if (isPreview) return;
    if (nodeIds.length === 0) {
      setIsLoaded(true);
      return;
    }

    let urlParams = `?limit=1000&timeframe_min=${tfConfig.tf}`;
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
  }, [config.dataPaths, config.dataPath, effectiveTimeframe, isPreview]);

  // Listen to live updates
  useEffect(() => {
    if (isPreview || !isLoaded || nodeIds.length === 0 || !metadata) return;

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
        setHistoryData(prev => {
            const newHistory = [...prev, newPoint];
            // Keep a reasonable number of points for live viewing if no aggregation
            if (!tfConfig.aggr && newHistory.length > maxPoints) return newHistory.slice(-maxPoints);
            return newHistory;
        });
    }
  }, [metadata, isLoaded, isPreview]);

  const chartData = isPreview ? previewData : historyData;

  // Chart Component Selection
  const ChartComponent = chartType === 'bar' ? BarChart : (chartType === 'area' ? AreaChart : LineChart);
  const DataComponent = chartType === 'bar' ? Bar : (chartType === 'area' ? Area : Line);
  
  const lineType = chartType === 'stepAfter' ? 'stepAfter' : 'monotone';
  const lockTimeframe = config.lockTimeframe || false;
  
  // Track base bounds for zooming
  if (lockTimeframe) {
      boundsRef.current.max = Math.floor(Date.now() / 1000);
      boundsRef.current.min = boundsRef.current.max - (tfConfig.tf * 60);
  } else if (chartData.length > 0) {
      boundsRef.current.min = chartData[0].timestamp_unix;
      boundsRef.current.max = chartData[chartData.length - 1].timestamp_unix;
  }

  // Handle Wheel Zoom
  useEffect(() => {
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
  }, []);
  
  let xDomain = zoomDomain || ['dataMin', 'dataMax'];
  let xAxisProps = {
      dataKey: "timestamp_unix",
      type: "number",
      domain: xDomain,
      tickFormatter: (unixTime) => new Date(unixTime * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: zoomDomain ? '2-digit' : undefined}),
      minTickGap: 30
  };
  
  if (lockTimeframe && !zoomDomain) {
      let now = Math.floor(Date.now() / 1000);
      if (chartData.length > 0) {
          now = chartData[chartData.length - 1].timestamp_unix;
      }
      
      const minTs = now - (tfConfig.tf * 60);
      
      xDomain = [minTs, now];
      
      // Calculate nice stable ticks based on timeframe
      const ticks = [];
      let tickInterval = 60; // default 1 min for 5m timeframe
      if (tfConfig.tf === 15) tickInterval = 300; // 5 min
      else if (tfConfig.tf === 60) tickInterval = 900; // 15 min
      else if (tfConfig.tf === 1440) tickInterval = 14400; // 4 hours
      else if (tfConfig.tf >= 10080) tickInterval = 86400; // 1 day
      
      const firstTick = Math.ceil(minTs / tickInterval) * tickInterval;
      for (let t = firstTick; t <= now; t += tickInterval) {
          ticks.push(t);
      }
      
      xAxisProps = {
          dataKey: "timestamp_unix",
          type: "number",
          domain: xDomain,
          ticks: ticks,
          tickFormatter: (unixTime) => {
              const d = new Date(unixTime * 1000);
              if (tfConfig.tf >= 1440) {
                  return `${d.toLocaleDateString([], { month: 'numeric', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              }
              return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          },
          minTickGap: 30
      };
  }

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
      <div 
        className="flex-1 min-h-[150px] cursor-crosshair relative p-3"
        ref={chartWrapperRef}
        onDoubleClick={() => setZoomDomain(null)}
      >
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={chartData}>
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
                domain={[yMin, yMax]}
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
        ) : (
          <div className="text-fg-muted text-sm italic flex items-center justify-center h-full">
            Waiting for data...
          </div>
        )}
      </div>
    </div>
  );
}
