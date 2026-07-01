import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api';
import { Users, Building2, Briefcase, FileText, Clock, CheckCircle2 } from 'lucide-react';

interface Summary {
  totalUsers: number;
  totalJobSeekers: number;
  totalCompanies: number;
  totalJobs: number;
  totalActiveJobs: number;
  totalApplications: number;
  totalAccepted: number;
  totalRejected: number;
  totalInterviews: number;
  verifiedCompanies: number;
  unverifiedCompanies: number;
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => unwrap<Summary>((await api.get('/dashboard/summary')).data),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-slate-500 mb-6">Ringkasan aktivitas Sulbar Kerja</p>

      {isLoading && <div className="text-slate-500">Memuat…</div>}
      {error && <div className="text-red-600">Gagal memuat dashboard</div>}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card icon={<Users />}     label="Total User"          value={data.totalUsers} />
          <Card icon={<Users />}     label="Pencari Kerja"       value={data.totalJobSeekers} />
          <Card icon={<Building2 />} label="Perusahaan Verified" value={data.verifiedCompanies} />
          <Card icon={<Clock />}     label="Perusahaan Pending"  value={data.unverifiedCompanies} />
          <Card icon={<Briefcase />} label="Lowongan Aktif"      value={data.totalActiveJobs} />
          <Card icon={<Briefcase />} label="Total Lowongan"      value={data.totalJobs} />
          <Card icon={<FileText />}  label="Total Lamaran"       value={data.totalApplications} />
          <Card icon={<CheckCircle2 />} label="Lamaran Diterima" value={data.totalAccepted} />
        </div>
      )}
    </div>
  );
}

function Card({ icon, label, value }: { icon: JSX.Element; label: string; value: number }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="p-2 rounded-md bg-brand-50 text-brand-600">{icon}</div>
      <div>
        <div className="text-xs uppercase text-slate-500">{label}</div>
        <div className="text-2xl font-semibold">{value.toLocaleString('id-ID')}</div>
      </div>
    </div>
  );
}
