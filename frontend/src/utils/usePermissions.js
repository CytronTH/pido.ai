import useAuthStore from '../store/useAuthStore';

export const usePermissions = () => {
  const user = useAuthStore((state) => state.user);
  const rawRole = user?.role || 'viewer';
  const role = rawRole === 'editor' ? 'engineer' : rawRole;

  const isAdmin = role === 'admin';
  const isEngineer = role === 'engineer';
  const isOperator = role === 'operator';
  const isViewer = role === 'viewer';

  // Allowed projects for Viewer (null means unrestricted access to all projects)
  const allowedProjects = isViewer
    ? (Array.isArray(user?.allowed_projects) ? user.allowed_projects : [])
    : null;

  const canAccessProject = (projectId) => {
    if (!projectId) return true;
    if (isAdmin || isEngineer || isOperator) return true;
    if (isViewer) {
      return Array.isArray(allowedProjects) && allowedProjects.includes(projectId);
    }
    return false;
  };

  return {
    user,
    role,
    isAdmin,
    isEngineer,
    isOperator,
    isViewer,
    allowedProjects,
    canAccessProject,

    // Pipeline Builder permissions (Viewer & Operator cannot view/edit/deploy pipeline)
    canViewPipeline: isAdmin || isEngineer,
    canEditPipeline: isAdmin || isEngineer,
    canDeploy: isAdmin || isEngineer,
    canEdit: isAdmin || isEngineer, // Backward compatibility

    // Live Dashboard permissions
    canViewDashboard: true,
    canInteractDashboard: isAdmin || isEngineer || isOperator, // Operator can Ack alerts & reset counters
    canEditDashboard: isAdmin || isEngineer, // Layout customization

    // Project & Runtime permissions
    canStartStop: isAdmin || isEngineer || isOperator,
    canManageProjects: isAdmin || isEngineer,
    canAssignViewers: isAdmin || isEngineer, // Admin & Engineer can manage Viewer project access

    // System Administration
    canManageUsers: isAdmin,
    canShutdownSystem: isAdmin,
  };
};

export default usePermissions;
