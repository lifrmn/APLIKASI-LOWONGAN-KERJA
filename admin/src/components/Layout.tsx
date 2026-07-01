import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  FileText,
  ScrollText,
  LogOut,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../lib/auth';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/companies', label: 'Perusahaan', icon: Building2 },
  { to: '/jobs', label: 'Lowongan', icon: Briefcase },
  { to: '/applications', label: 'Lamaran', icon: FileText },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
];

export function Layout() {
  const nav = useNavigate();
  const { user, clear } = useAuth();

  function logout() {
    clear();
    nav('/login', { replace: true });
  }

  return (
    <div className="min-h-full grid grid-cols-[16rem_1fr]">
      {/* Sidebar */}
      <aside className="bg-brand-800 text-brand-50 flex flex-col">
        <div className="px-5 py-5 border-b border-brand-700">
          <div className="text-lg font-semibold">Sulbar Kerja</div>
          <div className="text-xs text-brand-200">Admin Dashboard</div>
        </div>

        <nav className="flex-1 py-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-5 py-2.5 text-sm border-l-4',
                  isActive
                    ? 'bg-brand-700 border-white text-white'
                    : 'border-transparent hover:bg-brand-700/60',
                )
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-brand-700 text-sm">
          <div className="mb-2">
            <div className="font-medium truncate">{user?.fullName ?? '-'}</div>
            <div className="text-xs text-brand-200 truncate">{user?.email}</div>
            <div className="text-[10px] uppercase tracking-wide text-brand-300 mt-1">
              {user?.role}
            </div>
          </div>
          <button onClick={logout} className="btn-outline w-full !text-slate-800">
            <LogOut size={16} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
