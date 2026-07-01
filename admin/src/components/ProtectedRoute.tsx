import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../lib/auth';

interface Props {
  children: ReactNode;
  roles?: string[];
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_DINAS', 'OPERATOR_KECAMATAN', 'OPERATOR_DESA', 'LEADER'];

export function ProtectedRoute({ children, roles = ADMIN_ROLES }: Props) {
  const loc = useLocation();
  const { accessToken, user } = useAuth();

  if (!accessToken || !user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (roles.length && !roles.includes(user.role)) {
    return (
      <div className="p-8">
        <div className="card p-6 max-w-md">
          <h1 className="text-lg font-semibold">Akses ditolak</h1>
          <p className="text-sm text-slate-600 mt-1">
            Role Anda (<b>{user.role}</b>) tidak diizinkan mengakses admin dashboard.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
