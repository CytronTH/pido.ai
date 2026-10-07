import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, Activity, Library, ScrollText } from 'lucide-react';
import ProjectVariableMonitor from './ProjectVariableMonitor';
import ProjectCollectionsPanel from './ProjectCollectionsPanel';
import LogsViewer from './LogsViewer';

const TABS = [
  { key: 'variables', label: 'Variables', icon: Activity, hint: 'Time-series values from 💾 Database Writer nodes', accent: 'indigo' },
  { key: 'collections', label: 'Collections', icon: Library, hint: 'Structured tables from 📚 Collection Writer nodes', accent: 'emerald' },
  { key: 'events', label: 'Event Logs', icon: ScrollText, hint: 'AI inference events, alerts and snapshots', accent: 'blue' },
];

const ACTIVE_CLS = {
  indigo: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 shadow-sm shadow-indigo-500/10',
  emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10',
  blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-sm shadow-blue-500/10',
};

/** Builds { nodeMap, nodes, edges, project } from the project's pipeline for node mapping and connection checks. */
function useProjectPipeline(projectId) {
  const [pipelineInfo, setPipelineInfo] = useState({ nodeMap: {}, nodes: [], edges: [], project: null });

  const fetchPipeline = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      const project = Array.isArray(data) ? data.find(p => p.id === projectId) : null;
      const mapping = {};
      const nodes = project?.pipeline?.nodes || [];
      const edges = project?.pipeline?.edges || [];
      nodes.forEach(n => {
        mapping[n.id] = { label: n.data?.label || n.data?.variableName || n.type, type: n.type };
      });
      setPipelineInfo({ nodeMap: mapping, nodes, edges, project });
    } catch (e) {
      console.error('Failed to fetch project pipeline info:', e);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  return { ...pipelineInfo, refreshPipeline: fetchPipeline };
}

export default function ProjectDatabase({ projectId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some(t => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'variables';
  const pipelineInfo = useProjectPipeline(projectId);
  const activeTab = TABS.find(t => t.key === tab);

  const selectTab = (key) => setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('tab', key); return p; }, { replace: true });

  return (
    <div className="h-full overflow-y-auto bg-canvas text-fg">
      <div className="p-3 sm:p-4 md:p-6 pb-0 sm:pb-0 md:pb-0 flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-blue-500/15 to-emerald-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-500 shadow-lg shadow-indigo-500/10 shrink-0">
              <Database size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Project Database</h1>
              <p className="text-[11px] sm:text-xs text-fg-muted mt-0.5">{activeTab.hint}</p>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-1.5 bg-surface/80 border border-line rounded-2xl p-1.5 overflow-x-auto" role="tablist">
            {TABS.map(({ key, label, icon: Icon, accent }) => {
              const active = key === tab;
              return (
                <button
                  key={key}
                  id={`db-tab-${key}`}
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border whitespace-nowrap transition-all active:scale-95 ${
                    active ? ACTIVE_CLS[accent] : 'border-transparent text-fg-muted hover:text-fg hover:bg-surface-2'
                  }`}
                >
                  <Icon size={15} /> {label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'variables' && (
        <div className="p-3 sm:p-4 md:p-6 animate-in fade-in duration-300">
          <ProjectVariableMonitor
            projectId={projectId}
            nodeMap={pipelineInfo.nodeMap}
            pipeline={pipelineInfo}
            onRefreshPipeline={pipelineInfo.refreshPipeline}
          />
        </div>
      )}
      {tab === 'collections' && (
        <div className="p-3 sm:p-4 md:p-6 animate-in fade-in duration-300">
          <ProjectCollectionsPanel projectId={projectId} />
        </div>
      )}
      {tab === 'events' && (
        <div className="animate-in fade-in duration-300">
          <LogsViewer projectId={projectId} embedded />
        </div>
      )}
    </div>
  );
}
