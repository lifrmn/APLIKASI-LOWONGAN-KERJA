import { FormEvent, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, unwrap } from '../lib/api';
import { AuthUser, useAuth } from '../lib/auth';

const ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN_DINAS',
  'OPERATOR_KECAMATAN',
  'OPERATOR_DESA',
  'LEADER',
]);

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const data = unwrap<{ accessToken: string; refreshToken: string; user: AuthUser }>(res.data);
      if (!ADMIN_ROLES.has(data.user.role)) {
        toast.error('Akun ini bukan akun admin.');
        setLoading(false);
        return;
      }
      setSession(data);
      toast.success('Login berhasil');
      nav(loc.state?.from ?? '/', { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Login gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full grid place-items-center bg-gradient-to-br from-brand-700 to-brand-900 p-6">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="text-xl font-semibold text-brand-700">Sulbar Kerja</div>
          <div className="text-sm text-slate-500">Admin Dashboard</div>
        </div>

        <label className="text-sm font-medium block mb-1">Email</label>
        <input
          type="email"
          className="input mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />

        <label className="text-sm font-medium block mb-1">Password</label>
        <input
          type="password"
          className="input mb-5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading} className="btn-primary w-full">
          <LogIn size={16} />
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
