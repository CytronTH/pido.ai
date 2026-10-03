import React, { useState, useEffect } from 'react';
import { X, Save, Settings, Palette, Bell, Sliders, Activity, Plus, Sparkles, Trash2, ArrowUpDown } from 'lucide-react';
import GaugeWidget from './GaugeWidget';
import TrafficLightWidget from './TrafficLightWidget';
import MetricWidget from './MetricWidget';
import ChartWidget from './ChartWidget';
import TextWidget from './TextWidget';
import HistoricalChartWidget from './HistoricalChartWidget';

const PRESET_COLOR_STOPS = [
  {
    name: 'Traffic Light (60 / 85 / 100%)',
    stops: [
      { limit: 60, color: '#10b981' },
      { limit: 85, color: '#eab308' },
      { limit: 100, color: '#ef4444' }
    ]
  },
  {
    name: 'Cool to Hot (40 / 75 / 100%)',
    stops: [
      { limit: 40, color: '#3b82f6' },
      { limit: 75, color: '#f59e0b' },
      { limit: 100, color: '#ef4444' }
    ]
  },
  {
    name: 'Battery / Capacity (20 / 50 / 100%)',
    stops: [
      { limit: 20, color: '#ef4444' },
      { limit: 50, color: '#eab308' },
      { limit: 100, color: '#10b981' }
    ]
  },
  {
    name: 'Pass / Alert (50 / 100%)',
    stops: [
      { limit: 50, color: '#10b981' },
      { limit: 100, color: '#ef4444' }
    ]
  }
];

const QUICK_COLORS = ['#10b981', '#eab308', '#f97316', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4'];

const ToggleSwitch = ({ label, checked, onChange, className = "mb-3" }) => (
  <div className={`flex items-center justify-between gap-4 ${className}`}>
    <h4 className="text-sm font-semibold text-fg-secondary">{label}</h4>
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-9 h-5 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-fg after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-fg-secondary after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
    </label>
  </div>
);

export default function WidgetSettingsModal({ isOpen, onClose, onSave, widgetItem, projectId, metadata = {} }) {
  const getNestedValue = (obj, path) => {
    if (!obj || !path) return null;
    const parts = path.split('.');
    let current = obj;
    for (let part of parts) {
      if (current === undefined || current === null) return null;
      if (part === 'length' && Array.isArray(current)) {
        current = current.length;
      } else {
        current = current[part];
      }
    }
    return current;
  };

  const formatDisplayVal = (val) => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'number') {
      return val % 1 !== 0 ? val.toFixed(2) : String(val);
    }
    if (typeof val === 'boolean') {
      return val ? 'true' : 'false';
    }
    if (typeof val === 'object') {
      if (val.value !== undefined) return formatDisplayVal(val.value);
      if (val.actual !== undefined && val.target !== undefined) return `${val.actual}/${val.target}`;
      if (Array.isArray(val)) return `[${val.length}]`;
      return 'Object';
    }
    return String(val);
  };
  const [formData, setFormData] = useState({ title: '', dataPath: '', unit: '', nodeId: '' });
  const [dataSources, setDataSources] = useState([]);
  const [pipelineNodes, setPipelineNodes] = useState([]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/data-sources?project_id=${projectId}`)
      .then(res => res.json())
      .then(data => setDataSources(data))
      .catch(err => console.error("Failed to load data sources:", err));

    fetch(`/api/projects`)
      .then(res => res.json())
      .then(projects => {
        const p = projects.find(proj => proj.id === projectId);
        if (p && p.pipeline && p.pipeline.nodes) {
           setPipelineNodes(p.pipeline.nodes.filter(n => ['counter', 'flowCounter'].includes(n.type)));
        }
      })
      .catch(err => console.error("Failed to load projects:", err));
  }, [projectId]);

  useEffect(() => {
    if (widgetItem && widgetItem.config) {
      setFormData({
        title: widgetItem.config.title || '',
        showTitle: widgetItem.config.showTitle ?? true,
        dataPath: widgetItem.config.dataPath || '',
        dataPaths: widgetItem.config.dataPaths || (widgetItem.config.dataPath ? [widgetItem.config.dataPath] : []),
        nodeId: widgetItem.config.nodeId || '',
        unit: widgetItem.config.unit || '',
        chartType: widgetItem.config.chartType || 'stepAfter',
        color: widgetItem.config.color || '#10b981',
        threshold: widgetItem.config.threshold || '',
        thresholdMin: widgetItem.config.thresholdMin || '',
        thresholdCondition: widgetItem.config.thresholdCondition || '>',
        iconName: widgetItem.config.iconName || 'Activity',
        decimals: widgetItem.config.decimals !== undefined ? widgetItem.config.decimals : '',
        unitPosition: widgetItem.config.unitPosition || 'inline',
        compactNotation: widgetItem.config.compactNotation || false,
        showTrend: widgetItem.config.showTrend || false,
        trendMode: widgetItem.config.trendMode || 'percent',
        trendPositiveColor: widgetItem.config.trendPositiveColor || 'green',
        alertGlow: widgetItem.config.alertGlow ?? true,
        timeframe: widgetItem.config.timeframe || '5m',
        lockTimeframe: widgetItem.config.lockTimeframe || false,
        yMin: widgetItem.config.yMin || '',
        yMax: widgetItem.config.yMax || '',
        maxDataPoints: widgetItem.config.maxDataPoints || 600,
        strokeWidth: widgetItem.config.strokeWidth !== undefined ? widgetItem.config.strokeWidth : 2,
        showDots: widgetItem.config.showDots || false,
        fillOpacity: widgetItem.config.fillOpacity !== undefined ? widgetItem.config.fillOpacity : 20,
        showGrid: widgetItem.config.showGrid !== undefined ? widgetItem.config.showGrid : true,
        gridStyle: widgetItem.config.gridStyle || '3 3',
        useGradient: widgetItem.config.useGradient !== undefined ? widgetItem.config.useGradient : true,
        thresholdColor: widgetItem.config.thresholdColor || '#ef4444',
        thresholdLabel: widgetItem.config.thresholdLabel || 'Threshold',
        thresholdMin: widgetItem.config.thresholdMin || '',
        thresholdMinColor: widgetItem.config.thresholdMinColor || '#3b82f6',
        thresholdMinLabel: widgetItem.config.thresholdMinLabel || 'Lower Limit',
        unit: widgetItem.config.unit || '',
        yAxisMargin: widgetItem.config.yAxisMargin || '',
        yAxisLogScale: widgetItem.config.yAxisLogScale || false,
        thickness: widgetItem.config.thickness || 16,
        gaugeStyle: widgetItem.config.gaugeStyle || 'half-circle',
        orientation: widgetItem.config.orientation || 'vertical',
        colorStops: widgetItem.config.colorStops || [],
        colorMode: widgetItem.config.colorMode || 'segmented',
        min: widgetItem.config.min !== undefined ? widgetItem.config.min : '',
        max: widgetItem.config.max !== undefined ? widgetItem.config.max : '',
        enableDynamicColors: widgetItem.config.enableDynamicColors ?? (widgetItem.config.colorStops && widgetItem.config.colorStops.length > 0),
        enableDisplayScale: widgetItem.config.enableDisplayScale ?? true,
        enableUpperLimit: widgetItem.config.enableUpperLimit ?? (widgetItem.config.threshold !== '' && widgetItem.config.threshold !== undefined),
        enableLowerLimit: widgetItem.config.enableLowerLimit ?? (widgetItem.config.thresholdMin !== '' && widgetItem.config.thresholdMin !== undefined),
        enableYAxisConstraints: widgetItem.config.enableYAxisConstraints ?? (widgetItem.config.yMin !== '' || widgetItem.config.yMax !== ''),
        enableVisualTweaks: widgetItem.config.enableVisualTweaks ?? true,
        fontColorMode: widgetItem.config.fontColorMode || 'dynamic',
        fontColor: widgetItem.config.fontColor || '#FFFFFF',
        valueFontSize: widgetItem.config.valueFontSize || 1,
        unitFontSize: widgetItem.config.unitFontSize || 1
      });
    }
  }, [widgetItem]);


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddColorStop = () => {
    const currentStops = [...(formData.colorStops || [])];
    let nextLimit = 100;
    if (currentStops.length > 0) {
      const maxLimit = Math.max(...currentStops.map(s => parseFloat(s.limit) || 0));
      if (maxLimit < 100) {
        nextLimit = 100;
      } else {
        nextLimit = Math.min(100, Math.round(maxLimit * 0.75));
      }
    }
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4'];
    const nextColor = colors[currentStops.length % colors.length];
    currentStops.push({ limit: nextLimit, color: nextColor });
    setFormData({ ...formData, colorStops: currentStops });
  };

  const handleRemoveColorStop = (index) => {
    const newStops = [...(formData.colorStops || [])];
    newStops.splice(index, 1);
    setFormData({ ...formData, colorStops: newStops });
  };

  const handleUpdateColorStop = (index, field, value) => {
    const newStops = [...(formData.colorStops || [])];
    newStops[index] = { ...newStops[index], [field]: value };
    setFormData({ ...formData, colorStops: newStops });
  };

  const handleSortColorStops = () => {
    const sorted = [...(formData.colorStops || [])].sort((a, b) => (parseFloat(a.limit) || 0) - (parseFloat(b.limit) || 0));
    setFormData({ ...formData, colorStops: sorted });
  };

  const handleSave = () => {
    const selectedSource = dataSources.find(ds => ds.id === formData.dataPath);
    const extraConfig = {};
    if (selectedSource) {
      if (selectedSource.stream_id !== undefined) extraConfig.stream_id = selectedSource.stream_id;
      if (selectedSource.has_ai !== undefined) extraConfig.has_ai = selectedSource.has_ai;
      if (selectedSource.nodeId !== undefined) extraConfig.nodeId = selectedSource.nodeId;
    }
    
    // Also save friendly names for chart data paths
    if (formData.dataPaths && formData.dataPaths.length > 0) {
      const names = {};
      formData.dataPaths.forEach(id => {
        const ds = dataSources.find(d => d.id === id);
        if (ds) names[id] = ds.name;
      });
      extraConfig.dataPathNames = names;
    }
    
    onSave(widgetItem.i, { ...widgetItem.config, ...formData, ...extraConfig });
  };

  const getSupportedTypes = (type) => {
    switch(type) {
      case 'metric': return ['number'];
      case 'gauge': return ['number'];
      case 'capacityBar': return ['number'];
      case 'trafficLight': return ['number', 'boolean', 'text'];
      case 'radialDonut': return ['number'];
      case 'text': return ['text', 'boolean'];
      case 'textFeed': return ['array_text'];
      case 'chart': return ['number', 'array_number'];
      case 'video': return ['video'];
      case 'imageGallery': return ['image'];
      case 'targetTracker': return ['target_tracker'];
      default: return []; // Specific widgets like heatmap, status, actions might not need data binding here
    }
  };

  const supportedTypes = widgetItem ? getSupportedTypes(widgetItem.type) : [];
  const filteredSources = dataSources.filter(ds => {
    if (!supportedTypes.includes(ds.dataType)) return false;
    if (ds.widgetType) {
      const metricCompatible = ['metric', 'gauge', 'capacityBar', 'radialDonut', 'trafficLight'];
      if (ds.widgetType === 'metric' && metricCompatible.includes(widgetItem?.type)) {
        return true;
      }
      if (ds.widgetType !== widgetItem?.type) return false;
    }
    return true;
  });

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
  ];
  
  if (['chart', 'metric', 'gauge', 'capacityBar', 'radialDonut'].includes(widgetItem?.type)) {
    tabs.push({ id: 'appearance', label: 'Appearance', icon: Palette });
    tabs.push({ id: 'limits', label: 'Limits & Alerts', icon: Bell });
  }
  
  if (['chart'].includes(widgetItem?.type)) {
    tabs.push({ id: 'advanced', label: 'Advanced', icon: Sliders });
  }

  const [activeTab, setActiveTab] = useState('general');

  // Ensure active tab is valid if widget type changes (rare but safe)
  useEffect(() => {
    if (widgetItem && !tabs.find(t => t.id === activeTab)) {
      setActiveTab('general');
    }
  }, [widgetItem?.type]);

  if (!isOpen || !widgetItem) return null;

  const renderPreview = () => {
    const previewProps = {
      title: formData.title || 'Preview Title',
      config: { ...formData, __isPreview: true },
    };
    
    // Retrieve real value if dataPath exists, else fallback to dummy
    const dsId = formData.dataPath || (formData.dataPaths && formData.dataPaths[0]) || widgetItem?.dataSourceId;
    let realValue = getNestedValue(metadata, dsId);
    if (realValue !== null && typeof realValue === 'object' && realValue.value !== undefined) {
      realValue = realValue.value;
    }
    
    switch(widgetItem?.type) {
      case 'gauge':
      case 'capacityBar':
      case 'radialDonut':
        return <GaugeWidget {...previewProps} value={realValue !== null ? realValue : 65} unit={formData.unit || ''} />;
      case 'trafficLight':
        return <TrafficLightWidget {...previewProps} value={realValue !== null ? realValue : 1} />; // 1 is warning state
      case 'metric':
        return <MetricWidget {...previewProps} value={realValue !== null ? realValue : 1024} unit={formData.unit || ''} />;
      case 'text':
        return <TextWidget {...previewProps} value={realValue !== null ? realValue : "System Nominal"} />;
      case 'chart':
        return <div className="w-full h-full bg-surface rounded-xl flex items-center justify-center border border-line-strong shadow-inner"><span className="text-fg-subtle font-mono text-sm">Chart Preview</span></div>;
      default:
        return <div className="text-fg-subtle text-sm">Preview not available</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-canvas border border-line rounded-2xl shadow-2xl w-[900px] h-[650px] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-surface px-6 py-4 border-b border-line shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="font-bold text-fg text-lg leading-tight">Widget Settings</h3>
              <p className="text-xs text-fg-muted">Configure "{widgetItem?.type === 'metric' ? 'Number' : widgetItem?.type}" widget properties</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-fg-muted hover:text-fg hover:bg-surface-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-[400px]">
          {/* Left Side: Form */}
          <div className="flex-1 flex flex-col border-r border-line">
            {/* Tab Navigation */}
            <div className="flex px-6 border-b border-line bg-surface/50 shrink-0">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      isActive 
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                        : 'border-transparent text-fg-muted hover:text-fg hover:border-line-stronger'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                )
              })}
            </div>
            
            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-surface">
          
          {/* ================= GENERAL TAB ================= */}
          <div className={activeTab === 'general' ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
            <div className="space-y-5">
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-fg-secondary mb-1.5">Widget Title</label>
                  <input 
                    type="text" 
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full bg-canvas border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none shadow-inner"
                    placeholder="e.g. People Count"
                  />
                </div>
                <div className="pt-7 shrink-0">
                  <ToggleSwitch 
                    label="Show Title" 
                    checked={formData.showTitle !== false} 
                    onChange={(e) => setFormData({ ...formData, showTitle: e.target.checked })} 
                    className="mb-0"
                  />
                </div>
              </div>

              {widgetItem.type === 'historicalChart' ? (
                <div>
                  <label className="block text-sm font-medium text-fg-secondary mb-1.5">Target Counter Node</label>
                  <select 
                    name="nodeId"
                    value={formData.nodeId}
                    onChange={handleChange}
                    className="w-full bg-canvas border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                  >
                    <option value="">-- All Project Counters --</option>
                    {pipelineNodes.map(n => (
                      <option key={n.id} value={n.id}>{n.data?.label || n.type} ({n.id})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-fg-secondary mb-1.5">Data Source Binding</label>
                  {widgetItem.type === 'chart' ? (
                    <div className="w-full bg-canvas border border-line-strong rounded-lg p-3 text-fg text-sm max-h-40 overflow-y-auto shadow-inner custom-scrollbar">
                      {(() => {
                        const danglingPaths = (formData.dataPaths || []).filter(p => !filteredSources.some(ds => ds.id === p));
                        const allToRender = [
                          ...filteredSources, 
                          ...danglingPaths.map(p => ({ id: p, name: '⚠️ Deleted Source', isDangling: true }))
                        ];
                        
                        if (allToRender.length === 0) {
                          return <div className="text-fg-subtle italic p-2 text-center text-xs">No supported sources available in this project.</div>;
                        }
                        return allToRender.map(ds => {
                          const val = getNestedValue(metadata, ds.id);
                          const displayVal = formatDisplayVal(val);
                          return (
                          <label key={ds.id} className={`flex items-center gap-3 p-2 rounded-md hover:bg-surface-2 cursor-pointer transition-colors ${ds.isDangling ? 'text-red-600/80 dark:text-red-400/80' : ''}`}>
                            <input 
                              type="checkbox" 
                              checked={formData.dataPaths?.includes(ds.id)}
                              onChange={(e) => {
                                const paths = formData.dataPaths || [];
                                if (e.target.checked) setFormData({ ...formData, dataPaths: [...paths, ds.id] });
                                else setFormData({ ...formData, dataPaths: paths.filter(p => p !== ds.id) });
                              }}
                              className="w-4 h-4 rounded border-line-stronger bg-surface text-blue-500 focus:ring-blue-500 focus:ring-offset-surface cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{ds.name}</span>
                              <span className={`${ds.isDangling ? 'text-red-500/50' : 'text-fg-subtle'} font-mono text-[10px]`}>{displayVal}</span>
                            </div>
                          </label>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <select 
                      name="dataPath"
                      value={formData.dataPath}
                      onChange={handleChange}
                      className="w-full bg-canvas border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                    >
                      <option value="">-- Select Data Source --</option>
                      {formData.dataPath && !filteredSources.some(ds => ds.id === formData.dataPath) && (
                        <option value={formData.dataPath}>⚠️ Deleted Source ({formData.dataPath})</option>
                      )}
                      {filteredSources.map(ds => {
                        const isVideo = ds.dataType === 'video' || widgetItem?.type === 'video';
                        const val = isVideo ? null : getNestedValue(metadata, ds.id);
                        const displayVal = isVideo ? '' : ` [${formatDisplayVal(val)}]`;
                        return (
                          <option key={ds.id} value={ds.id}>{ds.name}{displayVal}</option>
                        );
                      })}
                    </select>
                  )}
                  <p className="text-xs text-fg-subtle mt-2 flex items-center gap-1.5">
                    <Activity size={12} />
                    {supportedTypes.length > 0 
                      ? `Supported types: ${supportedTypes.join(', ')}` 
                      : "No data binding required."}
                  </p>
                </div>
              )}

              {['metric', 'gauge', 'capacityBar', 'radialDonut', 'text', 'targetTracker'].includes(widgetItem?.type) && (
                <div className={['metric', 'gauge', 'capacityBar', 'radialDonut'].includes(widgetItem?.type) ? "grid grid-cols-2 gap-4" : "w-full"}>
                  <div>
                    <label className="block text-sm font-medium text-fg-secondary mb-1.5">Unit Suffix / Label</label>
                    <input 
                      type="text" 
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      className="w-full bg-canvas border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm focus:border-blue-500 outline-none shadow-inner"
                      placeholder="e.g. %, kg, pcs"
                    />
                  </div>
                  {widgetItem?.type === 'metric' && (
                    <div>
                      <label className="block text-sm font-medium text-fg-secondary mb-1.5">Unit Position</label>
                      <select
                        name="unitPosition"
                        value={formData.unitPosition || 'inline'}
                        onChange={handleChange}
                        className="w-full bg-canvas border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                      >
                        <option value="inline">ต่อหลังตัวเลข (Behind / Inline)</option>
                        <option value="below">อยู่ใต้ตัวเลข (Below Number)</option>
                      </select>
                    </div>
                  )}
                  {['metric', 'gauge', 'capacityBar', 'radialDonut'].includes(widgetItem?.type) && (
                    <div>
                      <label className="block text-sm font-medium text-fg-secondary mb-1.5">Decimal Places</label>
                      <input 
                        type="number" 
                        name="decimals"
                        value={formData.decimals}
                        onChange={handleChange}
                        className="w-full bg-canvas border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm focus:border-blue-500 outline-none shadow-inner"
                        placeholder="e.g. 0, 1, 2"
                        min="0" max="10"
                      />
                    </div>
                  )}

                  {widgetItem?.type === 'metric' && (
                    <>
                      <div className="col-span-2 p-3.5 rounded-xl border border-line-strong/60 bg-surface-2/40 transition-colors hover:border-line-strong">
                        <ToggleSwitch 
                          label={
                            <div>
                              <span className="text-sm font-semibold text-fg">Compact Notation (K, M, B)</span>
                              <p className="text-xs text-fg-subtle font-normal mt-0.5">ย่อตัวเลขจำนวนมาก เช่น 1.5K, 2.4M, 1.1B</p>
                            </div>
                          } 
                          checked={formData.compactNotation || false} 
                          onChange={(e) => setFormData({ ...formData, compactNotation: e.target.checked })} 
                          className="mb-0"
                        />
                      </div>

                      <div className="col-span-2 p-3.5 rounded-xl border border-line-strong/60 bg-surface-2/40 space-y-3 transition-colors hover:border-line-strong">
                        <ToggleSwitch 
                          label={
                            <div>
                              <span className="text-sm font-semibold text-fg">Trend Indicator (ลูกศรความเปลี่ยนแปลง)</span>
                              <p className="text-xs text-fg-subtle font-normal mt-0.5">แสดงทิศทางการเปลี่ยนแปลงเทียบกับค่าก่อนหน้า (▲ / ▼)</p>
                            </div>
                          } 
                          checked={formData.showTrend || false} 
                          onChange={(e) => setFormData({ ...formData, showTrend: e.target.checked })} 
                          className="mb-0"
                        />

                        {formData.showTrend && (
                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-line-strong/50 animate-in fade-in duration-200">
                            <div>
                              <label className="block text-xs font-medium text-fg-secondary mb-1">Display Mode</label>
                              <select 
                                name="trendMode"
                                value={formData.trendMode || 'percent'}
                                onChange={handleChange}
                                className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-fg text-xs focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                              >
                                <option value="percent">Percentage (+5.4%)</option>
                                <option value="value">Difference Value (+12)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-fg-secondary mb-1">Positive Direction (▲ ขึ้น)</label>
                              <select 
                                name="trendPositiveColor"
                                value={formData.trendPositiveColor || 'green'}
                                onChange={handleChange}
                                className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-fg text-xs focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                              >
                                <option value="green">เขียว (Green = Good / Positive)</option>
                                <option value="red">แดง (Red = Alert / Bad)</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ================= APPEARANCE TAB ================= */}
          <div className={activeTab === 'appearance' ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
            <div className="space-y-5">
              
                <div>
                  <label className="block text-sm font-medium text-fg-secondary mb-1.5">Widget Icon</label>
                  <select 
                    name="iconName"
                    value={formData.iconName}
                    onChange={handleChange}
                    className="w-full bg-canvas border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                  >
                    <option value="">No Icon / Default</option>
                    <option value="Activity">Activity</option>
                    <option value="Users">Users</option>
                    <option value="Thermometer">Thermometer</option>
                    <option value="Car">Car</option>
                    <option value="Cpu">CPU</option>
                    <option value="Droplets">Droplets</option>
                    <option value="Zap">Zap / Energy</option>
                    <option value="Camera">Camera</option>
                    <option value="Eye">Eye</option>
                    <option value="BarChart2">Bar Chart</option>
                  </select>
                </div>

              {widgetItem.type === 'gauge' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-fg-secondary mb-1.5">Gauge Style</label>
                    <select 
                      name="gaugeStyle"
                      value={formData.gaugeStyle || 'half-circle'}
                      onChange={(e) => setFormData({ ...formData, gaugeStyle: e.target.value })}
                      className="w-full bg-canvas border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                    >
                      <option value="half-circle">Modern Half-Circle</option>
                      <option value="horseshoe">Horseshoe with Needle</option>
                      <option value="radial-donut">Radial Donut</option>
                      <option value="capacity-bar">Capacity Bar (Linear Tube)</option>
                    </select>
                  </div>
                  {(formData.gaugeStyle === 'half-circle' || !formData.gaugeStyle) && (
                    <div>
                      <label className="block text-sm font-medium text-fg-secondary mb-1.5 flex justify-between">
                        <span>Tube Thickness</span>
                        <span className="text-blue-600 dark:text-blue-400">{formData.thickness || 16}%</span>
                      </label>
                      <input 
                        type="range" 
                        name="thickness"
                        min="4" 
                        max="40" 
                        value={formData.thickness || 16}
                        onChange={(e) => setFormData({ ...formData, thickness: parseInt(e.target.value) })}
                        className="w-full accent-blue-500"
                      />
                      <p className="text-xs text-fg-subtle mt-1">Adjust the thickness of the gauge donut tube.</p>
                    </div>
                  )}
                  {formData.gaugeStyle === 'capacity-bar' && (
                    <div>
                      <label className="block text-sm font-medium text-fg-secondary mb-1.5">Bar Orientation</label>
                      <select 
                        name="orientation"
                        value={formData.orientation || 'vertical'}
                        onChange={(e) => setFormData({ ...formData, orientation: e.target.value })}
                        className="w-full bg-canvas border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                      >
                        <option value="vertical">Vertical</option>
                        <option value="horizontal">Horizontal</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {widgetItem.type === 'capacityBar' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-fg-secondary mb-1.5">Bar Orientation</label>
                    <select 
                      name="orientation"
                      value={formData.orientation || 'vertical'}
                      onChange={(e) => setFormData({ ...formData, orientation: e.target.value })}
                      className="w-full bg-canvas border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                    >
                      <option value="vertical">Vertical</option>
                      <option value="horizontal">Horizontal</option>
                    </select>
                  </div>
                </div>
              )}

              {(widgetItem.type === 'gauge' || widgetItem.type === 'capacityBar') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-fg-muted mb-1.5">Base Theme Color</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          name="color"
                          value={formData.color || '#10B981'}
                          onChange={handleChange}
                          className="h-9 w-10 bg-canvas border border-line-strong rounded cursor-pointer"
                        />
                        <input 
                          type="text" 
                          name="color"
                          value={formData.color || '#10B981'}
                          onChange={handleChange}
                          className="w-full bg-surface border border-line-strong rounded px-2 py-1.5 text-fg text-sm outline-none uppercase font-mono"
                          placeholder="#10B981"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-medium text-fg-muted mb-1.5 flex justify-between">
                        <span>Value Font Scale</span>
                        <span className="text-blue-600 dark:text-blue-400">{formData.valueFontSize || 1}x</span>
                      </label>
                      <input 
                        type="range" 
                        name="valueFontSize"
                        min="0.5" 
                        max="3" 
                        step="0.1"
                        value={formData.valueFontSize || 1}
                        onChange={handleChange}
                        className="w-full accent-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-fg-muted mb-1.5 flex justify-between">
                        <span>Unit / Label Scale</span>
                        <span className="text-blue-600 dark:text-blue-400">{formData.unitFontSize || 1}x</span>
                      </label>
                      <input 
                        type="range" 
                        name="unitFontSize"
                        min="0.5" 
                        max="3" 
                        step="0.1"
                        value={formData.unitFontSize || 1}
                        onChange={handleChange}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-xl border transition-colors ${formData.enableDynamicColors ? 'bg-surface-2/60 border-line-strong' : 'bg-surface-2/40 border-line-strong/60 hover:border-line-strong'}`}>
                    <ToggleSwitch 
                      label={
                        <div>
                          <span className="text-sm font-semibold text-fg">Dynamic Colors & Ranges</span>
                          <p className="text-xs text-fg-subtle font-normal mt-0.5">เปลี่ยนสีตามช่วงของค่าตัวเลข (Color Stops)</p>
                        </div>
                      }
                      checked={formData.enableDynamicColors} 
                      onChange={(e) => setFormData({ ...formData, enableDynamicColors: e.target.checked })} 
                      className="mb-0"
                    />
                    
                    {formData.enableDynamicColors && (
                      <div className="space-y-4 pt-3 border-t border-line-strong/50 animate-in fade-in duration-200 mt-3">

                    <div>
                      <label className="block text-xs font-medium text-fg-muted mb-1.5">Color Display Mode</label>
                      <select 
                        name="colorMode"
                        value={formData.colorMode || 'segmented'}
                        onChange={(e) => setFormData({ ...formData, colorMode: e.target.value })}
                        className="w-full bg-surface border border-line-strong rounded px-3 py-2 text-fg text-sm focus:border-blue-500 outline-none h-9"
                      >
                        <option value="segmented">Segmented</option>
                        <option value="solid">Solid Thresholds</option>
                      </select>
                    </div>

                    {/* Interactive Visual Range Bar Preview */}
                    {(() => {
                      const stops = formData.colorStops || [];
                      const sorted = [...stops].map((s, idx) => ({ ...s, origIndex: idx })).sort((a, b) => (parseFloat(a.limit) || 0) - (parseFloat(b.limit) || 0));
                      let lastLimit = 0;
                      const segments = sorted.map((s) => {
                        const limit = Math.min(100, Math.max(0, parseFloat(s.limit) || 0));
                        const width = Math.max(0, limit - lastLimit);
                        const from = lastLimit;
                        lastLimit = limit;
                        return { ...s, from, to: limit, width };
                      });
                      const remainderWidth = Math.max(0, 100 - lastLimit);

                      return (
                        <div className="space-y-2 p-3 bg-surface rounded-xl border border-line-strong/80">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-fg flex items-center gap-1.5">
                              <Sparkles size={13} className="text-amber-500" />
                              <span>Live Range Visualizer (0% – 100%)</span>
                            </label>
                            {stops.length > 1 && (
                              <button
                                type="button"
                                onClick={handleSortColorStops}
                                className="text-[11px] text-blue-500 hover:text-blue-600 flex items-center gap-1 hover:underline"
                                title="เรียงลำดับ % จากน้อยไปมาก"
                              >
                                <ArrowUpDown size={11} /> Auto-sort
                              </button>
                            )}
                          </div>

                          {/* Visual Progress Bar */}
                          <div className="h-8 w-full bg-surface-3 rounded-lg overflow-hidden flex border border-line-strong shadow-inner relative select-none">
                            {segments.map((seg, i) => (
                              <div
                                key={i}
                                style={{ width: `${seg.width}%`, backgroundColor: seg.color }}
                                className="h-full flex items-center justify-center relative transition-all duration-150 border-r border-black/20 last:border-r-0 group cursor-default"
                                title={`Zone ${i + 1}: ${seg.from}% – ${seg.to}% (${seg.color})`}
                              >
                                {seg.width >= 12 && (
                                  <span className="text-[11px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] truncate px-1">
                                    {seg.from}-{seg.to}%
                                  </span>
                                )}
                              </div>
                            ))}
                            {remainderWidth > 0 && (
                              <div
                                style={{ width: `${remainderWidth}%` }}
                                className="h-full bg-surface-2 flex items-center justify-center text-fg-subtle text-[10px] italic border-dashed border-line-strong px-1"
                                title={`Remaining: ${lastLimit}% – 100% (Default Color)`}
                              >
                                {remainderWidth >= 15 && `+${remainderWidth}%`}
                              </div>
                            )}
                          </div>

                          {/* Bar scale ticks */}
                          <div className="flex justify-between text-[10px] text-fg-subtle font-mono px-0.5 select-none">
                            <span>0%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>75%</span>
                            <span>100%</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Quick Presets */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-fg-muted">Quick Presets (ชุดสีสำเร็จรูป)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {PRESET_COLOR_STOPS.map((preset, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => setFormData({ ...formData, colorStops: preset.stops.map(s => ({ ...s })) })}
                            className="p-2 rounded-lg border border-line-strong hover:border-blue-500/80 bg-surface hover:bg-surface-2/70 text-left transition-all group flex flex-col gap-1.5"
                          >
                            <span className="text-xs font-semibold text-fg group-hover:text-blue-500 transition-colors">
                              {preset.name}
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {preset.stops.map((st, sIdx) => (
                                <div key={sIdx} className="flex items-center gap-1">
                                  <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: st.color }} />
                                  <span className="text-[10px] text-fg-subtle font-mono">{st.limit}%</span>
                                  {sIdx < preset.stops.length - 1 && <span className="text-fg-subtle text-[10px]">·</span>}
                                </div>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Zone Cards with Sliders and Swatches */}
                    <div className="space-y-2.5 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-fg">Threshold Zones (กำหนดช่วงและสี)</label>
                        <span className="text-xs text-fg-subtle font-mono">{(formData.colorStops || []).length} zones</span>
                      </div>

                      {(formData.colorStops || []).map((stop, index) => {
                        const prevLimit = index === 0 ? 0 : ((formData.colorStops || [])[index - 1]?.limit || 0);
                        return (
                          <div key={index} className="p-3 rounded-xl bg-surface border border-line-strong/80 space-y-2.5 transition-all hover:border-line-strong">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0 shadow-sm" style={{ backgroundColor: stop.color }} />
                                <span className="text-xs font-semibold text-fg">
                                  Zone {index + 1}: <span className="text-blue-500 font-mono">{prevLimit}% → {stop.limit}%</span>
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveColorStop(index)}
                                className="p-1 text-fg-subtle hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                title="ลบช่วงนี้"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            {/* Range slider and direct input */}
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-fg-subtle font-mono shrink-0">Upper:</span>
                              <input
                                type="range"
                                min="1"
                                max="100"
                                value={stop.limit || 0}
                                onChange={(e) => handleUpdateColorStop(index, 'limit', Number(e.target.value))}
                                className="flex-1 accent-blue-500 h-2 bg-surface-3 rounded-lg cursor-pointer"
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={stop.limit}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? '' : Math.min(100, Math.max(1, Number(e.target.value)));
                                    handleUpdateColorStop(index, 'limit', val);
                                  }}
                                  className="w-14 bg-canvas border border-line-strong rounded px-2 py-1 text-xs text-center font-mono text-fg focus:border-blue-500 outline-none"
                                />
                                <span className="text-xs text-fg-subtle font-mono">%</span>
                              </div>
                            </div>

                            {/* Color Picker & Quick Swatches */}
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-line-strong/30">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {QUICK_COLORS.map((qc) => (
                                  <button
                                    key={qc}
                                    type="button"
                                    onClick={() => handleUpdateColorStop(index, 'color', qc)}
                                    style={{ backgroundColor: qc }}
                                    className={`w-5 h-5 rounded-full border transition-transform ${stop.color?.toLowerCase() === qc.toLowerCase() ? 'scale-125 ring-2 ring-blue-500 ring-offset-1 ring-offset-surface border-white' : 'border-black/20 hover:scale-110'}`}
                                    title={qc}
                                  />
                                ))}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <input
                                  type="color"
                                  value={stop.color}
                                  onChange={(e) => handleUpdateColorStop(index, 'color', e.target.value)}
                                  className="w-6 h-6 rounded cursor-pointer border border-line-strong bg-transparent"
                                  title="Custom Color"
                                />
                                <input
                                  type="text"
                                  value={stop.color}
                                  onChange={(e) => handleUpdateColorStop(index, 'color', e.target.value)}
                                  className="w-20 bg-canvas border border-line-strong rounded px-1.5 py-0.5 text-[11px] text-fg font-mono uppercase text-center outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={handleAddColorStop}
                        className="w-full mt-2 py-2.5 border border-dashed border-line-strong rounded-xl text-xs font-medium text-fg-muted hover:text-blue-500 hover:border-blue-500/60 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus size={14} /> Add Color Range Zone
                      </button>
                    </div>
                    </div>
                  )}
                  </div>
                </>
              )}

              {widgetItem.type === 'chart' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-fg-secondary mb-1.5">Chart Type</label>
                      <select 
                        name="chartType"
                        value={formData.chartType}
                        onChange={handleChange}
                        className="w-full bg-canvas border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm focus:border-blue-500 outline-none shadow-inner cursor-pointer"
                      >
                        <option value="stepAfter">Step Line (Digital)</option>
                        <option value="monotone">Smooth Line (Analog)</option>
                        <option value="area">Area Chart</option>
                        <option value="bar">Bar Chart</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg-secondary mb-1.5">Base Theme Color</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          name="color"
                          value={formData.color}
                          onChange={handleChange}
                          className="h-10 w-12 bg-canvas border border-line-strong rounded-lg cursor-pointer"
                        />
                        <input 
                          type="text" 
                          name="color"
                          value={formData.color}
                          onChange={handleChange}
                          className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-fg text-sm focus:border-blue-500 outline-none shadow-inner uppercase font-mono"
                          placeholder="#10B981"
                        />
                      </div>
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-xl border transition-colors ${formData.enableVisualTweaks ? 'bg-surface-2/60 border-line-strong' : 'bg-surface-2/40 border-line-strong/60 hover:border-line-strong'}`}>
                    <ToggleSwitch 
                      label={
                        <div>
                          <span className="text-sm font-semibold text-fg">Visual Tweaks</span>
                          <p className="text-xs text-fg-subtle font-normal mt-0.5">ปรับแต่งเส้นกราฟ ความทึบ และจุดข้อมูล</p>
                        </div>
                      }
                      checked={formData.enableVisualTweaks} 
                      onChange={(e) => setFormData({ ...formData, enableVisualTweaks: e.target.checked })} 
                      className="mb-0"
                    />
                    
                    {formData.enableVisualTweaks && (
                      <div className="space-y-4 pt-3 border-t border-line-strong/50 animate-in fade-in duration-200 mt-3">
                        <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-fg-muted mb-1">Line Thickness (px)</label>
                        <input 
                          type="number" 
                          name="strokeWidth"
                          value={formData.strokeWidth}
                          onChange={handleChange}
                          className="w-full bg-surface border border-line-strong rounded px-3 py-1.5 text-fg text-sm focus:border-blue-500 outline-none"
                          min="1" max="10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-fg-muted mb-1">Fill Opacity (%)</label>
                        <input 
                          type="number" 
                          name="fillOpacity"
                          value={formData.fillOpacity}
                          onChange={handleChange}
                          className="w-full bg-surface border border-line-strong rounded px-3 py-1.5 text-fg text-sm focus:border-blue-500 outline-none"
                          min="0" max="100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-surface-2 p-2 rounded-lg transition-colors">
                        <input 
                          type="checkbox"
                          checked={formData.showDots}
                          onChange={(e) => setFormData({ ...formData, showDots: e.target.checked })}
                          className="rounded border-line-stronger bg-surface text-blue-500 focus:ring-0"
                        />
                        <span className="text-sm text-fg-secondary">Show Data Points</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-surface-2 p-2 rounded-lg transition-colors">
                        <input 
                          type="checkbox"
                          checked={formData.useGradient}
                          onChange={(e) => setFormData({ ...formData, useGradient: e.target.checked })}
                          className="rounded border-line-stronger bg-surface text-blue-500 focus:ring-0"
                        />
                        <span className="text-sm text-fg-secondary">Gradient Area Fill</span>
                      </label>
                    </div>

                    <div className="border-t border-line pt-3">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-surface-2 p-2 rounded-lg transition-colors mb-2">
                        <input 
                          type="checkbox"
                          checked={formData.showGrid}
                          onChange={(e) => setFormData({ ...formData, showGrid: e.target.checked })}
                          className="rounded border-line-stronger bg-surface text-blue-500 focus:ring-0"
                        />
                        <span className="text-sm text-fg-secondary">Show Background Grid</span>
                      </label>
                      
                      {formData.showGrid && (
                        <div className="pl-8 pr-2">
                          <label className="block text-xs font-medium text-fg-subtle mb-1">Grid Style</label>
                          <select
                            name="gridStyle"
                            value={formData.gridStyle}
                            onChange={handleChange}
                            className="w-full bg-surface border border-line-strong rounded px-3 py-1.5 text-fg-secondary text-sm focus:border-blue-500 outline-none"
                          >
                            <option value="3 3">Dashed (3 3)</option>
                            <option value="5 5">Large Dashed (5 5)</option>
                            <option value="0">Solid Line</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
                </>
              )}
            </div>
          </div>

          {/* ================= LIMITS & ALERTS TAB ================= */}
          <div className={activeTab === 'limits' ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
            <div className="space-y-4">
              
              <div className={`p-3.5 rounded-xl border relative overflow-hidden transition-colors ${formData.enableUpperLimit ? 'bg-red-500/5 dark:bg-red-950/25 border-red-500/40' : 'bg-surface-2/40 border-line-strong/60 hover:border-line-strong'}`}>
                {formData.enableUpperLimit && <div className="absolute top-0 left-0 w-1 h-full bg-red-500/60"></div>}
                <ToggleSwitch 
                  label={
                    <div>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">Upper Limit (Max)</span>
                      <p className="text-xs text-fg-subtle font-normal mt-0.5">เตือนเมื่อค่าเกินเกณฑ์สูงสุดที่กำหนด</p>
                    </div>
                  } 
                  checked={formData.enableUpperLimit} 
                  onChange={(e) => setFormData({ ...formData, enableUpperLimit: e.target.checked })} 
                  className="mb-0"
                />
                {formData.enableUpperLimit && (
                  <div className="pt-3 border-t border-line-strong/50 animate-in fade-in duration-200 mt-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1.5">Value Trigger</label>
                    <div className="flex gap-0 overflow-hidden rounded-lg border border-line-strong shadow-inner">
                      {widgetItem.type === 'metric' && (
                        <select 
                          name="thresholdCondition"
                          value={formData.thresholdCondition}
                          onChange={handleChange}
                          className="w-12 bg-surface px-2 py-2 text-fg text-sm border-r border-line-strong outline-none"
                        >
                          <option value=">">&gt;</option>
                          <option value="<">&lt;</option>
                          <option value="==">=</option>
                        </select>
                      )}
                      <input 
                        type="number" 
                        name="threshold"
                        value={formData.threshold}
                        onChange={handleChange}
                        className="w-full bg-canvas px-3 py-2 text-fg text-sm focus:bg-surface outline-none transition-colors"
                        placeholder="e.g. 5000"
                      />
                    </div>
                  </div>
                  
                  {widgetItem.type === 'chart' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-fg-muted mb-1.5">Display Label</label>
                        <input 
                          type="text" 
                          name="thresholdLabel"
                          value={formData.thresholdLabel}
                          onChange={handleChange}
                          className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-fg text-sm outline-none"
                          placeholder="e.g. Overheating"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-fg-muted mb-1.5">Line Color</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            name="thresholdColor"
                            value={formData.thresholdColor}
                            onChange={handleChange}
                            className="h-8 w-12 bg-canvas border border-line-strong rounded cursor-pointer"
                          />
                          <div className="flex-1 text-xs text-fg-subtle py-2 border border-line rounded bg-surface/50 px-2 text-center pointer-events-none uppercase">{formData.thresholdColor}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                </div>
                )}
              </div>

              <div className={`p-3.5 rounded-xl border relative overflow-hidden transition-colors ${formData.enableLowerLimit ? 'bg-blue-500/5 dark:bg-blue-950/25 border-blue-500/40' : 'bg-surface-2/40 border-line-strong/60 hover:border-line-strong'}`}>
                {formData.enableLowerLimit && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/60"></div>}
                <ToggleSwitch 
                  label={
                    <div>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Lower Limit (Min)</span>
                      <p className="text-xs text-fg-subtle font-normal mt-0.5">เตือนเมื่อค่าต่ำกว่าเกณฑ์ต่ำสุดที่กำหนด</p>
                    </div>
                  } 
                  checked={formData.enableLowerLimit} 
                  onChange={(e) => setFormData({ ...formData, enableLowerLimit: e.target.checked })} 
                  className="mb-0"
                />
                {formData.enableLowerLimit && (
                  <div className="pt-3 border-t border-line-strong/50 animate-in fade-in duration-200 mt-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1.5">Value Trigger (&lt;)</label>
                    <input 
                      type="number" 
                      name="thresholdMin"
                      value={formData.thresholdMin}
                      onChange={handleChange}
                      className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-fg text-sm focus:border-blue-500 outline-none shadow-inner"
                      placeholder="e.g. 10"
                    />
                  </div>
                  
                  {widgetItem.type === 'chart' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-fg-muted mb-1.5">Display Label</label>
                        <input 
                          type="text" 
                          name="thresholdMinLabel"
                          value={formData.thresholdMinLabel}
                          onChange={handleChange}
                          className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-fg text-sm outline-none"
                          placeholder="e.g. Low Stock"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-fg-muted mb-1.5">Line Color</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            name="thresholdMinColor"
                            value={formData.thresholdMinColor}
                            onChange={handleChange}
                            className="h-8 w-12 bg-canvas border border-line-strong rounded cursor-pointer"
                          />
                          <div className="flex-1 text-xs text-fg-subtle py-2 border border-line rounded bg-surface/50 px-2 text-center pointer-events-none uppercase">{formData.thresholdMinColor}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                </div>
                )}
              </div>

              {widgetItem.type === 'metric' && (
                <div className="p-3.5 rounded-xl border border-line-strong/60 bg-surface-2/40 transition-colors hover:border-line-strong">
                  <ToggleSwitch 
                    label={
                      <div>
                        <span className="text-sm font-semibold text-fg">Card Neon Glow on Alert</span>
                        <p className="text-xs text-fg-subtle font-normal mt-0.5">เพิ่มเอฟเฟกต์แสงเรืองรอบการ์ด (Neon Glow) เมื่อค่าเกินเกณฑ์ Alert</p>
                      </div>
                    } 
                    checked={formData.alertGlow ?? true} 
                    onChange={(e) => setFormData({ ...formData, alertGlow: e.target.checked })} 
                    className="mb-0"
                  />
                </div>
              )}
              
              {(widgetItem.type === 'gauge' || widgetItem.type === 'capacityBar') && (
                <div className={`p-3.5 rounded-xl border transition-colors ${formData.enableDisplayScale ? 'bg-surface-2/60 border-line-strong' : 'bg-surface-2/40 border-line-strong/60 hover:border-line-strong'}`}>
                  <ToggleSwitch 
                    label={
                      <div>
                        <span className="text-sm font-semibold text-fg">Display Scale Range</span>
                        <p className="text-xs text-fg-subtle font-normal mt-0.5">กำหนดค่าต่ำสุด (0%) และสูงสุด (100%) สำหรับสเกลเกจ</p>
                      </div>
                    } 
                    checked={formData.enableDisplayScale} 
                    onChange={(e) => setFormData({ ...formData, enableDisplayScale: e.target.checked })} 
                    className="mb-0"
                  />
                  {formData.enableDisplayScale && (
                    <div className="pt-3 border-t border-line-strong/50 animate-in fade-in duration-200 mt-3">
                      <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-fg-muted mb-1">Minimum Value (0%)</label>
                      <input 
                        type="number" 
                        name="min"
                        value={formData.min !== undefined ? formData.min : ''}
                        onChange={handleChange}
                        className="w-full bg-surface border border-line-strong rounded px-3 py-2 text-fg text-sm outline-none"
                        placeholder="Default: 0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-fg-muted mb-1">Maximum Value (100%)</label>
                      <input 
                        type="number" 
                        name="max"
                        value={formData.max !== undefined ? formData.max : ''}
                        onChange={handleChange}
                        className="w-full bg-surface border border-line-strong rounded px-3 py-2 text-fg text-sm outline-none"
                        placeholder="Default: 100"
                      />
                    </div>
                  </div>
                    </div>
                  )}
                </div>
              )}
              
              {widgetItem.type === 'chart' && (
                <div className={`p-3.5 rounded-xl border transition-colors ${formData.enableYAxisConstraints ? 'bg-surface-2/60 border-line-strong' : 'bg-surface-2/40 border-line-strong/60 hover:border-line-strong'}`}>
                  <ToggleSwitch 
                    label={
                      <div>
                        <span className="text-sm font-semibold text-fg">Y-Axis Constraints</span>
                        <p className="text-xs text-fg-subtle font-normal mt-0.5">ล็อกช่วงแกน Y ไม่ให้ปรับอัตโนมัติ</p>
                      </div>
                    } 
                    checked={formData.enableYAxisConstraints} 
                    onChange={(e) => setFormData({ ...formData, enableYAxisConstraints: e.target.checked })} 
                    className="mb-0"
                  />
                  {formData.enableYAxisConstraints && (
                    <div className="pt-3 border-t border-line-strong/50 animate-in fade-in duration-200 mt-3">
                      <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-fg-muted mb-1">Fixed Min Value</label>
                      <input 
                        type="number" 
                        name="yMin"
                        value={formData.yMin}
                        onChange={handleChange}
                        className="w-full bg-surface border border-line-strong rounded px-3 py-2 text-fg text-sm outline-none"
                        placeholder="Auto"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-fg-muted mb-1">Fixed Max Value</label>
                      <input 
                        type="number" 
                        name="yMax"
                        value={formData.yMax}
                        onChange={handleChange}
                        className="w-full bg-surface border border-line-strong rounded px-3 py-2 text-fg text-sm outline-none"
                        placeholder="Auto"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-fg-muted mb-1">Auto Top Margin (%)</label>
                      <input 
                        type="number" 
                        name="yAxisMargin"
                        value={formData.yAxisMargin}
                        onChange={handleChange}
                        className="w-full bg-surface border border-line-strong rounded px-3 py-2 text-fg text-sm outline-none"
                        placeholder="e.g. 20 (adds 20% space above highest peak)"
                        min="0" max="200"
                      />
                    </div>
                  </div>
                  </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ================= ADVANCED TAB ================= */}
          <div className={activeTab === 'advanced' ? 'block animate-in fade-in slide-in-from-right-4 duration-300' : 'hidden'}>
            <div className="space-y-5">

              {widgetItem.type === 'chart' && (
                <>
                  <div className="p-4 bg-canvas/50 border border-line rounded-xl space-y-4">
                    <h4 className="text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-2">Engine Settings</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-fg-secondary mb-1.5">X-Axis Timeframe Behavior</label>
                      <select 
                        name="lockTimeframe"
                        value={formData.lockTimeframe ? 'true' : 'false'}
                        onChange={(e) => setFormData({ ...formData, lockTimeframe: e.target.value === 'true' })}
                        className="w-full bg-surface border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm outline-none cursor-pointer"
                      >
                        <option value="false">Dynamic Auto-Fit (Zoom to actual data)</option>
                        <option value="true">Strict Locked Timeframe (Crop overflow)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-fg-secondary mb-1.5">Data Points Render Limit</label>
                      <input 
                        type="number" 
                        name="maxDataPoints"
                        value={formData.maxDataPoints}
                        onChange={handleChange}
                        className="w-full bg-surface border border-line-strong rounded-lg px-4 py-2.5 text-fg text-sm outline-none"
                        placeholder="e.g. 600"
                        min="100" max="5000"
                      />
                      <p className="text-xs text-fg-subtle mt-2 leading-relaxed">
                        Reduces browser memory usage by capping the number of SVG nodes drawn simultaneously. Default is 600.
                      </p>
                    </div>
                  </div>

                  <div className="border border-line bg-canvas rounded-xl p-4">
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={formData.yAxisLogScale}
                          onChange={(e) => setFormData({ ...formData, yAxisLogScale: e.target.checked })}
                          className="w-5 h-5 rounded border-line-stronger bg-surface text-blue-500 focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <span className="text-sm font-medium text-fg-secondary block">Logarithmic Scale (Y-Axis)</span>
                          <span className="text-xs text-fg-subtle">Best for displaying exponentially growing data or datasets with massive variance.</span>
                        </div>
                      </label>
                  </div>
                </>
              )}

            </div>
          </div>

            </div>
          </div>

          {/* Right Side: Preview */}
          <div className={`w-[360px] flex flex-col p-6 shrink-0 relative bg-canvas`}>
             <h4 className={`text-xs font-semibold uppercase tracking-widest mb-4 text-fg-subtle`}>Live Preview</h4>
             <div className="flex-1 flex items-center justify-center">
                <div 
                   className="w-full relative flex items-center justify-center"
                   style={{ 
                     aspectRatio: `${(widgetItem?.w || 4) * 100 + ((widgetItem?.w || 4) - 1) * 12} / ${(widgetItem?.h || 3) * 75 + ((widgetItem?.h || 3) - 1) * 12}`,
                     maxHeight: '350px'
                   }}
                >
                   {/* Wrapping in an absolute container ensures the inner widget treats this as its fixed boundary, perfectly mimicking the grid item */}
                   <div className="absolute inset-0 w-full h-full overflow-hidden rounded-xl">
                      {renderPreview()}
                   </div>
                </div>
             </div>
             
             <div className={`mt-auto text-[10px] italic text-center px-4 text-fg-faint`}>
               Note: The preview shows sample data to help you style the widget.
             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-surface p-5 border-t border-line flex justify-end gap-3 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.5)] z-10 shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 bg-transparent hover:bg-surface-2 text-fg-secondary rounded-lg text-sm font-medium transition-colors border border-line-strong"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
          >
            <Save size={16} /> Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
