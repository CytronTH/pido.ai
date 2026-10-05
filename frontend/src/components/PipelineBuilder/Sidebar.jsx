import React from 'react';
import { 
  Camera, BrainCircuit, Filter, Timer, Code, Hash, ArrowRightLeft, Target, 
  Activity, Database, BookOpen, Image, Video, Type, LineChart, List, Bell, 
  ToggleLeft, ToggleRight, BellRing, Lightbulb, Settings2, Bug, Terminal, 
  Info, X 
} from 'lucide-react';

export const NODE_CATEGORIES = [
  {
    title: 'Vision & AI',
    badgeColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    items: [
      { type: 'inputNode', label: 'Input Source', desc: 'Camera or video source', icon: Camera, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
      { type: 'aiNode', label: 'AI Model', desc: 'Hailo-8 NPU inference', icon: BrainCircuit, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
      { type: 'snapshotNode', label: 'Snapshot', desc: 'Capture image frame', icon: Image, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' },
    ]
  },
  {
    title: 'Analytics & Logic',
    badgeColor: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    items: [
      { type: 'logicNode', label: 'Logic Filter', desc: 'Filter & equation rules', icon: Filter, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
      { type: 'flowCounterNode', label: 'Flow Counter', desc: 'Line & zone object counter', icon: ArrowRightLeft, color: 'text-teal-500 bg-teal-500/10 border-teal-500/20' },
      { type: 'counterNode', label: 'Event Counter', desc: 'Signal edge counter', icon: Hash, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
      { type: 'targetTrackerNode', label: 'Target Tracker', desc: 'Production target & ETA', icon: Target, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
      { type: 'unitThroughputNode', label: 'Unit Throughput', desc: 'Rate per minute tracking', icon: Activity, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
      { type: 'functionNode', label: 'Function', desc: 'Python transformation script', icon: Code, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
      { type: 'rateLimitNode', label: 'Rate Limit', desc: 'Throttle event rate', icon: Timer, color: 'text-teal-500 bg-teal-500/10 border-teal-500/20' },
    ]
  },
  {
    title: 'Storage & Integration',
    badgeColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    items: [
      { type: 'databaseWriterNode', label: 'Database Writer', desc: 'Save values to database', icon: Database, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
      { type: 'collectionWriterNode', label: 'Collection Writer', desc: 'Save to collections', icon: BookOpen, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
      { type: 'actionNode', label: 'Action / Alert', desc: 'Notification & webhook', icon: Bell, color: 'text-green-500 bg-green-500/10 border-green-500/20' },
    ]
  },
  {
    title: 'Hardware & I/O',
    badgeColor: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
    items: [
      { type: 'digitalInputNode', label: 'Digital Input', desc: 'Isolated DI (Max 50V)', icon: ToggleLeft, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' },
      { type: 'digitalOutputNode', label: 'Digital Output', desc: 'Isolated DO (Max 50V)', icon: ToggleRight, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
      { type: 'buzzerNode', label: 'Active Buzzer', desc: 'GPIO19 Onboard alert', icon: BellRing, color: 'text-red-500 bg-red-500/10 border-red-500/20' },
      { type: 'ledNode', label: 'LED Driver', desc: 'PWM Output (Max 2A)', icon: Lightbulb, color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' },
      { type: 'rs485Node', label: 'RS485 Modbus', desc: 'Serial industrial comms', icon: Settings2, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
    ]
  },
  {
    title: 'Dashboard Outputs',
    badgeColor: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
    items: [
      { type: 'dashboardVideoNode', label: 'Video Stream', desc: 'Live video to dashboard', icon: Video, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' },
      { type: 'dashboardMetricNode', label: 'Number / Metric', desc: 'Numeric metric display', icon: Hash, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' },
      { type: 'dashboardTextNode', label: 'Text Value', desc: 'Status text display', icon: Type, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' },
      { type: 'dashboardChartNode', label: 'Chart', desc: 'Time-series chart output', icon: LineChart, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
      { type: 'dashboardLogNode', label: 'Dashboard Log', desc: 'Historical feed output', icon: List, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
    ]
  },
  {
    title: 'Diagnostics & Debug',
    badgeColor: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    items: [
      { type: 'debugNode', label: 'Debug node', desc: 'Probe payload packets', icon: Bug, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
      { type: 'debugOutputNode', label: 'Debug Output', desc: 'Live JSON terminal window', icon: Terminal, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    ]
  }
];

export default function Sidebar({ onOpenWiki, onAddNode, onCloseMobile }) {

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('text/plain', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleInfoClick = (e, nodeType) => {
    e.stopPropagation();
    if (onOpenWiki) onOpenWiki(nodeType);
  };

  const handleNodeClick = (nodeType) => {
    if (onAddNode) onAddNode(nodeType);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <aside className="w-full md:w-64 bg-surface border-l border-line p-4 flex flex-col gap-3 overflow-y-auto h-full">
      {/* Mobile Drawer Header */}
      {onCloseMobile && (
        <div className="flex items-center justify-between pb-3 border-b border-line md:hidden">
          <span className="font-semibold text-sm text-fg">Tap to Add Node</span>
          <button 
            onClick={onCloseMobile} 
            className="p-1.5 rounded-lg bg-surface-2 text-fg-muted hover:text-fg border border-line-strong active:scale-95"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <button 
        onClick={() => onOpenWiki && onOpenWiki(null)}
        className="flex items-center gap-2 mb-1 p-2.5 sm:p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-lg text-blue-800 dark:text-blue-100 font-medium text-xs sm:text-sm transition-all shadow-sm active:scale-95 shrink-0"
      >
        <BookOpen size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="truncate">📖 เปิดดู Node Wiki (หน้าหลัก)</span>
      </button>

      {NODE_CATEGORIES.map(category => (
        <div key={category.title} className="flex flex-col gap-1.5">
          <div className="text-fg-muted font-semibold text-xs uppercase tracking-wider mt-2 mb-1 flex items-center justify-between">
            <span>{category.title}</span>
            <span className="text-[10px] text-fg-subtle font-normal">({category.items.length})</span>
          </div>
          {category.items.map(item => {
            const IconComponent = item.icon;
            return (
              <div 
                key={item.type}
                className="bg-surface-2 border border-line-strong/60 p-2 sm:p-2.5 rounded-xl cursor-pointer hover:bg-surface-3 hover:border-line-strong transition-all shadow-sm flex items-center justify-between group gap-2.5 select-none active:scale-[0.98]"
                onDragStart={(event) => onDragStart(event, item.type)}
                onClick={() => handleNodeClick(item.type)}
                draggable
                title="Click or tap to add, or drag to position"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`p-2 rounded-lg border shrink-0 ${item.color}`}>
                    <IconComponent size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-fg text-xs sm:text-sm font-semibold truncate group-hover:text-blue-500 transition-colors">
                      {item.label}
                    </div>
                    {item.desc && (
                      <div className="text-[10px] sm:text-[11px] text-fg-subtle truncate">
                        {item.desc}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="md:hidden text-[10px] text-fg-muted bg-surface-3 px-1.5 py-0.5 rounded border border-line-strong">Add</span>
                  <button 
                    onClick={(e) => handleInfoClick(e, item.type)} 
                    className="text-fg-muted hover:text-fg sm:opacity-0 sm:group-hover:opacity-100 transition-all p-1.5 hover:bg-surface rounded-lg shrink-0"
                    title="View Wiki Info"
                  >
                    <Info size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div className="mt-auto text-[11px] text-fg-subtle italic text-center p-3 border-t border-line/60 shrink-0">
        <span className="hidden md:inline">Drag or tap node to add to canvas.</span>
        <span className="md:hidden">Tap any node to add to canvas.</span>
      </div>
    </aside>
  );
}
