import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Import all 10 Widgets
import VideoWidget from './DashboardWidgets/VideoWidget';
import PipelineStatusWidget from './DashboardWidgets/PipelineStatusWidget';
import HeatmapWidget from './DashboardWidgets/HeatmapWidget';
import ActionButtonsWidget from './DashboardWidgets/ActionButtonsWidget';
import SnapshotsWidget from './DashboardWidgets/SnapshotsWidget';
import SystemResourceWidget from './DashboardWidgets/SystemResourceWidget';
// Generic Widgets
import GaugeWidget from './DashboardWidgets/GaugeWidget';
import TrafficLightWidget from './DashboardWidgets/TrafficLightWidget';
import TargetTrackerWidget from './DashboardWidgets/TargetTrackerWidget';
import MetricWidget from './DashboardWidgets/MetricWidget';
import TextWidget from './DashboardWidgets/TextWidget';
import TextFeedWidget from './DashboardWidgets/TextFeedWidget';
import ChartWidget from './DashboardWidgets/ChartWidget';
import HistoricalChartWidget from './DashboardWidgets/HistoricalChartWidget';
import WidgetSettingsModal from './DashboardWidgets/WidgetSettingsModal';
import WidgetAlertModal from './DashboardWidgets/WidgetAlertModal';
import SaveVersionModal from './DashboardVersions/SaveVersionModal';
import VersionHistoryPanel from './DashboardVersions/VersionHistoryPanel';
import { listDashboardVersions, saveDashboardVersion } from './DashboardVersions/dashboardVersionsApi';

import { 
  Unlock, Save, Plus, Copy, 
  Video, Gauge, CircleDot, Target, Hash, 
  Type, ListOrdered, LineChart, BarChart2, 
  Play, Image, Flame, Zap, LayoutGrid, ArrowUpToLine, Move, History, Undo2, Check,
  AlertTriangle, Clock 
} from 'lucide-react';

const ResponsiveGridLayout = WidthProvider(Responsive);

// ── Grid geometry (v2 = Grafana-style fine grid) ─────────────────────────────
// v1 (legacy): 12 cols, rowHeight 75, margin 12  → one row unit = 87px
// v2:          24 cols, rowHeight 30, margin 8   → one row unit = 38px
const GRID_VERSION = 2;
const GRID_COLS = { lg: 24, md: 20, sm: 12, xs: 8, xxs: 4 };
const GRID_ROW_HEIGHT = 30;
const GRID_MARGIN = 8;
const V1_ROW_UNIT = 75 + 12;
const V2_ROW_UNIT = GRID_ROW_HEIGHT + GRID_MARGIN;
const V1_TO_V2_COL = 2;
const V1_TO_V2_ROW = V1_ROW_UNIT / V2_ROW_UNIT;

const toV2Rows = (rows) => Math.max(1, Math.round(rows * V1_TO_V2_ROW));

/** Scale a legacy 12-col / 75px layout item into the 24-col / 30px grid. */
const migrateItemV1toV2 = (item) => ({
  ...item,
  x: (item.x || 0) * V1_TO_V2_COL,
  w: (item.w || 1) * V1_TO_V2_COL,
  y: Math.round((item.y || 0) * V1_TO_V2_ROW),
  h: toV2Rows(item.h || 1),
  minW: item.minW ? item.minW * V1_TO_V2_COL : undefined,
  minH: item.minH ? toV2Rows(item.minH) : undefined,
});

const WIDGET_CATEGORIES = [
  {
    id: 'vision',
    name: 'Media & AI Vision',
    widgets: [
      { type: 'video', label: 'Video Stream', desc: 'Realtime WHEP stream & AI detection overlay', icon: Video, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', minW: 2, minH: 2 },
      { type: 'imageGallery', label: 'Snapshots', desc: 'Capture gallery & image detections', icon: Image, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', minW: 2, minH: 2 },
      { type: 'heatmap', label: 'Heatmap', desc: 'Spatial density & movement distribution', icon: Flame, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', minW: 2, minH: 2 }
    ]
  },
  {
    id: 'metrics',
    name: 'Metrics & Gauges',
    widgets: [
      { type: 'metric', label: 'Number / Metric', desc: 'Numeric values, trend delta & alert glow', icon: Hash, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', minW: 2, minH: 2 },
      { type: 'gauge', label: 'Gauge', desc: 'Circular, horseshoe, donut & linear tube', icon: Gauge, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20', minW: 2, minH: 2 },
      { type: 'trafficLight', label: 'Traffic Light', desc: 'Status lamp indicator (Red/Yellow/Green)', icon: CircleDot, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', minW: 2, minH: 3 },
      { type: 'targetTracker', label: 'Target Tracker', desc: 'Target vs actual progress tracker', icon: Target, color: 'text-violet-500 bg-violet-500/10 border-violet-500/20', minW: 3, minH: 3 }
    ]
  },
  {
    id: 'analytics',
    name: 'Charts & Analytics',
    widgets: [
      { type: 'chart', label: 'Line Chart', desc: 'Realtime telemetry streaming trends', icon: LineChart, color: 'text-teal-500 bg-teal-500/10 border-teal-500/20', minW: 2, minH: 2 },
      { type: 'historicalChart', label: 'Historical Activity', desc: 'Time-aggregated detection statistics', icon: BarChart2, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', minW: 3, minH: 3 }
    ]
  },
  {
    id: 'data',
    name: 'Data & Telemetry',
    widgets: [
      { type: 'text', label: 'Text Value', desc: 'Single string or boolean status display', icon: Type, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20', minW: 2, minH: 2 },
      { type: 'textFeed', label: 'Log Feed', desc: 'Streaming alert log feed and events', icon: ListOrdered, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', minW: 2, minH: 2 },
      { type: 'pipelineStatus', label: 'Pipeline Status', desc: 'Hardware & node health monitor', icon: Zap, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', minW: 2, minH: 2 }
    ]
  },
  {
    id: 'controls',
    name: 'Controls & Actions',
    widgets: [
      { type: 'actionButtons', label: 'Action Buttons', desc: 'Trigger MQTT, GPIO & Webhooks', icon: Play, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20', minW: 2, minH: 2 }
    ]
  }
];

// Widget minimum sizes above are written in legacy (v1) units; convert once for the v2 grid.
const TIMEFRAME_PRESETS = [
  { id: '5m', label: '5m', desc: '5 นาทีล่าสุด (Live 1s)' },
  { id: '15m', label: '15m', desc: '15 นาทีล่าสุด' },
  { id: '1h', label: '1h', desc: '1 ชั่วโมงล่าสุด (เฉลี่ยทุก 1m)' },
  { id: '24h', label: '24h', desc: '24 ชั่วโมงล่าสุด (เฉลี่ยทุก 10m)' },
  { id: '7d', label: '7d', desc: '7 วันล่าสุด (เฉลี่ยทุก 1h)' },
];

const WIDGET_TYPES = WIDGET_CATEGORIES.flatMap(c => c.widgets).map(w => ({
  ...w,
  minW: w.minW * V1_TO_V2_COL,
  minH: toV2Rows(w.minH),
}));

// Written in v1 units, migrated to v2 at load time.
const defaultLayoutV1 = [
  { i: 'video', x: 0, y: 0, w: 6, h: 5, minW: 2, minH: 2, type: 'video' },
  { i: 'status', x: 10, y: 0, w: 2, h: 2, minW: 2, minH: 2, type: 'pipelineStatus' },
  { i: 'metric_count', x: 6, y: 0, w: 2, h: 2, minW: 2, minH: 2, type: 'metric', config: { title: 'Detections', dataPath: 'data.length', unit: 'objects' } },
  { i: 'metric_cpu', x: 8, y: 0, w: 2, h: 2, minW: 2, minH: 2, type: 'metric', config: { title: 'CPU Usage', dataPath: 'system.cpu_percent', unit: '%' } },
  { i: 'feed_alerts', x: 8, y: 2, w: 4, h: 3, minW: 2, minH: 2, type: 'textFeed', config: { title: 'Live Alerts', dataPath: 'alerts' } },
  { i: 'chart_history', x: 0, y: 5, w: 6, h: 3, minW: 2, minH: 2, type: 'chart', config: { title: 'Detections Trend', dataPath: 'history.data' } },
  { i: 'actions', x: 6, y: 2, w: 2, h: 3, minW: 2, minH: 2, type: 'actionButtons' },
  { i: 'snapshots', x: 0, y: 8, w: 6, h: 2, minW: 2, minH: 2, type: 'imageGallery' },
  { i: 'heatmap', x: 6, y: 8, w: 6, h: 2, minW: 2, minH: 2, type: 'heatmap' }
];

const getNestedValue = (obj, path) => {
  if (!path || !obj) return undefined;
  const keys = path.split('.');
  let current = obj;
  for (let key of keys) {
    if (current === undefined || current === null) return undefined;
    if (key === 'length' && Array.isArray(current)) {
      current = current.length;
    } else {
      current = current[key];
    }
  }
  return current;
};

/** Find the first free spot for a w×h item: right of `source` if it fits, otherwise directly below it. */
const findDuplicatePosition = (source, items, cols) => {
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const right = { x: source.x + source.w, y: source.y, w: source.w, h: source.h };
  if (right.x + right.w <= cols && !items.some(it => overlaps(right, it))) return { x: right.x, y: right.y };
  return { x: source.x, y: source.y + source.h };
};

// ── Pipeline Data Validation for Widgets ─────────────────────────────────────────────────
const PIPELINE_WIDGET_TYPES = [
  'metric',
  'gauge',
  'capacityBar',
  'radialDonut',
  'trafficLight',
  'targetTracker',
  'chart',
  'text',
  'textFeed',
  'video'
];

/**
 * Validates whether a widget that requires pipeline builder data is receiving it.
 * Returns { hasAlert: true, statusLabel, reason, detail, suggestion, dataPath } if missing.
 */
const checkWidgetPipelineAlert = (item, metadata, dataSources, dataSourcesLoaded, connected) => {
  const type = item.type || item.i?.split('_')[0];
  if (!PIPELINE_WIDGET_TYPES.includes(type)) {
    return { hasAlert: false };
  }

  const config = item.config || {};

  // Case: Chart widget (supports multiple paths or single path)
  if (type === 'chart') {
    const paths = config.dataPaths || (config.dataPath ? [config.dataPath] : []);
    if (paths.length === 0) {
      return {
        hasAlert: true,
        statusType: 'unbound',
        statusLabel: 'ยังไม่ได้เลือก Data Source',
        reason: 'ยังไม่ได้เลือก Data Source สำหรับแสดงผลกราฟ',
        detail: 'Widget กราฟนี้ต้องการอย่างน้อย 1 Data Source จาก Pipeline Builder เพื่อวาดเส้นข้อมูล',
        suggestion: 'คลิกปุ่ม "เปิดการตั้งค่า Widget" ด้านล่างเพื่อเลือก Data Source อย่างน้อย 1 จุด',
        dataPath: 'ไม่ได้ระบุ (None)'
      };
    }

    if (dataSourcesLoaded && paths.every(p => !dataSources.some(ds => ds.id === p))) {
      return {
        hasAlert: true,
        statusType: 'dangling',
        statusLabel: 'Data Source ไม่พบใน Pipeline',
        reason: 'Data Source ทั้งหมดที่ตั้งไว้ไม่พบใน Pipeline ปัจจุบัน',
        detail: `Data path (${paths.join(', ')}) ไม่มีอยู่ใน Pipeline Builder ที่กำลังรันอยู่ Node อาจถูกลบหรือเปลี่ยนชื่อ`,
        suggestion: 'ตรวจสอบการเชื่อมโยง Node ในหน้า Pipeline Builder หรือเลือก Data Source ใหม่ในการตั้งค่า Widget',
        dataPath: paths.join(', ')
      };
    }

    let hasAnyData = false;
    for (const p of paths) {
      const match = p.match(/^dashboard\.(.+?)\.(?:value|history)$/);
      const nodeId = match ? match[1] : null;
      const nodeData = nodeId ? metadata?.dashboard?.[nodeId] : getNestedValue(metadata, p);
      if (nodeData && (nodeData.value !== undefined || (Array.isArray(nodeData.history) && nodeData.history.length > 0))) {
        hasAnyData = true;
        break;
      }
      if (getNestedValue(metadata, p) !== undefined) {
        hasAnyData = true;
        break;
      }
    }

    if (!hasAnyData) {
      return {
        hasAlert: true,
        statusType: !connected ? 'offline' : 'waiting_data',
        statusLabel: !connected ? 'Pipeline ออฟไลน์' : 'ยังไม่ได้รับข้อมูล',
        reason: !connected 
          ? 'การเชื่อมต่อกับ Pipeline ขาดหาย (WebSocket Disconnected)' 
          : 'ยังไม่ได้รับข้อมูลจาก Pipeline Builder',
        detail: !connected
          ? 'ระบบไม่สามารถติดต่อกับเซิร์ฟเวอร์หรือ Pipeline ได้ ทำให้ไม่มีข้อมูลส่งมายังกราฟ'
          : `ผูกข้อมูลกับ [${paths.map(p => dataSources.find(d => d.id === p)?.name || p).join(', ')}] แล้ว แต่ยังไม่มีข้อมูลถูกส่งมาจาก Pipeline Builder`,
        suggestion: !connected
          ? 'ตรวจสอบว่าเซิร์ฟเวอร์และ Pipeline Builder กำลังทำงาน'
          : 'ตรวจสอบว่า Pipeline มีการ Trigger หรือ Node มีข้อมูลไหลผ่านจริง',
        dataPath: paths.join(', ')
      };
    }

    return { hasAlert: false };
  }

  // Case: Video widget
  if (type === 'video') {
    const dataPath = config.dataPath;
    if (!dataPath) {
      return {
        hasAlert: true,
        statusType: 'unbound',
        statusLabel: 'ยังไม่ได้ผูก Video Stream',
        reason: 'ไม่ได้เลือก Video Stream จาก Pipeline Builder',
        detail: 'Widget นี้ต้องการ Video Stream จาก Pipeline Builder แต่ยังไม่ได้ระบุ Data Source',
        suggestion: 'คลิก "เปิดการตั้งค่า Widget" แล้วเลือก Video Stream จากกล้องหรือ Node ที่ต้องการ',
        dataPath: 'ไม่ได้ระบุ (None)'
      };
    }

    const matchedSource = dataSources.find(ds => ds.id === dataPath);
    if (dataSourcesLoaded && !matchedSource) {
      return {
        hasAlert: true,
        statusType: 'dangling',
        statusLabel: 'ไม่พบ Stream ใน Pipeline',
        reason: `ไม่พบ Video Stream (${dataPath}) ใน Pipeline ปัจจุบัน`,
        detail: 'Stream Node นี้อาจถูกลบหรือเปลี่ยนชื่อในหน้า Pipeline Builder ทำให้ไม่สามารถดึงภาพได้',
        suggestion: 'กลับไปตรวจสอบการเชื่อมต่อ Dashboard Video Node ใน Pipeline Builder หรือเลือก Stream ใหม่',
        dataPath
      };
    }

    if (!connected) {
      return {
        hasAlert: true,
        statusType: 'offline',
        statusLabel: 'Pipeline ออฟไลน์',
        reason: 'การเชื่อมต่อกับ Pipeline ขาดหาย (Offline)',
        detail: 'ไม่สามารถติดต่อกับเซิร์ฟเวอร์ได้ Video Stream อาจไม่พร้อมใช้งาน',
        suggestion: 'ตรวจสอบสถานะการทำงานของ Pipeline ในระบบ',
        dataPath
      };
    }

    return { hasAlert: false };
  }

  // Case: Single-value widgets (metric, gauge, capacityBar, radialDonut, trafficLight, targetTracker, text, textFeed)
  const dataPath = config.dataPath;
  if (!dataPath || dataPath.trim() === '') {
    return {
      hasAlert: true,
      statusType: 'unbound',
      statusLabel: 'ยังไม่ได้เลือก Data Source',
      reason: 'ยังไม่ได้ผูกข้อมูลกับ Node ใน Pipeline Builder',
      detail: 'Widget ประเภทนี้ต้องอาศัยข้อมูลจาก Pipeline Builder แต่ยังไม่มีการกำหนด Data Source',
      suggestion: 'คลิกปุ่ม "เปิดการตั้งค่า Widget" ด้านล่างเพื่อเลือก Data Source จาก Pipeline',
      dataPath: 'ไม่ได้ระบุ (None)'
    };
  }

  const matchedSource = dataSources.find(ds => ds.id === dataPath);
  if (dataSourcesLoaded && !matchedSource) {
    return {
      hasAlert: true,
      statusType: 'dangling',
      statusLabel: 'Data Source ไม่พบใน Pipeline',
      reason: `ไม่พบ Data Source "${dataPath}" ใน Pipeline ปัจจุบัน`,
      detail: 'Data Source นี้ไม่มีอยู่ใน Pipeline ที่กำลังรันอยู่ Node อาจถูกลบหรือเปลี่ยนชื่อ',
      suggestion: 'ตรวจสอบ Node ในหน้า Pipeline Builder หรือเลือก Data Source ใหม่ในการตั้งค่า Widget',
      dataPath
    };
  }

  const val = getNestedValue(metadata, dataPath);
  if (val === undefined || val === null) {
    const sourceName = matchedSource?.name || dataPath;
    return {
      hasAlert: true,
      statusType: !connected ? 'offline' : 'waiting_data',
      statusLabel: !connected ? 'Pipeline ออฟไลน์' : 'ยังไม่ได้รับข้อมูล',
      reason: !connected 
        ? 'การเชื่อมต่อกับ Pipeline ขาดหาย (WebSocket Disconnected)' 
        : `ยังไม่ได้รับข้อมูลจาก Pipeline Builder (${sourceName})`,
      detail: !connected
        ? 'เซิร์ฟเวอร์หรือ Pipeline ไม่ได้เชื่อมต่อ ทำให้ไม่มีข้อมูลส่งมาอัปเดต'
        : `เชื่อมต่อกับ Node "${sourceName}" แล้ว แต่ขณะนี้ยังไม่มีข้อมูลส่งมา (ค่าเป็น undefined/null)`,
      suggestion: !connected
        ? 'ตรวจสอบว่า Pipeline กำลังรันอยู่และเซิร์ฟเวอร์เปิดใช้งานปกติ'
        : 'รอให้กระบวนการใน Pipeline ทำงาน หรือตรวจสอบว่ามี Input ส่งผ่าน Node นี้หรือไม่',
      dataPath
    };
  }

  return { hasAlert: false };
};

// ── Version snapshot helpers ─────────────────────────────────────────────────────────────
/** Only the fields that matter for persistence (RGL adds transient keys like `moved`). */
const normalizeItem = ({ i, x, y, w, h, minW, minH, type, config }) => ({ i, x, y, w, h, minW, minH, type, config: config || {} });

const snapshotOf = (lg, compact) => ({
  compact,
  lg: [...(lg || [])].map(normalizeItem).sort((a, b) => a.i.localeCompare(b.i)),
});

/** Payload stored by the backend (and restored from it). Only `lg` is persisted; other breakpoints are derived. */
const toSavedLayout = (lg, compact) => ({
  lg: (lg || []).map(normalizeItem),
  _grid: { version: GRID_VERSION, compact },
});

const diffSnapshots = (saved, current) => {
  const savedById = new Map((saved?.lg || []).map(it => [it.i, it]));
  const currentById = new Map(current.lg.map(it => [it.i, it]));
  let added = 0, removed = 0, moved = 0, configured = 0;
  currentById.forEach((it, id) => {
    const old = savedById.get(id);
    if (!old) { added++; return; }
    if (old.x !== it.x || old.y !== it.y || old.w !== it.w || old.h !== it.h) moved++;
    if (JSON.stringify(old.config) !== JSON.stringify(it.config)) configured++;
  });
  savedById.forEach((_, id) => { if (!currentById.has(id)) removed++; });
  return { added, removed, moved, configured, modeChanged: !!saved && saved.compact !== current.compact };
};

export default function LiveDashboard({ metadata, connected, projectId }) {
  const [layouts, setLayouts] = useState({ lg: [] }); // start empty instead of defaultLayout to prevent flashing
  const [compactMode, setCompactMode] = useState('free'); // 'vertical' = Auto-arrange, 'free' = Free placement (default)
  const [isEditMode, setIsEditMode] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null); // { item, alertInfo } for Alert details modal
  const [isLoading, setIsLoading] = useState(true);
  const [dataSources, setDataSources] = useState([]);
  const [dataSourcesLoaded, setDataSourcesLoaded] = useState(false);

  // Version history state
  const [savedSnapshot, setSavedSnapshot] = useState(null); // snapshotOf() of the last saved/loaded layout
  const [currentVersion, setCurrentVersion] = useState(null); // version_number of the latest saved version
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Global Timeframe state (Home Assistant Style)
  const [globalTimeframe, setGlobalTimeframe] = useState(() => {
    try {
      return localStorage.getItem('pido_global_timeframe') || '15m';
    } catch {
      return '15m';
    }
  });

  const handleGlobalTimeframeChange = (tf) => {
    setGlobalTimeframe(tf);
    try {
      localStorage.setItem('pido_global_timeframe', tf);
    } catch {}
  };
  // RGL normalises (compacts) the layout on first render; adopt that result as the clean baseline.
  const adoptBaselineRef = useRef(false);
  const adoptTimerRef = useRef(null);

  const currentSnapshot = useMemo(() => snapshotOf(layouts.lg, compactMode), [layouts.lg, compactMode]);
  const isDirty = savedSnapshot !== null && JSON.stringify(savedSnapshot) !== JSON.stringify(currentSnapshot);
  const changes = useMemo(() => diffSnapshots(savedSnapshot, currentSnapshot), [savedSnapshot, currentSnapshot]);

  const applySavedLayout = React.useCallback((saved) => {
    const gridMeta = saved?._grid || {};
    // Backward compatibility check
    let lg = Array.isArray(saved?.lg) ? saved.lg : (Array.isArray(saved) ? saved : []);
    const hasTypes = lg.length === 0 || lg.some(i => i.type);
    if (!hasTypes) {
      lg = defaultLayoutV1.map(migrateItemV1toV2); // Overwrite with new generic layout if old format
    } else if ((gridMeta.version || 1) < GRID_VERSION) {
      lg = lg.map(migrateItemV1toV2);
    }
    // Free placement is the default; only an explicitly saved Auto-arrange keeps vertical compaction
    const compact = gridMeta.compact === 'vertical' ? 'vertical' : 'free';
    setLayouts({ lg });
    setCompactMode(compact);
    setSavedSnapshot(snapshotOf(lg, compact));
    adoptBaselineRef.current = true;
    clearTimeout(adoptTimerRef.current);
    adoptTimerRef.current = setTimeout(() => { adoptBaselineRef.current = false; }, 500);
  }, []);

  useEffect(() => () => clearTimeout(adoptTimerRef.current), []);

  useEffect(() => {
    if (!projectId) return;
    fetch('/api/projects')
      .then(res => res.json())
      .then(projects => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
          setDataSources(project.exposed_data_sources || []);
          setDataSourcesLoaded(true);
          applySavedLayout(project.dashboard_layout || {});
        }
      })
      .catch(err => console.error("Failed to load dashboard layout", err))
      .finally(() => setIsLoading(false));

    listDashboardVersions(projectId, 1)
      .then(v => setCurrentVersion(v.length > 0 ? v[0].version_number : null))
      .catch(err => console.error("Failed to load dashboard versions", err));
  }, [projectId, applySavedLayout]);

  // Adopt RGL's first normalised layout as the clean baseline (avoids a false "unsaved" state on load)
  useEffect(() => {
    if (adoptBaselineRef.current) setSavedSnapshot(currentSnapshot);
  }, [currentSnapshot]);

  // Warn before closing / reloading the tab with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const onLayoutChange = React.useCallback((layout, newLayouts) => {
    setLayouts(prev => {
      const mergedLayouts = { ...newLayouts };
      for (const bp in mergedLayouts) {
        mergedLayouts[bp] = mergedLayouts[bp].map(newItem => {
          const prevItems = prev[bp] || prev.lg || [];
          const oldItem = prevItems.find(i => i.i === newItem.i) || {};
          return {
            ...newItem,
            type: oldItem.type || newItem.i.split('_')[0],
            config: oldItem.config || {}
          };
        });
      }
      return mergedLayouts;
    });
  }, []);

  // Removed onDrop and droppingItem

  const handleAddWidgetClick = React.useCallback((type) => {
    const widgetDef = WIDGET_TYPES.find(w => w.type === type);
    if (!widgetDef) return;

    const newId = `${type}_${Date.now()}`;
    
    // Find bottom-most position
    const currentLg = layouts.lg || [];
    let maxY = 0;
    currentLg.forEach(item => {
      if (item.y + item.h > maxY) {
        maxY = item.y + item.h;
      }
    });

    const newWidget = {
      i: newId,
      x: 0,
      y: maxY,
      w: widgetDef.minW,
      h: widgetDef.minH,
      minW: widgetDef.minW,
      minH: widgetDef.minH,
      type: type,
      config: { title: `New ${widgetDef.label.split(' ')[1]}` }
    };

    setLayouts(prev => {
      const updated = { ...prev };
      for (const bp in updated) {
        updated[bp] = [...(updated[bp] || []), newWidget];
      }
      if (!updated.lg) updated.lg = [newWidget];
      return updated;
    });
  }, [layouts]);

  const handleDuplicateWidget = React.useCallback((sourceId) => {
    setLayouts(prev => {
      const lg = prev.lg || [];
      const source = lg.find(it => it.i === sourceId);
      if (!source) return prev;

      const type = source.type || source.i.split('_')[0];
      const config = structuredClone(source.config || {});
      if (config.title) config.title = `${config.title} (Copy)`;

      const pos = findDuplicatePosition(source, lg, GRID_COLS.lg);
      const copy = {
        ...source,
        i: `${type}_${Date.now()}`,
        x: pos.x,
        y: pos.y,
        type,
        config,
      };

      const updated = {};
      for (const bp in prev) {
        updated[bp] = [...(prev[bp] || []), copy];
      }
      if (!updated.lg) updated.lg = [copy];
      return updated;
    });
  }, []);

  const handleConfirmSave = async (note) => {
    setSaving(true);
    setSaveError(null);
    try {
      const version = await saveDashboardVersion(projectId, note, toSavedLayout(layouts.lg, compactMode));
      setSavedSnapshot(currentSnapshot);
      setCurrentVersion(version.version_number);
      setHistoryRefreshKey(k => k + 1);
      setSaveModalOpen(false);
      setIsEditMode(false);
    } catch (err) {
      console.error("Failed to save dashboard version", err);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (isDirty && !window.confirm('ยกเลิกการแก้ไขทั้งหมดที่ยังไม่ได้บันทึก?')) return;
    if (savedSnapshot) {
      setLayouts({ lg: savedSnapshot.lg.map(it => ({ ...it, config: structuredClone(it.config) })) });
      setCompactMode(savedSnapshot.compact);
    }
    setIsEditMode(false);
  };

  const handleRestored = (version) => {
    applySavedLayout(version.layout);
    setCurrentVersion(version.version_number);
    setIsEditMode(false);
  };

  const openSaveModal = () => {
    setSaveError(null);
    setSaveModalOpen(true);
  };

  const openSettings = (item) => {
    setEditingWidget(item);
    setSettingsModalOpen(true);
  };

  const handleSaveWidgetSettings = (id, newConfig) => {
    setLayouts(prev => {
      const updatedLg = prev.lg.map(item => {
        if (item.i === id) {
          return { ...item, config: newConfig };
        }
        return item;
      });
      return { ...prev, lg: updatedLg };
    });
    setSettingsModalOpen(false);
    setEditingWidget(null);
  };

  return (
    <div className="animate-in fade-in duration-500 flex flex-col h-full relative">
      
      {/* Dedicated Top Control Bar (Home Assistant Style Timeframe + Action Toolbar) */}
      <div className="shrink-0 mb-3 flex flex-wrap items-center justify-between gap-2.5 z-20">
        {/* Left: Global Timeframe Selector (Home Assistant Style) */}
        <div className="flex items-center bg-surface-2/90 backdrop-blur-md border border-line-strong rounded-xl p-1 shadow-sm text-xs" role="group" aria-label="Global Timeframe">
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-fg-subtle">
            <Clock size={13} className="text-teal-500 shrink-0" />
            <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Timeframe</span>
          </div>
          <div className="flex items-center gap-0.5">
            {TIMEFRAME_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => handleGlobalTimeframeChange(preset.id)}
                className={`px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-all text-[11px] sm:text-xs cursor-pointer ${
                  globalTimeframe === preset.id
                    ? 'bg-teal-600 text-white shadow-sm font-semibold'
                    : 'text-fg-secondary hover:text-fg hover:bg-surface-3'
                }`}
                title={preset.desc}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Existing Actions Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
        {isEditMode && (
          <div className="flex items-center bg-surface-2/90 backdrop-blur-sm border border-line-strong rounded-xl p-1 shadow-sm text-xs sm:text-sm" role="group" aria-label="Layout mode">
            <button
              onClick={() => setCompactMode('vertical')}
              className={`px-2.5 py-1 sm:py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${compactMode === 'vertical' ? 'bg-blue-600 text-white shadow' : 'text-fg-secondary hover:bg-surface-3'}`}
              title="Auto-arrange: widget จะไหลขึ้นไปชิดด้านบนอัตโนมัติ"
            >
              <ArrowUpToLine size={14} /> <span className="hidden sm:inline">Auto-arrange</span>
            </button>
            <button
              onClick={() => setCompactMode('free')}
              className={`px-2.5 py-1 sm:py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${compactMode === 'free' ? 'bg-blue-600 text-white shadow' : 'text-fg-secondary hover:bg-surface-3'}`}
              title="Free placement: วางตรงไหนก็อยู่ตรงนั้น เว้นช่องว่างได้"
            >
              <Move size={14} /> <span className="hidden sm:inline">Free placement</span>
            </button>
          </div>
        )}
        {isDirty && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl backdrop-blur-sm" title="มีการแก้ไขที่ยังไม่ได้บันทึกเป็นเวอร์ชัน">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> ยังไม่ได้บันทึก
          </div>
        )}
        <button
          onClick={() => setHistoryOpen(o => !o)}
          className={`backdrop-blur-sm px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors border shadow-sm active:scale-95 ${historyOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-surface-2/90 hover:bg-surface-3 text-fg-secondary border-line-strong'}`}
          title="Version History"
        >
          <History size={15} />
          <span className="hidden sm:inline">{currentVersion ? `v${currentVersion}` : 'History'}</span>
        </button>
        {isEditMode ? (
          <>
            <button
              onClick={handleDiscard}
              className="bg-surface-2/90 hover:bg-surface-3 backdrop-blur-sm text-fg-secondary px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors border border-line-strong shadow-sm active:scale-95"
              title={isDirty ? 'ยกเลิกการแก้ไขที่ยังไม่ได้บันทึก' : 'ออกจากโหมดแก้ไข'}
            >
              <Undo2 size={15} /> <span className="hidden sm:inline">{isDirty ? 'Discard' : 'Cancel'}</span>
            </button>
            {isDirty || currentVersion === null ? (
              <button 
                onClick={openSaveModal}
                className="bg-green-600 hover:bg-green-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm active:scale-95"
              >
                <Save size={15} /> <span>Save Version</span>
              </button>
            ) : (
              <button 
                onClick={() => setIsEditMode(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm active:scale-95"
                title="ไม่มีการเปลี่ยนแปลง"
              >
                <Check size={15} /> <span>Done</span>
              </button>
            )}
          </>
        ) : (
          <button 
            onClick={() => setIsEditMode(true)}
            className="bg-surface-2/90 hover:bg-surface-3 backdrop-blur-sm text-fg-secondary px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-colors border border-line-strong shadow-sm active:scale-95"
          >
            <Unlock size={15} /> <span>Edit Layout</span>
          </button>
        )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-canvas rounded-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {/* Grid Layout Canvas */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden p-1 sm:p-2 bg-canvas rounded-xl border ${isEditMode ? 'border-blue-500/50 border-dashed' : 'border-transparent'}`}>
          <ResponsiveGridLayout
            className="layout"
            style={{
              minHeight: '100%',
              ...(isEditMode ? {
                // Faint guide lines in the gutters between grid cells (column step = (width - margin) / cols)
                backgroundImage: 'linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)',
                backgroundSize: `calc((100% - ${GRID_MARGIN}px) / ${GRID_COLS.lg}) ${V2_ROW_UNIT}px`,
                backgroundPosition: `${GRID_MARGIN / 2}px ${GRID_MARGIN / 2}px`,
              } : {}),
            }}
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={GRID_COLS}
            rowHeight={GRID_ROW_HEIGHT}
            onLayoutChange={onLayoutChange}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            margin={[GRID_MARGIN, GRID_MARGIN]}
            compactType={compactMode === 'free' ? null : 'vertical'}
            preventCollision={false}
            draggableCancel=".widget-toolbar"
          >
          {layouts.lg.map(item => {
            const config = item.config || {};
            const type = item.type || item.i; // fallback for older configs
            const alertInfo = checkWidgetPipelineAlert(item, metadata, dataSources, dataSourcesLoaded, connected);
            
            return (
              <div key={item.i} className="relative group h-full w-full">
                {/* Overlay to prevent widgets (like videos/iframes) from swallowing drag events */}
                {isEditMode && (
                  <div className="absolute inset-0 z-10 cursor-move" />
                )}

                {/* Blinking yellow alert border for widgets missing pipeline builder data */}
                {alertInfo.hasAlert && (
                  <div 
                    className="absolute inset-0 rounded-xl pointer-events-none ring-2 ring-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.45)] animate-pulse z-10" 
                    aria-hidden="true"
                  />
                )}

                {/* Exclamation Warning Icon Button - clicking displays reason for alert */}
                {alertInfo.hasAlert && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAlert({ item, alertInfo });
                    }}
                    className={`absolute top-2 right-2 z-20 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-500/70 text-amber-600 dark:text-amber-400 shadow-lg backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-95 group/btn ${
                      isEditMode ? 'group-hover:right-28' : ''
                    }`}
                    title={`แจ้งเตือน: ${alertInfo.reason} (คลิกเพื่อดูรายละเอียด)`}
                    aria-label={`แจ้งเตือน: ${alertInfo.reason}`}
                  >
                    <AlertTriangle size={14} className="animate-bounce shrink-0 text-amber-500" />
                    <span className="text-[11px] font-semibold hidden sm:inline">No Data</span>
                  </button>
                )}
                
                {isEditMode && (
                  <div className="widget-toolbar absolute top-2 right-2 z-20 hidden group-hover:flex items-center gap-1">
                    <button 
                      onClick={() => handleDuplicateWidget(item.i)}
                      className="bg-surface-2 p-1.5 rounded hover:bg-blue-600 hover:text-white hover:border-blue-600 border border-line-stronger text-fg-secondary shadow-md transition-colors"
                      title="Duplicate Widget (คัดลอกพร้อมการตั้งค่าทั้งหมด)"
                    >
                      <Copy size={16} />
                    </button>
                    <button 
                      onClick={() => openSettings(item)}
                      className="bg-surface-2 p-1.5 rounded hover:bg-surface-3 border border-line-stronger text-fg-secondary shadow-md"
                      title="Widget Settings"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button 
                      onClick={() => {
                        setLayouts(prev => {
                          const updated = {};
                          for (const bp in prev) {
                            updated[bp] = prev[bp].filter(i => i.i !== item.i);
                          }
                          return updated;
                        });
                      }}
                      className="bg-red-900/80 p-1.5 rounded hover:bg-red-800 border border-red-700 text-red-100 shadow-md"
                      title="Remove Widget"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                )}
                {type === 'video' && (
                  <VideoWidget 
                    metadata={config?.stream_id ? (metadata && metadata[config.stream_id]) : metadata} 
                    projectId={projectId} 
                    config={config} 
                    dataSources={dataSources}
                    dataSourcesLoaded={dataSourcesLoaded}
                  />
                )}
                {type === 'pipelineStatus' && <PipelineStatusWidget connected={connected} metadata={metadata} config={config} />}
                {type === 'actionButtons' && <ActionButtonsWidget config={config} />}
                {type === 'heatmap' && <HeatmapWidget config={config} />}
                {type === 'imageGallery' && <SnapshotsWidget config={config} />}
                {type === 'systemResource' && <SystemResourceWidget config={config} />}
                
                {/* Generic Widgets */}
                {type === 'metric' && (
                  <MetricWidget 
                    title={config.title} 
                    value={getNestedValue(metadata, config.dataPath)} 
                    unit={config.unit} 
                    config={config}
                  />
                )}
                {type === 'text' && (
                  <TextWidget 
                    title={config.title} 
                    value={getNestedValue(metadata, config.dataPath)} 
                    unit={config.unit} 
                    config={config}
                  />
                )}
                {type === 'gauge' && (
                  <GaugeWidget 
                    title={config.title} 
                    value={getNestedValue(metadata, config.dataPath)} 
                    unit={config.unit} 
                    config={config} 
                  />
                )}
                {type === 'trafficLight' && (
                  <TrafficLightWidget 
                    title={config.title} 
                    value={getNestedValue(metadata, config.dataPath)} 
                    config={config} 
                  />
                )}
                {type === 'radialDonut' && (
                  <GaugeWidget 
                    title={config.title} 
                    value={getNestedValue(metadata, config.dataPath)} 
                    unit={config.unit} 
                    config={{ ...config, gaugeStyle: 'radial-donut' }} 
                  />
                )}
                {type === 'capacityBar' && (
                  <GaugeWidget 
                    title={config.title} 
                    value={getNestedValue(metadata, config.dataPath)} 
                    unit={config.unit} 
                    config={{ ...config, gaugeStyle: 'capacity-bar' }} 
                  />
                )}
                {type === 'targetTracker' && (
                  <TargetTrackerWidget 
                    title={config.title} 
                    data={getNestedValue(metadata, config.dataPath)} 
                    config={config} 
                    projectId={projectId} 
                  />
                )}
                {type === 'textFeed' && (
                  <TextFeedWidget 
                    title={config.title} 
                    feedData={getNestedValue(metadata, config.dataPath) || []} 
                    config={config}
                  />
                )}
                {type === 'chart' && (
                  (() => {
                    const paths = config.dataPaths || (config.dataPath ? [config.dataPath] : []);
                    const nodeIds = [];
                    const nodeDataList = [];
                    
                    paths.forEach(path => {
                        const match = path.match(/^dashboard\.(.+?)\.(?:value|history)$/);
                        if (match) nodeIds.push({ id: match[1], path });
                        const nodeDataPath = path.replace(/\.(?:value|history)$/, '');
                        
                        // We need a stable way to extract getNestedValue. Let's just pass the parts.
                        // Actually, doing it here is fine.
                    });
                    
                    // We can just pass the whole metadata and paths, but for performance, 
                    // passing only what's needed is better. However, ChartWidget can just extract what it needs.
                    
                    return (
                      <ChartWidget 
                        title={config.title} 
                        config={config}
                        paths={paths}
                        metadata={metadata}
                        globalTimeframe={globalTimeframe}
                      />
                    );
                  })()
                )}
                {type === 'historicalChart' && (
                  <HistoricalChartWidget 
                    projectId={projectId} 
                    config={config} 
                    globalTimeframe={globalTimeframe}
                  />
                )}
              </div>
            );
          })}
          </ResponsiveGridLayout>
        </div>

        {/* Edit Mode Slide-over Panel */}
        <div 
          className={`absolute top-0 right-0 h-full w-80 bg-surface/95 backdrop-blur-md border-l border-line p-4 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar transition-transform duration-300 z-30 shadow-2xl ${isEditMode ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="shrink-0">
            <div className="flex items-center gap-2 text-fg font-bold text-sm tracking-wide">
              <LayoutGrid size={17} className="text-blue-500" />
              <span>Available Widgets</span>
            </div>
            <p className="text-xs text-fg-subtle mt-1 leading-relaxed">
              คลิกปุ่ม <span className="font-semibold text-fg">+</span> เพื่อเพิ่ม Widget ลงบน Dashboard
            </p>
          </div>

          <div className="space-y-4 pb-8">
            {WIDGET_CATEGORIES.map(category => (
              <div key={category.id} className="space-y-2">
                <div className="text-[11px] font-bold text-fg-muted uppercase tracking-wider px-1 flex items-center justify-between border-b border-line pb-1">
                  <span>{category.name}</span>
                  <span className="text-[10px] text-fg-subtle font-normal">({category.widgets.length})</span>
                </div>
                <div className="space-y-1.5">
                  {category.widgets.map(widget => {
                    const WidgetIcon = widget.icon;
                    return (
                      <div 
                        key={widget.type}
                        className="bg-surface-2 border border-line-strong/60 p-2.5 rounded-xl cursor-pointer hover:bg-surface-3 hover:border-line-strong transition-all shadow-sm flex items-center justify-between group gap-2.5"
                        onClick={() => handleAddWidgetClick(widget.type)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-2 rounded-lg border shrink-0 ${widget.color}`}>
                            <WidgetIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-fg text-xs font-semibold truncate group-hover:text-blue-500 transition-colors">
                              {widget.label}
                            </div>
                            <div className="text-[11px] text-fg-subtle truncate">
                              {widget.desc}
                            </div>
                          </div>
                        </div>
                        <button 
                          className="p-1.5 rounded-lg bg-surface border border-line text-blue-500 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all shadow-sm shrink-0"
                          title="Add to Dashboard"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <WidgetSettingsModal 
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSave={handleSaveWidgetSettings}
        widgetItem={editingWidget}
        projectId={projectId}
        metadata={metadata}
      />

      <VersionHistoryPanel
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        projectId={projectId}
        currentVersion={currentVersion}
        isDirty={isDirty}
        onRestored={handleRestored}
        refreshKey={historyRefreshKey}
      />

      <SaveVersionModal
        isOpen={saveModalOpen}
        onClose={() => !saving && setSaveModalOpen(false)}
        onConfirm={handleConfirmSave}
        changes={changes}
        nextVersion={(currentVersion || 0) + 1}
        saving={saving}
        error={saveError}
      />

      <WidgetAlertModal
        isOpen={Boolean(selectedAlert)}
        onClose={() => setSelectedAlert(null)}
        item={selectedAlert?.item}
        alertInfo={selectedAlert?.alertInfo}
        onOpenSettings={(targetItem) => {
          setSelectedAlert(null);
          openSettings(targetItem);
        }}
      />
    </div>
  );
}
