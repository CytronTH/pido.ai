import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/useAuthStore';
import usePermissions from '../../utils/usePermissions';
import authFetch from '../../utils/api';
import { 
  Users, Plus, Shield, Trash2, Key, X, RefreshCw, Check, 
  Eye, Wrench, HardHat, Crown, Info, Folder, CheckSquare, Square, AlertCircle
} from 'lucide-react';

const ROLE_INFO = {
  admin: {
    label: 'Admin',
    icon: Crown,
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    desc: 'Full system control: users, hardware, pipelines, and operating system.'
  },
  engineer: {
    label: 'Engineer',
    icon: Wrench,
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    desc: 'Pipeline builder, model tuning, live dashboards, and viewer project assignment.'
  },
  operator: {
    label: 'Operator',
    icon: HardHat,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    desc: 'Live dashboard monitoring, alert acknowledgment, counter reset, and engine run.'
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    desc: 'View-only access to selected project dashboards. Pipeline Builder is hidden.'
  }
};

const PERMISSION_MATRIX = [
  { feature: 'Pipeline Builder: View Nodes & Flow', admin: true, engineer: true, operator: false, viewer: false },
  { feature: 'Pipeline Builder: Edit Nodes & Settings', admin: true, engineer: true, operator: false, viewer: false },
  { feature: 'Pipeline Builder: Deploy to Hailo NPU', admin: true, engineer: true, operator: false, viewer: false },
  { feature: 'Pipeline Builder: Save/Restore Versions', admin: true, engineer: true, operator: false, viewer: false },
  { feature: 'Live Dashboard: View Streams & Charts', admin: true, engineer: true, operator: true, viewer: 'Allowed Projects Only' },
  { feature: 'Live Dashboard: Ack Alerts & Reset Counters', admin: true, engineer: true, operator: true, viewer: false },
  { feature: 'Live Dashboard: Customize Layout & Widgets', admin: true, engineer: true, operator: false, viewer: false },
  { feature: 'Project & Engine: Start / Stop AI Engine', admin: true, engineer: true, operator: true, viewer: false },
  { feature: 'Project & Engine: Create / Delete Projects', admin: true, engineer: true, operator: false, viewer: false },
  { feature: 'Hardware & AI: Upload Models (.hef) & Cameras', admin: true, engineer: true, operator: false, viewer: false },
  { feature: 'User Management: Manage Viewer Project Access', admin: true, engineer: true, operator: false, viewer: false },
  { feature: 'Administration: Manage Users & Roles', admin: true, engineer: false, operator: false, viewer: false },
  { feature: 'System Control: Reboot / Shutdown Host', admin: true, engineer: false, operator: false, viewer: false },
];

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = useAuthStore(state => state.token);
  const currentUser = useAuthStore(state => state.user);
  const { isAdmin, isEngineer } = usePermissions();

  const [showInvite, setShowInvite] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [editingViewerProjects, setEditingViewerProjects] = useState(null); // user object currently editing projects for
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [inviteData, setInviteData] = useState({
    username: '',
    password: '',
    role: isEngineer && !isAdmin ? 'viewer' : 'engineer',
    allowed_projects: []
  });

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/users');
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await authFetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to fetch project list for user assignment', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchProjects();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        username: inviteData.username.trim(),
        password: inviteData.password,
        role: inviteData.role,
        allowed_projects: inviteData.role === 'viewer' ? inviteData.allowed_projects : []
      };

      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Failed to create user');
      }
      setShowInvite(false);
      setInviteData({
        username: '',
        password: '',
        role: isEngineer && !isAdmin ? 'viewer' : 'engineer',
        allowed_projects: []
      });
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (user) => {
    if (!confirm(`Are you sure you want to delete user '${user.username}'?`)) return;
    try {
      const res = await authFetch(`/api/users/${user.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Failed to delete user');
      }
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await authFetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Failed to update role');
      }
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveViewerProjects = async (userId, allowed_projects) => {
    setIsSaving(true);
    try {
      const res = await authFetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed_projects })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Failed to update viewer project access');
      }
      setEditingViewerProjects(null);
      await fetchUsers();
      setToastMessage('Project access updated successfully!');
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleInviteProject = (projectId) => {
    setInviteData(prev => {
      const cur = prev.allowed_projects || [];
      const updated = cur.includes(projectId)
        ? cur.filter(id => id !== projectId)
        : [...cur, projectId];
      return { ...prev, allowed_projects: updated };
    });
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 text-fg">
            <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            User Management & Access Control
          </h1>
          <p className="text-fg-muted mt-1 text-sm">
            {isAdmin 
              ? '👑 Administrator View: Manage team roles, security credentials, and platform privileges.'
              : '🛠️ Engineer View: Manage Viewer accounts and configure project dashboard access.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMatrix(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface border border-line text-fg text-sm font-medium rounded-xl transition-colors shadow-sm"
          >
            <Shield className="w-4 h-4 text-purple-500" />
            Permission Matrix
          </button>
          <button 
            onClick={() => {
              setInviteData({
                username: '',
                password: '',
                role: isEngineer && !isAdmin ? 'viewer' : 'viewer',
                allowed_projects: projects.map(p => p.id)
              });
              setShowInvite(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl transition-colors font-medium shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            {isAdmin ? 'Invite User' : 'Add Viewer'}
          </button>
        </div>
      </div>

      {/* Role Quick Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(ROLE_INFO).map(([key, info]) => {
          const Icon = info.icon;
          return (
            <div key={key} className="bg-surface/60 border border-line rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`p-1.5 rounded-lg border ${info.badgeClass}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="font-semibold text-sm text-fg">{info.label}</span>
              </div>
              <p className="text-xs text-fg-subtle leading-relaxed">{info.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="bg-surface/70 border border-line rounded-2xl overflow-hidden backdrop-blur-sm shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-fg-secondary">
            <thead className="bg-surface-2/60 text-fg-muted border-b border-line text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Dashboard Access</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-fg-subtle">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading users...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-red-500 font-medium">
                    {error}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-fg-subtle">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map(u => {
                  const roleKey = u.role === 'editor' ? 'engineer' : u.role;
                  const roleMeta = ROLE_INFO[roleKey] || ROLE_INFO.viewer;
                  const RoleIcon = roleMeta.icon;
                  const isViewerUser = roleKey === 'viewer';
                  const allowedList = Array.isArray(u.allowed_projects) ? u.allowed_projects : [];
                  const canEditThisUser = isAdmin || (isEngineer && isViewerUser);

                  return (
                    <tr key={u.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold uppercase text-white shadow-sm">
                            {u.username.charAt(0)}
                          </div>
                          <div>
                            <span className="font-medium text-fg block">{u.username}</span>
                            <span className="text-xs text-fg-subtle">
                              Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isAdmin && u.id !== currentUser?.id ? (
                          <select 
                            value={roleKey}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="bg-surface-2 border border-line rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus:border-blue-500 text-fg"
                          >
                            <option value="admin">👑 Admin</option>
                            <option value="engineer">🛠️ Engineer</option>
                            <option value="operator">👷 Operator</option>
                            <option value="viewer">👁️ Viewer</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${roleMeta.badgeClass}`}>
                            <RoleIcon className="w-3.5 h-3.5" />
                            {roleMeta.label}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isViewerUser ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-fg-muted font-medium">
                              {allowedList.length === 0 ? (
                                <span className="text-amber-500 flex items-center gap-1">
                                  <AlertCircle size={12} /> No projects assigned
                                </span>
                              ) : (
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  {allowedList.length} of {projects.length} projects
                                </span>
                              )}
                            </span>
                            {canEditThisUser && (
                              <button
                                onClick={() => setEditingViewerProjects(u)}
                                className="text-xs px-2 py-0.5 rounded bg-surface hover:bg-surface-2 border border-line text-fg transition-colors"
                              >
                                Edit Access
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-fg-subtle font-medium">
                            All Projects (Global Access)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${u.is_active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canEditThisUser && u.id !== currentUser?.id && (
                          <button 
                            onClick={() => handleDelete(u)} 
                            className="p-1.5 text-fg-subtle hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" 
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite/Add User Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-line rounded-2xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowInvite(false)} 
              className="absolute top-4 right-4 text-fg-muted hover:text-fg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold mb-1 text-fg flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-500" />
              {isAdmin ? 'Create New User' : 'Add New Viewer'}
            </h2>
            <p className="text-xs text-fg-muted mb-5">
              {isAdmin ? 'Configure credentials, system role, and access rights.' : 'Create a viewer account and choose which project dashboards they can see.'}
            </p>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <input 
                  type="text" 
                  value={inviteData.username}
                  onChange={e => setInviteData({ ...inviteData, username: e.target.value })}
                  className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-blue-500 text-sm" 
                  placeholder="e.g. operator_john"
                  required 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input 
                  type="password" 
                  value={inviteData.password}
                  onChange={e => setInviteData({ ...inviteData, password: e.target.value })}
                  className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-blue-500 text-sm" 
                  placeholder="••••••••"
                  required 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-1.5">
                  Assigned Role
                </label>
                {isAdmin ? (
                  <select 
                    value={inviteData.role}
                    onChange={e => setInviteData({ ...inviteData, role: e.target.value })}
                    className="w-full bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-fg focus:outline-none focus:border-blue-500 text-sm [&>option]:bg-surface"
                  >
                    <option value="viewer">👁️ Viewer — View selected project dashboards only</option>
                    <option value="operator">👷 Operator — Live Dashboard & counter control</option>
                    <option value="engineer">🛠️ Engineer — Pipeline builder & viewer manager</option>
                    <option value="admin">👑 Admin — Full system administration</option>
                  </select>
                ) : (
                  <div className="bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-sm text-fg flex items-center gap-2">
                    <Eye className="w-4 h-4 text-zinc-400" />
                    <span>Viewer (Engineers can create Viewer accounts)</span>
                  </div>
                )}
              </div>

              {/* Viewer Project Whitelist */}
              {inviteData.role === 'viewer' && (
                <div className="border border-line rounded-xl p-4 bg-surface-2/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-fg block">
                        Accessible Project Dashboards
                      </span>
                      <span className="text-[11px] text-fg-subtle">
                        Viewer will ONLY see Live Dashboards for checked projects.
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setInviteData({ ...inviteData, allowed_projects: projects.map(p => p.id) })}
                        className="text-[11px] text-blue-500 hover:underline font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-fg-muted text-[11px]">|</span>
                      <button
                        type="button"
                        onClick={() => setInviteData({ ...inviteData, allowed_projects: [] })}
                        className="text-[11px] text-fg-subtle hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {projects.length === 0 ? (
                    <p className="text-xs text-fg-muted italic">No projects found in the system yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                      {projects.map(proj => {
                        const isChecked = (inviteData.allowed_projects || []).includes(proj.id);
                        return (
                          <label 
                            key={proj.id}
                            onClick={() => toggleInviteProject(proj.id)}
                            className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                              isChecked 
                                ? 'bg-blue-600/10 border-blue-500/40 text-fg' 
                                : 'bg-surface border-line text-fg-muted hover:border-fg/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-fg-subtle shrink-0" />
                              )}
                              <span className="font-medium text-fg">{proj.name || proj.id}</span>
                            </div>
                            <span className="text-[10px] text-fg-subtle font-mono">{proj.id}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors shadow-md shadow-blue-500/20 text-sm"
              >
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Viewer Project Access Modal */}
      {editingViewerProjects && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-line rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setEditingViewerProjects(null)} 
              className="absolute top-4 right-4 text-fg-muted hover:text-fg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold mb-1 text-fg flex items-center gap-2">
              <Folder className="w-5 h-5 text-blue-500" />
              Project Access: {editingViewerProjects.username}
            </h2>
            <p className="text-xs text-fg-muted mb-4">
              Select which project dashboards this viewer is allowed to access.
            </p>

            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-fg-secondary">
                Selected: {(editingViewerProjects.allowed_projects || []).length} / {projects.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingViewerProjects({
                    ...editingViewerProjects,
                    allowed_projects: projects.map(p => p.id)
                  })}
                  className="text-xs text-blue-500 hover:underline font-medium"
                >
                  Select All
                </button>
                <span className="text-fg-muted text-xs">|</span>
                <button
                  type="button"
                  onClick={() => setEditingViewerProjects({
                    ...editingViewerProjects,
                    allowed_projects: []
                  })}
                  className="text-xs text-fg-subtle hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-5">
              {projects.map(proj => {
                const isChecked = (editingViewerProjects.allowed_projects || []).includes(proj.id);
                return (
                  <div 
                    key={proj.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const cur = editingViewerProjects.allowed_projects || [];
                      const updated = cur.includes(proj.id)
                        ? cur.filter(id => id !== proj.id)
                        : [...cur, proj.id];
                      setEditingViewerProjects({ ...editingViewerProjects, allowed_projects: updated });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        const cur = editingViewerProjects.allowed_projects || [];
                        const updated = cur.includes(proj.id)
                          ? cur.filter(id => id !== proj.id)
                          : [...cur, proj.id];
                        setEditingViewerProjects({ ...editingViewerProjects, allowed_projects: updated });
                      }
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors text-xs select-none ${
                      isChecked 
                        ? 'bg-blue-600/10 border-blue-500/40 text-fg' 
                        : 'bg-surface-2/60 border-line text-fg-muted hover:border-fg/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-fg-subtle shrink-0" />
                      )}
                      <span className="font-medium text-fg">{proj.name || proj.id}</span>
                    </div>
                    <span className="text-[10px] text-fg-subtle font-mono">{proj.id}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setEditingViewerProjects(null)}
                className="flex-1 py-2 rounded-xl border border-line text-sm font-medium hover:bg-surface-2 transition-colors text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveViewerProjects(editingViewerProjects.id, editingViewerProjects.allowed_projects || [])}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Access</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Matrix Modal */}
      {showMatrix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-line rounded-2xl p-6 w-full max-w-4xl shadow-2xl relative max-h-[88vh] overflow-y-auto">
            <button 
              onClick={() => setShowMatrix(false)} 
              className="absolute top-4 right-4 text-fg-muted hover:text-fg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold mb-1 text-fg flex items-center gap-2">
              <Shield className="w-6 h-6 text-purple-500" />
              Platform Role & Permission Matrix
            </h2>
            <p className="text-xs text-fg-muted mb-6">
              Overview of capabilities and security privileges across all 4 system roles.
            </p>

            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 text-fg-muted border-b border-line">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Activity / Privilege</th>
                    <th className="px-4 py-3 font-semibold text-center text-purple-600 dark:text-purple-400">👑 Admin</th>
                    <th className="px-4 py-3 font-semibold text-center text-blue-600 dark:text-blue-400">🛠️ Engineer</th>
                    <th className="px-4 py-3 font-semibold text-center text-emerald-600 dark:text-emerald-400">👷 Operator</th>
                    <th className="px-4 py-3 font-semibold text-center text-zinc-500">👁️ Viewer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {PERMISSION_MATRIX.map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-2/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-fg">{row.feature}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-emerald-500 font-bold">✓</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.engineer === true ? (
                          <span className="text-emerald-500 font-bold">✓</span>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.operator === true ? (
                          <span className="text-emerald-500 font-bold">✓</span>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.viewer === true ? (
                          <span className="text-emerald-500 font-bold">✓</span>
                        ) : typeof row.viewer === 'string' ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            {row.viewer}
                          </span>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowMatrix(false)}
                className="px-5 py-2 bg-surface-2 hover:bg-surface border border-line text-fg text-xs font-semibold rounded-xl transition-colors"
              >
                Close Matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-3">
          <Check className="w-5 h-5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
