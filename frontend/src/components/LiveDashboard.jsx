import React, { useState, useEffect } from 'react';
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

import { 
  Lock, Unlock, Save, Plus, 
  Video, Gauge, CircleDot, Target, Hash, 
  Type, ListOrdered, LineChart, BarChart2, 
  Play, Image, Flame, Zap, LayoutGrid 
} from 'lucide-react';

const ResponsiveGridLayout = WidthProvider(Responsive);

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

const WIDGET_TYPES = WIDGET_CATEGORIES.flatMap(c => c.widgets);

const defaultLayout = [
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

export default function LiveDashboard({ metadata, connected, projectId }) {
  const [layouts, setLayouts] = useState({ lg: [] }); // start empty instead of defaultLayout to prevent flashing
  const [isEditMode, setIsEditMode] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSources, setDataSources] = useState([]);
  const [dataSourcesLoaded, setDataSourcesLoaded] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    fetch('/api/projects')
      .then(res => res.json())
      .then(projects => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
          setDataSources(project.exposed_data_sources || []);
          setDataSourcesLoaded(true);
          if (project.dashboard_layout) {
            // Backward compatibility check
            const updatedLayout = project.dashboard_layout.lg ? project.dashboard_layout.lg : project.dashboard_layout;
            const hasTypes = updatedLayout.length === 0 || updatedLayout.some(i => i.type);
            if (!hasTypes) {
               setLayouts({ lg: defaultLayout }); // Overwrite with new generic layout if old format
            } else {
               setLayouts({ lg: updatedLayout });
            }
          }
        }
      })
      .catch(err => console.error("Failed to load dashboard layout", err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

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

  const saveLayout = async () => {
    try {
      const res = await fetch('/api/projects');
      const projects = await res.json();
      
      const updatedProjects = projects.map(p => {
        if (p.id === projectId) {
          return { ...p, dashboard_layout: layouts };
        }
        return p;
      });

      const saveRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProjects)
      });

      if (saveRes.ok) {
        setIsEditMode(false);
      } else {
        alert("Failed to save layout to server.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving layout.");
    }
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
      
      {/* Floating Toolbar */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-40 flex gap-2">
        {isEditMode ? (
          <button 
            onClick={saveLayout}
            className="bg-green-600 hover:bg-green-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-colors shadow-lg active:scale-95"
          >
            <Save size={15} /> <span>Save Layout</span>
          </button>
        ) : (
          <button 
            onClick={() => setIsEditMode(true)}
            className="bg-surface-2/90 hover:bg-surface-3 backdrop-blur-sm text-fg-secondary px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-colors border border-line-strong shadow-lg active:scale-95"
          >
            <Unlock size={15} /> <span>Edit Layout</span>
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-canvas rounded-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {/* Grid Layout Canvas */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden p-1 sm:p-2 bg-canvas rounded-xl border ${isEditMode ? 'border-blue-500/50 border-dashed' : 'border-transparent'}`}>
          <ResponsiveGridLayout
            className="layout"
            style={{ minHeight: '100%' }}
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={75}
            onLayoutChange={onLayoutChange}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            margin={[12, 12]}
          >
          {layouts.lg.map(item => {
            const config = item.config || {};
            const type = item.type || item.i; // fallback for older configs
            
            return (
              <div key={item.i} className="relative group h-full w-full">
                {/* Overlay to prevent widgets (like videos/iframes) from swallowing drag events */}
                {isEditMode && (
                  <div className="absolute inset-0 z-10 cursor-move" />
                )}
                
                {isEditMode && (
                  <React.Fragment>
                    <button 
                      onClick={() => openSettings(item)}
                      className="absolute top-2 right-2 z-20 bg-surface-2 p-1.5 rounded hover:bg-surface-3 hidden group-hover:block border border-line-stronger text-fg-secondary shadow-md"
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
                      className="absolute top-2 right-10 z-20 bg-red-900/80 p-1.5 rounded hover:bg-red-800 hidden group-hover:block border border-red-700 text-red-100 shadow-md"
                      title="Remove Widget"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </React.Fragment>
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
                      />
                    );
                  })()
                )}
                {type === 'historicalChart' && (
                  <HistoricalChartWidget 
                    projectId={projectId} 
                    config={config} 
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
          <div className="mt-14 shrink-0">
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
    </div>
  );
}
