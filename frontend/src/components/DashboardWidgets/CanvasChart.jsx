import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { readThemeColor } from '../../utils/theme';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

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

export default function CanvasChart({
  data = [],
  seriesIds = [],
  seriesNames = {},
  chartType = 'stepAfter', // 'monotone', 'stepAfter', 'area', 'bar'
  baseColor = '#10b981',
  unit = '',
  strokeWidth = 2,
  showDots = false,
  fillOpacity = 0.2,
  useGradient = true,
  showGrid = true,
  gridDash = '3 3',
  xDomain = null,
  yDomain = ['auto', 'auto'],
  useLogScale = false,
  tickFormatter = null,
  threshold = null,
  thresholdLabel = 'Threshold',
  thresholdColor = '#ef4444',
  thresholdMin = null,
  thresholdMinLabel = 'Lower Limit',
  thresholdMinColor = '#3b82f6',
  primaryStats = null,
  showMeanLine = false,
  showMinMaxLines = false,
  onZoom = null,
  onResetZoom = null,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoverInfo, setHoverInfo] = useState(null); // { x, y, pointIndex, clientX, clientY }

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Calculate series colors
  const seriesColor = useCallback(
    (index) => (index === 0 ? baseColor : COLORS[index % COLORS.length]),
    [baseColor]
  );

  // Compute actual X and Y bounds
  const bounds = useMemo(() => {
    if (!data || data.length === 0) {
      return { xMin: 0, xMax: 1, yMin: 0, yMax: 100, yTicks: [] };
    }

    let xMin = xDomain ? xDomain[0] : data[0].timestamp_unix;
    let xMax = xDomain ? xDomain[1] : data[data.length - 1].timestamp_unix;
    if (xMin >= xMax) xMax = xMin + 300;

    // Y bounds
    let rawYMin = Infinity;
    let rawYMax = -Infinity;

    data.forEach((row) => {
      seriesIds.forEach((id) => {
        const v = Number(row[id]);
        if (!isNaN(v) && v !== null) {
          if (v < rawYMin) rawYMin = v;
          if (v > rawYMax) rawYMax = v;
        }
      });
    });

    if (rawYMin === Infinity) rawYMin = 0;
    if (rawYMax === -Infinity) rawYMax = 100;
    if (rawYMin === rawYMax) {
      rawYMin -= 10;
      rawYMax += 10;
    }

    let effYMin = yDomain[0] !== 'auto' && yDomain[0] !== null ? Number(yDomain[0]) : rawYMin;
    let effYMax = yDomain[1] !== 'auto' && yDomain[1] !== null ? Number(yDomain[1]) : rawYMax;

    if (useLogScale) {
      effYMin = Math.max(0.1, effYMin);
      effYMax = Math.max(effYMin * 10, effYMax);
    } else {
      // Add slight 5% padding if auto
      if (yDomain[0] === 'auto') effYMin = Math.floor(effYMin - Math.abs(effYMin) * 0.05);
      if (yDomain[1] === 'auto') effYMax = Math.ceil(effYMax + Math.abs(effYMax) * 0.05);
      if (effYMin >= effYMax) effYMax = effYMin + 10;
    }

    // Generate nice Y-Ticks
    const yTicks = [];
    if (useLogScale) {
      let cur = Math.pow(10, Math.floor(Math.log10(effYMin)));
      while (cur <= effYMax * 1.05) {
        if (cur >= effYMin * 0.95) yTicks.push(cur);
        cur *= 10;
      }
    } else {
      const step = (effYMax - effYMin) / 4;
      for (let i = 0; i <= 4; i++) {
        yTicks.push(effYMin + step * i);
      }
    }

    return { xMin, xMax, yMin: effYMin, yMax: effYMax, yTicks };
  }, [data, seriesIds, xDomain, yDomain, useLogScale]);

  // Main Canvas Render Function
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    const width = dimensions.width;
    const height = dimensions.height;

    // Theme colors read live
    const gridColor = readThemeColor('line') || 'rgba(255,255,255,0.08)';
    const axisTextColor = readThemeColor('fg-subtle') || '#888888';
    const surfaceColor = readThemeColor('surface') || '#18181b';

    ctx.clearRect(0, 0, width, height);

    // Layout Margins
    const padLeft = 48;
    const padRight = 16;
    const padTop = 16;
    const padBottom = 26;
    const plotW = Math.max(10, width - padLeft - padRight);
    const plotH = Math.max(10, height - padTop - padBottom);

    const { xMin, xMax, yMin, yMax, yTicks } = bounds;

    // Coordinate mapping functions
    const getX = (ts) => padLeft + ((ts - xMin) / (xMax - xMin)) * plotW;
    const getY = (val) => {
      if (useLogScale) {
        const safeVal = Math.max(yMin, val);
        const ratio = (Math.log10(safeVal) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin));
        return padTop + plotH * (1 - Math.max(0, Math.min(1, ratio)));
      }
      const ratio = (val - yMin) / (yMax - yMin);
      return padTop + plotH * (1 - Math.max(0, Math.min(1, ratio)));
    };

    // Clip to plot area for data drawing
    const clipToPlot = () => {
      ctx.beginPath();
      ctx.rect(padLeft, padTop, plotW, plotH);
      ctx.clip();
    };

    // 1. Draw Grid Lines & Y-Axis Labels
    ctx.font = '10px monospace';
    ctx.fillStyle = axisTextColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const parseDash = (dashStr) => {
      if (!dashStr || dashStr === '0') return [];
      return dashStr.split(/\s+/).map(Number).filter((n) => !isNaN(n));
    };
    const dashPattern = parseDash(gridDash);

    yTicks.forEach((tickVal) => {
      const y = getY(tickVal);
      if (y >= padTop && y <= padTop + plotH) {
        if (showGrid) {
          ctx.beginPath();
          ctx.setLineDash(dashPattern);
          ctx.strokeStyle = gridColor;
          ctx.lineWidth = 1;
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotW, y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Y label
        let label = Number.isInteger(tickVal) ? String(tickVal) : tickVal.toFixed(1);
        if (tickVal >= 1000000) label = `${(tickVal / 1000000).toFixed(1)}M`;
        else if (tickVal >= 1000) label = `${(tickVal / 1000).toFixed(1)}k`;
        ctx.fillText(label, padLeft - 6, y);
      }
    });

    // 2. Draw X-Axis Labels & Vertical Grid
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const xSpan = xMax - xMin;
    const numXTicks = Math.max(2, Math.min(7, Math.floor(plotW / 80)));
    const xStep = xSpan / (numXTicks - 1);

    for (let i = 0; i < numXTicks; i++) {
      const ts = xMin + xStep * i;
      const x = getX(ts);

      if (x >= padLeft && x <= padLeft + plotW) {
        if (showGrid && i > 0 && i < numXTicks - 1) {
          ctx.beginPath();
          ctx.setLineDash(dashPattern);
          ctx.strokeStyle = gridColor;
          ctx.lineWidth = 1;
          ctx.moveTo(x, padTop);
          ctx.lineTo(x, padTop + plotH);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const label = tickFormatter ? tickFormatter(ts) : new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        ctx.fillText(label, x, padTop + plotH + 8);
      }
    }

    // 3. Draw Reference Lines (Thresholds, Mean, Min/Max)
    const drawRefLine = (val, color, dash, labelText, align = 'right') => {
      if (val === null || val === undefined || isNaN(val)) return;
      const y = getY(val);
      if (y < padTop || y > padTop + plotH) return;

      ctx.beginPath();
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      if (labelText) {
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = align;
        const textX = align === 'right' ? padLeft + plotW - 4 : padLeft + 4;
        ctx.fillText(labelText, textX, y - 4);
      }
    };

    if (threshold !== null && !isNaN(threshold)) {
      drawRefLine(threshold, thresholdColor, [4, 3], thresholdLabel, 'right');
    }
    if (thresholdMin !== null && !isNaN(thresholdMin)) {
      drawRefLine(thresholdMin, thresholdMinColor, [4, 3], thresholdMinLabel, 'right');
    }
    if (showMeanLine && primaryStats?.mean !== undefined) {
      drawRefLine(primaryStats.mean, '#10b981', [3, 3], `Mean: ${formatValue(primaryStats.mean, unit)}`, 'right');
    }
    if (showMinMaxLines && primaryStats) {
      if (primaryStats.min !== undefined) {
        drawRefLine(primaryStats.min, '#0ea5e9', [2, 2], `Min: ${formatValue(primaryStats.min, unit)}`, 'left');
      }
      if (primaryStats.max !== undefined) {
        drawRefLine(primaryStats.max, '#f43f5e', [2, 2], `Max: ${formatValue(primaryStats.max, unit)}`, 'left');
      }
    }

    // 4. Draw Data Series
    if (data.length > 0) {
      ctx.save();
      clipToPlot();

      seriesIds.forEach((id, sIdx) => {
        const color = seriesColor(sIdx);
        const points = [];

        data.forEach((row) => {
          const v = Number(row[id]);
          if (row.timestamp_unix !== undefined && !isNaN(v) && v !== null) {
            points.push({
              x: getX(row.timestamp_unix),
              y: getY(v),
              val: v,
              ts: row.timestamp_unix,
            });
          }
        });

        if (points.length === 0) return;

        // Area Chart Gradient Fill
        if (chartType === 'area') {
          ctx.beginPath();
          const baseY = padTop + plotH;
          ctx.moveTo(points[0].x, baseY);

          if (chartType === 'stepAfter') {
            points.forEach((pt, i) => {
              if (i === 0) ctx.lineTo(pt.x, pt.y);
              else {
                ctx.lineTo(pt.x, points[i - 1].y);
                ctx.lineTo(pt.x, pt.y);
              }
            });
          } else {
            points.forEach((pt, i) => {
              if (i === 0) ctx.lineTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            });
          }

          ctx.lineTo(points[points.length - 1].x, baseY);
          ctx.closePath();

          if (useGradient) {
            const grad = ctx.createLinearGradient(0, padTop, 0, baseY);
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.globalAlpha = Math.min(1, fillOpacity * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
          } else {
            ctx.fillStyle = color;
            ctx.globalAlpha = fillOpacity;
            ctx.fill();
            ctx.globalAlpha = 1.0;
          }
        }

        // Bar Chart
        if (chartType === 'bar') {
          const baseY = padTop + plotH;
          const barW = Math.max(2, Math.min(16, (plotW / points.length) * 0.7));
          ctx.fillStyle = color;
          ctx.globalAlpha = Math.max(0.6, fillOpacity);

          points.forEach((pt) => {
            const bh = baseY - pt.y;
            ctx.fillRect(pt.x - barW / 2, pt.y, barW, bh);
          });
          ctx.globalAlpha = 1.0;
        } else {
          // Line Stroke (Monotone / StepAfter / Area Line)
          ctx.beginPath();
          ctx.lineWidth = strokeWidth;
          ctx.strokeStyle = color;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (chartType === 'stepAfter') {
            points.forEach((pt, i) => {
              if (i === 0) ctx.moveTo(pt.x, pt.y);
              else {
                ctx.lineTo(pt.x, points[i - 1].y);
                ctx.lineTo(pt.x, pt.y);
              }
            });
          } else {
            // Smooth Line
            points.forEach((pt, i) => {
              if (i === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            });
          }

          ctx.stroke();

          // Dots
          if (showDots) {
            ctx.fillStyle = color;
            points.forEach((pt) => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
              ctx.fill();
            });
          }
        }
      });

      ctx.restore();
    }

    // 5. Draw Active Hover Crosshair on Canvas
    if (hoverInfo && data.length > 0) {
      const activeRow = data[hoverInfo.pointIndex];
      if (activeRow) {
        const hoverX = getX(activeRow.timestamp_unix);
        if (hoverX >= padLeft && hoverX <= padLeft + plotW) {
          // Vertical crosshair line
          ctx.beginPath();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = readThemeColor('fg-muted') || 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 1;
          ctx.moveTo(hoverX, padTop);
          ctx.lineTo(hoverX, padTop + plotH);
          ctx.stroke();
          ctx.setLineDash([]);

          // Active indicator dots on series
          seriesIds.forEach((id, sIdx) => {
            const v = Number(activeRow[id]);
            if (!isNaN(v) && v !== null) {
              const y = getY(v);
              const color = seriesColor(sIdx);

              // Outer glow ring
              ctx.beginPath();
              ctx.arc(hoverX, y, 5, 0, Math.PI * 2);
              ctx.fillStyle = surfaceColor;
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = color;
              ctx.stroke();

              // Inner solid dot
              ctx.beginPath();
              ctx.arc(hoverX, y, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.fill();
            }
          });
        }
      }
    }

    ctx.restore();
  }, [
    dimensions,
    data,
    seriesIds,
    seriesColor,
    chartType,
    strokeWidth,
    showDots,
    fillOpacity,
    useGradient,
    showGrid,
    gridDash,
    bounds,
    tickFormatter,
    threshold,
    thresholdLabel,
    thresholdColor,
    thresholdMin,
    thresholdMinLabel,
    thresholdMinColor,
    primaryStats,
    showMeanLine,
    showMinMaxLines,
    useLogScale,
    hoverInfo,
  ]);

  // Handle Mouse Hover / Crosshair Detection
  const handleMouseMove = (e) => {
    if (!data || data.length === 0 || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const padLeft = 48;
    const padRight = 16;
    const plotW = Math.max(10, dimensions.width - padLeft - padRight);
    const { xMin, xMax } = bounds;

    if (mouseX < padLeft || mouseX > padLeft + plotW) {
      setHoverInfo(null);
      return;
    }

    // Find closest timestamp point
    const mouseTs = xMin + ((mouseX - padLeft) / plotW) * (xMax - xMin);
    let closestIdx = 0;
    let minDiff = Infinity;

    for (let i = 0; i < data.length; i++) {
      const diff = Math.abs(data[i].timestamp_unix - mouseTs);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    setHoverInfo({
      pointIndex: closestIdx,
      mouseX,
      mouseY,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  // Wheel Zoom Listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onZoom) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const padLeft = 48;
      const padRight = 16;
      const plotW = Math.max(10, rect.width - padLeft - padRight);
      const mouseX = e.clientX - rect.left;

      const { xMin, xMax } = bounds;
      const range = xMax - xMin;
      let ratio = 0.5;
      if (mouseX >= padLeft && mouseX <= padLeft + plotW) {
        ratio = (mouseX - padLeft) / plotW;
      }

      const mouseTs = xMin + ratio * range;
      const zoomFactor = e.deltaY < 0 ? 0.75 : 1.25;
      let newRange = range * zoomFactor;
      if (newRange < 10) newRange = 10;
      if (newRange > 86400 * 30) newRange = 86400 * 30;

      onZoom([mouseTs - newRange * ratio, mouseTs + newRange * (1 - ratio)]);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [bounds, onZoom]);

  const activeRow = hoverInfo && data[hoverInfo.pointIndex] ? data[hoverInfo.pointIndex] : null;
  const timeInfo = activeRow ? formatHumanTime(activeRow.timestamp_unix) : null;

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative select-none cursor-crosshair overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={onResetZoom}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating Hover Tooltip */}
      {hoverInfo && activeRow && timeInfo && (
        <div
          className="absolute z-30 pointer-events-none rounded-lg border px-3 py-2 shadow-2xl text-xs min-w-[170px] bg-surface/95 backdrop-blur-md border-line-strong transition-all duration-75"
          style={{
            left: `${Math.min(dimensions.width - 180, Math.max(10, hoverInfo.mouseX + 14))}px`,
            top: `${Math.min(dimensions.height - 110, Math.max(10, hoverInfo.mouseY - 20))}px`,
          }}
        >
          <div className="flex items-baseline justify-between gap-3 pb-1 mb-1.5 border-b border-line">
            <span className="font-semibold text-fg font-mono text-[11px]">
              {timeInfo.day} {timeInfo.time}
            </span>
            <span className="text-[10px] text-fg-subtle whitespace-nowrap">{timeInfo.relative}</span>
          </div>
          <div className="space-y-1">
            {seriesIds.map((id, sIdx) => {
              const color = seriesColor(sIdx);
              const val = activeRow[id];
              return (
                <div key={id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate text-fg-secondary text-[11px]">{seriesNames[id] || id}</span>
                  </span>
                  <span className="font-mono font-bold text-fg whitespace-nowrap text-[11px]">
                    {formatValue(val, unit)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
