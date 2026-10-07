import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Camera, BrainCircuit, Archive, ArrowUpCircle
} from 'lucide-react';
import SourceManager from './SourceManager';
import ModelManager from './ModelManager';
import UpdateManager from './UpdateManager';
import BackupManager from './BackupManager';

export default function Settings() {
  const location = useLocation();
  const [entities, setEntities] = useState({ cameras: [], models: [], integrations: [] });
  const [loading, setLoading] = useState(true);
  
  // 3 Primary Tabs: 'sources' (Source Manager), 'models' (Model Manager), 'backup_updater' (Backup & Updater)
  const [activeTab, setActiveTab] = useState(() => location.state?.tab || 'sources');

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state?.tab]);
  
  // Sub-tab for Backup & Updater: 'backups' | 'updates'
  const [backupUpdaterSubTab, setBackupUpdaterSubTab] = useState('backups');
  
  const [saving, setSaving] = useState(false);
  const [soFiles, setSoFiles] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeProjects, setActiveProjects] = useState({});

  useEffect(() => {
    fetchEntities();
    fetchSoFiles();
    fetchVideoDevices();
    fetchProjects();
    fetchProjectsStatus();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  };

  const fetchProjectsStatus = async () => {
    try {
      const res = await fetch('/api/projects/status');
      const data = await res.json();
      if (data && typeof data === 'object') setActiveProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects status', err);
    }
  };

  const fetchVideoDevices = async () => {
    try {
      const res = await fetch('/api/system/video-devices');
      const data = await res.json();
      if (data.status === 'success') setVideoDevices(data.devices || []);
    } catch (err) {
      console.error('Failed to fetch video devices', err);
    }
  };

  const fetchSoFiles = async () => {
    try {
      const res = await fetch('/api/so-files');
      const data = await res.json();
      if (data.status === 'success') setSoFiles(data.files || []);
    } catch (err) {
      console.error('Failed to fetch .so files', err);
    }
  };

  const fetchEntities = async () => {
    try {
      const res = await fetch('/api/entities');
      const data = await res.json();
      setEntities({
        cameras: data.cameras || [],
        models: data.models || [],
        integrations: data.integrations || []
      });
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch entities", err);
      setLoading(false);
    }
  };

  const saveEntities = async (newEntities) => {
    setSaving(true);
    try {
      await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntities)
      });
      setEntities(newEntities);
    } catch (err) {
      console.error("Failed to save entities", err);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-line p-8 flex items-center justify-center text-fg-muted gap-3">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading Global Settings...</span>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-line p-3 sm:p-6 flex flex-col h-full overflow-hidden">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-fg flex items-center gap-2">
            {activeTab === 'sources' && 'Source Manager'}
            {activeTab === 'models' && 'AI Model Manager'}
            {activeTab === 'backup_updater' && 'Backup & Updater'}
          </h2>
          <p className="text-xs text-fg-muted mt-0.5">
            {activeTab === 'sources' && 'Unified camera feeds, RTSP CCTV streams, and demo video files'}
            {activeTab === 'models' && 'Hailo-8L neural network models (.hef), task types, classes, and pipeline bindings'}
            {activeTab === 'backup_updater' && 'Complete system snapshots, project migration, and OTA platform updates'}
          </p>
        </div>
      </div>

      {/* ── 3 Main Navigation Tabs ── */}
      <div className="flex gap-2 border-b border-line mb-6 overflow-x-auto whitespace-nowrap pb-2 scrollbar-none shrink-0">
        {/* Tab 1: Source Manager */}
        <button 
          onClick={() => setActiveTab('sources')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold text-sm transition-all shrink-0 ${
            activeTab === 'sources' 
              ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/5 rounded-t-lg' 
              : 'border-transparent text-fg-muted hover:text-fg hover:bg-surface-2/60 rounded-t-lg'
          }`}
        >
          <Camera size={18} />
          <span>Source Manager</span>
          <span className="text-[11px] px-2 py-0.2 bg-surface-3 text-fg-secondary rounded-full font-mono">
            {entities.cameras.length}
          </span>
        </button>

        {/* Tab 2: Model Manager */}
        <button 
          onClick={() => setActiveTab('models')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold text-sm transition-all shrink-0 ${
            activeTab === 'models' 
              ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-500/5 rounded-t-lg' 
              : 'border-transparent text-fg-muted hover:text-fg hover:bg-surface-2/60 rounded-t-lg'
          }`}
        >
          <BrainCircuit size={18} />
          <span>Model Manager</span>
          <span className="text-[11px] px-2 py-0.2 bg-surface-3 text-fg-secondary rounded-full font-mono">
            {entities.models.length}
          </span>
        </button>

        {/* Tab 3: Backup & Updater */}
        <button 
          onClick={() => setActiveTab('backup_updater')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold text-sm transition-all shrink-0 ${
            activeTab === 'backup_updater' 
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5 rounded-t-lg' 
              : 'border-transparent text-fg-muted hover:text-fg hover:bg-surface-2/60 rounded-t-lg'
          }`}
        >
          <Archive size={18} />
          <span>Backup &amp; Updater</span>
        </button>
      </div>

      {/* ── Content Area ── */}
      <div className="flex-1 overflow-y-auto pr-1">
        
        {/* ── TAB 1: SOURCE MANAGER ── */}
        {activeTab === 'sources' && (
          <SourceManager
            sources={entities.cameras}
            onSaveEntities={(updatedCams) => saveEntities({ ...entities, cameras: updatedCams })}
            videoDevices={videoDevices}
            onRefreshEntities={fetchEntities}
          />
        )}

        {/* ── TAB 2: MODEL MANAGER ── */}
        {activeTab === 'models' && (
          <ModelManager
            models={entities.models}
            onSaveEntities={(updatedModels) => saveEntities({ ...entities, models: updatedModels })}
            soFiles={soFiles}
            onRefreshEntities={fetchEntities}
            projects={projects}
            activeProjects={activeProjects}
          />
        )}

        {/* ── TAB 3: BACKUP & UPDATER ── */}
        {activeTab === 'backup_updater' && (
          <div className="flex flex-col gap-4">
            {/* Sub-navigation Switcher between Backups and Updates */}
            <div className="flex items-center gap-2 p-1.5 bg-surface-2 rounded-xl border border-line max-w-md shrink-0">
              <button
                onClick={() => setBackupUpdaterSubTab('backups')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  backupUpdaterSubTab === 'backups'
                    ? 'bg-surface text-fg shadow-xs border border-line'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <Archive size={15} className="text-indigo-500" />
                Project Backups &amp; Migration
              </button>

              <button
                onClick={() => setBackupUpdaterSubTab('updates')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  backupUpdaterSubTab === 'updates'
                    ? 'bg-surface text-fg shadow-xs border border-line'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <ArrowUpCircle size={15} className="text-amber-500" />
                Platform &amp; System Updates
              </button>
            </div>

            {/* Active Sub-tab Content */}
            <div className="pt-2">
              {backupUpdaterSubTab === 'backups' ? (
                <BackupManager />
              ) : (
                <UpdateManager />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
