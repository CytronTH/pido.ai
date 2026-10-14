import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center bg-canvas text-fg flex-col gap-4 p-8 animate-in fade-in duration-200">
        <div className="p-4 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-bold text-fg">Access Denied</h1>
        <p className="text-fg-muted text-center max-w-md">
          You do not have permission to view this page. This section requires <span className="font-semibold text-fg">{allowedRoles.join(', ')}</span> privileges.
        </p>
        <button 
          onClick={() => window.history.back()}
          className="mt-2 px-6 py-2.5 bg-surface-2 border border-line-strong hover:bg-surface-3 rounded-xl transition-all shadow-sm active:scale-95 font-medium text-fg"
        >
          Go Back
        </button>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
