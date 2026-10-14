import useAuthStore from '../store/useAuthStore';

export const usePermissions = () => {
  const user = useAuthStore((state) => state.user);
  const role = user?.role || 'viewer';

  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';
  const isViewer = role === 'viewer';

  return {
    user,
    role,
    isAdmin,
    isEditor,
    isViewer,
    canEdit: isAdmin || isEditor,
    canDeploy: isAdmin || isEditor,
    canStartStop: isAdmin || isEditor,
    canManageProjects: isAdmin || isEditor,
    canShutdownSystem: isAdmin,
  };
};

export default usePermissions;
