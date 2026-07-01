import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, PaginationMeta } from '../lib/api';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/format';

interface AppRow {
  id: string;
  status: string;
  appliedAt: string;
  job?: { title: string };
  jobSeeker?: { fullName: string };
}

export default function ApplicationsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['applications', page, status],
    queryFn: async () => {
      const res = await api.get('/applications', { params: { page, limit: 20, status: status || undefined } });
      return {
        data: (res.data?.data ?? []) as AppRow[],
        meta: res.data?.meta as PaginationMeta | undefined,
      };
    },
    placeholderData: (prev) => prev,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Lamaran</h1>

      <div className="mb-3">
        <label className="text-sm mr-2">Status:</label>
        <select
          className="input inline-block w-auto"
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
        >
          <option value="">Semua</option>
          <option value="APPLIED">Applied</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="INTERVIEW">Interview</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Lowongan</th>
              <th className="px-4 py-2 font-medium">Pelamar</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Melamar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.data?.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">{a.job?.title ?? '-'}</td>
                <td className="px-4 py-2">{a.jobSeeker?.fullName ?? '-'}</td>
                <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-2 text-slate-500">{formatDate(a.appliedAt)}</td>
              </tr>
            ))}
            {isFetching && !data && (
              <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-500">Memuat...</td></tr>
            )}
            {!isFetching && !data?.data?.length && (
              <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-500">Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination meta={data?.meta} onChange={setPage} />
    </div>
  );
}
